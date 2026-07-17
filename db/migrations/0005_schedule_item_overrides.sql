-- RF-CORE-002: sobrescrita manual de células geradas automaticamente pela engine, com restore.
-- Cada override é por item de cronograma + competência (mês), guardando o Valor Unitário
-- manual que substitui o valor calculado pelo rateio/reajuste automático (schedule.ts/reajuste.ts).
-- Restaurar = apagar a linha de override; o item volta a usar o cálculo automático naquele mês.

create table schedule_item_overrides (
  id uuid primary key default gen_random_uuid(),
  schedule_item_id uuid not null references schedule_items(id) on delete cascade,
  mes_competencia date not null, -- truncado ao primeiro dia do mês
  valor_unitario_override numeric not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (schedule_item_id, mes_competencia)
);

create index idx_schedule_item_overrides_item_id on schedule_item_overrides(schedule_item_id);
create index idx_schedule_item_overrides_created_by on schedule_item_overrides(created_by);

alter table schedule_item_overrides enable row level security;

create function schedule_item_workspace_id(p_schedule_item_id uuid) returns uuid
  language sql security definer stable set search_path = public as $$
    select project_workspace_id(project_id) from schedule_items where id = p_schedule_item_id;
  $$;

revoke execute on function schedule_item_workspace_id(uuid) from public;
revoke execute on function schedule_item_workspace_id(uuid) from anon;
grant execute on function schedule_item_workspace_id(uuid) to authenticated;

create policy schedule_item_overrides_isolation on schedule_item_overrides
  for all using (is_workspace_member(schedule_item_workspace_id(schedule_item_id)));
