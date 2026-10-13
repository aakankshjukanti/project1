#!/usr/bin/env node
/**
 * Beat map for a music track, so cuts can land on the beat.
 *
 *   npm run beats -- <audio-or-video> [--project <name>] [--min 60] [--max 190]
 *
 * Writes work/<project>/beats.json (or next to the file) with:
 *   bpm, beatSeconds, downbeatSeconds, onsetSeconds, and the same in frames at 25/30/60fps.
 *
 * How it works: spectral flux gives an onset strength curve, autocorrelation of that curve
 * gives the tempo, then we slide a grid at that tempo to the phase that lands on the most
 * energy. No Python, no model — just ffmpeg and maths.
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {basename, extname, join} from 'node:path';
import {decodePcm, fmt, median, onsetEnvelope, probe} from './lib/media.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!file || !existsSync(file)) {
  console.error('Usage: npm run beats -- <audio-or-video> [--project <name>] [--min 60] [--max 190]');
  process.exit(2);
}

const RATE = 22050;
const minBpm = Number(flag('min', 60));
const maxBpm = Number(flag('max', 190));
const project = flag('project', null);

const info = probe(file);
const samples = decodePcm(file, RATE);
if (!samples || samples.length < RATE) {
  console.error('No usable audio in that file.');
  process.exit(1);
}

const {env, hopSeconds} = onsetEnvelope(samples, RATE);

// Smooth a little, then subtract a moving median so a loud section doesn't hide the beats in a quiet one.
const smooth = new Float64Array(env.length);
for (let i = 0; i < env.length; i++) {
  smooth[i] = (env[Math.max(0, i - 1)] + env[i] + env[Math.min(env.length - 1, i + 1)]) / 3;
}
const detrended = new Float64Array(env.length);
const W = Math.round(0.5 / hopSeconds);
for (let i = 0; i < smooth.length; i++) {
  const from = Math.max(0, i - W);
  const to = Math.min(smooth.length, i + W);
  detrended[i] = Math.max(0, smooth[i] - median(Array.from(smooth.slice(from, to))));
}

/* ---------------------------------------------------------------- tempo */

const lagFor = (bpm) => Math.round(60 / bpm / hopSeconds);
const minLag = lagFor(maxBpm);
const maxLag = lagFor(minBpm);
let bestLag = minLag;
let bestScore = -1;
const scores = [];
for (let lag = minLag; lag <= maxLag; lag++) {
  let sum = 0;
  for (let i = 0; i + lag < detrended.length; i++) sum += detrended[i] * detrended[i + lag];
  const score = sum / (detrended.length - lag);
  scores.push({lag, score});
  if (score > bestScore) {
    bestScore = score;
    bestLag = lag;
  }
}

/**
 * Autocorrelation alone confuses a tempo with its half and double. Settle it by
 * laying each candidate grid over the actual hits and keeping the one that lands on them.
 */
const phaseFor = (lag) => {
  let phase = 0;
  let best = -1;
  for (let p = 0; p < lag; p++) {
    let sum = 0;
    for (let i = p; i < detrended.length; i += lag) sum += detrended[i];
    if (sum > best) {
      best = sum;
      phase = p;
    }
  }
  return phase;
};

const peakForOnsets = Math.max(...detrended);
const onsetIdx = [];
for (let i = 1; i < detrended.length - 1; i++) {
  if (detrended[i] > peakForOnsets * 0.18 && detrended[i] >= detrended[i - 1] && detrended[i] > detrended[i + 1]) {
    if (!onsetIdx.length || (i - onsetIdx[onsetIdx.length - 1]) * hopSeconds > 0.09) onsetIdx.push(i);
  }
}

const duration = info?.duration || samples.length / RATE;
const TOL = 0.07;
const onsetTimes = onsetIdx.map((i) => i * hopSeconds);

/**
 * Least-squares fit of period and phase to the onsets a grid already lands on.
 * The analysis hop is ~23ms, so an integer lag can only ever approximate the real
 * period — which matters twice: it drifts across a long track, and (worse) it makes a
 * true period that falls between two hops score lower than its own double, which may sit
 * exactly on one. Refine before comparing, or the tempo comes back halved.
 */
const refit = (periodSeconds, phaseSeconds) => {
  const xs = [];
  const ys = [];
  for (const t of onsetTimes) {
    const k = Math.round((t - phaseSeconds) / periodSeconds);
    if (Math.abs(t - (phaseSeconds + k * periodSeconds)) <= TOL) {
      xs.push(k);
      ys.push(t);
    }
  }
  if (xs.length < 4) return {period: periodSeconds, phase: phaseSeconds};
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, b, i) => a + b * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return {period: periodSeconds, phase: phaseSeconds};
  const slope = (n * sxy - sx * sy) / denom;
  let intercept = (sy - slope * sx) / n;
  if (!(slope > 0.2 && slope < 2)) return {period: periodSeconds, phase: phaseSeconds};
  while (intercept - slope >= 0) intercept -= slope;
  return {period: slope, phase: intercept};
};

/**
 * One pass only refines what it already matches, so a seed that is 2% out drifts past the
 * tolerance after a few beats and the fit gives up on its own. Iterating lets each pass
 * match more of the track than the last, until the period stops moving.
 */
const refitToConvergence = (periodSeconds, phaseSeconds, passes = 6) => {
  let p = periodSeconds;
  let ph = phaseSeconds;
  for (let i = 0; i < passes; i++) {
    const next = refit(p, ph);
    if (Math.abs(next.period - p) < 1e-5) return next;
    p = next.period;
    ph = next.phase;
  }
  return {period: p, phase: ph};
};

const onsetSorted = [...onsetTimes].sort((a, b) => a - b);
const onsetNear = (t) => {
  let lo = 0;
  let hi = onsetSorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (onsetSorted[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  return (
    (onsetSorted[lo] !== undefined && Math.abs(onsetSorted[lo] - t) <= TOL) ||
    (onsetSorted[lo - 1] !== undefined && Math.abs(onsetSorted[lo - 1] - t) <= TOL)
  );
};

/** Reward grids that land on hits, punish grids with lots of empty beats. */
const scoreGrid = (period, phase) => {
  let hit = 0;
  let grid = 0;
  for (let t = phase; t <= duration; t += period) {
    grid++;
    if (onsetNear(t)) hit++;
  }
  if (!grid) return -1;
  return hit / onsetTimes.length - 0.35 * (1 - hit / grid);
};

/**
 * A candidate period can only be a whole analysis hop (~23ms), which at 120 BPM is a 2%
 * error — enough that the grid walks off the beat within a few bars and scores worse than
 * its own half, whose longer period happens to divide the hop more cleanly. That is how a
 * tempo comes back halved. So search a continuous window around each candidate instead of
 * trusting the integer lag, and let the best (period, phase) pair represent it.
 */
const gridScore = (lag) => {
  const seed = lag * hopSeconds;
  const span = seed * 0.05;
  const step = seed * 0.002;
  let best = {lag, period: seed, phase: 0, score: -1};
  for (let p = seed - span; p <= seed + span; p += step) {
    if (p <= 0) continue;
    for (let ph = 0; ph < p; ph += 0.01) {
      const score = scoreGrid(p, ph);
      if (score > best.score) best = {lag, period: p, phase: ph, score};
    }
  }
  // Now that the period is close, the beat-index correspondence is right and the fit lands.
  const fitted = refitToConvergence(best.period, best.phase);
  const fittedScore = scoreGrid(fitted.period, fitted.phase);
  return fittedScore >= best.score ? {lag, ...fitted, score: fittedScore} : best;
};

/**
 * Autocorrelation is one opinion about the tempo; the spacing between the hits themselves
 * is another, and it is the one that survives a track whose strongest periodicity is not
 * its beat. Offer both — plus each one's half and double — and let the grid score decide.
 */
const gaps = [];
for (let i = 1; i < onsetTimes.length; i++) gaps.push(onsetTimes[i] - onsetTimes[i - 1]);
const gapLag = gaps.length ? Math.max(1, Math.round(median(gaps) / hopSeconds)) : bestLag;

const candidates = [...new Set([Math.round(bestLag / 2), bestLag, bestLag * 2, Math.round(gapLag / 2), gapLag, gapLag * 2])]
  .filter((lag) => lag >= minLag && lag <= maxLag)
  .map(gridScore);
const chosen = candidates.reduce((best, c) => (c.score > best.score ? c : best), candidates[0]);
bestLag = chosen.lag;

// One more fit on the winner, so beat 400 is as accurate as beat 4.
const {period: beatPeriod, phase: phaseSeconds} = refitToConvergence(chosen.period, chosen.phase);
const bpm = 60 / beatPeriod;

const beats = [];
for (let t = phaseSeconds; t <= duration; t += beatPeriod) beats.push(Number(t.toFixed(3)));

// Downbeats: the strongest of every four beats decides where bar one starts.
let barPhase = 0;
let barScore = -1;
for (let p = 0; p < 4; p++) {
  let sum = 0;
  for (let i = p; i < beats.length; i += 4) {
    const idx = Math.round(beats[i] / hopSeconds);
    sum += detrended[idx] || 0;
  }
  if (sum > barScore) {
    barScore = sum;
    barPhase = p;
  }
}
const downbeats = beats.filter((_, i) => (i - barPhase) % 4 === 0);

/* ---------------------------------------------------------------- onsets (hits, not grid) */

const onsets = onsetIdx.map((i) => Number((i * hopSeconds).toFixed(3)));

/* ---------------------------------------------------------------- write */

const frames = (list, fps) => list.map((t) => Math.round(t * fps));
const out = {
  source: file,
  durationSeconds: Number(duration.toFixed(3)),
  bpm: Number(bpm.toFixed(2)),
  beatSeconds: beats,
  downbeatSeconds: downbeats,
  onsetSeconds: onsets,
  frames: {25: frames(beats, 25), 30: frames(beats, 30), 60: frames(beats, 60)},
  downbeatFrames: {25: frames(downbeats, 25), 30: frames(downbeats, 30), 60: frames(downbeats, 60)},
};

const dir = project ? join('work', project) : join('work', 'beats');
mkdirSync(dir, {recursive: true});
const outPath = join(dir, `${basename(file, extname(file))}.beats.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));

console.log(`Tempo      ${fmt(bpm, 1)} BPM  (beat every ${fmt(beatPeriod, 3)}s)`);
console.log(`Beats      ${beats.length}`);
console.log(`Downbeats  ${downbeats.length} (bar starts at ${fmt(downbeats[0] ?? 0, 2)}s)`);
console.log(`Hits       ${onsets.length} onsets`);
console.log(`Written    ${outPath}`);
console.log('\nCut on downbeats for a calm edit, on beats for a fast one, on hits for accents.');
