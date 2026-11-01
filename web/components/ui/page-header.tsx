import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
};

/** Screen title (28px/800) with muted subtitle, for tab roots. */
export function PageHeader({ title, subtitle, right, className }: PageHeaderProps) {
  return (
    <header className={cn("pt-safe flex items-start justify-between gap-4 pb-6", className)}>
      <div className="pt-6">
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[14px] font-medium text-muted">{subtitle}</p>}
      </div>
      {right && <div className="pt-7">{right}</div>}
    </header>
  );
}
