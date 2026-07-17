// RF-CORE-005: resolução hierárquica de parâmetros configuráveis (Workspace > Sistema).
// Se todos os níveis forem nulos, quem chama deve suspender o cálculo dependente e avisar
// o usuário — nunca assumir um default silencioso (mesma regra aplicada à Taxa de VPL em
// core/engine/fcl.ts::resolverTaxaDescontoAnual).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParametrosFiscais } from "@/core/engine";
import type { SystemParameterRow } from "@/lib/types/db";

export const CHAVE_TAXA_DESCONTO_PADRAO_GLOBAL = "taxa_desconto_padrao_global";
export const CHAVE_LIMITE_MENSAL_ADICIONAL_IRPJ = "limite_mensal_adicional_irpj";
export const CHAVE_ALIQUOTA_IRPJ_BASE = "aliquota_irpj_base";
export const CHAVE_ALIQUOTA_IRPJ_ADICIONAL = "aliquota_irpj_adicional";
export const CHAVE_ALIQUOTA_CSLL = "aliquota_csll";

/** Busca todos os parâmetros do Sistema + de um Workspace específico numa única query. */
export async function carregarParametros(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("system_parameters")
    .select("escopo, workspace_id, chave, valor")
    .or(`escopo.eq.SISTEMA,workspace_id.eq.${workspaceId}`);

  if (error) throw error;

  const porChave = new Map<string, number>();
  const rows = (data ?? []) as Pick<SystemParameterRow, "escopo" | "workspace_id" | "chave" | "valor">[];

  // Aplica SISTEMA primeiro, depois WORKSPACE sobrescreve — resolução Workspace > Sistema.
  for (const row of rows.filter((r) => r.escopo === "SISTEMA")) {
    porChave.set(row.chave, row.valor);
  }
  for (const row of rows.filter((r) => r.escopo === "WORKSPACE")) {
    porChave.set(row.chave, row.valor);
  }

  return porChave;
}

export function resolverTaxaDescontoPadraoGlobal(parametros: Map<string, number>): number | null {
  return parametros.get(CHAVE_TAXA_DESCONTO_PADRAO_GLOBAL) ?? null;
}

/** Monta ParametrosFiscais a partir da hierarquia — nunca hardcoded no engine (nota ⚠️ 2.4). */
export function resolverParametrosFiscais(parametros: Map<string, number>): ParametrosFiscais | null {
  const limiteMensalAdicionalIRPJ = parametros.get(CHAVE_LIMITE_MENSAL_ADICIONAL_IRPJ);
  const aliquotaIRPJBase = parametros.get(CHAVE_ALIQUOTA_IRPJ_BASE);
  const aliquotaIRPJAdicional = parametros.get(CHAVE_ALIQUOTA_IRPJ_ADICIONAL);
  const aliquotaCSLL = parametros.get(CHAVE_ALIQUOTA_CSLL);

  if (
    limiteMensalAdicionalIRPJ === undefined ||
    aliquotaIRPJBase === undefined ||
    aliquotaIRPJAdicional === undefined ||
    aliquotaCSLL === undefined
  ) {
    return null;
  }

  return { limiteMensalAdicionalIRPJ, aliquotaIRPJBase, aliquotaIRPJAdicional, aliquotaCSLL };
}
