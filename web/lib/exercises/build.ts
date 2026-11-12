import type { CatalogEntry, ExerciseId } from "./catalog";
import { FAMILIES } from "./families";
import { resolveRules } from "./rules";
import { GATES, GOALS, SIGNALS } from "./signals";
import type { ExerciseConfig } from "./types";

/** How far `v` lies outside [min, max] (0 inside). */
export function outsideBand(v: number, [min, max]: readonly [number, number]): number {
  return Math.max(0, min - v, v - max);
}

/** Catalog data + family defaults → the config the set engine runs. */
export function buildExercise(entry: CatalogEntry & { id: ExerciseId }): ExerciseConfig {
  const family = FAMILIES[entry.family];
  const base = {
    id: entry.id,
    name: entry.name,
    preferredView: entry.view ?? family.view,
    setupHint: entry.setupHint ?? family.setupHint,
    rules: resolveRules(entry.rules),
  };

  if ("hold" in entry) {
    const { signal: signalId, band, gate: gateId, maxDeviation, graceMs = 600 } = entry.hold;
    const signal = SIGNALS[signalId];
    const gate = gateId ? GATES[gateId] : null;
    return {
      ...base,
      mode: "hold",
      metric: band ? `${signal.metric} off target` : signal.metric,
      hold: { maxDeviation, graceMs },
      measure(f) {
        if (gate && !gate(f)) return null;
        const v = signal.measure(f);
        if (v === null) return null;
        return band ? outsideBand(v, band) : v;
      },
    };
  }

  const signal = SIGNALS[entry.signal ?? family.signal];
  return {
    ...base,
    mode: "reps",
    metric: signal.metric,
    counter: entry.counter,
    phaseLabel: entry.phaseLabel ?? family.phaseLabel,
    missCues: entry.missCues ?? family.missCues,
    measure: signal.measure,
    ...(entry.goal ? { goal: GOALS[entry.goal] } : {}),
  };
}
