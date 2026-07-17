import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Client Supabase para Server Components / Route Handlers — respeita RLS via cookies de sessão. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll chamado de um Server Component sem middleware de refresh — ignorável.
          }
        },
      },
    },
  );
}
