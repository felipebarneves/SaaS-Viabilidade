-- Teste de regressão manual para RF-CORE-003 (histórico de versões imutável).
-- Rodar via SQL Editor do Supabase (ou MCP execute_sql) apontando para o projeto
-- desejado. Requer pelo menos um usuário em auth.users — troque v_user_id abaixo.
-- Não deixa dados residuais quando passa; se falhar, o erro identifica o cenário.

do $$
declare
  v_user_id uuid := (select id from auth.users limit 1);
  v_workspace_id uuid;
  v_project_id uuid;
  v_version_id uuid;
  v_nome_antes text;
  v_nome_depois text;
  v_delete_bloqueado boolean := false;
begin
  if v_user_id is null then
    raise exception 'Nenhum usuário em auth.users — crie um usuário de teste antes de rodar este script.';
  end if;

  insert into workspaces (nome) values ('__teste_rf_core_003__') returning id into v_workspace_id;
  insert into workspace_members (workspace_id, user_id, role) values (v_workspace_id, v_user_id, 'OWNER_ADMIN');
  insert into projects (workspace_id, nome, duracao_meses, regime_tributario, aliquota_efetiva_ir_csll, created_by)
    values (v_workspace_id, '__teste__', 1, 'SIMPLIFICADO_ALIQUOTA_UNICA', 0.06, v_user_id)
    returning id into v_project_id;
  insert into project_versions (project_id, nome, created_by, snapshot)
    values (v_project_id, 'versao_original', v_user_id, '{"teste": true}'::jsonb)
    returning id into v_version_id;

  select nome into v_nome_antes from project_versions where id = v_version_id;

  -- 1) UPDATE direto deve ser silenciosamente ignorado (rule "do instead nothing")
  update project_versions set nome = 'versao_hackeada' where id = v_version_id;
  select nome into v_nome_depois from project_versions where id = v_version_id;
  if v_nome_antes <> v_nome_depois then
    raise exception 'FALHA 1: UPDATE sobrescreveu a versão';
  end if;
  raise notice 'OK 1: UPDATE direto foi ignorado, nome permanece "%"', v_nome_depois;

  -- 2) DELETE direto na versão deve ser BLOQUEADO com exceção (projeto ainda existe)
  begin
    delete from project_versions where id = v_version_id;
    v_delete_bloqueado := false;
  exception when others then
    v_delete_bloqueado := true;
    raise notice 'OK 2: DELETE direto foi bloqueado com exceção: %', sqlerrm;
  end;
  if not v_delete_bloqueado then
    raise exception 'FALHA 2: DELETE direto na versão foi permitido (RF-CORE-003 quebrado)';
  end if;

  -- 3) Apagar o PROJETO inteiro deve funcionar e cascatear a remoção da versão
  delete from projects where id = v_project_id;
  if exists (select 1 from project_versions where id = v_version_id) then
    raise exception 'FALHA 3: versão sobreviveu à exclusão em cascata do projeto';
  end if;
  raise notice 'OK 3: exclusão do projeto cascateou corretamente para project_versions';

  delete from workspace_members where workspace_id = v_workspace_id;
  delete from workspaces where id = v_workspace_id;

  raise notice 'RF-CORE-003: todos os cenários passaram';
end $$;
