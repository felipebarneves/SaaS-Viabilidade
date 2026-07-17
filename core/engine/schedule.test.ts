import { describe, expect, it } from "vitest";
import { distribuirItemCronograma } from "./schedule";
import type { ItemCronograma } from "./types";

describe("distribuirItemCronograma — RF-CORE-002 sobrescrita manual", () => {
  it("usa o override apenas na competência informada e mantém o cálculo automático nas demais", () => {
    const item: ItemCronograma = {
      id: "receita-1",
      tipo: "RECEITA",
      dataInicio: "2026-01-01",
      duracaoMeses: 3,
      quantidade: 1,
      valorUnitario: 1000,
      aliquotaImpostos: 0,
      overridesMensais: [{ mesCompetencia: "2026-02", valorUnitario: 5000 }],
    };

    const lancamentos = distribuirItemCronograma(item, { aplicaReajuste: false, competencias: [] });
    const porMes = new Map(lancamentos.map((l) => [l.mesCompetencia, l]));

    expect(porMes.get("2026-01")!.valorUnitario).toBe(1000);
    expect(porMes.get("2026-01")!.editadoManualmente).toBe(false);

    expect(porMes.get("2026-02")!.valorUnitario).toBe(5000);
    expect(porMes.get("2026-02")!.receitaLiquida).toBe(5000);
    expect(porMes.get("2026-02")!.editadoManualmente).toBe(true);

    expect(porMes.get("2026-03")!.valorUnitario).toBe(1000);
    expect(porMes.get("2026-03")!.editadoManualmente).toBe(false);
  });

  it("override vence mesmo com Reajuste Contratual ativo na mesma competência", () => {
    const item: ItemCronograma = {
      id: "receita-1",
      tipo: "RECEITA",
      dataInicio: "2026-01-01",
      duracaoMeses: 2,
      quantidade: 1,
      valorUnitario: 1000,
      aliquotaImpostos: 0,
      overridesMensais: [{ mesCompetencia: "2026-02", valorUnitario: 9999 }],
    };

    const lancamentos = distribuirItemCronograma(item, {
      aplicaReajuste: true,
      periodicidade: "ANUAL",
      mesBase: 2,
      competencias: [{ mesCompetencia: "2026-02", percentualIndice: 0.1 }],
    });

    expect(lancamentos[1]!.valorUnitario).toBe(9999);
    expect(lancamentos[1]!.editadoManualmente).toBe(true);
  });

  it("sem overrides, editadoManualmente é sempre false", () => {
    const item: ItemCronograma = {
      id: "custo-1",
      tipo: "CUSTO",
      classificacaoCusto: "FIXO",
      dataInicio: "2026-01-01",
      duracaoMeses: 2,
      quantidade: 1,
      valorUnitario: 500,
      aliquotaImpostos: 0,
    };

    const lancamentos = distribuirItemCronograma(item, { aplicaReajuste: false, competencias: [] });
    expect(lancamentos.every((l) => l.editadoManualmente === false)).toBe(true);
  });
});
