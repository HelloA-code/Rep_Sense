import { cn } from "@/lib/utils";

/** Glass card: 4% white on black, 1px border, 20px radius. */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-border bg-surface p-5 backdrop-blur-sm", className)}
      {...props}
    />
  );
}
