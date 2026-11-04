import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database";
import { supabaseEnv } from "./env";

/** For server components and route handlers: one client per request, tied to its cookies. */
export async function serverSupabase() {
  const env = supabaseEnv();
  if (!env) return null;
  const store = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server components can't write cookies; the middleware refreshes the session.
        }
      },
    },
  });
}

export type ServerSupabase = NonNullable<Awaited<ReturnType<typeof serverSupabase>>>;

/** The verified signed-in user. getClaims checks the token; never trust the raw session cookie. */
export async function currentUser(): Promise<{ supabase: ServerSupabase; id: string; email: string | null } | null> {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { supabase, id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
