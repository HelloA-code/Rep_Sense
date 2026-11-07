import Link from "next/link";
import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** A titled group of rows, like a phone's settings screen. */
export function SettingsGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <h2 className="badge-text mb-2 px-1 text-muted">{title}</h2>}
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{children}</div>
    </section>
  );
}

type RowBody = { icon: LucideIcon; label: string; value?: string; danger?: boolean };

function Body({ icon: Icon, label, value, danger }: RowBody) {
  return (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-[11px]",
          danger ? "bg-danger/15 text-danger" : "bg-accent-tint text-accent",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <span className={cn("flex-1 text-[15px] font-semibold", danger && "text-danger")}>{label}</span>
      {value && <span className="max-w-[45%] truncate text-[13px] font-medium text-muted">{value}</span>}
    </>
  );
}

const rowClass = "flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-raised";
const chevron = <ChevronRightIcon className="size-4 shrink-0 text-muted" />;

export function SettingsLink({ href, ...body }: RowBody & { href: string }) {
  return (
    <Link href={href} className={rowClass}>
      <Body {...body} />
      {chevron}
    </Link>
  );
}

export function SettingsButton({
  onClick,
  disabled,
  ...body
}: RowBody & { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn(rowClass, "disabled:opacity-50")}>
      <Body {...body} />
      {!body.danger && chevron}
    </button>
  );
}

export function SettingsSwitch({
  checked,
  onChange,
  ...body
}: RowBody & { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={rowClass}>
      <Body {...body} />
      <span
        className={cn(
          "flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "justify-end bg-accent" : "justify-start bg-white/15",
        )}
      >
        <span className={cn("size-6 rounded-full", checked ? "bg-accent-fg" : "bg-white/70")} />
      </span>
    </button>
  );
}
