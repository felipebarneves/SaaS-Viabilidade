import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { obterRoleNoWorkspace, podeGerirMembrosEFaturamento } from "@/lib/auth/rbac";
import type { WorkspaceMemberRow } from "@/lib/types/db";
import { alterarRoleMembro, convidarMembro, removerMembro } from "@/app/actions/members";

const ROLES: { value: string; label: string }[] = [
  { value: "OWNER_ADMIN", label: "Owner/Admin" },
  { value: "ANALYST_CREATOR", label: "Analyst/Creator" },
  { value: "VIEWER_EXECUTIVE", label: "Viewer/Executive" },
];

export default async function MembrosPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  let { workspace: workspaceId } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  if (!workspaceId) {
    // Sem ?workspace= na URL: usa o primeiro workspace do usuário (mesmo fallback da lista de projetos).
    const { data: membership } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .limit(1)
      .maybeSingle();
    if (!membership) redirect("/projetos");
    workspaceId = membership.workspace_id as string;
  }

  const role = await obterRoleNoWorkspace(supabase, workspaceId);
  const ehAdmin = podeGerirMembrosEFaturamento(role);

  const { data: membros, error } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const lista = (membros ?? []) as WorkspaceMemberRow[];

  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: "1rem" }}>Membros do Workspace</h1>

      {!ehAdmin && (
        <div className="card" style={{ borderColor: "var(--negative)" }}>
          <span className="negative">
            ⚠ Apenas Owner/Admin pode convidar, mudar a role ou remover membros. Você está vendo em modo leitura.
          </span>
        </div>
      )}

      <div className="table-scroll" style={{ marginBottom: "1.25rem" }}>
        <table>
          <thead>
            <tr>
              <th>E-mail</th>
              <th>Role</th>
              {ehAdmin && <th>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.map((m) => (
              <tr key={m.user_id}>
                <td style={{ textAlign: "left" }}>
                  {m.email ?? m.user_id.slice(0, 8)}
                  {m.user_id === userData.user!.id && <span className="muted"> (você)</span>}
                </td>
                <td>
                  {ehAdmin ? (
                    <form action={alterarRoleMembro} style={{ display: "inline-flex", gap: "0.5rem" }}>
                      <input type="hidden" name="workspace_id" value={workspaceId} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <select name="role" defaultValue={m.role}>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button className="btn-secondary btn" type="submit">
                        Salvar
                      </button>
                    </form>
                  ) : (
                    ROLES.find((r) => r.value === m.role)?.label ?? m.role
                  )}
                </td>
                {ehAdmin && (
                  <td>
                    <form action={removerMembro}>
                      <input type="hidden" name="workspace_id" value={workspaceId} />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="btn-secondary btn" type="submit">
                        Remover
                      </button>
                    </form>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ehAdmin && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h2 style={{ fontSize: 15, marginTop: 0 }}>Convidar Membro</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            A pessoa precisa já ter criado conta (feito login pelo menos uma vez) — o MVP não envia e-mail de convite
            automático.
          </p>
          <form action={convidarMembro} style={{ display: "flex", gap: "0.5rem", alignItems: "end", flexWrap: "wrap" }}>
            <input type="hidden" name="workspace_id" value={workspaceId} />
            <div className="field">
              <label htmlFor="invite_email">E-mail</label>
              <input id="invite_email" name="email" type="email" required />
            </div>
            <div className="field">
              <label htmlFor="invite_role">Role</label>
              <select id="invite_role" name="role" defaultValue="ANALYST_CREATOR">
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" type="submit">
              Convidar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
