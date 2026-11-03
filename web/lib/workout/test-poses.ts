import { LANDMARK_COUNT, LM, type Landmark } from "@/lib/pose/landmarks";

// Synthetic poses for tests, in pixels on a W×H frame (converted to normalised landmarks).

export const W = 1280;
export const H = 720;

type P = { x: number; y: number };

function rotate(v: P, deg: number): P {
  const r = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
}

/** Hip position for a knee angle of `deg` between knee→ankle and knee→hip. */
function hipFor(knee: P, ankle: P, deg: number, turn: 1 | -1, thigh = 150): P {
  const len = Math.hypot(ankle.x - knee.x, ankle.y - knee.y);
  const shin = { x: (ankle.x - knee.x) / len, y: (ankle.y - knee.y) / len };
  const dir = rotate(shin, turn * deg);
  return { x: knee.x + thigh * dir.x, y: knee.y + thigh * dir.y };
}

function toLandmarks(points: Record<number, P>): Landmark[] {
  const lm: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  for (const [i, p] of Object.entries(points)) lm[Number(i)] = { x: p.x / W, y: p.y / H, z: 0, visibility: 0.99 };
  return lm;
}

/** Facing the camera, both legs bending to `kneeDeg`. `caving` pulls the knees in, more the deeper you go. */
export function frontSquatPose(kneeDeg: number, caving = false): Landmark[] {
  const cx = 640;
  const inset = caving ? 60 * Math.min(1, Math.max(0, (130 - kneeDeg) / 40)) : 0;
  const lAnkle = { x: cx + 100, y: 650 };
  const rAnkle = { x: cx - 100, y: 650 };
  const lKnee = { x: cx + 100 - inset, y: 500 };
  const rKnee = { x: cx - 100 + inset, y: 500 };
  const lHip = hipFor(lKnee, lAnkle, kneeDeg, -1);
  const rHip = hipFor(rKnee, rAnkle, kneeDeg, 1);
  const hipY = (lHip.y + rHip.y) / 2;
  return toLandmarks({
    [LM.LEFT_ANKLE]: lAnkle,
    [LM.RIGHT_ANKLE]: rAnkle,
    [LM.LEFT_KNEE]: lKnee,
    [LM.RIGHT_KNEE]: rKnee,
    [LM.LEFT_HIP]: lHip,
    [LM.RIGHT_HIP]: rHip,
    [LM.LEFT_SHOULDER]: { x: cx + 120, y: hipY - 250 },
    [LM.RIGHT_SHOULDER]: { x: cx - 120, y: hipY - 250 },
    [LM.NOSE]: { x: cx, y: hipY - 330 },
  });
}

/** Side-on and horizontal (plank / push-up top). `hipDrop` px: + sags, − pikes. */
export function plankPose(hipDrop = 0): Landmark[] {
  const y = 450;
  return toLandmarks({
    [LM.LEFT_SHOULDER]: { x: 400, y },
    [LM.RIGHT_SHOULDER]: { x: 405, y: y + 2 },
    [LM.LEFT_HIP]: { x: 650, y: y + hipDrop },
    [LM.RIGHT_HIP]: { x: 655, y: y + hipDrop + 2 },
    [LM.LEFT_KNEE]: { x: 780, y: y + hipDrop / 2 },
    [LM.LEFT_ANKLE]: { x: 900, y },
    [LM.RIGHT_ANKLE]: { x: 905, y: y + 2 },
    [LM.LEFT_ELBOW]: { x: 400, y: y + 120 },
    [LM.LEFT_WRIST]: { x: 400, y: y + 240 },
  });
}

/** One rep's knee angles: down from 178 to `bottom`, a pause there, and back up. */
export function repAngles(bottom = 70, pauseFrames = 15): number[] {
  const out: number[] = [];
  for (let a = 178; a > bottom; a -= 6) out.push(a);
  for (let i = 0; i < pauseFrames; i++) out.push(bottom);
  for (let a = bottom; a <= 178; a += 6) out.push(a);
  for (let i = 0; i < 5; i++) out.push(178);
  return out;
}
