"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function criarWorkspace(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) throw new Error("Nome do workspace é obrigatório.");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Não autenticado.");

  // Gera o id no cliente para não depender de SELECT-back (RETURNING) logo após o INSERT:
  // no bootstrap do workspace o usuário ainda não é membro, então a policy de SELECT
  // (is_workspace_member) barraria a leitura de volta mesmo que o INSERT em si seja permitido.
  const workspaceId = crypto.randomUUID();

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .insert({ id: workspaceId, nome });
  if (workspaceError) throw workspaceError;

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: userData.user.id,
    role: "OWNER_ADMIN",
    email: userData.user.email,
  });
  if (memberError) throw memberError;

  revalidatePath("/workspaces");
  redirect(`/projetos?workspace=${workspaceId}`);
}
