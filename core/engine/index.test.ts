// Teste de regressão numérica obrigatório (DoD 2.4): cenários com resultado esperado
// calculado manualmente, comparados ao output do engine `simular()`.

import { describe, expect, it } from "vitest";
import { simular } from "./index";
import type { ProjetoInput } from "./types";

const parametrosFiscais = {
  limiteMensalAdicionalIRPJ: 20000,
  aliquotaIRPJBase: 0.15,
  aliquotaIRPJAdicional: 0.1,
  aliquotaCSLL: 0.09,
};

function baseProjeto(overrides: Partial<ProjetoInput>): ProjetoInput {
  return {
    id: "proj-1",
    duracaoMeses: 3,
    itensCronograma: [],
    capex: [],
    variacaoCapitalGiro: [],
    reajusteContratual: { aplicaReajuste: false, competencias: [] },
    tributacao: { regime: "SIMPLIFICADO_ALIQUOTA_UNICA", aliquotaEfetivaIRCSLL: 0.06, parametrosFiscais },
    considerarCustoFinanceiro: false,
    despesasFinanceiras: [],
    depreciacaoAmortizacao: [],
    taxaDescontoVPL: { taxaProjeto: 0.12, taxaPadraoGlobalWorkspace: null },
    ...overrides,
  };
}

describe("simular() — cenário simples de 3 meses, Simplificado (Alíquota Única)", () => {
  it("bate byte a byte com o cálculo manual mês a mês", () => {
    const projeto = baseProjeto({
      duracaoMeses: 3,
      itensCronograma: [
        {
          id: "receita-1",
          tipo: "RECEITA",
          dataInicio: "2026-01-15",
          duracaoMeses: 3,
          quantidade: 10,
          valorUnitario: 1000,
          aliquotaImpostos: 0.1,
        },
        {
          id: "custo-1",
          tipo: "CUSTO",
          classificacaoCusto: "VARIAVEL",
          dataInicio: "2026-01-15",
          duracaoMeses: 3,
          quantidade: 10,
          valorUnitario: 400,
          aliquotaImpostos: 0,
        },
      ],
    });

    const resultado = simular(projeto);

    // Receita bruta/mês = 10 * 1000 = 10000; líquida = 10000 * 0.9 = 9000
    // Custo/mês = 10 * 400 = 4000
    // EBITDA = 9000 - 4000 - 0 = 5000; EBIT = 5000 (sem dep/amort)
    // Lucro antes IR = 5000 (toggle custo financeiro OFF)
    // IR/CSLL = 5000 * 0.06 = 300; Lucro líquido = 4700
    // FCL = 4700 (sem dep/amort/capex/capital de giro)
    for (const linha of resultado.linhasMensais) {
      expect(linha.receitaLiquida).toBeCloseTo(9000, 6);
      expect(linha.ebitda).toBeCloseTo(5000, 6);
      expect(linha.ebit).toBeCloseTo(5000, 6);
      expect(linha.irCsll).toBeCloseTo(300, 6);
      expect(linha.lucroLiquido).toBeCloseTo(4700, 6);
      expect(linha.fcl).toBeCloseTo(4700, 6);
    }
    expect(resultado.linhasMensais[2]!.caixaAcumulado).toBeCloseTo(4700 * 3, 6);
    expect(resultado.payback.paybackSimplesMes).toBe(0);
  });
});

describe("simular() — Capex e Capital de Giro não-zero", () => {
  it("aplica Capex e ΔCapitalGiro apenas no mês de competência, fora do rateio do cronograma", () => {
    const projeto = baseProjeto({
      duracaoMeses: 2,
      itensCronograma: [
        {
          id: "receita-1",
          tipo: "RECEITA",
          dataInicio: "2026-01-01",
          duracaoMeses: 2,
          quantidade: 1,
          valorUnitario: 20000,
          aliquotaImpostos: 0,
        },
      ],
      capex: [{ id: "capex-1", valor: 15000, mesCompetencia: "2026-01" }],
      variacaoCapitalGiro: [{ mesCompetencia: "2026-02", valor: 2000 }],
    });

    const resultado = simular(projeto);

    // Mês 1: receita líquida 20000, IR/CSLL = 20000*0.06=1200, lucro líquido = 18800
    // FCL mês 1 = 18800 - 15000 (capex) - 0 = 3800
    expect(resultado.linhasMensais[0]!.capex).toBe(15000);
    expect(resultado.linhasMensais[0]!.fcl).toBeCloseTo(18800 - 15000, 6);

    // Mês 2: mesmo DRE, sem capex, com ΔCapitalGiro de 2000
    expect(resultado.linhasMensais[1]!.capex).toBe(0);
    expect(resultado.linhasMensais[1]!.variacaoCapitalGiro).toBe(2000);
    expect(resultado.linhasMensais[1]!.fcl).toBeCloseTo(18800 - 2000, 6);
  });
});

describe("simular() — Reajuste Contratual ativo atravessando duas competências", () => {
  it("corrige o Valor Unitário apenas nas competências de reajuste informadas", () => {
    const projeto = baseProjeto({
      duracaoMeses: 25,
      itensCronograma: [
        {
          id: "receita-1",
          tipo: "RECEITA",
          dataInicio: "2026-01-01",
          duracaoMeses: 25,
          quantidade: 1,
          valorUnitario: 1000,
          aliquotaImpostos: 0,
        },
      ],
      reajusteContratual: {
        aplicaReajuste: true,
        indice: "IPCA",
        periodicidade: "ANUAL",
        mesBase: 1,
        competencias: [
          { mesCompetencia: "2027-01", percentualIndice: 0.05 },
          { mesCompetencia: "2028-01", percentualIndice: 0.04 },
        ],
      },
    });

    const resultado = simular(projeto);
    const porMes = new Map(resultado.linhasMensais.map((l) => [l.mesCompetencia, l]));

    expect(porMes.get("2026-12")!.receitaLiquida).toBeCloseTo(1000, 6);
    expect(porMes.get("2027-01")!.receitaLiquida).toBeCloseTo(1050, 6);
    expect(porMes.get("2028-01")!.receitaLiquida).toBeCloseTo(1092, 6);
  });
});

describe("simular() — Lucro Presumido", () => {
  it("usa Base_Calculo = Receita_Bruta × Percentual_Presuncao para IR/CSLL", () => {
    const projeto = baseProjeto({
      duracaoMeses: 1,
      tributacao: { regime: "LUCRO_PRESUMIDO", percentualPresuncao: 0.32, parametrosFiscais },
      itensCronograma: [
        {
          id: "receita-1",
          tipo: "RECEITA",
          dataInicio: "2026-01-01",
          duracaoMeses: 1,
          quantidade: 1,
          valorUnitario: 100000,
          aliquotaImpostos: 0,
        },
      ],
    });

    const resultado = simular(projeto);
    const base = 100000 * 0.32; // 32000
    const irpj = base * 0.15 + Math.max(0, base - 20000) * 0.1; // 4800 + 1200 = 6000
    const csll = base * 0.09; // 2880
    expect(resultado.linhasMensais[0]!.irCsll).toBeCloseTo(irpj + csll, 6);
  });
});

describe("simular() — Lucro Real", () => {
  it("usa Base_Calculo = Lucro_Antes_IR puro (sem adições/exclusões, fora do escopo do MVP)", () => {
    const projeto = baseProjeto({
      duracaoMeses: 1,
      tributacao: { regime: "LUCRO_REAL", parametrosFiscais },
      itensCronograma: [
        {
          id: "receita-1",
          tipo: "RECEITA",
          dataInicio: "2026-01-01",
          duracaoMeses: 1,
          quantidade: 1,
          valorUnitario: 100000,
          aliquotaImpostos: 0,
        },
        {
          id: "custo-1",
          tipo: "CUSTO",
          classificacaoCusto: "VARIAVEL",
          dataInicio: "2026-01-01",
          duracaoMeses: 1,
          quantidade: 1,
          valorUnitario: 40000,
          aliquotaImpostos: 0,
        },
      ],
    });

    const resultado = simular(projeto);
    // Lucro_Antes_IR = 100000 - 40000 = 60000 (sem dep/amort/despesas financeiras)
    const base = 60000;
    const irpj = base * 0.15 + Math.max(0, base - 20000) * 0.1; // 9000 + 4000 = 13000
    const csll = base * 0.09; // 5400
    expect(resultado.linhasMensais[0]!.lucroAntesIR).toBeCloseTo(60000, 6);
    expect(resultado.linhasMensais[0]!.irCsll).toBeCloseTo(irpj + csll, 6);
    expect(resultado.linhasMensais[0]!.lucroLiquido).toBeCloseTo(60000 - (irpj + csll), 6);
  });
});

describe("simular() — Breakeven Operacional", () => {
  it("Margem_Contribuicao = (Receita - Custos_Variaveis)/Receita; Breakeven = Custos_Fixos/Margem", () => {
    const projeto = baseProjeto({
      duracaoMeses: 1,
      itensCronograma: [
        {
          id: "receita-1",
          tipo: "RECEITA",
          dataInicio: "2026-01-01",
          duracaoMeses: 1,
          quantidade: 1,
          valorUnitario: 10000,
          aliquotaImpostos: 0,
        },
        {
          id: "custo-var",
          tipo: "CUSTO",
          classificacaoCusto: "VARIAVEL",
          dataInicio: "2026-01-01",
          duracaoMeses: 1,
          quantidade: 1,
          valorUnitario: 4000,
          aliquotaImpostos: 0,
        },
        {
          id: "custo-fixo",
          tipo: "CUSTO",
          classificacaoCusto: "FIXO",
          dataInicio: "2026-01-01",
          duracaoMeses: 1,
          quantidade: 1,
          valorUnitario: 3000,
          aliquotaImpostos: 0,
        },
      ],
    });

    const resultado = simular(projeto);
    // Margem = (10000 - 4000)/10000 = 0.6; Breakeven = 3000/0.6 = 5000
    expect(resultado.breakeven.margemContribuicaoPercentual).toBeCloseTo(0.6, 6);
    expect(resultado.breakeven.operacionalReceita).toBeCloseTo(5000, 6);
  });
});

describe("simular() — RNF-CORE-001 (Performance): recálculo em menos de 150ms", () => {
  it("projeto de 60 meses com 40 itens de cronograma, reajuste e capex simula em <150ms", () => {
    const duracaoMeses = 60;
    const itensCronograma: ProjetoInput["itensCronograma"] = Array.from({ length: 40 }, (_, i) => ({
      id: `item-${i}`,
      tipo: i % 3 === 0 ? "RECEITA" : "CUSTO",
      classificacaoCusto: i % 3 === 0 ? undefined : i % 2 === 0 ? "FIXO" : "VARIAVEL",
      dataInicio: "2026-01-01",
      duracaoMeses,
      quantidade: 1,
      valorUnitario: 1000 + i,
      aliquotaImpostos: i % 3 === 0 ? 0.06 : 0,
    }));

    const projeto = baseProjeto({
      duracaoMeses,
      itensCronograma,
      capex: Array.from({ length: 5 }, (_, i) => ({ id: `capex-${i}`, valor: 10000, mesCompetencia: `2026-0${i + 1}` })),
      reajusteContratual: {
        aplicaReajuste: true,
        indice: "IPCA",
        periodicidade: "ANUAL",
        mesBase: 1,
        competencias: [
          { mesCompetencia: "2027-01", percentualIndice: 0.05 },
          { mesCompetencia: "2028-01", percentualIndice: 0.04 },
          { mesCompetencia: "2029-01", percentualIndice: 0.045 },
          { mesCompetencia: "2030-01", percentualIndice: 0.05 },
        ],
      },
    });

    const inicio = performance.now();
    simular(projeto);
    const duracaoMs = performance.now() - inicio;

    expect(duracaoMs).toBeLessThan(150);
  });
});
