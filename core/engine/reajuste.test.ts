import { describe, expect, it } from "vitest";
import { resolverValorUnitarioMensal } from "./reajuste";
import type { ConfiguracaoReajusteContratual } from "./types";

describe("Reajuste Contratual (Regra 4, fórmula 2.4)", () => {
  it("mantém valor constante quando toggle = OFF", () => {
    const reajuste: ConfiguracaoReajusteContratual = { aplicaReajuste: false, competencias: [] };
    const valores = resolverValorUnitarioMensal(1000, 4, ["2026-01", "2026-02", "2026-03", "2026-04"], reajuste);
    expect(valores).toEqual([1000, 1000, 1000, 1000]);
  });

  it("aplica reajuste multiplicando o valor vigente, atravessando duas competências", () => {
    const reajuste: ConfiguracaoReajusteContratual = {
      aplicaReajuste: true,
      indice: "IPCA",
      periodicidade: "ANUAL",
      mesBase: 1,
      competencias: [
        { mesCompetencia: "2027-01", percentualIndice: 0.05 },
        { mesCompetencia: "2028-01", percentualIndice: 0.04 },
      ],
    };
    const meses = [
      "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
      "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12",
      "2027-01", "2027-02",
      "2028-01",
    ];
    const valores = resolverValorUnitarioMensal(1000, meses.length, meses, reajuste);

    // Antes do 1o reajuste: constante em 1000
    for (let i = 0; i < 12; i++) expect(valores[i]).toBeCloseTo(1000, 6);
    // A partir de 2027-01: 1000 * 1.05 = 1050
    expect(valores[12]).toBeCloseTo(1050, 6);
    expect(valores[13]).toBeCloseTo(1050, 6);
    // A partir de 2028-01: 1050 * 1.04 = 1092
    expect(valores[14]).toBeCloseTo(1092, 6);
  });
});
