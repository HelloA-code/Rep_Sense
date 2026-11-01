import type { LucideIcon } from "lucide-react";
import { Card } from "./card";

/** Placeholder card for screens that arrive on a later day. */
export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid size-14 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
        <Icon className="size-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-[17px] font-bold">{title}</h2>
      <p className="mt-1.5 max-w-[30ch] text-[14px] font-medium text-muted">{text}</p>
    </Card>
  );
}
