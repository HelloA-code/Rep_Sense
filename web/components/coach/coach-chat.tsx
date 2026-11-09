"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircleIcon, Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ChatInput } from "@/components/ui/chat-input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How was my training this week?",
  "Which exercise has my lowest form score?",
  "Am I eating enough protein?",
];

/** Chat with the AI coach, which answers from the user's own workout and food numbers. */
export function CoachChat({ initial }: { initial: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setBusy(true);
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message }, { id: replyId, role: "assistant", content: "" }]);
    const write = (content: string) => setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content } : x)));
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        write(data.error ?? "Couldn't reach the coach. Try again.");
        return;
      }
      // The reply arrives in pieces; show each as it comes.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        write(reply);
      }
      if (!reply.trim()) write("No answer came back. Try asking again.");
    } catch {
      write("Couldn't reach the coach. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!window.confirm("Delete this conversation?")) return;
    const { browserSupabase } = await import("@/lib/supabase/client");
    const supabase = browserSupabase();
    const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
    const userId = data.session?.user.id;
    if (!supabase || !userId) return;
    const { error } = await supabase.from("coach_messages").delete().eq("user_id", userId);
    if (!error) setMessages([]);
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col">
      <PageHeader
        title="Coach"
        subtitle="Answers from your own workout and food numbers."
        right={
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button type="button" aria-label="Delete conversation" onClick={clear} className="grid size-9 place-items-center rounded-full text-muted hover:text-danger">
                <Trash2Icon className="size-4" />
              </button>
            )}
            <Badge>Beta</Badge>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-3 pb-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <span className="grid size-14 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
              <MessageCircleIcon className="size-6" strokeWidth={1.75} />
            </span>
            <p className="mt-4 text-[17px] font-bold">Ask about your training</p>
            <p className="mt-1 max-w-[30ch] text-[14px] font-medium text-muted">
              Your coach sees your workout stats and food log, never your camera.
            </p>
            <div className="mt-6 flex w-full flex-col gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-tile border border-border-strong bg-surface px-4 py-3 text-left text-[14px] font-medium text-text/85 hover:bg-surface-raised"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px] leading-relaxed font-medium whitespace-pre-wrap",
                m.role === "user" ? "self-end rounded-br-md bg-accent text-accent-fg" : "self-start rounded-bl-md border border-border bg-surface",
              )}
            >
              {m.content || <span className="inline-block animate-pulse text-muted">Thinking…</span>}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-28 pt-2">
        <ChatInput value={draft} onChange={setDraft} onSend={() => send(draft)} disabled={busy} />
        <p className="mt-2 text-center text-[11px] font-medium text-muted">
          AI can be wrong. Not medical advice. Messages go to Google&rsquo;s Gemini.
        </p>
      </div>
    </div>
  );
}
