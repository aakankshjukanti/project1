#!/usr/bin/env node
/**
 * Speed ramps — slow-mo and speed-ups that ease in and out instead of switching hard.
 *
 *   npm run ramp -- <clip> --ramp 3.0-5.0:1->0.4 [--ramp 8-9:1->2.5] [--ease inOut] [--out path]
 *
 * Reads as: between 3s and 5s, glide from normal speed to 0.4x.
 * Audio is stretched to match, so a ramped clip stays usable with sound.
 *
 * No frame interpolation in this version: going below about 0.4x on 30fps footage will
 * start to judder. Shoot 60fps for heavy slow-mo, or keep ramps on b-roll.
 */
import {existsSync, mkdirSync} from 'node:fs';
import {basename, dirname, extname, join} from 'node:path';
import {FFMPEG, fmt, probe, run} from './lib/media.mjs';

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
const allFlags = (name) => args.map((a, i) => (a === `--${name}` ? args[i + 1] : null)).filter(Boolean);

const input = positional[0];
if (!input || !existsSync(input)) {
  console.error('Usage: npm run ramp -- <clip> --ramp 3.0-5.0:1->0.4 [--ease inOut] [--out path]');
  process.exit(2);
}

const info = probe(input);
if (!info) {
  console.error('Could not read that file.');
  process.exit(1);
}

/* ---------------------------------------------------------------- parse the ramps */

const ramps = allFlags('ramp').map((spec) => {
  const m = /^([\d.]+)-([\d.]+):([\d.]+)->([\d.]+)$/.exec(spec.trim());
  if (!m) {
    console.error(`Bad ramp "${spec}". Use start-end:fromSpeed->toSpeed, e.g. 3.0-5.0:1->0.4`);
    process.exit(2);
  }
  const [, a, b, from, to] = m;
  return {start: Number(a), end: Number(b), from: Number(from), to: Number(to)};
}).sort((x, y) => x.start - y.start);

if (!ramps.length) {
  console.error('Give at least one --ramp, e.g. --ramp 3.0-5.0:1->0.4');
  process.exit(2);
}
for (const r of ramps) {
  if (r.end <= r.start) { console.error(`Ramp ends before it starts: ${r.start}-${r.end}`); process.exit(2); }
  if (r.end > info.duration + 0.01) { console.error(`Ramp at ${r.end}s is past the end of the clip (${fmt(info.duration, 2)}s).`); process.exit(2); }
  if (r.from <= 0 || r.to <= 0) { console.error('Speeds must be greater than 0.'); process.exit(2); }
}

/* ---------------------------------------------------------------- build the segments */

const ease = flag('ease', 'inOut');
const curve = (u) => {
  if (ease === 'linear') return u;
  if (ease === 'in') return u * u;
  if (ease === 'out') return 1 - (1 - u) * (1 - u);
  return u * u * (3 - 2 * u); // inOut: smoothstep, matches our motion feel
};

const segments = [];
let cursor = 0;
for (const r of ramps) {
  if (r.start > cursor + 0.001) segments.push({start: cursor, end: r.start, speed: 1});
  // A ramp is many short constant-speed pieces; enough of them and the change reads as smooth.
  const steps = Math.max(8, Math.round((r.end - r.start) * 12));
  const stepLen = (r.end - r.start) / steps;
  for (let i = 0; i < steps; i++) {
    const u = (i + 0.5) / steps;
    segments.push({
      start: r.start + i * stepLen,
      end: r.start + (i + 1) * stepLen,
      speed: r.from + (r.to - r.from) * curve(u),
    });
  }
  cursor = r.end;
}
if (cursor < info.duration - 0.001) segments.push({start: cursor, end: info.duration, speed: 1});

/** atempo only accepts 0.5–2, so chain it for anything outside that. */
const atempoChain = (speed) => {
  const parts = [];
  let s = speed;
  while (s < 0.5) { parts.push(0.5); s /= 0.5; }
  while (s > 2) { parts.push(2); s /= 2; }
  parts.push(Number(s.toFixed(6)));
  return parts.map((p) => `atempo=${p}`).join(',');
};

const hasAudio = info.hasAudio;
const filters = [];
segments.forEach((seg, i) => {
  filters.push(
    `[0:v]trim=start=${fmt(seg.start, 4)}:end=${fmt(seg.end, 4)},setpts=(PTS-STARTPTS)/${fmt(seg.speed, 6)}[v${i}]`,
  );
  if (hasAudio) {
    filters.push(
      `[0:a]atrim=start=${fmt(seg.start, 4)}:end=${fmt(seg.end, 4)},asetpts=PTS-STARTPTS,${atempoChain(seg.speed)}[a${i}]`,
    );
  }
});
const streams = segments.map((_, i) => (hasAudio ? `[v${i}][a${i}]` : `[v${i}]`)).join('');
filters.push(`${streams}concat=n=${segments.length}:v=1:a=${hasAudio ? 1 : 0}[vout]${hasAudio ? '[aout]' : ''}`);

const outPath = flag('out', join(dirname(input), `${basename(input, extname(input))}-ramped.mp4`));
mkdirSync(dirname(outPath), {recursive: true});

const cmd = [
  '-y', '-loglevel', 'error', '-i', input,
  '-filter_complex', filters.join(';'),
  '-map', '[vout]',
  ...(hasAudio ? ['-map', '[aout]'] : []),
  '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p',
  ...(hasAudio ? ['-c:a', 'aac', '-b:a', '256k'] : []),
  '-movflags', '+faststart',
  outPath,
];

const outputDuration = segments.reduce((sum, s) => sum + (s.end - s.start) / s.speed, 0);
console.log(`In    ${input}  (${fmt(info.duration, 2)}s, ${fmt(info.fps, 2)}fps${hasAudio ? ', with audio' : ', silent'})`);
for (const r of ramps) {
  console.log(`Ramp  ${fmt(r.start, 2)}s → ${fmt(r.end, 2)}s : ${r.from}x → ${r.to}x  (${ease})`);
}
console.log(`Out   ${outPath}  (${fmt(outputDuration, 2)}s expected)`);
console.log(`      ${segments.length} segments, rendering…`);

const r = run(FFMPEG, cmd);
if (!r.ok) {
  console.error('\nffmpeg failed:\n' + r.err.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
}

const done = probe(outPath);
console.log(`Done  ${fmt(done?.duration ?? 0, 2)}s`);
if (Math.min(...ramps.map((x) => Math.min(x.from, x.to))) < 0.4 && info.fps < 50) {
  console.log('\nHeads up: below 0.4x on sub-50fps footage can judder. Shoot 60fps for heavy slow-mo.');
}
