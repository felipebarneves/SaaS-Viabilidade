-- Índices para as FKs usadas diretamente pelas policies de RLS (is_workspace_member /
-- project_workspace_id filtram por estas colunas em toda leitura/escrita) — sem índice,
-- o advisor de performance do Supabase aponta full scan em tabelas que crescem por Workspace/Projeto.

create index if not exists idx_workspace_members_user_id on workspace_members(user_id);
create index if not exists idx_system_parameters_workspace_id on system_parameters(workspace_id);
create index if not exists idx_projects_workspace_id on projects(workspace_id);
create index if not exists idx_projects_created_by on projects(created_by);
create index if not exists idx_schedule_items_project_id on schedule_items(project_id);
create index if not exists idx_capex_items_project_id on capex_items(project_id);
create index if not exists idx_project_versions_project_id on project_versions(project_id);
create index if not exists idx_project_versions_created_by on project_versions(created_by);
