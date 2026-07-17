-- Prumo Viabilidade — schema inicial (Supabase/Postgres)
-- Cobre: multi-tenancy (5.1), RBAC (5.2), inputs de projeto (2.2), regras de cálculo (2.3/2.4),
-- histórico de versões imutável (RF-CORE-003) e resolução hierárquica de parâmetros (RF-CORE-005).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 5.1 Multi-tenancy
-- ---------------------------------------------------------------------------

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

create type workspace_role as enum ('OWNER_ADMIN', 'ANALYST_CREATOR', 'VIEWER_EXECUTIVE');

create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 2.2 Enums de negócio
-- ---------------------------------------------------------------------------

create type regime_tributario as enum ('LUCRO_PRESUMIDO', 'LUCRO_REAL', 'SIMPLIFICADO_ALIQUOTA_UNICA');
create type classificacao_custo as enum ('FIXO', 'VARIAVEL');
create type indice_reajuste as enum ('IPCA', 'INCC_M', 'IGP_M', 'OUTRO');
create type periodicidade_reajuste as enum ('ANUAL', 'ANIVERSARIO_CONTRATO');
create type tipo_item_cronograma as enum ('RECEITA', 'CUSTO', 'DESPESA_OPERACIONAL');
create type status_versao as enum ('RASCUNHO', 'APROVADO');

-- ---------------------------------------------------------------------------
-- RF-CORE-005 Resolução hierárquica de parâmetros (Projeto > Workspace > Sistema)
-- ---------------------------------------------------------------------------

create table system_parameters (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('SISTEMA', 'WORKSPACE')),
  workspace_id uuid references workspaces(id) on delete cascade,
  chave text not null,
  valor numeric not null,
  updated_at timestamptz not null default now(),
  constraint escopo_workspace_coerente check (
    (escopo = 'SISTEMA' and workspace_id is null) or
    (escopo = 'WORKSPACE' and workspace_id is not null)
  ),
  unique (escopo, workspace_id, chave)
);

comment on table system_parameters is
  'Parâmetros configuráveis nunca hardcoded no engine: taxa_desconto_padrao_global, '
  'limite_mensal_adicional_irpj, aliquota_irpj_base, aliquota_irpj_adicional, aliquota_csll.';

-- ---------------------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  nome text not null,
  duracao_meses integer not null check (duracao_meses > 0),

  -- Financeiro (2.2)
  taxa_desconto_projeto numeric, -- anual, fração 0-1; nulo => fallback para workspace (RF-CORE-005)
  considerar_custo_financeiro boolean not null default false,
  regime_tributario regime_tributario not null,
  percentual_presuncao numeric, -- obrigatório se regime = LUCRO_PRESUMIDO
  aliquota_efetiva_ir_csll numeric, -- obrigatório se regime = SIMPLIFICADO_ALIQUOTA_UNICA

  -- Contrato / Reajuste (2.2)
  aplica_reajuste_contratual boolean not null default false,
  indice_reajuste indice_reajuste,
  indice_reajuste_outro_nome text,
  periodicidade_reajuste periodicidade_reajuste,
  mes_base_reajuste smallint check (mes_base_reajuste between 1 and 12),

  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint presuncao_obrigatoria_se_regime check (
    regime_tributario <> 'LUCRO_PRESUMIDO' or percentual_presuncao is not null
  ),
  constraint aliquota_efetiva_obrigatoria_se_regime check (
    regime_tributario <> 'SIMPLIFICADO_ALIQUOTA_UNICA' or aliquota_efetiva_ir_csll is not null
  ),
  constraint reajuste_campos_obrigatorios check (
    not aplica_reajuste_contratual or (
      indice_reajuste is not null and periodicidade_reajuste is not null and mes_base_reajuste is not null
    )
  )
);

-- Itens de cronograma físico-financeiro (receita/custo/despesa) — Regra 1
create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  tipo tipo_item_cronograma not null,
  classificacao_custo classificacao_custo, -- obrigatório se tipo in (CUSTO, DESPESA_OPERACIONAL)
  data_inicio date not null,
  duracao_meses integer not null check (duracao_meses > 0),
  quantidade numeric not null,
  valor_unitario numeric not null,
  aliquota_impostos numeric not null default 0, -- fração 0-1, só se aplica a RECEITA
  editado_manualmente boolean not null default false, -- RF-CORE-002
  created_at timestamptz not null default now(),

  constraint classificacao_obrigatoria_para_custo check (
    tipo = 'RECEITA' or classificacao_custo is not null
  )
);

-- Capex — cronograma próprio, independente do rateio por duração (Regra 1)
create table capex_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  valor numeric not null,
  mes_competencia date not null, -- truncado ao primeiro dia do mês
  created_at timestamptz not null default now()
);

-- Variação de Capital de Giro — input direto mês a mês (Regra 1)
create table working_capital_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  mes_competencia date not null,
  valor numeric not null,
  created_at timestamptz not null default now(),
  unique (project_id, mes_competencia)
);

-- Percentual do índice de reajuste por competência — input manual no MVP (2.4, nota ⚠️)
create table contract_adjustment_competencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  mes_competencia date not null,
  percentual_indice numeric not null,
  created_at timestamptz not null default now(),
  unique (project_id, mes_competencia)
);

-- Depreciação/Amortização mensal
create table depreciation_amortization_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  mes_competencia date not null,
  depreciacao numeric not null default 0,
  amortizacao numeric not null default 0,
  unique (project_id, mes_competencia)
);

-- Despesas financeiras mensais — usadas apenas se considerar_custo_financeiro = true
create table financial_expense_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  mes_competencia date not null,
  valor numeric not null,
  unique (project_id, mes_competencia)
);

-- ---------------------------------------------------------------------------
-- RF-CORE-003 Histórico de versões (imutável) + RF-CORE-004 Comparativo
-- ---------------------------------------------------------------------------

create table project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  nome text not null,
  status status_versao not null default 'RASCUNHO',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  snapshot jsonb not null -- todos os parâmetros de entrada + indicadores calculados na data do salvamento
);

-- Impede update/delete de versões salvas — apenas inserts de novas versões (RF-CORE-003).
create rule project_versions_no_update as on update to project_versions do instead nothing;
create rule project_versions_no_delete as on delete to project_versions do instead nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security — isolamento estrito por Workspace (5.1)
-- ---------------------------------------------------------------------------

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table system_parameters enable row level security;
alter table projects enable row level security;
alter table schedule_items enable row level security;
alter table capex_items enable row level security;
alter table working_capital_entries enable row level security;
alter table contract_adjustment_competencies enable row level security;
alter table depreciation_amortization_entries enable row level security;
alter table financial_expense_entries enable row level security;
alter table project_versions enable row level security;

create function is_workspace_member(p_workspace_id uuid) returns boolean
  language sql security definer stable as $$
    select exists (
      select 1 from workspace_members
      where workspace_id = p_workspace_id and user_id = auth.uid()
    );
  $$;

create function project_workspace_id(p_project_id uuid) returns uuid
  language sql security definer stable as $$
    select workspace_id from projects where id = p_project_id;
  $$;

create policy workspace_members_isolation on workspaces
  for all using (is_workspace_member(id));

create policy workspace_members_own_workspace on workspace_members
  for all using (is_workspace_member(workspace_id));

create policy system_parameters_isolation on system_parameters
  for all using (escopo = 'SISTEMA' or is_workspace_member(workspace_id));

create policy projects_isolation on projects
  for all using (is_workspace_member(workspace_id));

create policy schedule_items_isolation on schedule_items
  for all using (is_workspace_member(project_workspace_id(project_id)));

create policy capex_items_isolation on capex_items
  for all using (is_workspace_member(project_workspace_id(project_id)));

create policy working_capital_entries_isolation on working_capital_entries
  for all using (is_workspace_member(project_workspace_id(project_id)));

create policy contract_adjustment_competencies_isolation on contract_adjustment_competencies
  for all using (is_workspace_member(project_workspace_id(project_id)));

create policy depreciation_amortization_entries_isolation on depreciation_amortization_entries
  for all using (is_workspace_member(project_workspace_id(project_id)));

create policy financial_expense_entries_isolation on financial_expense_entries
  for all using (is_workspace_member(project_workspace_id(project_id)));

create policy project_versions_isolation on project_versions
  for all using (is_workspace_member(project_workspace_id(project_id)));
