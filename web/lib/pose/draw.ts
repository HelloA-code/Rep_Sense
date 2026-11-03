import { MIN_VISIBILITY } from "./frame-check";
import { BODY_JOINTS, FACE_POINTS, SKELETON, type Landmark } from "./landmarks";

const ACCENT = "#FFC53D";
const JOINT_STROKE = "#111111";

/**
 * Draws the skeleton in canvas pixels. The canvas has the video's resolution,
 * so normalised landmarks map straight to x * width, y * height.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly Landmark[] | null,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks) return;

  // Scale strokes with resolution so they look ~3px on a phone screen.
  const line = Math.max(2, Math.min(width, height) / 240);
  const radius = line * 1.7;
  const seen = (i: number) => (landmarks[i]?.visibility ?? 0) >= MIN_VISIBILITY;
  const px = (i: number) => [landmarks[i].x * width, landmarks[i].y * height] as const;

  ctx.lineCap = "round";
  ctx.lineWidth = line;
  ctx.strokeStyle = ACCENT;
  ctx.beginPath();
  for (const [a, b] of SKELETON) {
    if (!seen(a) || !seen(b)) continue;
    const [ax, ay] = px(a);
    const [bx, by] = px(b);
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.stroke();

  ctx.fillStyle = ACCENT;
  ctx.strokeStyle = JOINT_STROKE;
  ctx.lineWidth = line * 0.6;
  const dot = (i: number, r: number) => {
    if (!seen(i)) return;
    const [x, y] = px(i);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  for (const i of BODY_JOINTS) dot(i, radius);
  for (const i of FACE_POINTS) dot(i, radius * 0.75);
}

const DANGER = "#FF4D4D";

/**
 * Red ring around each offending joint plus a small cue label, as in the live-camera
 * reference. Call after drawSkeleton. The canvas is CSS-mirrored for the selfie
 * camera, so text is drawn flipped back to stay readable.
 */
export function drawIssues(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly Landmark[] | null,
  issues: readonly { cue: string; joints: readonly number[] }[],
  width: number,
  height: number,
  mirrored: boolean,
) {
  if (!landmarks || issues.length === 0) return;
  const unit = Math.max(2, Math.min(width, height) / 240);
  const ring = unit * 9;
  ctx.save();
  for (const issue of issues) {
    const pts = issue.joints.map((i) => landmarks[i]).filter((l) => l && l.visibility >= MIN_VISIBILITY);
    if (pts.length === 0) continue;
    for (const l of pts) {
      ctx.beginPath();
      ctx.arc(l.x * width, l.y * height, ring, 0, Math.PI * 2);
      ctx.lineWidth = unit * 1.2;
      ctx.strokeStyle = DANGER;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(l.x * width, l.y * height, ring * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,77,77,0.55)";
      ctx.fill();
    }
    // Label pill next to the first joint.
    const x = pts[0].x * width + (mirrored ? -1 : 1) * ring * 1.3;
    const y = pts[0].y * height;
    ctx.font = `800 ${Math.round(unit * 7)}px Inter, system-ui, sans-serif`;
    const text = issue.cue;
    const tw = ctx.measureText(text).width;
    const padX = unit * 4;
    const h = unit * 11;
    ctx.save();
    ctx.translate(x, y);
    if (mirrored) ctx.scale(-1, 1);
    ctx.fillStyle = DANGER;
    ctx.beginPath();
    ctx.roundRect(0, -h / 2, tw + padX * 2, h, h / 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.textBaseline = "middle";
    ctx.fillText(text, padX, 0);
    ctx.restore();
  }
  ctx.restore();
}
