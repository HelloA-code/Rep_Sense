"use client";

import { useRef, useState } from "react";
import { CameraIcon, SparklesIcon } from "lucide-react";
import type { DraftItem } from "@/lib/nutrition/items";
import { photoToJpegBase64 } from "@/lib/nutrition/resize-image";
import { cn } from "@/lib/utils";

type Result = { items: DraftItem[]; dropped: number };

async function post(url: string, body: unknown): Promise<Result> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Partial<Result> & { error?: string };
  if (!res.ok || !data.items) throw new Error(data.error ?? "Something went wrong. Try again.");
  return { items: data.items, dropped: data.dropped ?? 0 };
}

/** "Describe it" and "Snap it": the AI finds the foods, the user reviews before saving. */
export function AiFoodInput({ onFound }: { onFound: (items: DraftItem[], source: "text" | "photo") => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"text" | "photo" | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(kind: "text" | "photo", task: () => Promise<Result>) {
    setBusy(kind);
    setMessage(null);
    try {
      const { items, dropped } = await task();
      if (items.length === 0) setMessage({ text: "No food found. Try describing it in a few words.", error: true });
      else {
        onFound(items, kind);
        if (kind === "text") setText("");
        setMessage({
          text: `Found ${items.length} ${items.length === 1 ? "food" : "foods"}. Check the amounts below.${dropped ? ` ${dropped} couldn't be estimated.` : ""}`,
          error: false,
        });
      }
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Something went wrong.", error: true });
    } finally {
      setBusy(null);
    }
  }

  function describe() {
    if (text.trim().length < 2) return;
    void run("text", () => post("/api/food/parse", { text }));
  }

  function photo(file: File | undefined) {
    if (!file) return;
    void run("photo", async () => post("/api/food/photo", { image: await photoToJpegBase64(file) }));
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-tile border border-border-strong bg-surface pr-1.5 pl-4 focus-within:border-accent-border">
          <input
            aria-label="Describe what you ate"
            placeholder="2 rotis, a bowl of dal, salad"
            maxLength={500}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && describe()}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-white/30"
          />
          <button
            type="button"
            aria-label="Find foods"
            disabled={busy !== null || text.trim().length < 2}
            onClick={describe}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-40"
          >
            <SparklesIcon className={cn("size-[18px]", busy === "text" && "animate-pulse")} />
          </button>
        </label>
        <button
          type="button"
          aria-label="Snap a photo of your meal"
          disabled={busy !== null}
          onClick={() => fileRef.current?.click()}
          className="grid size-[52px] shrink-0 place-items-center rounded-tile border border-accent-border bg-accent-tint text-accent disabled:opacity-40"
        >
          <CameraIcon className={cn("size-5", busy === "photo" && "animate-pulse")} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => photo(e.target.files?.[0])} />
      </div>
      <p className={cn("text-[12px] font-medium", message?.error ? "text-danger" : message ? "text-accent" : "text-muted")}>
        {busy === "photo"
          ? "Looking at your photo…"
          : busy === "text"
            ? "Finding the foods…"
            : message?.text ?? "Describe it, or snap a photo. Photos go to Google's Gemini once and aren't stored."}
      </p>
    </div>
  );
}
