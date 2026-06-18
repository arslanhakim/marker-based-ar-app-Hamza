// Generates the SECOND image target (the "trigger") -> public/trigger.png
//
// Tracking-optimized: image-target trackers key off many distinct, sharp CORNER
// features, so this uses dense, hard-edged, asymmetric shards/triangles/rectangles
// at multiple scales with strong contrast — the SAME angular style as the base
// marker.png (which tracks well). It deliberately AVOIDS smooth concentric
// circles/rings/spirals, which are weak for keypoint tracking.
//
// It stays clearly DIFFERENT from the base marker via a distinct WARM palette
// (orange/red/brown on cream) vs. the base's cool blue/green/grey on white.
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
const rand = mulberry32(0x5eed7a9);
const rng = (min, max) => min + rand() * (max - min);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Warm cream background to distinguish from the base marker's white/cool look.
ctx.fillStyle = '#fbf3e0';
ctx.fillRect(0, 0, SIZE, SIZE);

const margin = Math.round(SIZE * 0.08);
const inner = SIZE - margin * 2;

// Warm, high-contrast palette (vs. base marker's blue/green/grey).
const inks = ['#000000', '#1a1a1a', '#3a1500', '#5a2b0c'];
const accents = ['#e07b00', '#c0392b', '#b8860b', '#8a2b00', '#d4006a'];
const ink = () => (rand() < 0.78 ? pick(inks) : pick(accents));

function withinContent(fn) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, margin, inner, inner);
  ctx.clip();
  fn();
  ctx.restore();
}

// Sharp asymmetric triangle (lots of corners — great for tracking).
function shard() {
  const x = rng(margin, SIZE - margin);
  const y = rng(margin, SIZE - margin);
  const r = rng(20, inner * 0.18);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rng(0, Math.PI * 2));
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * rng(0.4, 1.1), r * rng(0.3, 1));
  ctx.lineTo(-r * rng(0.4, 1.1), r * rng(0.2, 1));
  ctx.closePath();
  ctx.fillStyle = ink();
  ctx.globalAlpha = rng(0.7, 1);
  ctx.fill();
  ctx.restore();
}

// Rotated rectangle / bar.
function bar() {
  const w = rng(18, inner * 0.2);
  const h = rng(10, inner * 0.12);
  ctx.save();
  ctx.translate(rng(margin, SIZE - margin), rng(margin, SIZE - margin));
  ctx.rotate(rng(0, Math.PI));
  ctx.fillStyle = ink();
  ctx.globalAlpha = rng(0.7, 1);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// Irregular quad/chevron (more hard corners).
function chevron() {
  ctx.save();
  ctx.translate(rng(margin, SIZE - margin), rng(margin, SIZE - margin));
  ctx.rotate(rng(0, Math.PI * 2));
  const s = rng(20, inner * 0.14);
  ctx.beginPath();
  ctx.moveTo(-s, -s * 0.5);
  ctx.lineTo(0, -s);
  ctx.lineTo(s, -s * 0.5);
  ctx.lineTo(s * 0.4, s);
  ctx.lineTo(-s * 0.4, s * rng(0.4, 1));
  ctx.closePath();
  ctx.fillStyle = ink();
  ctx.globalAlpha = rng(0.7, 1);
  ctx.fill();
  ctx.restore();
}

// Short straight stroke (sharp ends).
function stroke() {
  ctx.save();
  ctx.translate(rng(margin, SIZE - margin), rng(margin, SIZE - margin));
  ctx.rotate(rng(0, Math.PI * 2));
  ctx.strokeStyle = ink();
  ctx.lineWidth = rng(3, 9);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(rng(25, inner * 0.16), 0);
  ctx.stroke();
  ctx.restore();
}

// Dense, multi-scale angular field.
withinContent(() => {
  for (let i = 0; i < 150; i++) shard();
  for (let i = 0; i < 120; i++) bar();
  for (let i = 0; i < 70; i++) chevron();
  for (let i = 0; i < 110; i++) stroke();

  // Fine angular dot/square noise for small-scale corner features.
  for (let i = 0; i < 650; i++) {
    ctx.save();
    ctx.translate(rng(margin, SIZE - margin), rng(margin, SIZE - margin));
    ctx.rotate(rng(0, Math.PI));
    ctx.fillStyle = ink();
    ctx.globalAlpha = rng(0.5, 1);
    const s = rng(3, 9);
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
});

// Unique asymmetric landmarks (hard-edged, NOT round) to fix orientation.
// Bold filled chevron/arrow cluster, top-left.
withinContent(() => {
  ctx.save();
  ctx.translate(margin + inner * 0.2, margin + inner * 0.2);
  ctx.rotate(0.35);
  ctx.fillStyle = '#000000';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const o = i * 34;
    ctx.moveTo(-70, -40 + o);
    ctx.lineTo(0, -70 + o);
    ctx.lineTo(70, -40 + o);
    ctx.lineTo(70, -22 + o);
    ctx.lineTo(0, -52 + o);
    ctx.lineTo(-70, -22 + o);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
});

// Bold nested squares (rotated), bottom-right — high-contrast corner landmark.
withinContent(() => {
  ctx.save();
  ctx.translate(SIZE - margin - inner * 0.22, SIZE - margin - inner * 0.22);
  ctx.rotate(0.6);
  for (let i = 0; i < 5; i++) {
    const s = 150 - i * 28;
    ctx.fillStyle = i % 2 === 0 ? '#000000' : '#e07b00';
    ctx.fillRect(-s / 2, -s / 2, s, s);
  }
  ctx.restore();
});

// A short label adds more unique, asymmetric features (font is best-effort).
try {
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(inner * 0.13)}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(SIZE * 0.5, margin + inner * 0.55);
  ctx.rotate(-0.05);
  ctx.fillText('GO!', -inner * 0.13, 0);
  ctx.restore();
} catch (e) {
  // Font unavailable — shapes already provide plenty of features.
}

// Bold double framing border (warm) so it's easy to frame on camera.
ctx.strokeStyle = '#8a2b00';
ctx.lineWidth = Math.round(SIZE * 0.026);
const b = ctx.lineWidth / 2;
ctx.strokeRect(b, b, SIZE - ctx.lineWidth, SIZE - ctx.lineWidth);
ctx.strokeStyle = '#000000';
ctx.lineWidth = 4;
ctx.strokeRect(margin * 0.55, margin * 0.55, SIZE - margin * 1.1, SIZE - margin * 1.1);

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, canvas.toBuffer('image/png'));
console.log('Wrote', outFile, `(${SIZE}x${SIZE})`);
