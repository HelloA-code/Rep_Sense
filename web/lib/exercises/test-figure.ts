import { LANDMARK_COUNT, LM, type Landmark } from "@/lib/pose/landmarks";
import type { SignalId } from "./signals";
import type { PoseFrame } from "./types";

// Test helper: a side-on stick figure (facing +x) built from joint angles, so any signal
// can be driven to an exact value. Both sides get the same points, so it doesn't matter
// which side the engine looks at.

export const FIG_W = 1280;
export const FIG_H = 720;

type P = { x: number; y: number };

export type FigureAngles = {
  /** Hip–knee–ankle. */
  knee?: number;
  /** Shoulder–hip–knee. */
  hip?: number;
  /** Hip–shoulder–elbow (0 = arm hanging, 180 = overhead). */
  shoulder?: number;
  /** Shoulder–elbow–wrist. */
  elbow?: number;
  /** Heel raised this many degrees above the toe. */
  footTilt?: number;
  /** Rotates the whole figure (90 = lying along the floor). */
  lie?: number;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const rotate = (v: P, deg: number): P => ({
  x: v.x * Math.cos(rad(deg)) - v.y * Math.sin(rad(deg)),
  y: v.x * Math.sin(rad(deg)) + v.y * Math.cos(rad(deg)),
});
const add = (a: P, v: P, len: number): P => ({ x: a.x + v.x * len, y: a.y + v.y * len });
const neg = (v: P): P => ({ x: -v.x, y: -v.y });

export function figure({ knee = 175, hip = 175, shoulder = 10, elbow = 170, footTilt = 0, lie = 0 }: FigureAngles = {}) {
  const toe = { x: 700, y: 650 };
  const heel = { x: toe.x - 80 * Math.cos(rad(footTilt)), y: toe.y - 80 * Math.sin(rad(footTilt)) };
  const ankle = { x: heel.x + 15, y: heel.y - 15 };
  const kneeP = add(ankle, { x: 0, y: -1 }, 150);
  const thigh = rotate({ x: 0, y: 1 }, knee); // knee → hip
  const hipP = add(kneeP, thigh, 150);
  const torso = rotate(neg(thigh), -hip); // hip → shoulder
  const shoulderP = add(hipP, torso, 250);
  const upperArm = rotate(neg(torso), -shoulder); // shoulder → elbow
  const elbowP = add(shoulderP, upperArm, 120);
  const forearm = rotate(neg(upperArm), elbow); // elbow → wrist
  const wristP = add(elbowP, forearm, 110);
  const nose = add(shoulderP, torso, 60);

  const points: Record<number, P> = {
    [LM.NOSE]: nose,
    [LM.LEFT_SHOULDER]: shoulderP,
    [LM.RIGHT_SHOULDER]: shoulderP,
    [LM.LEFT_ELBOW]: elbowP,
    [LM.RIGHT_ELBOW]: elbowP,
    [LM.LEFT_WRIST]: wristP,
    [LM.RIGHT_WRIST]: wristP,
    [LM.LEFT_HIP]: hipP,
    [LM.RIGHT_HIP]: hipP,
    [LM.LEFT_KNEE]: kneeP,
    [LM.RIGHT_KNEE]: kneeP,
    [LM.LEFT_ANKLE]: ankle,
    [LM.RIGHT_ANKLE]: ankle,
    [LM.LEFT_HEEL]: heel,
    [LM.RIGHT_HEEL]: heel,
    [LM.LEFT_FOOT]: toe,
    [LM.RIGHT_FOOT]: toe,
  };
  // Rotate about the hip and recentre, so a lying figure stays in frame.
  const centre = { x: 640, y: 380 };
  return frame(
    Object.fromEntries(
      Object.entries(points).map(([i, p]) => {
        const r = rotate({ x: p.x - hipP.x, y: p.y - hipP.y }, lie);
        return [i, { x: centre.x + r.x, y: centre.y + r.y }];
      }),
    ),
  );
}

/** A frame with these joints visible (pixels) and everything else hidden. */
export function frame(points: Record<number, P>): PoseFrame {
  const lm: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.1 }));
  for (const [i, p] of Object.entries(points)) lm[Number(i)] = { x: p.x / FIG_W, y: p.y / FIG_H, z: 0, visibility: 0.99 };
  return { lm, width: FIG_W, height: FIG_H, side: "left" };
}

/** A pose where `signal` reads `value` (everything else in a neutral standing position). */
export function poseForSignal(signal: SignalId, value: number): PoseFrame {
  switch (signal) {
    case "knee":
    case "front-knee":
      return figure({ knee: value });
    case "hip":
      return figure({ hip: value });
    case "elbow":
      return figure({ elbow: value });
    case "arm-raise":
      return figure({ shoulder: 180 - value, elbow: 175 });
    case "heel-raise":
      return figure({ footTilt: 90 - value });
    case "body-line":
      return figure({ hip: 180 - value, lie: 90 });
  }
}
