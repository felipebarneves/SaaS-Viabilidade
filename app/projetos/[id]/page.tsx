import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { carregarProjetoComRelacionamentos } from "@/lib/projects/repository";
import { montarProjetoInput } from "@/lib/projects/mapper";
import {
  carregarParametros,
  resolverParametrosFiscais,
  resolverTaxaDescontoPadraoGlobal,
} from "@/lib/params/resolve";
import { simular } from "@/core/engine";
import { adicionarCapex, adicionarCapitalGiro, adicionarCompetenciaReajuste, adicionarItemCronograma } from "@/app/actions/projects";
import { salvarVersao } from "@/app/actions/versions";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number): string {
  return `${(valor * 100).toFixed(1)}%`;
}

export default async function ProjetoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const dados = await carregarProjetoComRelacionamentos(supabase, id);
  if (!dados) notFound();

  const workspaceId = dados.project.workspace_id;
  const parametros = await carregarParametros(supabase, workspaceId);
  const parametrosFiscais = resolverParametrosFiscais(parametros);
  const taxaPadraoGlobal = resolverTaxaDescontoPadraoGlobal(parametros);

  const avisos: string[] = [];
  if (!parametrosFiscais) {
    avisos.push(
      "Parâmetros fiscais (alíquotas IRPJ/CSLL, limite mensal adicional) não configurados no Workspace nem no Sistema — cálculo de IR/CSLL suspenso.",
    );
  }

  const resultado = parametrosFiscais
    ? simular(montarProjetoInput(dados, taxaPadraoGlobal, parametrosFiscais))
    : null;

  if (resultado?.vpl.status === "SUSPENSO" && resultado.vpl.motivoSuspensao) {
    avisos.push(resultado.vpl.motivoSuspensao);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>{dados.project.nome}</h1>
          <span className="muted">
            {dados.project.duracao_meses} meses · {dados.project.regime_tributario}
          </span>
        </div>
        <Link href={`/projetos/${id}/versoes`}>Comparar versões →</Link>
      </div>

      {avisos.map((aviso) => (
        <div key={aviso} className="card" style={{ borderColor: "var(--negative)" }}>
          <span className="negative">⚠ {aviso}</span>
        </div>
      ))}

      <div className="card">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Cronograma Físico-Financeiro (Módulo 2)</h2>
        <div className="table-scroll" style={{ marginBottom: "1rem" }}>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Classificação</th>
                <th>Início</th>
                <th>Duração</th>
                <th>Qtd.</th>
                <th>Valor Unit.</th>
                <th>Impostos</th>
              </tr>
            </thead>
            <tbody>
              {dados.scheduleItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.tipo}</td>
                  <td>{item.classificacao_custo ?? "—"}</td>
                  <td>{item.data_inicio}</td>
                  <td>{item.duracao_meses}</td>
                  <td>{item.quantidade}</td>
                  <td>{formatarMoeda(item.valor_unitario)}</td>
                  <td>{formatarPercentual(item.aliquota_impostos)}</td>
                </tr>
              ))}
              {dados.scheduleItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted">
                    Nenhum item lançado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form action={adicionarItemCronograma} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.5rem", alignItems: "end" }}>
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="workspace_id" value={workspaceId} />
          <div className="field">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" name="tipo" required defaultValue="RECEITA">
              <option value="RECEITA">Receita</option>
              <option value="CUSTO">Custo</option>
              <option value="DESPESA_OPERACIONAL">Despesa Operacional</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="classificacao_custo">Classificação</label>
            <select id="classificacao_custo" name="classificacao_custo" defaultValue="">
              <option value="">—</option>
              <option value="FIXO">Fixo</option>
              <option value="VARIAVEL">Variável</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="data_inicio">Início</label>
            <input id="data_inicio" name="data_inicio" type="date" required />
          </div>
          <div className="field">
            <label htmlFor="duracao_meses">Duração</label>
            <input id="duracao_meses" name="duracao_meses" type="number" min={1} required />
          </div>
          <div className="field">
            <label htmlFor="quantidade">Qtd.</label>
            <input id="quantidade" name="quantidade" type="number" step="any" required />
          </div>
          <div className="field">
            <label htmlFor="valor_unitario">Valor Unit.</label>
            <input id="valor_unitario" name="valor_unitario" type="number" step="any" required />
          </div>
          <div className="field">
            <label htmlFor="aliquota_impostos">Impostos (só Receita)</label>
            <input id="aliquota_impostos" name="aliquota_impostos" type="number" step="0.0001" min={0} max={1} />
          </div>
          <button className="btn" type="submit" style={{ gridColumn: "1 / -1", justifySelf: "start" }}>
            + Adicionar Item
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Capex</h2>
        <ul>
          {dados.capexItems.map((c) => (
            <li key={c.id}>
              {c.mes_competencia.slice(0, 7)} — {formatarMoeda(c.valor)}
            </li>
          ))}
        </ul>
        <form action={adicionarCapex} style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="workspace_id" value={workspaceId} />
          <div className="field">
            <label htmlFor="capex_mes">Mês (YYYY-MM)</label>
            <input id="capex_mes" name="mes_competencia" type="month" required />
          </div>
          <div className="field">
            <label htmlFor="capex_valor">Valor</label>
            <input id="capex_valor" name="valor" type="number" step="any" required />
          </div>
          <button className="btn" type="submit">
            + Adicionar Capex
          </button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Variação de Capital de Giro</h2>
        <ul>
          {dados.workingCapitalEntries.map((v) => (
            <li key={v.id}>
              {v.mes_competencia.slice(0, 7)} — {formatarMoeda(v.valor)}
            </li>
          ))}
        </ul>
        <form action={adicionarCapitalGiro} style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="workspace_id" value={workspaceId} />
          <div className="field">
            <label htmlFor="cg_mes">Mês (YYYY-MM)</label>
            <input id="cg_mes" name="mes_competencia" type="month" required />
          </div>
          <div className="field">
            <label htmlFor="cg_valor">Valor (+ necessidade / − liberação)</label>
            <input id="cg_valor" name="valor" type="number" step="any" required />
          </div>
          <button className="btn" type="submit">
            + Lançar
          </button>
        </form>
      </div>

      {dados.project.aplica_reajuste_contratual && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Percentual do Índice por Competência</h2>
          <ul>
            {dados.adjustmentCompetencies.map((c) => (
              <li key={c.id}>
                {c.mes_competencia.slice(0, 7)} — {formatarPercentual(c.percentual_indice)}
              </li>
            ))}
          </ul>
          <form action={adicionarCompetenciaReajuste} style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <div className="field">
              <label htmlFor="reaj_mes">Competência (YYYY-MM)</label>
              <input id="reaj_mes" name="mes_competencia" type="month" required />
            </div>
            <div className="field">
              <label htmlFor="reaj_pct">Percentual do Índice</label>
              <input id="reaj_pct" name="percentual_indice" type="number" step="0.0001" required />
            </div>
            <button className="btn" type="submit">
              + Lançar
            </button>
          </form>
        </div>
      )}

      {resultado && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Resultados (Módulo 3)</h2>
            <form action={salvarVersao} style={{ display: "flex", gap: "0.5rem" }}>
              <input type="hidden" name="project_id" value={id} />
              <input type="hidden" name="workspace_id" value={workspaceId} />
              <input name="nome" placeholder="Nome da versão" required />
              <button className="btn" type="submit">
                Salvar Versão
              </button>
            </form>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "1rem",
              margin: "1rem 0",
            }}
          >
            <Indicador titulo="VPL" valor={resultado.vpl.status === "CALCULADO" ? formatarMoeda(resultado.vpl.valor!) : "Suspenso"} />
            <Indicador titulo="Payback Simples" valor={resultado.payback.paybackSimplesMes !== undefined ? `Mês ${resultado.payback.paybackSimplesMes}` : "Não atingido"} />
            <Indicador titulo="Payback Descontado" valor={resultado.payback.paybackDescontadoMes !== undefined ? `Mês ${resultado.payback.paybackDescontadoMes}` : "Não atingido"} />
            <Indicador titulo="Breakeven Ponto de Caixa" valor={resultado.breakeven.pontoDeCaixaMes !== undefined ? `Mês ${resultado.breakeven.pontoDeCaixaMes}` : "Não atingido"} />
            <Indicador
              titulo="Breakeven Operacional"
              valor={resultado.breakeven.operacionalReceita !== undefined ? formatarMoeda(resultado.breakeven.operacionalReceita) : "—"}
            />
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mês</th>
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
                {resultado.linhasMensais.map((l) => (
                  <tr key={l.mesCompetencia}>
                    <td>{l.mesCompetencia}</td>
                    <td>{formatarMoeda(l.receitaLiquida)}</td>
                    <td>{formatarMoeda(l.ebitda)}</td>
                    <td>{formatarMoeda(l.ebit)}</td>
                    <td>{formatarMoeda(l.irCsll)}</td>
                    <td>{formatarMoeda(l.lucroLiquido)}</td>
                    <td className={l.fcl < 0 ? "negative" : "positive"}>{formatarMoeda(l.fcl)}</td>
                    <td className={l.caixaAcumulado < 0 ? "negative" : "positive"}>{formatarMoeda(l.caixaAcumulado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem" }}>
      <div className="muted" style={{ fontSize: 12 }}>
        {titulo}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{valor}</div>
    </div>
  );
}
