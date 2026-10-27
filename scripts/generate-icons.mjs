// Regenerates the PWA icons (event-agnostic artwork, so a new event needs no new art).
// Usage: node scripts/generate-icons.mjs
import { createCanvas } from "canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "icons");
const BACKGROUND = "#0a0a0a";
const GRADIENT = ["#f59e0b", "#f97316"];

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function render(size, { maskable }) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Maskable icons must keep their content inside the central 80% safe zone and
  // fill the whole canvas with an opaque background.
  const inset = maskable ? size * 0.1 : 0;
  const inner = size - inset * 2;
  if (maskable) {
    ctx.fillStyle = BACKGROUND;
    ctx.fillRect(0, 0, size, size);
  }

  const gradient = ctx.createLinearGradient(inset, inset, inset + inner, inset + inner);
  gradient.addColorStop(0, GRADIENT[0]);
  gradient.addColorStop(1, GRADIENT[1]);
  roundedRect(ctx, inset, inset, inner, inner, inner * 0.22);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Check mark
  ctx.strokeStyle = BACKGROUND;
  ctx.lineWidth = inner * 0.11;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(inset + inner * 0.27, inset + inner * 0.53);
  ctx.lineTo(inset + inner * 0.44, inset + inner * 0.70);
  ctx.lineTo(inset + inner * 0.75, inset + inner * 0.33);
  ctx.stroke();

  return canvas.toBuffer("image/png");
}

mkdirSync(OUT_DIR, { recursive: true });
const outputs = [
  ["icon-192x192.png", render(192, { maskable: false })],
  ["icon-512x512.png", render(512, { maskable: false })],
  ["icon-maskable-512x512.png", render(512, { maskable: true })],
];
for (const [name, buffer] of outputs) {
  writeFileSync(join(OUT_DIR, name), buffer);
  console.log(`wrote public/icons/${name} (${buffer.length} bytes)`);
}
