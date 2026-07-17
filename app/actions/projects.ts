"use server";

// Server Actions do Módulo 1 (Cadastro) e Módulo 2 (Cronograma). Toda escrita passa
// primeiro pela checagem de RBAC (5.2) e depois pela RLS do banco como segunda camada.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterRoleNoWorkspace, podeEscrever } from "@/lib/auth/rbac";
import type { RegimeTributario, ClassificacaoCusto, TipoItem } from "@/core/engine";

async function exigirPermissaoDeEscrita(workspaceId: string) {
  const supabase = await createClient();
  const role = await obterRoleNoWorkspace(supabase, workspaceId);
  if (!podeEscrever(role)) {
    throw new Error("Sem permissão de escrita neste workspace (perfil Viewer/Executive).");
  }
  return supabase;
}

export async function criarProjeto(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado.");

  const regime = String(formData.get("regime_tributario")) as RegimeTributario;
  const percentualPresuncaoRaw = formData.get("percentual_presuncao");
  const aliquotaEfetivaRaw = formData.get("aliquota_efetiva_ir_csll");

  const { data: projeto, error } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      nome: String(formData.get("nome")),
      duracao_meses: Number(formData.get("duracao_meses")),
      taxa_desconto_projeto: formData.get("taxa_desconto_projeto")
        ? Number(formData.get("taxa_desconto_projeto"))
        : null,
      considerar_custo_financeiro: formData.get("considerar_custo_financeiro") === "on",
      regime_tributario: regime,
      percentual_presuncao: percentualPresuncaoRaw ? Number(percentualPresuncaoRaw) : null,
      aliquota_efetiva_ir_csll: aliquotaEfetivaRaw ? Number(aliquotaEfetivaRaw) : null,
      aplica_reajuste_contratual: formData.get("aplica_reajuste_contratual") === "on",
      indice_reajuste: formData.get("indice_reajuste") || null,
      indice_reajuste_outro_nome: formData.get("indice_reajuste_outro_nome") || null,
      periodicidade_reajuste: formData.get("periodicidade_reajuste") || null,
      mes_base_reajuste: formData.get("mes_base_reajuste")
        ? Number(formData.get("mes_base_reajuste"))
        : null,
      created_by: userData.user.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/projetos");
  redirect(`/projetos/${projeto.id}`);
}

export async function adicionarItemCronograma(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const tipo = String(formData.get("tipo")) as TipoItem;
  const classificacaoCusto = formData.get("classificacao_custo") as ClassificacaoCusto | null;

  if (tipo !== "RECEITA" && !classificacaoCusto) {
    throw new Error("Classificação do Custo (Fixo/Variável) é obrigatória para Custo/Despesa.");
  }

  const { error } = await supabase.from("schedule_items").insert({
    project_id: projectId,
    tipo,
    classificacao_custo: tipo === "RECEITA" ? null : classificacaoCusto,
    data_inicio: String(formData.get("data_inicio")),
    duracao_meses: Number(formData.get("duracao_meses")),
    quantidade: Number(formData.get("quantidade")),
    valor_unitario: Number(formData.get("valor_unitario")),
    aliquota_impostos: tipo === "RECEITA" ? Number(formData.get("aliquota_impostos") || 0) : 0,
  });
  if (error) throw error;

  revalidatePath(`/projetos/${projectId}`);
}

export async function adicionarCapex(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const { error } = await supabase.from("capex_items").insert({
    project_id: projectId,
    valor: Number(formData.get("valor")),
    mes_competencia: `${formData.get("mes_competencia")}-01`,
  });
  if (error) throw error;

  revalidatePath(`/projetos/${projectId}`);
}

export async function adicionarCapitalGiro(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const { error } = await supabase.from("working_capital_entries").upsert(
    {
      project_id: projectId,
      mes_competencia: `${formData.get("mes_competencia")}-01`,
      valor: Number(formData.get("valor")),
    },
    { onConflict: "project_id,mes_competencia" },
  );
  if (error) throw error;

  revalidatePath(`/projetos/${projectId}`);
}

export async function adicionarCompetenciaReajuste(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const { error } = await supabase.from("contract_adjustment_competencies").upsert(
    {
      project_id: projectId,
      mes_competencia: `${formData.get("mes_competencia")}-01`,
      percentual_indice: Number(formData.get("percentual_indice")),
    },
    { onConflict: "project_id,mes_competencia" },
  );
  if (error) throw error;

  revalidatePath(`/projetos/${projectId}`);
}
