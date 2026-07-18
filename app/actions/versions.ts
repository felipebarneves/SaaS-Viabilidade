"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterRoleNoWorkspace, podeEscrever } from "@/lib/auth/rbac";
import { carregarProjetoComRelacionamentos } from "@/lib/projects/repository";
import { montarProjetoInput } from "@/lib/projects/mapper";
import { carregarParametros, resolverParametrosFiscais, resolverTaxaDescontoPadraoGlobal } from "@/lib/params/resolve";
import { simular } from "@/core/engine";
import type { ProjectVersionSnapshot } from "@/lib/projects/snapshot";
import { validarProjetoParaSimulacao } from "@/lib/projects/validacao";

export async function salvarVersao(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const nomeVersao = String(formData.get("nome") ?? "").trim();
  if (!nomeVersao) throw new Error("Nome da versão é obrigatório.");

  const supabase = await createClient();
  const role = await obterRoleNoWorkspace(supabase, workspaceId);
  if (!podeEscrever(role)) throw new Error("Sem permissão de escrita neste workspace.");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado.");

  const dados = await carregarProjetoComRelacionamentos(supabase, projectId);
  if (!dados) throw new Error("Projeto não encontrado.");

  const parametros = await carregarParametros(supabase, workspaceId);
  const parametrosFiscais = resolverParametrosFiscais(parametros);
  const validacao = validarProjetoParaSimulacao(dados.project, parametrosFiscais);
  if (!validacao.podeSimular || !parametrosFiscais) {
    throw new Error(validacao.avisos.join(" "));
  }

  const input = montarProjetoInput(dados, resolverTaxaDescontoPadraoGlobal(parametros), parametrosFiscais);
  const resultado = simular(input);

  const snapshot: ProjectVersionSnapshot = {
    input,
    resultado,
    salvoEm: new Date().toISOString(),
  };

  const { error } = await supabase.from("project_versions").insert({
    project_id: projectId,
    nome: nomeVersao,
    status: "RASCUNHO",
    created_by: userData.user.id,
    snapshot,
  });
  if (error) throw error;

  revalidatePath(`/projetos/${projectId}`);
  revalidatePath(`/projetos/${projectId}/versoes`);
}
