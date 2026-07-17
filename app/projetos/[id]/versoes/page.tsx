import { createClient } from "@/lib/supabase/server";
import type { ProjectVersionRow } from "@/lib/types/db";
import type { ProjectVersionSnapshot } from "@/lib/projects/snapshot";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// RF-CORE-004: comparativo lado a lado dos indicadores de resultado da Regra 2 entre versões salvas.
export default async function VersoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_versions")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const versoes = (data ?? []) as ProjectVersionRow[];

  if (versoes.length === 0) {
    return <p className="muted">Nenhuma versão salva ainda. Volte ao projeto e clique em "Salvar Versão".</p>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: "1rem" }}>Comparativo de Cenários</h1>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Indicador</th>
              {versoes.map((v) => (
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
            <LinhaComparativa titulo="Receita Líquida Total" versoes={versoes} extrair={(s) => s.resultado.linhasMensais.reduce((acc, l) => acc + l.receitaLiquida, 0)} formatar={formatarMoeda} />
            <LinhaComparativa titulo="EBITDA Total" versoes={versoes} extrair={(s) => s.resultado.linhasMensais.reduce((acc, l) => acc + l.ebitda, 0)} formatar={formatarMoeda} />
            <LinhaComparativa titulo="Lucro Líquido Total" versoes={versoes} extrair={(s) => s.resultado.linhasMensais.reduce((acc, l) => acc + l.lucroLiquido, 0)} formatar={formatarMoeda} />
            <LinhaComparativa
              titulo="VPL"
              versoes={versoes}
              extrair={(s) => (s.resultado.vpl.status === "CALCULADO" ? s.resultado.vpl.valor! : null)}
              formatar={(v) => (v === null ? "Suspenso" : formatarMoeda(v))}
            />
            <LinhaComparativa
              titulo="Payback Simples"
              versoes={versoes}
              extrair={(s) => s.resultado.payback.paybackSimplesMes ?? null}
              formatar={(v) => (v === null ? "Não atingido" : `Mês ${v}`)}
            />
            <LinhaComparativa
              titulo="Payback Descontado"
              versoes={versoes}
              extrair={(s) => s.resultado.payback.paybackDescontadoMes ?? null}
              formatar={(v) => (v === null ? "Não atingido" : `Mês ${v}`)}
            />
            <LinhaComparativa
              titulo="Breakeven Ponto de Caixa"
              versoes={versoes}
              extrair={(s) => s.resultado.breakeven.pontoDeCaixaMes ?? null}
              formatar={(v) => (v === null ? "Não atingido" : `Mês ${v}`)}
            />
            <LinhaComparativa
              titulo="Breakeven Operacional (Receita)"
              versoes={versoes}
              extrair={(s) => s.resultado.breakeven.operacionalReceita ?? null}
              formatar={(v) => (v === null ? "—" : formatarMoeda(v))}
            />
          </tbody>
        </table>
      </div>
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
