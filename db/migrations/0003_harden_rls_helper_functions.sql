-- Fecha os advisories de segurança do linter Supabase para as funções usadas nas policies de RLS:
-- 1) search_path fixo (evita sequestro de search_path por objetos criados em outros schemas);
-- 2) remove a possibilidade do client anônimo chamar essas funções diretamente via
--    /rest/v1/rpc/... — elas existem só para uso interno das policies para usuários autenticados.

alter function is_workspace_member(uuid) set search_path = public;
alter function project_workspace_id(uuid) set search_path = public;

revoke execute on function is_workspace_member(uuid) from public;
revoke execute on function project_workspace_id(uuid) from public;
revoke execute on function is_workspace_member(uuid) from anon;
revoke execute on function project_workspace_id(uuid) from anon;

grant execute on function is_workspace_member(uuid) to authenticated;
grant execute on function project_workspace_id(uuid) to authenticated;
