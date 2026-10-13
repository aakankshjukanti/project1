#!/usr/bin/env node
/**
 * Read a reference edit and write a style brief: how fast it cuts, how it paces itself,
 * and what its colour looks like. Feed the brief to a session and say "match this energy".
 *
 *   npm run refstyle -- references/somereel.mp4 [--threshold 0.30] [--fps 30]
 *
 * Writes work/refs/<clip>/style-brief.md and .json — cut list, shot lengths, pacing over
 * time, and colour stats. Nothing from the clip is ever used in your videos; this is
 * measurement, the same way an editor watches a reference and takes notes.
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {basename, extname, join} from 'node:path';
import {FFMPEG, fmt, median, probe, run, timecode} from './lib/media.mjs';

const args = process.argv.slice(2);
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { i++; continue; }
  positional.push(args[i]);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const file = positional[0];
if (!file || !existsSync(file)) {
  console.error('Usage: npm run refstyle -- <reference-clip> [--threshold 0.30] [--fps 30]');
  process.exit(2);
}

const threshold = Number(flag('threshold', 0.3));
const fps = Number(flag('fps', 30));
const info = probe(file);
if (!info) {
  console.error('Could not read that file.');
  process.exit(1);
}

/* ---------------------------------------------------------------- cuts */

const scene = run(FFMPEG, [
  '-hide_banner', '-i', file,
  '-filter_complex', `select='gt(scene,${threshold})',metadata=print:file=-`,
  '-an', '-f', 'null', '-',
]);

const cuts = [];
for (const line of (scene.out + '\n' + scene.err).split('\n')) {
  const m = /pts_time:([\d.]+)/.exec(line);
  if (m) {
    const t = Number(m[1]);
    if (!cuts.length || t - cuts[cuts.length - 1] > 0.12) cuts.push(Number(t.toFixed(3)));
  }
}

const bounds = [0, ...cuts, info.duration];
const shots = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const len = bounds[i + 1] - bounds[i];
  if (len > 0.05) shots.push({start: bounds[i], end: bounds[i + 1], length: Number(len.toFixed(3))});
}
const lengths = shots.map((s) => s.length);
const cutsPerMinute = info.duration ? (cuts.length / info.duration) * 60 : 0;

/* ---------------------------------------------------------------- colour, one sample per second */

const raw = run(FFMPEG, [
  '-v', 'error', '-i', file,
  '-vf', 'fps=1,scale=32:18',
  '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-',
], {encoding: 'buffer'});

const pixels = raw.ok ? raw.out : Buffer.alloc(0);
const perFrame = 32 * 18 * 3;
const samples = [];
for (let f = 0; f + perFrame <= pixels.length; f += perFrame) {
  let r = 0, g = 0, b = 0, lum = 0, sat = 0;
  const count = 32 * 18;
  const lums = [];
  for (let p = 0; p < count; p++) {
    const i = f + p * 3;
    const pr = pixels[i], pg = pixels[i + 1], pb = pixels[i + 2];
    r += pr; g += pg; b += pb;
    const mx = Math.max(pr, pg, pb);
    const mn = Math.min(pr, pg, pb);
    sat += mx ? (mx - mn) / mx : 0;
    const l = 0.2126 * pr + 0.7152 * pg + 0.0722 * pb;
    lum += l;
    lums.push(l);
  }
  lums.sort((x, y) => x - y);
  samples.push({
    second: samples.length,
    r: r / count, g: g / count, b: b / count,
    brightness: lum / count,
    saturation: sat / count,
    contrast: (lums[Math.floor(lums.length * 0.95)] - lums[Math.floor(lums.length * 0.05)]) / 255,
  });
}

const avg = (key) => (samples.length ? samples.reduce((s, x) => s + x[key], 0) / samples.length : 0);
const warmth = avg('r') - avg('b'); // positive = warm, negative = cool
const colour = {
  r: Math.round(avg('r')), g: Math.round(avg('g')), b: Math.round(avg('b')),
  brightness: Math.round(avg('brightness')),
  saturation: Number(avg('saturation').toFixed(3)),
  contrast: Number(avg('contrast').toFixed(3)),
  warmth: Number(warmth.toFixed(1)),
};

/* ---------------------------------------------------------------- pacing over time */

const buckets = [];
const bucketSize = Math.max(5, Math.round(info.duration / 8));
for (let t = 0; t < info.duration; t += bucketSize) {
  const inBucket = shots.filter((s) => s.start >= t && s.start < t + bucketSize);
  buckets.push({
    from: t,
    to: Math.min(t + bucketSize, info.duration),
    shots: inBucket.length,
    avgShot: inBucket.length ? Number((inBucket.reduce((a, s) => a + s.length, 0) / inBucket.length).toFixed(2)) : null,
  });
}

/* ---------------------------------------------------------------- write */

const name = basename(file, extname(file));
const dir = join('work', 'refs', name);
mkdirSync(dir, {recursive: true});

const med = median(lengths);
const pace = med < 0.8 ? 'very fast' : med < 1.6 ? 'fast' : med < 3 ? 'medium' : 'slow and held';
const look =
  `${colour.warmth > 8 ? 'warm' : colour.warmth < -8 ? 'cool' : 'neutral'}, ` +
  `${colour.saturation > 0.45 ? 'saturated' : colour.saturation < 0.25 ? 'desaturated' : 'moderately saturated'}, ` +
  `${colour.brightness > 150 ? 'bright' : colour.brightness < 80 ? 'dark' : 'mid-key'}, ` +
  `${colour.contrast > 0.75 ? 'high contrast' : colour.contrast < 0.45 ? 'soft contrast' : 'normal contrast'}`;

const brief = `# Style brief — ${name}

Measured from the reference, not copied from it. Use it to match energy and look.

## Pacing
- **Length:** ${fmt(info.duration, 1)}s
- **Cuts:** ${cuts.length}  (${fmt(cutsPerMinute, 1)} per minute)
- **Shot length:** median ${fmt(med, 2)}s · shortest ${fmt(Math.min(...lengths, 0), 2)}s · longest ${fmt(Math.max(...lengths, 0), 2)}s
- **Feel:** ${pace}

| Section | Shots | Average shot |
|---|---|---|
${buckets.map((b) => `| ${timecode(b.from)}–${timecode(b.to)} | ${b.shots} | ${b.avgShot ? `${b.avgShot}s` : '—'} |`).join('\n')}

## Colour
- **Look:** ${look}
- Average RGB ${colour.r}, ${colour.g}, ${colour.b} · brightness ${colour.brightness}/255
- Saturation ${colour.saturation} · contrast ${colour.contrast} · warmth ${colour.warmth > 0 ? '+' : ''}${colour.warmth}

## How to match it
- Cut roughly every **${fmt(med, 2)}s** (${Math.round(med * fps)} frames at ${fps}fps).
- ${med < 1 ? 'Keep almost every shot under a second; hold only the payoff.' : med < 2 ? 'Most shots under two seconds, with one or two longer holds to breathe.' : 'Let shots breathe; use motion inside the frame instead of cutting.'}
- ${colour.warmth > 8 ? 'Warm the grade slightly; protect skin from going orange.' : colour.warmth < -8 ? 'Cool the grade slightly; keep skin neutral.' : 'Keep the grade neutral.'}
- ${colour.saturation > 0.45 ? 'Colour is doing work here — one strong hue can dominate a shot.' : 'Colour is restrained; contrast and framing carry it.'}

## Cut list
${shots.map((s, i) => `${String(i + 1).padStart(2, '0')}. ${timecode(s.start)} → ${timecode(s.end)}  (${fmt(s.length, 2)}s)`).join('\n')}
`;

writeFileSync(join(dir, 'style-brief.md'), brief);
writeFileSync(
  join(dir, 'style-brief.json'),
  JSON.stringify({source: file, duration: info.duration, fps: info.fps, cuts, shots, cutsPerMinute, medianShot: med, colour, buckets}, null, 2),
);

console.log(`${name}: ${cuts.length} cuts, median shot ${fmt(med, 2)}s (${pace}), ${look}`);
console.log(`Written  ${join(dir, 'style-brief.md')}`);
