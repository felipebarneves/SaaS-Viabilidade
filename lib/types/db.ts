// Tipos espelhando as colunas de db/migrations/0001_init.sql — camada de dados, não de domínio.
// A conversão para os tipos de core/engine (ProjetoInput) acontece em lib/projects/mapper.ts.

import type {
  ClassificacaoCusto,
  IndiceReajuste,
  PeriodicidadeReajuste,
  RegimeTributario,
  TipoItem,
} from "@/core/engine";

export type WorkspaceRole = "OWNER_ADMIN" | "ANALYST_CREATOR" | "VIEWER_EXECUTIVE";
export type StatusVersao = "RASCUNHO" | "APROVADO";

export interface WorkspaceRow {
  id: string;
  nome: string;
  created_at: string;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
}

export interface SystemParameterRow {
  id: string;
  escopo: "SISTEMA" | "WORKSPACE";
  workspace_id: string | null;
  chave: string;
  valor: number;
}

export interface ProjectRow {
  id: string;
  workspace_id: string;
  nome: string;
  duracao_meses: number;
  taxa_desconto_projeto: number | null;
  considerar_custo_financeiro: boolean;
  regime_tributario: RegimeTributario;
  percentual_presuncao: number | null;
  aliquota_efetiva_ir_csll: number | null;
  aplica_reajuste_contratual: boolean;
  indice_reajuste: IndiceReajuste | null;
  indice_reajuste_outro_nome: string | null;
  periodicidade_reajuste: PeriodicidadeReajuste | null;
  mes_base_reajuste: number | null;
  created_by: string;
  created_at: string;
}

export interface ScheduleItemRow {
  id: string;
  project_id: string;
  tipo: TipoItem;
  classificacao_custo: ClassificacaoCusto | null;
  data_inicio: string;
  duracao_meses: number;
  quantidade: number;
  valor_unitario: number;
  aliquota_impostos: number;
  editado_manualmente: boolean;
}

export interface CapexItemRow {
  id: string;
  project_id: string;
  valor: number;
  mes_competencia: string; // date, truncado ao 1º dia do mês
}

export interface WorkingCapitalEntryRow {
  id: string;
  project_id: string;
  mes_competencia: string;
  valor: number;
}

export interface ContractAdjustmentCompetencyRow {
  id: string;
  project_id: string;
  mes_competencia: string;
  percentual_indice: number;
}

export interface DepreciationAmortizationEntryRow {
  id: string;
  project_id: string;
  mes_competencia: string;
  depreciacao: number;
  amortizacao: number;
}

export interface FinancialExpenseEntryRow {
  id: string;
  project_id: string;
  mes_competencia: string;
  valor: number;
}

export interface ScheduleItemOverrideRow {
  id: string;
  schedule_item_id: string;
  mes_competencia: string;
  valor_unitario_override: number;
  created_by: string;
  created_at: string;
}

export interface ProjectVersionRow {
  id: string;
  project_id: string;
  nome: string;
  status: StatusVersao;
  created_by: string;
  created_at: string;
  snapshot: unknown; // ver lib/projects/snapshot.ts para o shape tipado
}
