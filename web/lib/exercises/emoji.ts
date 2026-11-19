import type { LibraryGroup, Tracking } from "./library-types";

// Small emoji that make the exercise lists quicker to scan. One per group, one per
// tracking level, and a few exercises that look nothing like their group.

export const GROUP_EMOJI: Record<LibraryGroup | "mine", string> = {
  mine: "✨",
  squat: "🦵",
  hinge: "🏋️",
  lunge: "🚶",
  push: "💪",
  overhead: "🙌",
  row: "🚣",
  "vertical-pull": "🧗",
  "single-joint": "🦾",
  core: "🔥",
  hold: "⏱️",
  cardio: "🏃",
  skills: "🤸",
  mobility: "🧘",
};

export const TRACKING_EMOJI: Record<Tracking | "taught", string> = {
  camera: "📷",
  teach: "🎯",
  taught: "✅",
  log: "📝",
};

const EXERCISE_EMOJI: Partial<Record<string, string>> = {
  "stationary-bike": "🚴",
  "rowing-machine": "🚣",
  "treadmill-run": "🏃",
  elliptical: "🏃",
  "stair-climber": "🪜",
  "jump-rope": "🪢",
  "box-jump": "📦",
  "jumping-jack": "⭐",
  burpee: "🤸",
  "farmers-walk": "🧳",
  "dead-hang": "🐒",
  "kettlebell-swing": "🔔",
  "handstand-pushup": "🤸",
  "handstand-hold": "🤸",
};

/** The emoji shown next to an exercise: its own if it has one, else its group's. */
export function exerciseEmoji(id: string, group: LibraryGroup | "mine"): string {
  return EXERCISE_EMOJI[id] ?? GROUP_EMOJI[group];
}
