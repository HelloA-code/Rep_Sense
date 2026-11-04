import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/**
 * Keeps the login fresh on every request. This is the only place tokens are refreshed:
 * refreshing elsewhere too can look like token reuse and sign the user out.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = supabaseEnv();
  if (!env) return response;

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
