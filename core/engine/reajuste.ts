// Regra 4 (2.3) + fórmula de Reajuste Contratual (2.4).
// Aplicado antes do cálculo de Receita Líquida, apenas a itens de RECEITA.

import type { ConfiguracaoReajusteContratual } from "./types";

/**
 * Resolve o Valor Unitário vigente em cada mês do item, aplicando o reajuste
 * exatamente nas competências informadas manualmente (2.2: "Percentual do Índice
 * por Competência" é input manual por período no MVP).
 *
 *   Se mes_t está em competencias e toggle = ON:
 *       ValorUnitario_t = ValorUnitario_(t-1) × (1 + percentualIndice)
 *   Senão:
 *       ValorUnitario_t = ValorUnitario_(t-1)
 */
export function resolverValorUnitarioMensal(
  valorUnitarioBase: number,
  duracaoMeses: number,
  mesesCompetencia: string[], // competência de cada mês do item, alinhada por índice
  reajuste: ConfiguracaoReajusteContratual,
): number[] {
  const percentualPorCompetencia = new Map(
    reajuste.competencias.map((c) => [c.mesCompetencia, c.percentualIndice]),
  );

  const valores: number[] = [];
  let vigente = valorUnitarioBase;

  for (let t = 0; t < duracaoMeses; t++) {
    if (reajuste.aplicaReajuste) {
      const percentual = percentualPorCompetencia.get(mesesCompetencia[t]!);
      if (percentual !== undefined) {
        vigente = vigente * (1 + percentual);
      }
    }
    valores.push(vigente);
  }

  return valores;
}
