// 5.2 Matriz de Permissões — Viewer/Executive nunca deve conseguir escrever.
// RLS no banco já bloqueia fisicamente, mas a UI/Server Actions checam a role antes
// de tentar a escrita para dar feedback imediato em vez de um erro genérico de RLS.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRole } from "@/lib/types/db";

export async function obterRoleNoWorkspace(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return (data?.role as WorkspaceRole | undefined) ?? null;
}

export function podeEscrever(role: WorkspaceRole | null): boolean {
  return role === "OWNER_ADMIN" || role === "ANALYST_CREATOR";
}

export function podeGerirMembrosEFaturamento(role: WorkspaceRole | null): boolean {
  return role === "OWNER_ADMIN";
}

/** 5.2: exclusão permanente de projetos é permissão exclusiva de Owner/Admin. */
export function podeExcluirProjeto(role: WorkspaceRole | null): boolean {
  return role === "OWNER_ADMIN";
}
