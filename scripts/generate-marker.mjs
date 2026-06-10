// Generates a feature-rich, high-contrast, asymmetric AR marker -> public/marker.png
//
// Why this design: image-target trackers (MindAR) key off many distinct,
// non-repeating corner features. So we pack the frame with rotated rectangles,
// triangles, arcs, line bursts and fine dot noise at multiple scales, plus a few
// unique "landmark" elements (corner glyphs, an arrow) to kill any symmetry.
// A bold border makes the marker easy to frame in the camera.
//
// Run: node scripts/generate-marker.mjs

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZE = 1200; // px, square. ~4in at 300dpi when printed.
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
const outFile = join(outDir, 'marker.png');

// Deterministic PRNG (mulberry32) so the marker is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260610);
const rng = (min, max) => min + rand() * (max - min);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// --- background ---------------------------------------------------------------
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, SIZE, SIZE);

// Content is drawn inside a quiet border so the marker is easy to frame.
const margin = Math.round(SIZE * 0.08);
const inner = SIZE - margin * 2;

// Mostly-monochrome, high-contrast palette with a few accents for extra features.
const inks = ['#000000', '#111111', '#222222', '#333333', '#444444', '#1a1a1a'];
const accents = ['#c0392b', '#1f6feb', '#117a37', '#b8860b'];
const ink = () => (rand() < 0.85 ? pick(inks) : pick(accents));

function withinContent(fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, margin, inner, inner);
  ctx.clip();
  fn();
  ctx.restore();
}

function rotatedRect() {
  const w = rng(20, inner * 0.22);
  const h = rng(20, inner * 0.22);
  const x = rng(margin, SIZE - margin);
  const y = rng(margin, SIZE - margin);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rng(0, Math.PI));
  ctx.fillStyle = ink();
  ctx.globalAlpha = rng(0.65, 1);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function triangle() {
  const x = rng(margin, SIZE - margin);
  const y = rng(margin, SIZE - margin);
  const r = rng(20, inner * 0.16);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rng(0, Math.PI * 2));
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * rng(0.5, 1), r);
  ctx.lineTo(-r * rng(0.5, 1), r * rng(0.4, 1));
  ctx.closePath();
  ctx.fillStyle = ink();
  ctx.globalAlpha = rng(0.7, 1);
  ctx.fill();
  ctx.restore();
}

function arcBurst() {
  const x = rng(margin, SIZE - margin);
  const y = rng(margin, SIZE - margin);
  const rings = Math.floor(rng(3, 7));
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < rings; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, 8 + i * rng(6, 14), rng(0, 1), rng(3, 6));
    ctx.lineWidth = rng(2, 5);
    ctx.strokeStyle = ink();
    ctx.stroke();
  }
  ctx.restore();
}

function lineBurst() {
  const x = rng(margin, SIZE - margin);
  const y = rng(margin, SIZE - margin);
  const n = Math.floor(rng(4, 9));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rng(0, Math.PI));
  ctx.strokeStyle = ink();
  ctx.lineWidth = rng(2, 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = rng(20, inner * 0.13);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

// --- main body: layered shapes at multiple scales -----------------------------
withinContent(() => {
  for (let i = 0; i < 140; i++) rotatedRect();
  for (let i = 0; i < 90; i++) triangle();
  for (let i = 0; i < 22; i++) arcBurst();
  for (let i = 0; i < 22; i++) lineBurst();

  // Fine non-repeating dot/dash noise for small-scale features.
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = ink();
    ctx.globalAlpha = rng(0.5, 1);
    const x = rng(margin, SIZE - margin);
    const y = rng(margin, SIZE - margin);
    const r = rng(1.5, 5);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
});

// --- unique landmarks to guarantee asymmetry / orientation ------------------
// Solid arrow pointing to the top-left corner.
withinContent(() => {
  ctx.save();
  ctx.translate(margin + inner * 0.2, margin + inner * 0.2);
  ctx.rotate(Math.PI * 1.25);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, -70);
  ctx.lineTo(45, 30);
  ctx.lineTo(15, 30);
  ctx.lineTo(15, 90);
  ctx.lineTo(-15, 90);
  ctx.lineTo(-15, 30);
  ctx.lineTo(-45, 30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
});

// A bold filled square cluster bottom-right (distinct from the arrow corner).
withinContent(() => {
  ctx.fillStyle = '#000000';
  const bx = SIZE - margin - inner * 0.26;
  const by = SIZE - margin - inner * 0.26;
  for (let i = 0; i < 5; i++) {
    const s = 90 - i * 16;
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
    ctx.fillRect(bx - s / 2, by - s / 2, s, s);
  }
});

// Corner registration glyphs (three different shapes -> no symmetry).
function glyph(cx, cy, kind) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  if (kind === 'ring') {
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'cross') {
    ctx.fillRect(-30, -8, 60, 16);
    ctx.fillRect(-8, -30, 16, 60);
  } else if (kind === 'tri') {
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.lineTo(28, 24);
    ctx.lineTo(-28, 24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
glyph(margin + 60, SIZE - margin - 60, 'ring'); // bottom-left
glyph(SIZE - margin - 60, margin + 60, 'cross'); // top-right

// A short label adds more unique, asymmetric features (font is best-effort).
try {
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(inner * 0.1)}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(SIZE * 0.5, margin + inner * 0.5);
  ctx.rotate(-0.08);
  ctx.fillText('AR-1', -inner * 0.16, 0);
  ctx.restore();
} catch (e) {
  // Font unavailable in this environment — shapes already provide plenty of features.
}

// --- bold framing border ------------------------------------------------------
ctx.strokeStyle = '#000000';
ctx.lineWidth = Math.round(SIZE * 0.022);
const b = ctx.lineWidth / 2;
ctx.strokeRect(b, b, SIZE - ctx.lineWidth, SIZE - ctx.lineWidth);
// thin inner keyline just inside the quiet margin
ctx.lineWidth = 3;
ctx.strokeRect(margin * 0.55, margin * 0.55, SIZE - margin * 1.1, SIZE - margin * 1.1);

// --- write file ---------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, canvas.toBuffer('image/png'));
console.log('Wrote', outFile, `(${SIZE}x${SIZE})`);
