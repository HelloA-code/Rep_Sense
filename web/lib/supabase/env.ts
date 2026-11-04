/** Supabase settings, or null when accounts aren't set up: the app then runs signed-out. */
export function supabaseEnv(): { url: string; key: string } | null {
  // Written out in full: Next.js only inlines NEXT_PUBLIC_ vars referenced literally.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
