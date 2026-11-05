"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PrimaryButton, SecondaryButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentChip } from "@/components/ui/segment-chip";
import { TopBar } from "@/components/ui/top-bar";
import { safeNext } from "@/lib/safe-next";
import { supabaseEnv } from "@/lib/supabase/env";

const inputClass =
  "h-[52px] w-full rounded-tile border border-border-strong bg-surface px-4 text-[16px] font-semibold outline-none placeholder:text-white/30 focus:border-accent-border";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const configured = supabaseEnv() !== null;
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(
    params.get("error") ? { text: "That link didn't work. Try signing in again.", error: true } : null,
  );

  /** The Supabase client is big, so it's only fetched when someone actually signs in. */
  const client = async () => (await import("@/lib/supabase/client")).browserSupabase();

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  function enter() {
    router.replace(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = await client();
    if (!supabase) return;
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) return enter();
      setMessage({ text: error.message, error: true });
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callback() },
    });
    setBusy(false);
    if (error) setMessage({ text: error.message, error: true });
    else if (data.session) enter();
    else setMessage({ text: "Almost there: open the link we emailed you to confirm your account.", error: false });
  }

  async function google() {
    setBusy(true);
    const supabase = await client();
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) {
      setMessage({ text: error.message, error: true });
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col pb-8">
      <TopBar title={mode === "signin" ? "Sign in" : "Create account"} backHref="/today" />
      <p className="-mt-1 text-[14px] font-medium text-muted">
        Save your workouts and see your progress on any device. Only numbers are stored, never video.
      </p>

      {!configured ? (
        <Card className="mt-6">
          <p className="text-[15px] font-bold">Accounts aren&rsquo;t set up yet</p>
          <p className="mt-1 text-[13px] font-medium text-muted">You can still train; workouts stay on this device.</p>
        </Card>
      ) : (
        <>
          <div className="mt-6 flex gap-2">
            <SegmentChip selected={mode === "signin"} onClick={() => setMode("signin")}>
              Sign in
            </SegmentChip>
            <SegmentChip selected={mode === "signup"} onClick={() => setMode("signup")}>
              Create account
            </SegmentChip>
          </div>

          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              aria-label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="Password (8+ characters)"
              aria-label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            {message && (
              <p role="status" className={`text-[13px] font-semibold ${message.error ? "text-danger" : "text-accent"}`}>
                {message.text}
              </p>
            )}
            <PrimaryButton type="submit" disabled={busy}>
              {busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
            </PrimaryButton>
          </form>

          <div className="my-5 flex items-center gap-3 text-[12px] font-semibold text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <SecondaryButton onClick={google} disabled={busy}>
            Continue with Google
          </SecondaryButton>
        </>
      )}
    </div>
  );
}
