"use server";

// Server Actions do Módulo 1 (Cadastro) e Módulo 2 (Cronograma). Toda escrita passa
// primeiro pela checagem de RBAC (5.2) e depois pela RLS do banco como segunda camada.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterRoleNoWorkspace, podeEscrever, podeExcluirProjeto } from "@/lib/auth/rbac";
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

  if (regime === "LUCRO_PRESUMIDO" && !percentualPresuncaoRaw) {
    throw new Error("Regime Lucro Presumido exige o Percentual de Presunção preenchido.");
  }
  if (regime === "SIMPLIFICADO_ALIQUOTA_UNICA" && !aliquotaEfetivaRaw) {
    throw new Error("Regime Simplificado (Alíquota Única) exige a Alíquota Efetiva IR+CSLL preenchida.");
  }

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

/** 5.2: exclusão permanente — restrita a Owner/Admin, checada aqui e reforçada pela RLS
 * (projects_delete_admin_only, migration 0012) como segunda camada. Cascata via ON DELETE
 * CASCADE remove todo o histórico de versões e lançamentos do projeto (RF-CORE-003). */
export async function excluirProjeto(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));

  const supabase = await createClient();
  const role = await obterRoleNoWorkspace(supabase, workspaceId);
  if (!podeExcluirProjeto(role)) {
    throw new Error("Apenas Owner/Admin pode excluir projetos permanentemente.");
  }

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;

  revalidatePath("/projetos");
  redirect(`/projetos?workspace=${workspaceId}`);
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

export async function adicionarDepreciacaoAmortizacao(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const { error } = await supabase.from("depreciation_amortization_entries").upsert(
    {
      project_id: projectId,
      mes_competencia: `${formData.get("mes_competencia")}-01`,
      depreciacao: Number(formData.get("depreciacao") || 0),
      amortizacao: Number(formData.get("amortizacao") || 0),
    },
    { onConflict: "project_id,mes_competencia" },
  );
  if (error) throw error;

  revalidatePath(`/projetos/${projectId}`);
}

export async function adicionarDespesaFinanceira(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const { error } = await supabase.from("financial_expense_entries").upsert(
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

/** RF-CORE-002: sobrescreve manualmente o Valor Unitário de um item numa competência específica. */
export async function sobrescreverItemMensal(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const scheduleItemId = String(formData.get("schedule_item_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado.");

  const { error: overrideError } = await supabase.from("schedule_item_overrides").upsert(
    {
      schedule_item_id: scheduleItemId,
      mes_competencia: `${formData.get("mes_competencia")}-01`,
      valor_unitario_override: Number(formData.get("valor_unitario_override")),
      created_by: userData.user.id,
    },
    { onConflict: "schedule_item_id,mes_competencia" },
  );
  if (overrideError) throw overrideError;

  const { error: flagError } = await supabase
    .from("schedule_items")
    .update({ editado_manualmente: true })
    .eq("id", scheduleItemId);
  if (flagError) throw flagError;

  revalidatePath(`/projetos/${projectId}`);
}

/** RF-CORE-002: restaura o item ao cálculo automático — remove os overrides mensais e a flag. */
export async function restaurarItemCronograma(formData: FormData) {
  const projectId = String(formData.get("project_id"));
  const workspaceId = String(formData.get("workspace_id"));
  const scheduleItemId = String(formData.get("schedule_item_id"));
  const supabase = await exigirPermissaoDeEscrita(workspaceId);

  const { error: deleteError } = await supabase
    .from("schedule_item_overrides")
    .delete()
    .eq("schedule_item_id", scheduleItemId);
  if (deleteError) throw deleteError;

  const { error: flagError } = await supabase
    .from("schedule_items")
    .update({ editado_manualmente: false })
    .eq("id", scheduleItemId);
  if (flagError) throw flagError;

  revalidatePath(`/projetos/${projectId}`);
}
