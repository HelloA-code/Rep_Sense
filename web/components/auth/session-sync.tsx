"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushOutbox, syncProfile } from "@/lib/data/sync";
import { browserSupabase } from "@/lib/supabase/client";

/** On login and when the connection returns: sync the profile and upload queued workouts. */
export function SessionSync() {
  const router = useRouter();

  useEffect(() => {
    const supabase = browserSupabase();
    if (!supabase) return;

    const flush = async () => {
      const { sent } = await flushOutbox();
      if (sent > 0) router.refresh(); // show the newly uploaded workout
    };
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || (event !== "SIGNED_IN" && event !== "INITIAL_SESSION")) return;
      // Deferred: awaiting Supabase calls inside this callback can deadlock its auth lock.
      setTimeout(() => {
        void syncProfile().then(flush);
      }, 0);
    });
    window.addEventListener("online", flush);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", flush);
    };
  }, [router]);

  return null;
}
