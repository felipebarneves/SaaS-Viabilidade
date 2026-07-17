-- 5.2 Matriz de Permissões — completa o RBAC: convite/remoção de membros restrito a
-- Owner/Admin (hoje qualquer membro existente conseguia inserir/remover linhas em
-- workspace_members via API direta, já que a policy antiga era FOR ALL sem checar role).

-- RPC para resolver e-mail -> user id sem expor auth.users inteiro ao client.
-- Necessário porque o convite funciona por e-mail, mas só sabemos o user_id de quem
-- já criou conta (MVP não manda e-mail de convite/signup automático).
create function find_user_id_by_email(p_email text) returns uuid
  language sql security definer stable set search_path = public as $$
    select id from auth.users where email = p_email;
  $$;

revoke execute on function find_user_id_by_email(text) from public;
revoke execute on function find_user_id_by_email(text) from anon;
grant execute on function find_user_id_by_email(text) to authenticated;

create function is_workspace_admin(p_workspace_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from workspace_members
      where workspace_id = p_workspace_id and user_id = (select auth.uid()) and role = 'OWNER_ADMIN'
    );
  $$;

revoke execute on function is_workspace_admin(uuid) from public;
revoke execute on function is_workspace_admin(uuid) from anon;
grant execute on function is_workspace_admin(uuid) to authenticated;

-- Substitui a policy FOR ALL antiga por policies por comando: SELECT continua aberto
-- a qualquer membro (precisa ver a lista), mas INSERT/UPDATE/DELETE (convidar, mudar
-- role, remover) fica restrito a Owner/Admin. O bootstrap do primeiro membro continua
-- funcionando via workspace_members_insert_bootstrap (migration 0008), que roda em
-- paralelo (OR) com esta.
drop policy if exists workspace_members_own_workspace on workspace_members;

create policy workspace_members_select on workspace_members
  for select using (is_workspace_member(workspace_id));

create policy workspace_members_admin_insert on workspace_members
  for insert with check (is_workspace_admin(workspace_id));

create policy workspace_members_admin_update on workspace_members
  for update using (is_workspace_admin(workspace_id)) with check (is_workspace_admin(workspace_id));

create policy workspace_members_admin_delete on workspace_members
  for delete using (is_workspace_admin(workspace_id));

-- Trava de segurança: nunca deixar um workspace sem nenhum OWNER_ADMIN (nem por DELETE
-- nem por UPDATE de role rebaixando o último admin) — evita workspace órfão sem ninguém
-- capaz de gerenciar membros/faturamento.
create function prevent_orphan_workspace() returns trigger
  language plpgsql set search_path = public as $$
  declare
    v_outros_admins int;
  begin
    if (TG_OP = 'DELETE' and OLD.role <> 'OWNER_ADMIN')
       or (TG_OP = 'UPDATE' and NEW.role = 'OWNER_ADMIN') then
      return coalesce(NEW, OLD);
    end if;

    select count(*) into v_outros_admins
      from workspace_members
      where workspace_id = OLD.workspace_id
        and role = 'OWNER_ADMIN'
        and user_id <> OLD.user_id;

    if v_outros_admins = 0 then
      raise exception 'Não é possível remover/rebaixar o último Owner/Admin do workspace.';
    end if;

    return coalesce(NEW, OLD);
  end;
  $$;

create trigger workspace_members_prevent_orphan
  before update or delete on workspace_members
  for each row execute function prevent_orphan_workspace();
