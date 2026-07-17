// Regra 1 (2.3): distribuição mensal do cronograma físico-financeiro.
// Capex e Variação de Capital de Giro NÃO passam por este rateio — são input direto por mês.

import type { ItemCronograma } from "./types";
import { addMonths, competenciaFromDate } from "./months";
import { resolverValorUnitarioMensal } from "./reajuste";
import type { ConfiguracaoReajusteContratual } from "./types";

export interface LancamentoMensalItem {
  mesCompetencia: string;
  quantidade: number;
  valorUnitario: number;
  aliquotaImpostos: number;
  receitaLiquida: number; // 0 para itens que não são RECEITA
  valorBruto: number; // quantidade × valorUnitario, sem imposto — usado para custos/despesas
  editadoManualmente: boolean; // RF-CORE-002 — true quando um override venceu o valor calculado
}

/**
 * Distribui um item de cronograma (receita/custo/despesa) mês a mês entre
 * Data de Início e Duração, aplicando reajuste contratual apenas a itens de RECEITA.
 * RF-CORE-002: overrides manuais por competência vencem sobre o valor calculado.
 */
export function distribuirItemCronograma(
  item: ItemCronograma,
  reajuste: ConfiguracaoReajusteContratual,
): LancamentoMensalItem[] {
  const mesInicio = competenciaFromDate(item.dataInicio);
  const mesesCompetencia = Array.from({ length: item.duracaoMeses }, (_, t) =>
    addMonths(mesInicio, t),
  );

  const valoresUnitarios =
    item.tipo === "RECEITA"
      ? resolverValorUnitarioMensal(
          item.valorUnitario,
          item.duracaoMeses,
          mesesCompetencia,
          reajuste,
        )
      : Array.from({ length: item.duracaoMeses }, () => item.valorUnitario);

  const overridesPorCompetencia = new Map(
    (item.overridesMensais ?? []).map((o) => [o.mesCompetencia, o.valorUnitario]),
  );

  return mesesCompetencia.map((mesCompetencia, t) => {
    const override = overridesPorCompetencia.get(mesCompetencia);
    const valorUnitario = override ?? valoresUnitarios[t]!;
    const valorBruto = item.quantidade * valorUnitario;
    const receitaLiquida =
      item.tipo === "RECEITA" ? valorBruto * (1 - item.aliquotaImpostos) : 0;

    return {
      mesCompetencia,
      quantidade: item.quantidade,
      valorUnitario,
      aliquotaImpostos: item.aliquotaImpostos,
      receitaLiquida,
      valorBruto,
      editadoManualmente: override !== undefined,
    };
  });
}
