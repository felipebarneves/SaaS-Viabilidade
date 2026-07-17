import { describe, expect, it } from "vitest";
import { calcularFCL, calcularVPL, calcularPayback, resolverTaxaDescontoAnual, taxaMensalComposta } from "./fcl";
import type { LinhaMensal } from "./types";

function linha(parcial: Partial<LinhaMensal> & { mesIndex: number; fcl: number; caixaAcumulado: number }): LinhaMensal {
  return {
    mesCompetencia: "2026-01",
    receitaLiquida: 0,
    custosOperacionais: 0,
    despesasOperacionais: 0,
    ebitda: 0,
    depreciacao: 0,
    amortizacao: 0,
    ebit: 0,
    despesasFinanceiras: 0,
    lucroAntesIR: 0,
    irCsll: 0,
    lucroLiquido: 0,
    capex: 0,
    variacaoCapitalGiro: 0,
    ...parcial,
  };
}

describe("FCL", () => {
  it("soma lucro líquido + dep/amort - capex - variação de capital de giro", () => {
    expect(calcularFCL(10000, 500, 300, 2000, 400)).toBe(8400);
  });
});

describe("Resolução hierárquica da taxa de desconto (Regra 3 / RF-CORE-005)", () => {
  it("usa taxa do projeto quando presente", () => {
    expect(resolverTaxaDescontoAnual({ taxaProjeto: 0.12, taxaPadraoGlobalWorkspace: 0.1 })).toBe(0.12);
  });
  it("cai para a taxa padrão global quando a do projeto é nula", () => {
    expect(resolverTaxaDescontoAnual({ taxaProjeto: null, taxaPadraoGlobalWorkspace: 0.1 })).toBe(0.1);
  });
  it("retorna null quando ambas são nulas", () => {
    expect(resolverTaxaDescontoAnual({ taxaProjeto: null, taxaPadraoGlobalWorkspace: null })).toBeNull();
  });
});

describe("VPL", () => {
  it("suspende o cálculo quando não há taxa de desconto resolvida (Regra 3)", () => {
    const resultado = calcularVPL(
      [linha({ mesIndex: 0, fcl: 1000, caixaAcumulado: 1000 })],
      { taxaProjeto: null, taxaPadraoGlobalWorkspace: null },
    );
    expect(resultado.status).toBe("SUSPENSO");
    expect(resultado.valor).toBeUndefined();
  });

  it("converte taxa anual para mensal via juros compostos (nunca /12 simples)", () => {
    const taxaAnual = 0.12;
    const esperadaMensal = Math.pow(1.12, 1 / 12) - 1;
    expect(taxaMensalComposta(taxaAnual)).toBeCloseTo(esperadaMensal, 10);
    expect(taxaMensalComposta(taxaAnual)).not.toBeCloseTo(0.01, 4); // não é 12%/12
  });

  it("calcula VPL como soma dos FCL descontados mês a mês", () => {
    const taxaMensal = taxaMensalComposta(0.12);
    const linhas = [
      linha({ mesIndex: 0, fcl: -10000, caixaAcumulado: -10000 }),
      linha({ mesIndex: 1, fcl: 3000, caixaAcumulado: -7000 }),
      linha({ mesIndex: 2, fcl: 3000, caixaAcumulado: -4000 }),
      linha({ mesIndex: 3, fcl: 3000, caixaAcumulado: -1000 }),
      linha({ mesIndex: 4, fcl: 3000, caixaAcumulado: 2000 }),
    ];
    const esperado = linhas.reduce((acc, l) => acc + l.fcl / Math.pow(1 + taxaMensal, l.mesIndex), 0);
    const resultado = calcularVPL(linhas, { taxaProjeto: 0.12, taxaPadraoGlobalWorkspace: null });
    expect(resultado.status).toBe("CALCULADO");
    expect(resultado.valor).toBeCloseTo(esperado, 6);
  });
});

describe("Payback", () => {
  it("Payback Simples: primeiro mês em que Caixa Acumulado >= 0", () => {
    const linhas = [
      linha({ mesIndex: 0, fcl: -10000, caixaAcumulado: -10000 }),
      linha({ mesIndex: 1, fcl: 3000, caixaAcumulado: -7000 }),
      linha({ mesIndex: 2, fcl: 3000, caixaAcumulado: -4000 }),
      linha({ mesIndex: 3, fcl: 3000, caixaAcumulado: -1000 }),
      linha({ mesIndex: 4, fcl: 3000, caixaAcumulado: 2000 }),
    ];
    const resultado = calcularPayback(linhas, { taxaProjeto: 0.12, taxaPadraoGlobalWorkspace: null });
    expect(resultado.paybackSimplesMes).toBe(4);
  });

  it("Payback Descontado ocorre depois (ou igual) ao Simples, pois pondera o custo de capital", () => {
    const linhas = [
      linha({ mesIndex: 0, fcl: -10000, caixaAcumulado: -10000 }),
      linha({ mesIndex: 1, fcl: 3000, caixaAcumulado: -7000 }),
      linha({ mesIndex: 2, fcl: 3000, caixaAcumulado: -4000 }),
      linha({ mesIndex: 3, fcl: 3000, caixaAcumulado: -1000 }),
      linha({ mesIndex: 4, fcl: 3000, caixaAcumulado: 2000 }),
      linha({ mesIndex: 5, fcl: 3000, caixaAcumulado: 5000 }),
    ];
    const resultado = calcularPayback(linhas, { taxaProjeto: 0.12, taxaPadraoGlobalWorkspace: null });
    expect(resultado.paybackDescontadoMes!).toBeGreaterThanOrEqual(resultado.paybackSimplesMes!);
  });
});
