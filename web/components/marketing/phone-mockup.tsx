import { RefreshCwIcon, XIcon } from "lucide-react";

// Illustration of the live camera screen: yellow skeleton in a squat,
// one joint flagged with a red ring + cue. No photo, no real data.

const J = {
  head: [100, 62],
  ls: [74, 100], rs: [126, 100],
  le: [56, 136], re: [144, 136],
  lw: [90, 146], rw: [110, 146],
  lh: [82, 190], rh: [118, 190],
  lk: [50, 214], rk: [150, 214],
  la: [66, 272], ra: [134, 272],
} as const;

type JointName = keyof typeof J;

const BONES: [JointName, JointName][] = [
  ["ls", "rs"], ["ls", "le"], ["le", "lw"], ["rs", "re"], ["re", "rw"],
  ["ls", "lh"], ["rs", "rh"], ["lh", "rh"],
  ["lh", "lk"], ["lk", "la"], ["rh", "rk"], ["rk", "ra"],
];

export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[280px] sm:w-[300px]">
      <div aria-hidden className="absolute -inset-16 -z-10 rounded-full bg-[radial-gradient(closest-side,rgba(255,190,40,0.22),transparent)]" />
      <div className="relative aspect-[9/19] overflow-hidden rounded-[46px] border-[6px] border-[#1c1c1c] bg-[#0b0b0b] shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
        {/* "camera feed": a dim room */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#2a2723_0%,#1a1816_55%,#0f0e0d_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.5))]" />

        <div className="absolute top-2.5 left-1/2 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

        <div className="absolute inset-x-0 top-12 flex items-center justify-between px-4">
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur">
            <XIcon className="size-4" />
          </span>
          <span className="badge-text flex h-7 items-center gap-1.5 rounded-full bg-white/10 px-3 text-white/90 backdrop-blur">
            <span className="size-1.5 rounded-full bg-danger" />
            Rec 12s · 7 reps
          </span>
          <span className="grid size-8 place-items-center rounded-full bg-white/10 text-white/80 backdrop-blur">
            <RefreshCwIcon className="size-3.5" />
          </span>
        </div>

        <svg viewBox="0 0 200 320" className="absolute inset-x-0 top-[13%] w-full" aria-hidden>
          <g stroke="#FFC53D" strokeWidth="2.5" strokeLinecap="round">
            {BONES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={J[a][0]} y1={J[a][1]} x2={J[b][0]} y2={J[b][1]} />
            ))}
          </g>
          <circle cx={J.head[0]} cy={J.head[1]} r="15" fill="none" stroke="#FFC53D" strokeWidth="2.5" />
          {(Object.keys(J) as JointName[])
            .filter((k) => k !== "head")
            .map((k) => (
              <circle key={k} cx={J[k][0]} cy={J[k][1]} r="4.5" fill="#FFC53D" stroke="#111" strokeWidth="1.5" />
            ))}
          <circle cx={J.lk[0]} cy={J.lk[1]} r="15" fill="none" stroke="#FF4D4D" strokeWidth="2.5" />
          <g transform={`translate(${J.lk[0] - 4} ${J.lk[1] + 22})`}>
            <rect width="62" height="20" rx="10" fill="#FF4D4D" />
            <text x="31" y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="#111">
              Knees out
            </text>
          </g>
        </svg>

        <div className="absolute inset-x-3 bottom-4 flex items-end justify-between rounded-[22px] border border-white/10 bg-black/55 px-5 py-3 backdrop-blur-md">
          <div>
            <p className="text-[11px] font-semibold text-white/60">Squat</p>
            <p className="text-[44px] leading-none font-extrabold tracking-tight">7</p>
          </div>
          <span className="badge-text mb-1 rounded-full border border-accent-border bg-accent-tint px-2.5 py-1 text-accent">
            Going down
          </span>
        </div>
      </div>
    </div>
  );
}
