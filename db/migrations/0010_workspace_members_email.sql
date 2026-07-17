-- Guarda o e-mail do membro na própria linha (denormalizado) para a UI listar membros
-- sem precisar de acesso a auth.users (não exposto via PostgREST por padrão, e não
-- queremos ampliar essa superfície). Preenchido pelo app no momento do convite/bootstrap.
alter table workspace_members add column email text;
