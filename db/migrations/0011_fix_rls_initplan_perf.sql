-- auth.uid() dentro de USING/WITH CHECK é reavaliado por linha se chamado direto;
-- envolver em (select ...) deixa o planner tratar como InitPlan (avaliado uma vez por
-- statement). Advisory de performance do Supabase apontou isso nas duas policies de
-- bootstrap criadas em 0008.

drop policy workspaces_insert_authenticated on workspaces;
create policy workspaces_insert_authenticated on workspaces
  for insert
  with check ((select auth.uid()) is not null);

drop policy workspace_members_insert_bootstrap on workspace_members;
create policy workspace_members_insert_bootstrap on workspace_members
  for insert
  with check (
    user_id = (select auth.uid())
    and role = 'OWNER_ADMIN'
    and not exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
    )
  );
