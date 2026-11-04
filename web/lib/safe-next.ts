/**
 * Where to go after login. Only paths inside this app: otherwise a crafted link like
 * /login?next=https://evil.example would bounce someone off-site after signing in.
 */
export function safeNext(next: string | null | undefined, fallback = "/today"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
