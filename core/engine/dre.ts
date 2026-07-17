// Fórmulas de EBITDA, EBIT, IR/CSLL e Lucro Líquido — seção 2.4.
// Alíquotas e limites de IR/CSLL são sempre recebidos como parâmetro (ParametrosFiscais),
// nunca hardcoded (nota ⚠️ 2.4).

import type { ConfiguracaoTributaria } from "./types";

export function calcularEBITDA(
  receitaLiquidaTotal: number,
  custosOperacionais: number,
  despesasOperacionais: number,
): number {
  return receitaLiquidaTotal - custosOperacionais - despesasOperacionais;
}

export function calcularEBIT(
  ebitda: number,
  depreciacao: number,
  amortizacao: number,
): number {
  return ebitda - depreciacao - amortizacao;
}

/** Regra 3: toggle "Considerar Custo Financeiro" decide se Despesas_Financeiras entram no Lucro_Antes_IR. */
export function calcularLucroAntesIR(
  ebit: number,
  despesasFinanceiras: number,
  considerarCustoFinanceiro: boolean,
): number {
  return considerarCustoFinanceiro ? ebit - despesasFinanceiras : ebit;
}

/**
 * IR/CSLL mensal — ramo da fórmula depende do Regime Tributário selecionado (2.4-B).
 * `receitaBrutaMensal` só é necessária para Lucro Presumido (Base_Calculo = Receita_Bruta × Percentual_Presuncao).
 */
export function calcularIRCSLL(
  lucroAntesIR: number,
  receitaBrutaMensal: number,
  tributacao: ConfiguracaoTributaria,
): number {
  const { regime, parametrosFiscais } = tributacao;
  const { limiteMensalAdicionalIRPJ, aliquotaIRPJBase, aliquotaIRPJAdicional, aliquotaCSLL } =
    parametrosFiscais;

  if (regime === "SIMPLIFICADO_ALIQUOTA_UNICA") {
    if (tributacao.aliquotaEfetivaIRCSLL === undefined) {
      throw new Error(
        "Regime Simplificado (Alíquota Única) exige Alíquota Efetiva IR+CSLL configurada.",
      );
    }
    return lucroAntesIR * tributacao.aliquotaEfetivaIRCSLL;
  }

  if (regime === "LUCRO_PRESUMIDO") {
    if (tributacao.percentualPresuncao === undefined) {
      throw new Error("Regime Lucro Presumido exige Percentual de Presunção configurado.");
    }
    const baseCalculo = receitaBrutaMensal * tributacao.percentualPresuncao;
    const irpj =
      baseCalculo * aliquotaIRPJBase +
      Math.max(0, baseCalculo - limiteMensalAdicionalIRPJ) * aliquotaIRPJAdicional;
    const csll = baseCalculo * aliquotaCSLL;
    return irpj + csll;
  }

  // LUCRO_REAL — v1 trata Base_Calculo como Lucro_Antes_IR puro (sem adições/exclusões, fora do MVP).
  const baseCalculo = lucroAntesIR;
  const irpj =
    baseCalculo * aliquotaIRPJBase +
    Math.max(0, baseCalculo - limiteMensalAdicionalIRPJ) * aliquotaIRPJAdicional;
  const csll = baseCalculo * aliquotaCSLL;
  return irpj + csll;
}

export function calcularLucroLiquido(lucroAntesIR: number, irCsll: number): number {
  return lucroAntesIR - irCsll;
}
