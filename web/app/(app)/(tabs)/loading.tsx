/** Shown the moment a tab is tapped, while its data loads, so taps never feel ignored. */
export default function TabLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="pt-safe">
        <div className="mt-6 h-8 w-32 rounded-chip bg-surface-raised" />
        <div className="mt-2 h-4 w-52 rounded-chip bg-surface" />
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <div className="h-44 rounded-card border border-border bg-surface" />
        <div className="h-24 rounded-card border border-border bg-surface" />
        <div className="h-36 rounded-card border border-border bg-surface" />
      </div>
    </div>
  );
}
