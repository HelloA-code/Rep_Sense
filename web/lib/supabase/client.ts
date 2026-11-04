import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database";
import { supabaseEnv } from "./env";

export type BrowserSupabase = ReturnType<typeof createBrowserClient<Database>>;

/** For client components. createBrowserClient reuses one instance. Null if accounts aren't set up. */
export function browserSupabase(): BrowserSupabase | null {
  const env = supabaseEnv();
  return env ? createBrowserClient<Database>(env.url, env.key) : null;
}
