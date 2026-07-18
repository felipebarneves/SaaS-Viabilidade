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
import {
  adicionarCapex,
  adicionarCapitalGiro,
  adicionarCompetenciaReajuste,
  adicionarDepreciacaoAmortizacao,
  adicionarDespesaFinanceira,
  adicionarItemCronograma,
  restaurarItemCronograma,
  sobrescreverItemMensal,
} from "@/app/actions/projects";
import { salvarVersao } from "@/app/actions/versions";
import { DashboardMensal } from "@/app/projetos/[id]/dashboard-mensal";
import { formatarMoeda, formatarPercentual } from "@/lib/format";
import { validarProjetoParaSimulacao } from "@/lib/projects/validacao";

export default async function ProjetoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const dados = await carregarProjetoComRelacionamentos(supabase, id);
  if (!dados) notFound();

  const workspaceId = dados.project.workspace_id;
  const parametros = await carregarParametros(supabase, workspaceId);
  const parametrosFiscais = resolverParametrosFiscais(parametros);
  const taxaPadraoGlobal = resolverTaxaDescontoPadraoGlobal(parametros);

  const validacao = validarProjetoParaSimulacao(dados.project, parametrosFiscais);
  const avisos: string[] = [...validacao.avisos];

  const resultado =
    validacao.podeSimular && parametrosFiscais
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
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <a href={`/projetos/${id}/export.xlsx`}>Exportar .xlsx ↓</a>
          <a href={`/projetos/${id}/export.pdf`}>Exportar .pdf ↓</a>
          <Link href={`/projetos/${id}/versoes`}>Comparar versões →</Link>
        </div>
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
                <th>Editado</th>
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
                  <td>{item.editado_manualmente ? "Sim" : "—"}</td>
                </tr>
              ))}
              {dados.scheduleItems.length === 0 && (
                <tr>
                  <td colSpan={8} className="muted">
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

      {dados.scheduleItems.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Sobrescrita Manual por Competência (RF-CORE-002)</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Sobrescreve o Valor Unitário calculado automaticamente (rateio/reajuste) para um item num mês específico.
            Restaurar remove todos os overrides do item e volta ao cálculo automático.
          </p>

          {dados.scheduleItemOverrides.length > 0 && (
            <ul>
              {dados.scheduleItemOverrides.map((o) => {
                const item = dados.scheduleItems.find((i) => i.id === o.schedule_item_id);
                return (
                  <li key={o.id}>
                    {item?.tipo ?? "item"} ({o.schedule_item_id.slice(0, 8)}) — {o.mes_competencia.slice(0, 7)}: valor unitário sobrescrito para{" "}
                    {formatarMoeda(o.valor_unitario_override)}
                  </li>
                );
              })}
            </ul>
          )}

          <form action={sobrescreverItemMensal} style={{ display: "flex", gap: "0.5rem", alignItems: "end", marginBottom: "0.75rem" }}>
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <div className="field">
              <label htmlFor="override_item">Item</label>
              <select id="override_item" name="schedule_item_id" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {dados.scheduleItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.tipo} — início {item.data_inicio} — {formatarMoeda(item.valor_unitario)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="override_mes">Competência (YYYY-MM)</label>
              <input id="override_mes" name="mes_competencia" type="month" required />
            </div>
            <div className="field">
              <label htmlFor="override_valor">Valor Unitário Sobrescrito</label>
              <input id="override_valor" name="valor_unitario_override" type="number" step="any" required />
            </div>
            <button className="btn" type="submit">
              Sobrescrever
            </button>
          </form>

          <form action={restaurarItemCronograma} style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <div className="field">
              <label htmlFor="restore_item">Restaurar item ao cálculo automático</label>
              <select id="restore_item" name="schedule_item_id" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {dados.scheduleItems
                  .filter((item) => item.editado_manualmente)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.tipo} — início {item.data_inicio}
                    </option>
                  ))}
              </select>
            </div>
            <button className="btn-secondary btn" type="submit">
              Restaurar
            </button>
          </form>
        </div>
      )}

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

      <div className="card">
        <h2 style={{ fontSize: 15, marginTop: 0 }}>Depreciação/Amortização</h2>
        <ul>
          {dados.depreciationEntries.map((d) => (
            <li key={d.id}>
              {d.mes_competencia.slice(0, 7)} — Depreciação {formatarMoeda(d.depreciacao)} · Amortização {formatarMoeda(d.amortizacao)}
            </li>
          ))}
        </ul>
        <form action={adicionarDepreciacaoAmortizacao} style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
          <input type="hidden" name="project_id" value={id} />
          <input type="hidden" name="workspace_id" value={workspaceId} />
          <div className="field">
            <label htmlFor="da_mes">Mês (YYYY-MM)</label>
            <input id="da_mes" name="mes_competencia" type="month" required />
          </div>
          <div className="field">
            <label htmlFor="da_dep">Depreciação</label>
            <input id="da_dep" name="depreciacao" type="number" step="any" defaultValue={0} />
          </div>
          <div className="field">
            <label htmlFor="da_amort">Amortização</label>
            <input id="da_amort" name="amortizacao" type="number" step="any" defaultValue={0} />
          </div>
          <button className="btn" type="submit">
            + Lançar
          </button>
        </form>
      </div>

      {dados.project.considerar_custo_financeiro && (
        <div className="card">
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Despesas Financeiras</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Só entram no Lucro Antes do IR porque "Considerar Custo Financeiro" está ligado neste projeto (Regra 3).
          </p>
          <ul>
            {dados.financialExpenseEntries.map((d) => (
              <li key={d.id}>
                {d.mes_competencia.slice(0, 7)} — {formatarMoeda(d.valor)}
              </li>
            ))}
          </ul>
          <form action={adicionarDespesaFinanceira} style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
            <input type="hidden" name="project_id" value={id} />
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <div className="field">
              <label htmlFor="df_mes">Mês (YYYY-MM)</label>
              <input id="df_mes" name="mes_competencia" type="month" required />
            </div>
            <div className="field">
              <label htmlFor="df_valor">Valor</label>
              <input id="df_valor" name="valor" type="number" step="any" required />
            </div>
            <button className="btn" type="submit">
              + Lançar
            </button>
          </form>
        </div>
      )}

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

          <DashboardMensal linhasMensais={resultado.linhasMensais} />
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
