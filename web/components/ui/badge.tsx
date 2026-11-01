import { cn } from "@/lib/utils";

type BadgeProps = React.ComponentProps<"span"> & { tone?: "accent" | "neutral" };

/** Small uppercase pill (BETA, FRONT): 11px/700, 0.12em tracking. */
export function Badge({ tone = "accent", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "badge-text inline-flex h-7 items-center rounded-full border px-3",
        tone === "accent"
          ? "border-accent-border bg-accent-tint text-accent"
          : "border-border-strong bg-surface text-text/80",
        className,
      )}
      {...props}
    />
  );
}
