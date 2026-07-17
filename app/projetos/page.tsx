import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarWorkspace } from "@/app/actions/workspaces";

interface WorkspaceMembership {
  workspace_id: string;
  workspaces: { id: string; nome: string } | null;
}

export default async function ProjetosPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const { workspace: workspaceIdParam } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: membershipsRaw, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, nome)");
  if (membershipsError) throw membershipsError;

  const memberships = (membershipsRaw ?? []) as unknown as WorkspaceMembership[];

  if (memberships.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 420 }}>
        <h1 style={{ fontSize: 18, marginTop: 0 }}>Criar seu primeiro Workspace</h1>
        <p className="muted">
          Todo projeto pertence a um Workspace (Tenant) — você se torna Owner/Admin automaticamente.
        </p>
        <form action={criarWorkspace}>
          <div className="field">
            <label htmlFor="nome">Nome do Workspace</label>
            <input id="nome" name="nome" required style={{ width: "100%" }} />
          </div>
          <button className="btn" type="submit">
            Criar Workspace
          </button>
        </form>
      </div>
    );
  }

  const workspaceId = workspaceIdParam ?? memberships[0]!.workspace_id;

  const { data: projetos, error: projetosError } = await supabase
    .from("projects")
    .select("id, nome, duracao_meses, regime_tributario, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (projetosError) throw projetosError;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ fontSize: 20 }}>Projetos</h1>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {memberships.length > 1 && (
            <form>
              <select name="workspace" defaultValue={workspaceId} onChange={(e) => e.currentTarget.form?.submit()}>
                {memberships.map((m) => (
                  <option key={m.workspace_id} value={m.workspace_id}>
                    {m.workspaces?.nome ?? m.workspace_id}
                  </option>
                ))}
              </select>
            </form>
          )}
          <Link className="btn" href={`/projetos/novo?workspace=${workspaceId}`}>
            + Novo Projeto
          </Link>
        </div>
      </div>

      {(!projetos || projetos.length === 0) && <p className="muted">Nenhum projeto cadastrado ainda.</p>}

      {projetos && projetos.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Duração (meses)</th>
                <th>Regime Tributário</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/projetos/${p.id}`}>{p.nome}</Link>
                  </td>
                  <td>{p.duracao_meses}</td>
                  <td>{p.regime_tributario}</td>
                  <td>{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
