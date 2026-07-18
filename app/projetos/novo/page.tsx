import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarProjeto } from "@/app/actions/projects";

export default async function NovoProjetoPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string; erro?: string }>;
}) {
  let { workspace } = await searchParams;
  const { erro } = await searchParams;
  if (!workspace) {
    // Sem ?workspace= na URL (acesso direto/bookmark): usa o primeiro workspace do usuário,
    // como a lista de projetos já faz; sem nenhum, volta para o bootstrap de workspace.
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) redirect("/login");
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .limit(1)
      .maybeSingle();
    if (!membership) redirect("/projetos");
    workspace = membership.workspace_id as string;
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 18, marginTop: 0 }}>Novo Projeto</h1>
      {erro && <p className="negative">{erro}</p>}
      <form action={criarProjeto}>
        <input type="hidden" name="workspace_id" value={workspace} />

        <div className="field">
          <label htmlFor="nome">Nome do Projeto</label>
          <input id="nome" name="nome" required style={{ width: "100%" }} />
        </div>

        <div className="field">
          <label htmlFor="duracao_meses">Duração (meses)</label>
          <input id="duracao_meses" name="duracao_meses" type="number" min={1} required />
        </div>

        <div className="field">
          <label htmlFor="regime_tributario">Regime Tributário (IR/CSLL)</label>
          <select id="regime_tributario" name="regime_tributario" required defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
            <option value="LUCRO_REAL">Lucro Real</option>
            <option value="SIMPLIFICADO_ALIQUOTA_UNICA">Simplificado (Alíquota Única)</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="percentual_presuncao">Percentual de Presunção (%) — se Lucro Presumido</label>
          <input id="percentual_presuncao" name="percentual_presuncao" type="number" step="0.0001" min={0} max={1} placeholder="ex: 0.32" />
        </div>

        <div className="field">
          <label htmlFor="aliquota_efetiva_ir_csll">Alíquota Efetiva IR+CSLL (%) — se Simplificado</label>
          <input id="aliquota_efetiva_ir_csll" name="aliquota_efetiva_ir_csll" type="number" step="0.0001" min={0} max={1} placeholder="ex: 0.06" />
        </div>

        <div className="field">
          <label htmlFor="taxa_desconto_projeto">Taxa de Desconto do Projeto (VPL, anual) — opcional</label>
          <input id="taxa_desconto_projeto" name="taxa_desconto_projeto" type="number" step="0.0001" min={0} placeholder="Se vazio, usa a taxa padrão do Workspace" />
        </div>

        <div className="field">
          <label>
            <input type="checkbox" name="considerar_custo_financeiro" style={{ width: "auto", marginRight: "0.5rem" }} />
            Considerar Custo Financeiro
          </label>
        </div>

        <fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, marginBottom: "0.75rem" }}>
          <legend>Reajuste Contratual</legend>
          <div className="field">
            <label>
              <input type="checkbox" name="aplica_reajuste_contratual" style={{ width: "auto", marginRight: "0.5rem" }} />
              Aplica Reajuste Contratual
            </label>
          </div>
          <div className="field">
            <label htmlFor="indice_reajuste">Índice de Reajuste</label>
            <select id="indice_reajuste" name="indice_reajuste" defaultValue="">
              <option value="">—</option>
              <option value="IPCA">IPCA</option>
              <option value="INCC_M">INCC-M</option>
              <option value="IGP_M">IGP-M</option>
              <option value="OUTRO">Outro (Setorial)</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="indice_reajuste_outro_nome">Nome do Índice (se "Outro")</label>
            <input id="indice_reajuste_outro_nome" name="indice_reajuste_outro_nome" />
          </div>
          <div className="field">
            <label htmlFor="periodicidade_reajuste">Periodicidade</label>
            <select id="periodicidade_reajuste" name="periodicidade_reajuste" defaultValue="">
              <option value="">—</option>
              <option value="ANUAL">Anual</option>
              <option value="ANIVERSARIO_CONTRATO">Data de Aniversário do Contrato</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="mes_base_reajuste">Mês-base do Reajuste (1-12)</label>
            <input id="mes_base_reajuste" name="mes_base_reajuste" type="number" min={1} max={12} />
          </div>
        </fieldset>

        <button className="btn" type="submit">
          Criar Projeto
        </button>
      </form>
    </div>
  );
}
