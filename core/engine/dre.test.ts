import { describe, expect, it } from "vitest";
import { calcularEBITDA, calcularEBIT, calcularLucroAntesIR, calcularIRCSLL, calcularLucroLiquido } from "./dre";
import type { ConfiguracaoTributaria } from "./types";

const parametrosFiscais = {
  limiteMensalAdicionalIRPJ: 20000,
  aliquotaIRPJBase: 0.15,
  aliquotaIRPJAdicional: 0.1,
  aliquotaCSLL: 0.09,
};

describe("EBITDA / EBIT / Lucro Antes IR", () => {
  it("calcula EBITDA como Receita - Custos - Despesas operacionais", () => {
    expect(calcularEBITDA(100000, 40000, 10000)).toBe(50000);
  });

  it("calcula EBIT descontando depreciação e amortização", () => {
    expect(calcularEBIT(50000, 5000, 2000)).toBe(43000);
  });

  it("desconsidera despesas financeiras quando toggle OFF (Regra 3)", () => {
    expect(calcularLucroAntesIR(43000, 8000, false)).toBe(43000);
  });

  it("considera despesas financeiras quando toggle ON (Regra 3)", () => {
    expect(calcularLucroAntesIR(43000, 8000, true)).toBe(35000);
  });
});

describe("IR/CSLL por Regime Tributário (2.4-B)", () => {
  it("Simplificado (Alíquota Única): aplica direto sobre o lucro antes de IR", () => {
    const tributacao: ConfiguracaoTributaria = {
      regime: "SIMPLIFICADO_ALIQUOTA_UNICA",
      aliquotaEfetivaIRCSLL: 0.06,
      parametrosFiscais,
    };
    expect(calcularIRCSLL(35000, 100000, tributacao)).toBeCloseTo(2100, 6);
  });

  it("Lucro Presumido: usa Base_Calculo = Receita_Bruta × Percentual_Presuncao, sem adicional", () => {
    const tributacao: ConfiguracaoTributaria = {
      regime: "LUCRO_PRESUMIDO",
      percentualPresuncao: 0.32,
      parametrosFiscais,
    };
    // Receita bruta 100.000 -> base 32.000 (abaixo do limite de 20.000/mês -> ainda incide adicional acima do limite)
    const base = 100000 * 0.32; // 32000
    const irpj = base * 0.15 + Math.max(0, base - 20000) * 0.1; // 4800 + 1200 = 6000
    const csll = base * 0.09; // 2880
    expect(calcularIRCSLL(35000, 100000, tributacao)).toBeCloseTo(irpj + csll, 6);
  });

  it("Lucro Real: usa Base_Calculo = Lucro_Antes_IR puro (v1, sem ajustes fiscais)", () => {
    const tributacao: ConfiguracaoTributaria = {
      regime: "LUCRO_REAL",
      parametrosFiscais,
    };
    const base = 35000;
    const irpj = base * 0.15 + Math.max(0, base - 20000) * 0.1; // 5250 + 1500 = 6750
    const csll = base * 0.09; // 3150
    expect(calcularIRCSLL(base, 100000, tributacao)).toBeCloseTo(irpj + csll, 6);
  });

  it("Lucro Líquido = Lucro Antes IR - IR/CSLL", () => {
    expect(calcularLucroLiquido(35000, 9900)).toBeCloseTo(25100, 6);
  });
});
