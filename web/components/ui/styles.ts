import { cn } from "@/lib/utils";

// Plain strings (not a "use client" module) so server components can style
// links like buttons, e.g. <Link className={primaryButtonClass}>.

const buttonBase =
  "inline-flex h-[52px] w-full select-none items-center justify-center gap-2 rounded-full px-6 text-[16px] font-bold transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const primaryButtonClass = cn(buttonBase, "bg-accent text-accent-fg hover:bg-[#ffd060]");

export const secondaryButtonClass = cn(
  buttonBase,
  "border border-border-strong bg-surface text-text hover:bg-surface-raised",
);

export const iconButtonClass =
  "grid size-10 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-text transition hover:bg-surface-raised active:scale-95 focus-visible:outline-2 focus-visible:outline-accent";
