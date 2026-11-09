"use client";

import { ArrowUpIcon } from "lucide-react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
};

/** Rounded input with a yellow circular send button (DESIGN.md §3). */
export function ChatInput({ value, onChange, onSend, disabled, placeholder = "Ask Coach anything" }: ChatInputProps) {
  const canSend = !disabled && value.trim().length > 0;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className="flex items-center gap-2 rounded-full border border-border-strong bg-[#141414] py-1.5 pr-1.5 pl-5 focus-within:border-accent-border"
    >
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        maxLength={1000}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-white/35"
      />
      <button
        type="submit"
        aria-label="Send"
        disabled={!canSend}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-fg transition-opacity disabled:opacity-40"
      >
        <ArrowUpIcon className="size-5" strokeWidth={2.5} />
      </button>
    </form>
  );
}
