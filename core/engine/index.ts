// Orquestrador do motor de cálculo (Regra 2): recebe o ProjetoInput e produz todos os
// indicadores exigidos — Receita Líquida, EBITDA, EBIT, Lucro Líquido, VPL, Payback
// (Simples e Descontado) e Breakeven (Ponto de Caixa e Operacional).
//
// Este é o único ponto de entrada esperado pelas telas — nenhuma fórmula deve ser
// replicada em componentes de UI (1.1.2 do PRD).

import type { LinhaMensal, ProjetoInput, ResultadoSimulacao } from "./types";
import { distribuirItemCronograma } from "./schedule";
import { addMonths, monthIndex } from "./months";
import {
  calcularEBITDA,
  calcularEBIT,
  calcularLucroAntesIR,
  calcularIRCSLL,
  calcularLucroLiquido,
} from "./dre";
import { calcularFCL, calcularVPL, calcularPayback } from "./fcl";
import { calcularBreakeven } from "./breakeven";

interface MesAgregado {
  receitaLiquida: number;
  receitaBruta: number;
  custosFixos: number;
  custosVariaveis: number;
  despesasOperacionais: number;
}

function mesVazio(): MesAgregado {
  return {
    receitaLiquida: 0,
    receitaBruta: 0,
    custosFixos: 0,
    custosVariaveis: 0,
    despesasOperacionais: 0,
  };
}

export function simular(projeto: ProjetoInput): ResultadoSimulacao {
  const mesesCompetenciaTodos: string[] = [];
  for (const item of projeto.itensCronograma) {
    for (const l of distribuirItemCronograma(item, projeto.reajusteContratual)) {
      mesesCompetenciaTodos.push(l.mesCompetencia);
    }
  }
  for (const c of projeto.capex) mesesCompetenciaTodos.push(c.mesCompetencia);
  for (const v of projeto.variacaoCapitalGiro) mesesCompetenciaTodos.push(v.mesCompetencia);

  if (mesesCompetenciaTodos.length === 0) {
    return {
      linhasMensais: [],
      vpl: { status: "SUSPENSO", motivoSuspensao: "Nenhum lançamento no projeto." },
      payback: {},
      breakeven: {},
    };
  }

  const mesBase = mesesCompetenciaTodos.reduce((a, b) => (a < b ? a : b));
  const agregadoPorMes = new Map<string, MesAgregado>();
  const garantirMes = (mes: string): MesAgregado => {
    let m = agregadoPorMes.get(mes);
    if (!m) {
      m = mesVazio();
      agregadoPorMes.set(mes, m);
    }
    return m;
  };

  for (const item of projeto.itensCronograma) {
    const lancamentos = distribuirItemCronograma(item, projeto.reajusteContratual);
    for (const l of lancamentos) {
      const agregado = garantirMes(l.mesCompetencia);
      if (item.tipo === "RECEITA") {
        agregado.receitaLiquida += l.receitaLiquida;
        agregado.receitaBruta += l.valorBruto;
      } else if (item.tipo === "CUSTO") {
        if (item.classificacaoCusto === "FIXO") agregado.custosFixos += l.valorBruto;
        else agregado.custosVariaveis += l.valorBruto;
      } else {
        agregado.despesasOperacionais += l.valorBruto;
      }
    }
  }

  const capexPorMes = new Map<string, number>();
  for (const c of projeto.capex) {
    capexPorMes.set(c.mesCompetencia, (capexPorMes.get(c.mesCompetencia) ?? 0) + c.valor);
  }
  const capitalGiroPorMes = new Map<string, number>();
  for (const v of projeto.variacaoCapitalGiro) {
    capitalGiroPorMes.set(
      v.mesCompetencia,
      (capitalGiroPorMes.get(v.mesCompetencia) ?? 0) + v.valor,
    );
  }
  const despesaFinanceiraPorMes = new Map<string, number>();
  for (const d of projeto.despesasFinanceiras) {
    despesaFinanceiraPorMes.set(
      d.mesCompetencia,
      (despesaFinanceiraPorMes.get(d.mesCompetencia) ?? 0) + d.valor,
    );
  }
  const depAmortPorMes = new Map<string, { depreciacao: number; amortizacao: number }>();
  for (const da of projeto.depreciacaoAmortizacao) {
    const atual = depAmortPorMes.get(da.mesCompetencia) ?? { depreciacao: 0, amortizacao: 0 };
    depAmortPorMes.set(da.mesCompetencia, {
      depreciacao: atual.depreciacao + da.depreciacao,
      amortizacao: atual.amortizacao + da.amortizacao,
    });
  }

  const horizonte = Math.max(
    projeto.duracaoMeses,
    ...Array.from(agregadoPorMes.keys(), (mes) => monthIndex(mesBase, mes) + 1),
  );

  const linhasMensais: LinhaMensal[] = [];
  let caixaAcumulado = 0;

  for (let t = 0; t < horizonte; t++) {
    const mesCompetencia = addMonths(mesBase, t);
    const agregado = agregadoPorMes.get(mesCompetencia) ?? mesVazio();
    const custosOperacionais = agregado.custosFixos + agregado.custosVariaveis;
    const despesasOperacionais = agregado.despesasOperacionais;
    const { depreciacao, amortizacao } = depAmortPorMes.get(mesCompetencia) ?? {
      depreciacao: 0,
      amortizacao: 0,
    };
    const despesasFinanceiras = despesaFinanceiraPorMes.get(mesCompetencia) ?? 0;
    const capex = capexPorMes.get(mesCompetencia) ?? 0;
    const variacaoCapitalGiro = capitalGiroPorMes.get(mesCompetencia) ?? 0;

    const ebitda = calcularEBITDA(agregado.receitaLiquida, custosOperacionais, despesasOperacionais);
    const ebit = calcularEBIT(ebitda, depreciacao, amortizacao);
    const lucroAntesIR = calcularLucroAntesIR(
      ebit,
      despesasFinanceiras,
      projeto.considerarCustoFinanceiro,
    );
    const irCsll = calcularIRCSLL(lucroAntesIR, agregado.receitaBruta, projeto.tributacao);
    const lucroLiquido = calcularLucroLiquido(lucroAntesIR, irCsll);
    const fcl = calcularFCL(lucroLiquido, depreciacao, amortizacao, capex, variacaoCapitalGiro);
    caixaAcumulado += fcl;

    linhasMensais.push({
      mesCompetencia,
      mesIndex: t,
      receitaLiquida: agregado.receitaLiquida,
      custosOperacionais,
      despesasOperacionais,
      ebitda,
      depreciacao,
      amortizacao,
      ebit,
      despesasFinanceiras,
      lucroAntesIR,
      irCsll,
      lucroLiquido,
      capex,
      variacaoCapitalGiro,
      fcl,
      caixaAcumulado,
    });
  }

  const receitaLiquidaTotal = linhasMensais.reduce((acc, l) => acc + l.receitaLiquida, 0);
  const custosVariaveisTotais = Array.from(agregadoPorMes.values()).reduce(
    (acc, m) => acc + m.custosVariaveis,
    0,
  );
  const custosFixosTotais = Array.from(agregadoPorMes.values()).reduce(
    (acc, m) => acc + m.custosFixos,
    0,
  );

  return {
    linhasMensais,
    vpl: calcularVPL(linhasMensais, projeto.taxaDescontoVPL),
    payback: calcularPayback(linhasMensais, projeto.taxaDescontoVPL),
    breakeven: calcularBreakeven(
      linhasMensais,
      receitaLiquidaTotal,
      custosVariaveisTotais,
      custosFixosTotais,
    ),
  };
}

export * from "./types";
export * from "./schedule";
export * from "./reajuste";
export * from "./dre";
export * from "./fcl";
export * from "./breakeven";
export * from "./months";
