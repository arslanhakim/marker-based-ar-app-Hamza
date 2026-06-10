// Generates PWA icons -> public/icons/*.png
// A clean AR-themed glyph: a robot head inside a camera/AR viewfinder frame on a
// dark background. "Maskable" variants keep the glyph inside the safe zone and
// fill the whole canvas so they look right when masked to a circle/squircle.
//
// Run: node scripts/generate-icons.mjs

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = '#0d1117';
const ACCENT = '#1f6feb';
const LIGHT = '#e6edf3';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(S, { safe }) {
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // Full-bleed background (required for maskable; harmless for "any").
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, S, S);

  const c = S / 2;
  const half = (S * safe) / 2; // half-size of the content box
  const x0 = c - half;
  const y0 = c - half;
  const box = half * 2;

  // AR viewfinder corner brackets.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = S * 0.045;
  ctx.lineCap = 'round';
  const armC = box * 0.26; // corner-arm length
  const corners = [
    [x0, y0, 1, 1],
    [x0 + box, y0, -1, 1],
    [x0, y0 + box, 1, -1],
    [x0 + box, y0 + box, -1, -1],
  ];
  for (const [px, py, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(px + sx * armC, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + sy * armC);
    ctx.stroke();
  }

  // Robot head.
  const hw = box * 0.5;
  const hh = box * 0.46;
  const hx = c - hw / 2;
  const hy = c - hh / 2 + box * 0.03;
  ctx.fillStyle = LIGHT;
  roundRect(ctx, hx, hy, hw, hh, hw * 0.22);
  ctx.fill();

  // Antenna.
  ctx.strokeStyle = LIGHT;
  ctx.lineWidth = S * 0.03;
  ctx.beginPath();
  ctx.moveTo(c, hy);
  ctx.lineTo(c, hy - box * 0.12);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(c, hy - box * 0.14, S * 0.035, 0, Math.PI * 2);
  ctx.fill();

  // Eyes.
  ctx.fillStyle = ACCENT;
  const eyeR = hw * 0.12;
  const eyeY = hy + hh * 0.45;
  ctx.beginPath();
  ctx.arc(c - hw * 0.2, eyeY, eyeR, 0, Math.PI * 2);
  ctx.arc(c + hw * 0.2, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Mouth.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = S * 0.018;
  ctx.beginPath();
  ctx.moveTo(c - hw * 0.18, hy + hh * 0.74);
  ctx.lineTo(c + hw * 0.18, hy + hh * 0.74);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

const targets = [
  { name: 'icon-192.png', size: 192, safe: 0.82 },
  { name: 'icon-512.png', size: 512, safe: 0.82 },
  { name: 'icon-192-maskable.png', size: 192, safe: 0.62 },
  { name: 'icon-512-maskable.png', size: 512, safe: 0.62 },
];

for (const t of targets) {
  writeFileSync(join(outDir, t.name), drawIcon(t.size, { safe: t.safe }));
  console.log('Wrote', join('public', 'icons', t.name), `(${t.size}x${t.size})`);
}
