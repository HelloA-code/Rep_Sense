"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseEnv } from "@/lib/supabase/env";

/** On login and when the connection returns: sync the profile and upload queued workouts. */
export function SessionSync() {
  const router = useRouter();

  useEffect(() => {
    if (!supabaseEnv()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    // Loaded after the page is up: the Supabase client is big, and this can wait.
    void Promise.all([import("@/lib/data/sync"), import("@/lib/supabase/client")]).then(
      ([{ flushOutbox, syncCustomExercises, syncProfile }, { browserSupabase }]) => {
        const supabase = browserSupabase();
        if (cancelled || !supabase) return;
        const flush = async () => {
          const { sent } = await flushOutbox();
          if (sent > 0) router.refresh(); // show the newly uploaded workout
        };
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (!session || (event !== "SIGNED_IN" && event !== "INITIAL_SESSION")) return;
          // Deferred: awaiting Supabase calls inside this callback can deadlock its auth lock.
          setTimeout(() => {
            void syncProfile()
              .then(syncCustomExercises)
              .then(flush);
          }, 0);
        });
        window.addEventListener("online", flush);
        cleanup = () => {
          data.subscription.unsubscribe();
          window.removeEventListener("online", flush);
        };
      },
    );
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [router]);

  return null;
}
