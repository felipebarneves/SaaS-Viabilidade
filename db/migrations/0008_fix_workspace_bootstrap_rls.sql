-- Corrige um bug real encontrado em teste manual: RLS bloqueava a própria criação
-- do primeiro Workspace (erro 42501 "new row violates row-level security policy").
--
-- Causa: `workspace_members_isolation` (workspaces) e `workspace_members_own_workspace`
-- (workspace_members) só usam USING/WITH CHECK = is_workspace_member(...). No momento do
-- INSERT do workspace, ainda não existe nenhuma linha em workspace_members para ele —
-- então is_workspace_member() sempre retorna false e a policy bloqueia o próprio bootstrap.
-- O mesmo problema se repete ao inserir a primeira linha (o próprio criador) em
-- workspace_members.
--
-- Fix: duas policies de INSERT dedicadas, permissivas, somadas (OR) às existentes:
--   - workspaces: qualquer usuário autenticado pode criar um novo workspace.
--   - workspace_members: um usuário pode se auto-inserir como OWNER_ADMIN apenas quando
--     o workspace ainda não tem nenhum membro (bootstrap do criador). Convites de novos
--     membros por um Owner/Admin existente já funcionam via a policy FOR ALL existente
--     (is_workspace_member(workspace_id) = true para quem já é membro).

create policy workspaces_insert_authenticated on workspaces
  for insert
  with check (auth.uid() is not null);

create policy workspace_members_insert_bootstrap on workspace_members
  for insert
  with check (
    user_id = auth.uid()
    and role = 'OWNER_ADMIN'
    and not exists (
      select 1 from workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
    )
  );
