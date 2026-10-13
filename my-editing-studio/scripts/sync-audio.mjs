#!/usr/bin/env node
/**
 * Line two recordings up by their sound.
 *
 *   npm run sync -- <clip-a> <clip-b> [--fps 30] [--max 30]
 *
 * Use it for: a clip-on mic recorded separately, a second camera angle, or a green-screen
 * twin that started a moment late. Prints the offset in seconds and frames, and the exact
 * ffmpeg line to apply it.
 *
 * How: match the loudness shape of both recordings (coarse), then match the waveform itself
 * around that point (fine). Accurate to a handful of milliseconds on real audio.
 */
import {existsSync} from 'node:fs';
import {decodePcm, energyEnvelope, fmt, probe} from './lib/media.mjs';

const args = process.argv.slice(2);
// Positional file arguments only: skip every --flag and the value that follows it.
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) { i++; continue; }
  files.push(args[i]);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

if (files.length < 2 || !files.slice(0, 2).every((f) => existsSync(f))) {
  console.error('Usage: npm run sync -- <clip-a> <clip-b> [--fps 30] [--max 30]');
  process.exit(2);
}

const [fileA, fileB] = files;
const fps = flag('fps', 30);
const maxShift = flag('max', 30); // seconds to search either way

const COARSE_RATE = 8000;
const COARSE_HOP = 256;
const FINE_RATE = 22050;

const a = decodePcm(fileA, COARSE_RATE);
const b = decodePcm(fileB, COARSE_RATE);
if (!a || !b) {
  console.error('One of those files has no usable audio.');
  process.exit(1);
}

const norm = (env) => {
  const m = env.reduce((x, y) => x + y, 0) / env.length;
  const out = new Float64Array(env.length);
  for (let i = 0; i < env.length; i++) out[i] = env[i] - m;
  return out;
};

const ea = norm(energyEnvelope(a, COARSE_RATE, COARSE_HOP).env);
const eb = norm(energyEnvelope(b, COARSE_RATE, COARSE_HOP).env);
const hopSeconds = COARSE_HOP / COARSE_RATE;

/** Normalised correlation of two series at a given lag (b shifted by `lag` frames). */
function correlate(x, y, lag) {
  const start = Math.max(0, -lag);
  const end = Math.min(x.length, y.length - lag);
  if (end - start < 20) return -1;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = start; i < end; i++) {
    const xv = x[i];
    const yv = y[i + lag];
    num += xv * yv;
    dx += xv * xv;
    dy += yv * yv;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : -1;
}

const maxLag = Math.round(maxShift / hopSeconds);
let bestLag = 0;
let bestScore = -1;
for (let lag = -maxLag; lag <= maxLag; lag++) {
  const score = correlate(ea, eb, lag);
  if (score > bestScore) {
    bestScore = score;
    bestLag = lag;
  }
}
const coarseSeconds = bestLag * hopSeconds;

/* ---------------------------------------------------------------- fine pass on the waveform */

let offsetSeconds = coarseSeconds;
const fa = decodePcm(fileA, FINE_RATE);
const fb = decodePcm(fileB, FINE_RATE);
if (fa && fb) {
  const centre = Math.round(coarseSeconds * FINE_RATE);
  const window = Math.round(hopSeconds * 2 * FINE_RATE);
  const step = Math.max(1, Math.round(FINE_RATE / 4000)); // ~0.25ms resolution
  let fineBest = centre;
  let fineScore = -1;
  for (let lag = centre - window; lag <= centre + window; lag += step) {
    const score = correlate(fa, fb, lag);
    if (score > fineScore) {
      fineScore = score;
      fineBest = lag;
    }
  }
  if (fineScore > 0) offsetSeconds = fineBest / FINE_RATE;
}

const infoA = probe(fileA);
const infoB = probe(fileB);
const frames = offsetSeconds * fps;
const confidence = bestScore > 0.75 ? 'strong' : bestScore > 0.45 ? 'usable' : 'weak — check it by ear';

console.log(`A  ${fileA}  (${fmt(infoA?.duration ?? 0, 2)}s)`);
console.log(`B  ${fileB}  (${fmt(infoB?.duration ?? 0, 2)}s)`);
console.log('');
if (Math.abs(offsetSeconds) < 0.005) {
  console.log('These are already in sync.');
} else if (offsetSeconds > 0) {
  // B's content arrives later than A's: skip the head of B.
  console.log(`B starts ${fmt(offsetSeconds, 3)}s LATER than A  (${fmt(frames, 1)} frames at ${fps}fps)`);
  console.log(`Trim B:    -ss ${fmt(offsetSeconds, 3)} -i "${fileB}"`);
  console.log(`In the edit: start B at frame ${Math.round(frames)} of its own timeline.`);
} else {
  console.log(`B starts ${fmt(-offsetSeconds, 3)}s EARLIER than A  (${fmt(-frames, 1)} frames at ${fps}fps)`);
  console.log(`Trim A:    -ss ${fmt(-offsetSeconds, 3)} -i "${fileA}"`);
  console.log(`In the edit: start A at frame ${Math.round(-frames)} of its own timeline.`);
}
console.log(`\nMatch     ${fmt(bestScore, 3)} (${confidence})`);
if (infoA && infoB && Math.abs((infoA.fps || 0) - (infoB.fps || 0)) > 0.02) {
  console.log(`Careful:  different frame rates (${fmt(infoA.fps, 2)} vs ${fmt(infoB.fps, 2)}). Conform both before using this offset.`);
}
