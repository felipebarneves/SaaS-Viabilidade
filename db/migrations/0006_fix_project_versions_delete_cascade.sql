-- Corrige um bug real encontrado ao testar RF-CORE-003 ao vivo: a rule
-- "project_versions_no_delete ... do instead nothing" intercepta TODO delete,
-- inclusive os disparados pelo ON DELETE CASCADE de projects -> project_versions.
-- Isso quebra a checagem de integridade referencial do Postgres e torna
-- IMPOSSÍVEL apagar um projeto que tenha qualquer versão salva (erro XX000).
--
-- A regra de negócio real é: ninguém pode apagar uma versão diretamente
-- (overwrite de histórico), mas apagar o projeto inteiro (ação deliberada do
-- Owner/Admin) pode legitimamente cascatear a remoção de suas versões.
-- Um trigger BEFORE DELETE distingue os dois casos: no cascade disparado pela
-- FK, a linha em `projects` já foi removida na mesma transação antes do
-- cascade rodar; num delete direto em project_versions, o projeto ainda existe.

drop rule if exists project_versions_no_delete on project_versions;

create function prevent_direct_version_delete() returns trigger
  language plpgsql set search_path = public as $$
  begin
    if exists (select 1 from projects where id = old.project_id) then
      raise exception 'project_versions é imutável — não pode ser deletada diretamente (RF-CORE-003). Para remover o histórico, delete o projeto inteiro.';
    end if;
    return old;
  end;
  $$;

create trigger project_versions_prevent_direct_delete
  before delete on project_versions
  for each row execute function prevent_direct_version_delete();
