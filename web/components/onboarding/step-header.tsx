export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-[14px] font-medium text-muted">{subtitle}</p>
    </div>
  );
}
