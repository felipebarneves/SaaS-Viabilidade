"use server";

// 5.2 RBAC: convite, mudança de role e remoção de membros — restrito a Owner/Admin.
// A checagem aqui é só para dar feedback rápido; a RLS (0009_rbac_member_management.sql)
// é quem garante de verdade, inclusive contra chamadas diretas à API.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { obterRoleNoWorkspace, podeGerirMembrosEFaturamento } from "@/lib/auth/rbac";
import type { WorkspaceRole } from "@/lib/types/db";

async function exigirAdmin(workspaceId: string) {
  const supabase = await createClient();
  const role = await obterRoleNoWorkspace(supabase, workspaceId);
  if (!podeGerirMembrosEFaturamento(role)) {
    throw new Error("Apenas Owner/Admin pode gerenciar membros do workspace.");
  }
  return supabase;
}

export async function convidarMembro(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role")) as WorkspaceRole;
  if (!email) throw new Error("E-mail é obrigatório.");

  const supabase = await exigirAdmin(workspaceId);

  const { data: userId, error: lookupError } = await supabase.rpc("find_user_id_by_email", {
    p_email: email,
  });
  if (lookupError) throw lookupError;
  if (!userId) {
    throw new Error(
      `Nenhuma conta encontrada para ${email}. A pessoa precisa acessar o login e criar a conta antes de ser convidada (MVP não manda e-mail de convite automático).`,
    );
  }

  const { error: insertError } = await supabase.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: userId,
    role,
    email,
  });
  if (insertError) throw insertError;

  revalidatePath("/projetos/membros");
}

export async function alterarRoleMembro(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id"));
  const userId = String(formData.get("user_id"));
  const role = String(formData.get("role")) as WorkspaceRole;

  const supabase = await exigirAdmin(workspaceId);

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;

  revalidatePath("/projetos/membros");
}

export async function removerMembro(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id"));
  const userId = String(formData.get("user_id"));

  const supabase = await exigirAdmin(workspaceId);

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw error;

  revalidatePath("/projetos/membros");
}
