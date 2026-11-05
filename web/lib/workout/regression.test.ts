import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISE_CONFIGS } from "@/lib/exercises";
import type { ExerciseId } from "@/lib/equipment";
import type { Recording } from "@/lib/recording/format";
import { countRepsInRecording } from "./replay";

// Replays saved clips through the same engine as the live camera and checks the count.
// To add a real clip: export it, add "expectedReps": <your manual count> to the JSON
// (for planks, "expectedHeldSeconds" instead) and drop it in __fixtures__/.
// Synthetic ones come from `python -m src.write_fixtures` in ml/.

type Fixture = Recording & { expectedReps?: number; expectedHeldSeconds?: number };

const folder = join(__dirname, "__fixtures__");
const fixtures = readdirSync(folder)
  .filter((name) => name.endsWith(".json"))
  .map((name) => ({ name, clip: JSON.parse(readFileSync(join(folder, name), "utf8")) as Fixture }));

describe("rep-count regression", () => {
  it("covers all 6 exercises", () => {
    expect(new Set(fixtures.map((f) => f.clip.label))).toEqual(new Set(Object.keys(EXERCISE_CONFIGS)));
  });

  it.each(fixtures)("$name", ({ clip }) => {
    const result = countRepsInRecording(clip, EXERCISE_CONFIGS[clip.label as ExerciseId]);
    if (result.mode === "hold") {
      const expected = clip.expectedHeldSeconds ?? (clip.durationMs / 1000) * 0.8;
      expect(result.heldMs / 1000).toBeGreaterThanOrEqual(expected - 1);
    } else {
      expect(result.reps).toBe(clip.expectedReps);
    }
  });
});
