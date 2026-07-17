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

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .insert({ nome })
    .select("id")
    .single();
  if (workspaceError) throw workspaceError;

  const { error: memberError } = await supabase.from("workspace_members").insert({
    workspace_id: workspace.id,
    user_id: userData.user.id,
    role: "OWNER_ADMIN",
  });
  if (memberError) throw memberError;

  revalidatePath("/workspaces");
  redirect(`/projetos?workspace=${workspace.id}`);
}
