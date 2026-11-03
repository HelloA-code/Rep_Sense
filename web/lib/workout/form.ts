import type { FormRule, PoseFrame } from "@/lib/exercises/types";
import type { RepPhase } from "@/lib/exercises/state-machine";
import type { CameraView } from "@/lib/recording/format";

// Turns per-frame rule checks into coaching: an issue must persist for a moment before
// it counts (one noisy frame shouldn't make you "bad"), issues are collected per rep
// for the form score, and cues are rate-limited so the app doesn't nag.

export type ActiveIssue = {
  id: string;
  cue: string;
  severity: FormRule["severity"];
  joints: readonly number[];
};

/** An issue only counts once it has held this long. */
export const ISSUE_HOLD_MS = 300;

export function createFormTracker(rules: readonly FormRule[], holdMs = ISSUE_HOLD_MS) {
  const since = new Map<string, number>();
  const active = new Set<string>();
  let repIssues = new Map<string, ActiveIssue>();

  return {
    /**
     * Checks every rule valid for this view and phase. `active` = broken right now
     * (for the red rings); `started` = became active on this frame (for cues).
     */
    update(frame: PoseFrame, view: CameraView | null, phase: RepPhase, tMs: number) {
      const now: ActiveIssue[] = [];
      const started: ActiveIssue[] = [];
      for (const rule of rules) {
        const applies = view !== null && rule.views.includes(view) && (rule.phases === "any" || phase === "down");
        const joints = applies ? rule.check(frame) : null;
        if (!joints) {
          since.delete(rule.id);
          active.delete(rule.id);
          continue;
        }
        const t0 = since.get(rule.id) ?? tMs;
        since.set(rule.id, t0);
        if (tMs - t0 < holdMs) continue;
        const issue = { id: rule.id, cue: rule.cue, severity: rule.severity, joints };
        now.push(issue);
        if (!active.has(rule.id)) {
          active.add(rule.id);
          started.push(issue);
        }
        if (!repIssues.has(rule.id)) repIssues.set(rule.id, issue);
      }
      return { active: now, started };
    },
    /** The distinct issues seen since the last call; starts a new rep window. */
    takeRepIssues(): ActiveIssue[] {
      const out = [...repIssues.values()];
      repIssues = new Map();
      return out;
    },
  };
}

/** Points lost per distinct issue in a rep. */
export const PENALTY = { bad: 35, warn: 15 } as const;
/** A rep scoring at least this is a "good rep". */
export const GOOD_REP_SCORE = 70;

export function scoreRep(issues: readonly Pick<ActiveIssue, "severity">[]): number {
  return Math.max(0, issues.reduce((score, i) => score - PENALTY[i.severity], 100));
}

/**
 * Rate-limits spoken/toasted cues: at most one every `globalMs`, and the same cue at
 * most every `sameMs`. Returns true if the cue should be shown now.
 */
export function createCueScheduler(globalMs = 2500, sameMs = 6000) {
  let lastAny = -Infinity;
  const lastByKey = new Map<string, number>();
  return {
    offer(key: string, tMs: number): boolean {
      if (tMs - lastAny < globalMs) return false;
      if (tMs - (lastByKey.get(key) ?? -Infinity) < sameMs) return false;
      lastAny = tMs;
      lastByKey.set(key, tMs);
      return true;
    },
  };
}
