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

const Barbell = (p: IconProps) => (
  <Line {...p}>
    <path d="M2 12h20M5 8v8M7.5 9.5v5M19 8v8M16.5 9.5v5" />
  </Line>
);

const EzBar = (p: IconProps) => (
  <Line {...p}>
    <path d="M2 12h5l1.5-1.5L10 12l2-1.5 2 1.5 1.5-1.5L17 12h5M4.5 8.5v7M19.5 8.5v7" />
  </Line>
);

const CableMachine = (p: IconProps) => (
  <Line {...p}>
    <path d="M5 21V3h12v3M3 21h5M17 9v8M15 17h4" />
    <circle cx="17" cy="7.5" r="1.5" />
  </Line>
);

const GymMachine = (p: IconProps) => (
  <Line {...p}>
    <rect x="14" y="3" width="6" height="9" rx="1" />
    <path d="M14 6h6M14 9h6M17 12v8M3 15h8M7 15v5M3 20h16" />
  </Line>
);

const AssistBand = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 4h18M10 4c-3 6-3 11 2 16 5-5 5-10 2-16" />
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
  barbell: Barbell,
  "ez-bar": EzBar,
  "cable-machine": CableMachine,
  machines: GymMachine,
  "assist-band": AssistBand,
};
