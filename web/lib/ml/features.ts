// TypeScript twin of ml/src/features.py. A model only works on inputs built the way its
// training data was, so features.test.ts compares this with Python number by number.
// Change both together and bump FEATURE_VERSION.

export const FEATURE_VERSION = 1;

export const LABELS = ["idle", "squat", "pushup", "pullup", "dip", "lunge", "plank"] as const;
export type ModelLabel = (typeof LABELS)[number];

export const RESAMPLE_HZ = 15;
export const WINDOW = 30;
export const MAX_GAP_MS = 250;

const [NOSE, L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST] = [0, 11, 12, 13, 14, 15, 16];
const [L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE] = [23, 24, 25, 26, 27, 28];

const JOINTS = [
  NOSE,
  L_SHOULDER, R_SHOULDER,
  L_ELBOW, R_ELBOW,
  L_WRIST, R_WRIST,
  L_HIP, R_HIP,
  L_KNEE, R_KNEE,
  L_ANKLE, R_ANKLE,
];
const ANGLES = [
  [L_SHOULDER, L_ELBOW, L_WRIST], [R_SHOULDER, R_ELBOW, R_WRIST], // elbows
  [L_ELBOW, L_SHOULDER, L_HIP], [R_ELBOW, R_SHOULDER, R_HIP], // shoulders
  [L_SHOULDER, L_HIP, L_KNEE], [R_SHOULDER, R_HIP, R_KNEE], // hips
  [L_HIP, L_KNEE, L_ANKLE], [R_HIP, R_KNEE, R_ANKLE], // knees
];

export const NUM_FEATURES = 2 * JOINTS.length + ANGLES.length;

const COORD_LIMIT = 4;

type XY = { x: number; y: number };

/** Hip-centred, body-scaled coordinates plus joint angles, measured in pixels. */
export function frameFeatures(lm: readonly XY[], width: number, height: number): Float32Array {
  const px = (i: number): XY => ({ x: lm[i].x * width, y: lm[i].y * height });
  const ls = px(L_SHOULDER);
  const rs = px(R_SHOULDER);
  const lh = px(L_HIP);
  const rh = px(R_HIP);
  const hips = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 };
  const shoulders = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const scale = Math.max(
    Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y),
    Math.hypot(ls.x - rs.x, ls.y - rs.y),
    1e-6,
  );
  const clamp = (v: number) => Math.min(COORD_LIMIT, Math.max(-COORD_LIMIT, v));

  const out = new Float32Array(NUM_FEATURES);
  let n = 0;
  for (const j of JOINTS) {
    const p = px(j);
    out[n++] = clamp((p.x - hips.x) / scale);
    out[n++] = clamp((p.y - hips.y) / scale);
  }
  for (const [a, b, c] of ANGLES) {
    const pa = px(a);
    const pb = px(b);
    const pc = px(c);
    const ba = { x: pa.x - pb.x, y: pa.y - pb.y };
    const bc = { x: pc.x - pb.x, y: pc.y - pb.y };
    const lengths = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y);
    const cos = lengths === 0 ? 0 : Math.min(1, Math.max(-1, (ba.x * bc.x + ba.y * bc.y) / lengths));
    out[n++] = Math.acos(cos) / Math.PI;
  }
  return out;
}
