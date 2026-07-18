"use client";

import { useState } from "react";
import type { ProjectVersionRow } from "@/lib/types/db";
import type { ProjectVersionSnapshot } from "@/lib/projects/snapshot";
import { formatarMoeda } from "@/lib/format";

// RF-CORE-004: "selecionar duas ou mais versões do histórico" — por padrão mostra as duas
// mais recentes; o usuário liga/desliga quais entram no comparativo.
export function ComparativoSelecionavel({ versoes }: { versoes: ProjectVersionRow[] }) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(
    () => new Set(versoes.slice(0, 2).map((v) => v.id)),
  );

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  const versoesSelecionadas = versoes.filter((v) => selecionadas.has(v.id));

  return (
    <div>
      <div className="card">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Selecione as versões para comparar</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {versoes.map((v) => (
            <label key={v.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={selecionadas.has(v.id)} onChange={() => alternar(v.id)} />
              {v.nome}
              <span className="muted" style={{ fontSize: 11 }}>
                ({new Date(v.created_at).toLocaleDateString("pt-BR")})
              </span>
            </label>
          ))}
        </div>
      </div>

      {versoesSelecionadas.length < 2 ? (
        <p className="muted">Selecione ao menos duas versões para ver o comparativo.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Indicador</th>
                {versoesSelecionadas.map((v) => (
                  <th key={v.id}>
                    {v.nome}
                    <div className="muted" style={{ fontWeight: 400, fontSize: 11 }}>
                      {new Date(v.created_at).toLocaleString("pt-BR")} · {v.status}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <LinhaComparativa
                titulo="Receita Líquida Total"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.linhasMensais.reduce((acc, l) => acc + l.receitaLiquida, 0)}
                formatar={formatarMoeda}
              />
              <LinhaComparativa
                titulo="EBITDA Total"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.linhasMensais.reduce((acc, l) => acc + l.ebitda, 0)}
                formatar={formatarMoeda}
              />
              <LinhaComparativa
                titulo="Lucro Líquido Total"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.linhasMensais.reduce((acc, l) => acc + l.lucroLiquido, 0)}
                formatar={formatarMoeda}
              />
              <LinhaComparativa
                titulo="VPL"
                versoes={versoesSelecionadas}
                extrair={(s) => (s.resultado.vpl.status === "CALCULADO" ? s.resultado.vpl.valor! : null)}
                formatar={(v) => (v === null ? "Suspenso" : formatarMoeda(v))}
              />
              <LinhaComparativa
                titulo="Payback Simples"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.payback.paybackSimplesMes ?? null}
                formatar={(v) => (v === null ? "Não atingido" : `Mês ${v}`)}
              />
              <LinhaComparativa
                titulo="Payback Descontado"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.payback.paybackDescontadoMes ?? null}
                formatar={(v) => (v === null ? "Não atingido" : `Mês ${v}`)}
              />
              <LinhaComparativa
                titulo="Breakeven Ponto de Caixa"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.breakeven.pontoDeCaixaMes ?? null}
                formatar={(v) => (v === null ? "Não atingido" : `Mês ${v}`)}
              />
              <LinhaComparativa
                titulo="Breakeven Operacional (Receita)"
                versoes={versoesSelecionadas}
                extrair={(s) => s.resultado.breakeven.operacionalReceita ?? null}
                formatar={(v) => (v === null ? "—" : formatarMoeda(v))}
              />
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinhaComparativa<T>({
  titulo,
  versoes,
  extrair,
  formatar,
}: {
  titulo: string;
  versoes: ProjectVersionRow[];
  extrair: (snapshot: ProjectVersionSnapshot) => T;
  formatar: (valor: T) => string;
}) {
  return (
    <tr>
      <td>{titulo}</td>
      {versoes.map((v) => (
        <td key={v.id}>{formatar(extrair(v.snapshot as ProjectVersionSnapshot))}</td>
      ))}
    </tr>
  );
}
