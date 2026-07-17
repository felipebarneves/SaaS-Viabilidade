"use server";

import { createClient } from "@/lib/supabase/server";

export async function enviarMagicLink(
  _prevState: { erro?: string; enviado?: boolean },
  formData: FormData,
): Promise<{ erro?: string; enviado?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { erro: "Informe um e-mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) return { erro: error.message };
  return { enviado: true };
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
