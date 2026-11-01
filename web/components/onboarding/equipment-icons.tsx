import { BackpackIcon, DumbbellIcon, InfinityIcon } from "lucide-react";
import type { EquipmentId } from "@/lib/equipment";

// Thin-stroke line icons in lucide's style for gear lucide doesn't have.

type IconProps = { className?: string };

function Line({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const PullUpBar = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 5h18M6 5v15M18 5v15M4 20h4M16 20h4" />
  </Line>
);

const Rings = (p: IconProps) => (
  <Line {...p}>
    <path d="M8 2v8M16 2v8" />
    <circle cx="8" cy="14.5" r="4" />
    <circle cx="16" cy="14.5" r="4" />
  </Line>
);

const Parallettes = (p: IconProps) => (
  <Line {...p}>
    <path d="M5 10h14M7 10l-3 8M17 10l3 8M2.5 18h3M18.5 18h3" />
  </Line>
);

const DipStation = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 8h6M15 8h6M6 8v12M18 8v12M9 8v4M15 8v4M9 12h6M4 20h4M16 20h4" />
  </Line>
);

const WeightVest = (p: IconProps) => (
  <Line {...p}>
    <path d="M9 3 5 5.5V21h5v-6h4v6h5V5.5L15 3c-.6 1.8-1.6 3-3 3S9.6 4.8 9 3Z" />
    <path d="M7.5 11h2M14.5 11h2" />
  </Line>
);

const Bench = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="9" width="18" height="3.5" rx="1" />
    <path d="M6 12.5V19M18 12.5V19M12 12.5V16" />
  </Line>
);

const Box = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 9h16v11H4zM4 9l3-4h10l3 4" />
    <path d="M9.5 14.5h5" />
  </Line>
);

const Kettlebell = (p: IconProps) => (
  <Line {...p}>
    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
    <path d="M6.2 20.5a6.5 6.5 0 1 1 11.6 0Z" />
  </Line>
);

const Mat = (p: IconProps) => (
  <Line {...p}>
    <path d="M6 12h12a3.5 3.5 0 0 1 0 7H6" />
    <circle cx="6" cy="15.5" r="3.5" />
    <circle cx="6" cy="15.5" r="1" />
  </Line>
);

export const EQUIPMENT_ICONS: Record<EquipmentId, React.ComponentType<IconProps>> = {
  "pullup-bar": PullUpBar,
  rings: Rings,
  parallettes: Parallettes,
  "dip-station": DipStation,
  bands: (p) => <InfinityIcon strokeWidth={1.75} {...p} />,
  "weight-vest": WeightVest,
  backpack: (p) => <BackpackIcon strokeWidth={1.75} {...p} />,
  bench: Bench,
  box: Box,
  dumbbells: (p) => <DumbbellIcon strokeWidth={1.75} {...p} />,
  kettlebell: Kettlebell,
  mat: Mat,
};
