-- 5.2 Matriz de Permissões: "exclusão permanente de projetos" é permissão exclusiva de
-- Owner/Admin. A policy projects_isolation (0001) era FOR ALL para qualquer membro do
-- workspace, então DELETE também estava liberado pra Analyst/Creator e Viewer/Executive
-- via API direta — não havia UI para isso ainda, mas a RLS (camada de defesa em
-- profundidade) já deveria restringir. Substitui por policies por comando: SELECT/INSERT/
-- UPDATE continuam abertos a qualquer membro (a escrita real já é limitada por
-- podeEscrever() na Server Action — Viewer nunca chega a inserir/atualizar), DELETE fica
-- restrito a is_workspace_admin (mesma função de 0009, usada em workspace_members).

drop policy projects_isolation on projects;

create policy projects_select on projects
  for select using (is_workspace_member(workspace_id));

create policy projects_insert on projects
  for insert with check (is_workspace_member(workspace_id));

create policy projects_update on projects
  for update using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

create policy projects_delete_admin_only on projects
  for delete using (is_workspace_admin(workspace_id));
