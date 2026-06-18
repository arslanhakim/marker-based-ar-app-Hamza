// Generates the SECOND image target (the "trigger") -> public/trigger.png
//
// Must be feature-rich for tracking (high contrast, asymmetric, lots of
// non-repeating detail) AND visually distinct from the base marker.png so the
// two are easy to tell apart. We use a warm palette and concentric / radial
// motifs (vs. the base marker's cool, scattered-rectangle look).
//
// Run: node scripts/generate-trigger.mjs

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SIZE = 1200; // px, square. ~4in at 300dpi when printed.
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public');
const outFile = join(outDir, 'trigger.png');

// Deterministic PRNG (mulberry32) — different seed than the base marker.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(99174523);
const rng = (min, max) => min + rand() * (max - min);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Warm cream background to distinguish from the base marker's white/cool look.
ctx.fillStyle = '#fdf6e3';
ctx.fillRect(0, 0, SIZE, SIZE);

const margin = Math.round(SIZE * 0.08);
const inner = SIZE - margin * 2;

// Warm, high-contrast palette (vs. base marker's blue/green/grey).
const inks = ['#000000', '#1a1a1a', '#5a2b0c', '#7a1f1f'];
const accents = ['#e07b00', '#d4006a', '#b8860b', '#a83232'];
const ink = () => (rand() < 0.8 ? pick(inks) : pick(accents));

function withinContent(fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, margin, inner, inner);
  ctx.clip();
  fn();
  ctx.restore();
}

// Big concentric-ring clusters — the dominant motif (clearly unlike marker.png).
function ringCluster(cx, cy, maxR) {
  const rings = Math.floor(rng(5, 11));
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < rings; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, (maxR / rings) * (i + 1), rng(0, 0.6), rng(4.5, 6.28));
    ctx.lineWidth = rng(3, 9);
    ctx.strokeStyle = ink();
    ctx.stroke();
  }
  ctx.restore();
}

// Radiating wedge/petal bursts.
function wedgeBurst(cx, cy, r) {
  const n = Math.floor(rng(6, 12));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rng(0, Math.PI));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r * rng(0.5, 1), a, a + rng(0.1, 0.35));
    ctx.closePath();
    ctx.fillStyle = ink();
    ctx.globalAlpha = rng(0.6, 1);
    ctx.fill();
  }
  ctx.restore();
}

function dashStroke() {
  ctx.save();
  ctx.translate(rng(margin, SIZE - margin), rng(margin, SIZE - margin));
  ctx.rotate(rng(0, Math.PI * 2));
  ctx.strokeStyle = ink();
  ctx.lineWidth = rng(3, 8);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(rng(30, inner * 0.18), 0);
  ctx.stroke();
  ctx.restore();
}

withinContent(() => {
  for (let i = 0; i < 16; i++) {
    ringCluster(rng(margin, SIZE - margin), rng(margin, SIZE - margin), rng(40, inner * 0.18));
  }
  for (let i = 0; i < 14; i++) {
    wedgeBurst(rng(margin, SIZE - margin), rng(margin, SIZE - margin), rng(30, inner * 0.13));
  }
  for (let i = 0; i < 120; i++) dashStroke();

  // Fine dot noise for small-scale features.
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = ink();
    ctx.globalAlpha = rng(0.5, 1);
    const x = rng(margin, SIZE - margin);
    const y = rng(margin, SIZE - margin);
    ctx.beginPath();
    ctx.arc(x, y, rng(1.5, 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
});

// Unique asymmetric landmarks (distinct from the base marker's arrow/squares).
// A bold filled five-point star, top-left.
withinContent(() => {
  ctx.save();
  ctx.translate(margin + inner * 0.22, margin + inner * 0.2);
  ctx.rotate(-0.2);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 80 : 32;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    ctx[fn](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
});

// A bold spiral, bottom-right.
withinContent(() => {
  ctx.save();
  ctx.translate(SIZE - margin - inner * 0.22, SIZE - margin - inner * 0.22);
  ctx.strokeStyle = '#7a1f1f';
  ctx.lineWidth = 9;
  ctx.beginPath();
  for (let t = 0; t < Math.PI * 6; t += 0.1) {
    const r = 4 + t * 8;
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r;
    if (t === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
});

// A short label so it's unmistakably a different image and orientation-unique.
try {
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(inner * 0.11)}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(SIZE * 0.5, margin + inner * 0.52);
  ctx.rotate(0.06);
  ctx.fillText('GO!', -inner * 0.12, 0);
  ctx.restore();
} catch (e) {
  // Font unavailable — shapes already provide plenty of features.
}

// Bold double framing border (thicker/warmer than the base marker's).
ctx.strokeStyle = '#7a1f1f';
ctx.lineWidth = Math.round(SIZE * 0.026);
let b = ctx.lineWidth / 2;
ctx.strokeRect(b, b, SIZE - ctx.lineWidth, SIZE - ctx.lineWidth);
ctx.strokeStyle = '#000000';
ctx.lineWidth = 4;
ctx.strokeRect(margin * 0.55, margin * 0.55, SIZE - margin * 1.1, SIZE - margin * 1.1);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, canvas.toBuffer('image/png'));
console.log('Wrote', outFile, `(${SIZE}x${SIZE})`);
