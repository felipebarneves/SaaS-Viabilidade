"use client";

// RNF-CORE-004: dashboard agregado por Ano, com drill-down interativo ao Mês.
// Clique num "Ano" expande as linhas mensais daquele ano (transição animada);
// clique de novo no mesmo ano (ou noutro) recolhe/troca — nunca dois anos abertos ao mesmo tempo.

import { Fragment, useState } from "react";
import type { LinhaMensal } from "@/core/engine";
import { formatarMoeda } from "@/lib/format";

interface AgregadoAno {
  ano: string;
  meses: LinhaMensal[];
  receitaLiquida: number;
  ebitda: number;
  ebit: number;
  irCsll: number;
  lucroLiquido: number;
  fcl: number;
  caixaAcumuladoFinal: number;
}

function agregarPorAno(linhasMensais: LinhaMensal[]): AgregadoAno[] {
  const porAno = new Map<string, LinhaMensal[]>();
  for (const linha of linhasMensais) {
    const ano = linha.mesCompetencia.slice(0, 4);
    const lista = porAno.get(ano) ?? [];
    lista.push(linha);
    porAno.set(ano, lista);
  }

  return Array.from(porAno.entries()).map(([ano, meses]) => ({
    ano,
    meses,
    receitaLiquida: meses.reduce((acc, l) => acc + l.receitaLiquida, 0),
    ebitda: meses.reduce((acc, l) => acc + l.ebitda, 0),
    ebit: meses.reduce((acc, l) => acc + l.ebit, 0),
    irCsll: meses.reduce((acc, l) => acc + l.irCsll, 0),
    lucroLiquido: meses.reduce((acc, l) => acc + l.lucroLiquido, 0),
    fcl: meses.reduce((acc, l) => acc + l.fcl, 0),
    caixaAcumuladoFinal: meses[meses.length - 1]!.caixaAcumulado,
  }));
}

export function DashboardMensal({ linhasMensais }: { linhasMensais: LinhaMensal[] }) {
  const [anoExpandido, setAnoExpandido] = useState<string | null>(null);
  const agregados = agregarPorAno(linhasMensais);

  function alternarAno(ano: string) {
    setAnoExpandido((atual) => (atual === ano ? null : ano));
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Ano</th>
            <th>Receita Líquida</th>
            <th>EBITDA</th>
            <th>EBIT</th>
            <th>IR/CSLL</th>
            <th>Lucro Líquido</th>
            <th>FCL</th>
            <th>Caixa Acumulado</th>
          </tr>
        </thead>
        <tbody>
          {agregados.map((agregado) => {
            const expandido = anoExpandido === agregado.ano;
            return (
              <Fragment key={agregado.ano}>
                <tr
                  onClick={() => alternarAno(agregado.ano)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandido}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") alternarAno(agregado.ano);
                  }}
                  style={{ cursor: "pointer", fontWeight: 600, background: expandido ? "var(--surface)" : undefined }}
                >
                  <td>
                    <span style={{ display: "inline-block", transition: "transform 0.15s", transform: expandido ? "rotate(90deg)" : "rotate(0deg)", marginRight: 6 }}>
                      ▶
                    </span>
                    {agregado.ano}
                  </td>
                  <td>{formatarMoeda(agregado.receitaLiquida)}</td>
                  <td>{formatarMoeda(agregado.ebitda)}</td>
                  <td>{formatarMoeda(agregado.ebit)}</td>
                  <td>{formatarMoeda(agregado.irCsll)}</td>
                  <td>{formatarMoeda(agregado.lucroLiquido)}</td>
                  <td className={agregado.fcl < 0 ? "negative" : "positive"}>{formatarMoeda(agregado.fcl)}</td>
                  <td className={agregado.caixaAcumuladoFinal < 0 ? "negative" : "positive"}>
                    {formatarMoeda(agregado.caixaAcumuladoFinal)}
                  </td>
                </tr>
                {expandido &&
                  agregado.meses.map((l) => (
                    <tr key={l.mesCompetencia} className="drill-down-row">
                      <td style={{ paddingLeft: "2rem" }} className="muted">
                        {l.mesCompetencia}
                      </td>
                      <td>{formatarMoeda(l.receitaLiquida)}</td>
                      <td>{formatarMoeda(l.ebitda)}</td>
                      <td>{formatarMoeda(l.ebit)}</td>
                      <td>{formatarMoeda(l.irCsll)}</td>
                      <td>{formatarMoeda(l.lucroLiquido)}</td>
                      <td className={l.fcl < 0 ? "negative" : "positive"}>{formatarMoeda(l.fcl)}</td>
                      <td className={l.caixaAcumulado < 0 ? "negative" : "positive"}>{formatarMoeda(l.caixaAcumulado)}</td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
