// Converte linhas do banco (lib/types/db.ts) para o ProjetoInput esperado por core/engine::simular().
// Único ponto de tradução DB -> domínio — nenhuma tela deve montar ProjetoInput manualmente.

import type { ProjetoInput } from "@/core/engine";
import type {
  CapexItemRow,
  ContractAdjustmentCompetencyRow,
  DepreciationAmortizationEntryRow,
  FinancialExpenseEntryRow,
  ProjectRow,
  ScheduleItemOverrideRow,
  ScheduleItemRow,
  WorkingCapitalEntryRow,
} from "@/lib/types/db";
import type { ParametrosFiscais } from "@/core/engine";

export interface ProjetoComRelacionamentos {
  project: ProjectRow;
  scheduleItems: ScheduleItemRow[];
  scheduleItemOverrides: ScheduleItemOverrideRow[];
  capexItems: CapexItemRow[];
  workingCapitalEntries: WorkingCapitalEntryRow[];
  adjustmentCompetencies: ContractAdjustmentCompetencyRow[];
  depreciationEntries: DepreciationAmortizationEntryRow[];
  financialExpenseEntries: FinancialExpenseEntryRow[];
}

export function montarProjetoInput(
  dados: ProjetoComRelacionamentos,
  taxaDescontoPadraoGlobalWorkspace: number | null,
  parametrosFiscais: ParametrosFiscais,
): ProjetoInput {
  const { project } = dados;

  const overridesPorItem = new Map<string, { mesCompetencia: string; valorUnitario: number }[]>();
  for (const o of dados.scheduleItemOverrides) {
    const lista = overridesPorItem.get(o.schedule_item_id) ?? [];
    lista.push({ mesCompetencia: o.mes_competencia.slice(0, 7), valorUnitario: o.valor_unitario_override });
    overridesPorItem.set(o.schedule_item_id, lista);
  }

  return {
    id: project.id,
    duracaoMeses: project.duracao_meses,
    itensCronograma: dados.scheduleItems.map((item) => ({
      id: item.id,
      tipo: item.tipo,
      classificacaoCusto: item.classificacao_custo ?? undefined,
      dataInicio: item.data_inicio,
      duracaoMeses: item.duracao_meses,
      quantidade: item.quantidade,
      valorUnitario: item.valor_unitario,
      aliquotaImpostos: item.aliquota_impostos,
      overridesMensais: overridesPorItem.get(item.id),
    })),
    capex: dados.capexItems.map((c) => ({
      id: c.id,
      valor: c.valor,
      mesCompetencia: c.mes_competencia.slice(0, 7),
    })),
    variacaoCapitalGiro: dados.workingCapitalEntries.map((v) => ({
      mesCompetencia: v.mes_competencia.slice(0, 7),
      valor: v.valor,
    })),
    reajusteContratual: {
      aplicaReajuste: project.aplica_reajuste_contratual,
      indice: project.indice_reajuste ?? undefined,
      indiceOutroNome: project.indice_reajuste_outro_nome ?? undefined,
      periodicidade: project.periodicidade_reajuste ?? undefined,
      mesBase: project.mes_base_reajuste ?? undefined,
      competencias: dados.adjustmentCompetencies.map((c) => ({
        mesCompetencia: c.mes_competencia.slice(0, 7),
        percentualIndice: c.percentual_indice,
      })),
    },
    tributacao: {
      regime: project.regime_tributario,
      percentualPresuncao: project.percentual_presuncao ?? undefined,
      aliquotaEfetivaIRCSLL: project.aliquota_efetiva_ir_csll ?? undefined,
      parametrosFiscais,
    },
    considerarCustoFinanceiro: project.considerar_custo_financeiro,
    despesasFinanceiras: dados.financialExpenseEntries.map((d) => ({
      mesCompetencia: d.mes_competencia.slice(0, 7),
      valor: d.valor,
    })),
    depreciacaoAmortizacao: dados.depreciationEntries.map((d) => ({
      mesCompetencia: d.mes_competencia.slice(0, 7),
      depreciacao: d.depreciacao,
      amortizacao: d.amortizacao,
    })),
    taxaDescontoVPL: {
      taxaProjeto: project.taxa_desconto_projeto,
      taxaPadraoGlobalWorkspace: taxaDescontoPadraoGlobalWorkspace,
    },
  };
}
