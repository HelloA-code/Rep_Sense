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
