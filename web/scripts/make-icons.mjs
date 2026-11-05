// Generates the app icons from one SVG. Run once by hand: node scripts/make-icons.mjs
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "icons");
mkdirSync(out, { recursive: true });

// A dumbbell in the brand yellow. `inset` shrinks it for maskable icons, whose edges get cropped.
const svg = (size, inset = 1) => {
  const c = size / 2;
  const u = (size / 512) * inset;
  const bar = (x, h, w) =>
    `<rect x="${c + x * u - (w * u) / 2}" y="${c - (h * u) / 2}" width="${w * u}" height="${h * u}" rx="${14 * u}" fill="#FFC53D"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#000"/>
    ${bar(0, 36, 220)}${bar(-105, 180, 44)}${bar(105, 180, 44)}${bar(-160, 110, 38)}${bar(160, 110, 38)}
  </svg>`;
};

const targets = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["maskable-512.png", 512, 0.72],
  ["apple-touch-icon.png", 180, 0.85],
];
for (const [name, size, inset] of targets) {
  await sharp(Buffer.from(svg(size, inset))).png().toFile(join(out, name));
}
console.log("icons written");
