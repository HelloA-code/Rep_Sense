import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { serverSupabase } from "@/lib/supabase/server";

/** Google and email-confirmation links land here with a one-time code to swap for a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const supabase = await serverSupabase();

  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
