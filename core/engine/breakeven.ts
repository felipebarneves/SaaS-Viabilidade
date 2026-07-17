// Breakeven — Ponto de Caixa e Operacional (2.4). Dois indicadores com propósitos distintos,
// ambos devem ser exibidos, nunca um substituindo o outro.

import type { LinhaMensal, ResultadoBreakeven } from "./types";

export function calcularBreakevenPontoDeCaixa(linhasMensais: LinhaMensal[]): number | undefined {
  return linhasMensais.find((l) => l.caixaAcumulado >= 0)?.mesIndex;
}

/**
 * Breakeven_Operacional_Receita = Custos_Fixos_Totais / Margem_Contribuicao_Percentual
 * Margem_Contribuicao_Percentual = (Receita_Liquida - Custos_Variaveis) / Receita_Liquida
 */
export function calcularBreakevenOperacional(
  receitaLiquidaTotal: number,
  custosVariaveisTotais: number,
  custosFixosTotais: number,
): { operacionalReceita?: number; margemContribuicaoPercentual?: number } {
  if (receitaLiquidaTotal === 0) {
    return { operacionalReceita: undefined, margemContribuicaoPercentual: undefined };
  }

  const margemContribuicaoPercentual =
    (receitaLiquidaTotal - custosVariaveisTotais) / receitaLiquidaTotal;

  if (margemContribuicaoPercentual === 0) {
    return { operacionalReceita: undefined, margemContribuicaoPercentual };
  }

  return {
    operacionalReceita: custosFixosTotais / margemContribuicaoPercentual,
    margemContribuicaoPercentual,
  };
}

export function calcularBreakeven(
  linhasMensais: LinhaMensal[],
  receitaLiquidaTotal: number,
  custosVariaveisTotais: number,
  custosFixosTotais: number,
): ResultadoBreakeven {
  const pontoDeCaixaMes = calcularBreakevenPontoDeCaixa(linhasMensais);
  const { operacionalReceita, margemContribuicaoPercentual } = calcularBreakevenOperacional(
    receitaLiquidaTotal,
    custosVariaveisTotais,
    custosFixosTotais,
  );

  return { pontoDeCaixaMes, operacionalReceita, margemContribuicaoPercentual };
}
