import Link from "next/link";
import { CpuIcon, RepeatIcon, ScanLineIcon, ShieldCheckIcon, type LucideIcon } from "lucide-react";
import { PhoneMockup } from "@/components/marketing/phone-mockup";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui/styles";
import { cn } from "@/lib/utils";

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ScanLineIcon,
    title: "Pose tracking on your device",
    text: "33 body landmarks per frame with MediaPipe, right in the browser. No install, no upload.",
  },
  {
    icon: RepeatIcon,
    title: "Reps that actually count",
    text: "Smoothed joint angles and state machines count squats, push-ups, pull-ups, dips, lunges and planks, with voice cues when form slips.",
  },
  {
    icon: CpuIcon,
    title: "Its own trained model",
    text: "A classifier trained on recorded movement data recognises which exercise you're doing, so you can just start moving.",
  },
];

function Logo() {
  return (
    <span className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight">
      <span className="grid size-7 place-items-center rounded-full bg-accent">
        <span className="size-2.5 rounded-full border-2 border-accent-fg" />
      </span>
      RepSense
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      <div aria-hidden className="glow-warm pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" />
      <div aria-hidden className="glow-cool pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[720px]" />

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <nav className="flex h-20 items-center justify-between">
          <Logo />
          <Link href="/today" prefetch={false} className="text-[14px] font-bold text-accent hover:underline">
            Open the app
          </Link>
        </nav>

        <section className="grid items-center gap-14 pt-8 pb-20 md:grid-cols-[1.1fr_1fr] md:pt-16">
          <div>
            <Badge>Runs in your browser</Badge>
            <h1 className="mt-5 text-[44px] leading-[1.02] font-extrabold tracking-tight sm:text-[64px]">
              Your AI calisthenics coach
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed font-medium text-muted">
              Point your phone camera at yourself. RepSense counts every rep and calls out form issues
              as you move, with pose tracking that never leaves your device.
            </p>
            <div className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
              <Link href="/today" prefetch={false} className={primaryButtonClass}>
                Open the app
              </Link>
              <a href="#how" className={secondaryButtonClass}>
                How it works
              </a>
            </div>
          </div>
          <div>
            <PhoneMockup />
            <p className="mt-6 text-center text-[12px] font-medium text-muted">
              Illustration · live demo recording coming soon
            </p>
          </div>
        </section>

        <section id="how" className="scroll-mt-8 pb-16">
          <h2 className="text-[28px] font-extrabold tracking-tight">How it works</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <Card key={title} className="p-6">
                <span className="grid size-11 place-items-center rounded-full border border-accent-border bg-accent-tint text-accent">
                  <Icon className="size-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-5 text-[17px] font-bold">{title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed font-medium text-muted">{text}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <Card className="flex flex-col gap-5 border-accent-border bg-accent-tint p-6 sm:flex-row sm:items-center sm:p-8">
            <ShieldCheckIcon className="size-10 shrink-0 text-accent" strokeWidth={1.5} />
            <div className="flex-1">
              <h2 className="text-[20px] font-extrabold tracking-tight">Your video stays yours</h2>
              <p className="mt-1.5 max-w-[62ch] text-[14px] leading-relaxed font-medium text-text/75">
                The camera feed is processed frame by frame on your phone or laptop. Clips you choose
                to record stay on that device. Only numbers, such as rep counts and form scores, are
                ever saved to your account.
              </p>
            </div>
            <Link href="/today" prefetch={false} className={cn(primaryButtonClass, "sm:w-auto")}>
              Open the app
            </Link>
          </Card>
        </section>

        <footer className="flex flex-col gap-2 border-t border-border py-8 text-[13px] font-medium text-muted sm:flex-row sm:justify-between">
          <Logo />
          <p>A student project. Video never leaves your device.</p>
        </footer>
      </main>
    </div>
  );
}
