#!/usr/bin/env node
/**
 * Motion check — renders every frame of a composition and measures frame-to-frame
 * change across a grid of tiles, to catch what reads as "not smooth" at playback:
 *
 *   POP      something appears or changes in place within a single frame   (fails)
 *   CUT      the whole frame changes at once                                 (fails)
 *   STUTTER  motion freezes for a frame, then continues (hitch / snapping)   (fails)
 *   FAST     an edge jumps more than a tile (120px) per frame — strobes      (warning:
 *            add motion blur, slow it down, or feather the moving edge)
 *
 * Usage:
 *   node scripts/motion-check.mjs <CompositionId> [--frames=0-149] [--fps=30] [--scale=2] [--allow=45,90] [--keep]
 *
 * --scale   render supersampled (e.g. 2) and downsample before measuring — match the final render
 * --allow   frame numbers where a cut is intentional
 * --allow-file  JSON array of such frames (e.g. from scripts/find_cuts.py); pops/stutters within
 *           1 frame of them are also excused, since the footage itself jumps there
 * --keep    keep rendered PNGs in work/motion-check/<id>/ (deleted by default to save disk)
 * --reuse   analyse PNGs already kept from a previous run instead of rendering again
 * Exit code 1 when any POP, CUT or STUTTER is found.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {PNG} from 'pngjs';

const args = process.argv.slice(2);
const comp = args.find((a) => !a.startsWith('--'));
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
if (!comp) {
  console.error('Usage: node scripts/motion-check.mjs <CompositionId> [--frames=a-b] [--fps=30] [--scale=2] [--allow=f1,f2] [--keep]');
  process.exit(2);
}
const fps = Number(opt('fps') ?? 30);
const scale = Number(opt('scale') ?? 1);
const allowed = new Set((opt('allow') ?? '').split(',').filter(Boolean).map(Number));
// --allow-file: JSON array of frames with intentional content cuts (e.g. jump cuts in the footage).
if (opt('allow-file')) for (const f of JSON.parse(readFileSync(opt('allow-file'), 'utf8'))) allowed.add(Number(f));
const nearAllowed = (frame) => allowed.has(frame) || allowed.has(frame - 1) || allowed.has(frame + 1);
const reuse = args.includes('--reuse');
const keep = args.includes('--keep') || reuse;

// Measured on the output-size image. Luma differences are 0-255 means over a tile.
const TILE = 120; // px
const STEP = 2; // sample every 2nd pixel in each direction
const STILL = 0.05; // below this a tile is not changing
const VISIBLE = 1.0; // clearly visible change
const POP_MIN = 3.0; // a pop must be at least this strong...
const POP_RATIO = 5; // ...and this many times stronger than both neighbouring frames
const CUT_MIN = 12; // whole-frame mean change that counts as a cut
const DETAIL = 3; // tile luma std-dev: below this the tile is flat, so a freeze there is invisible

const dir = join('work', 'motion-check', comp);
if (!reuse) {
  rmSync(dir, {recursive: true, force: true});
  mkdirSync(dir, {recursive: true});
}

const renderArgs = ['remotion', 'render', comp, `"${dir}"`, '--sequence', '--image-format=png', '--log=error'];
if (opt('frames')) renderArgs.push(`--frames=${opt('frames')}`);
if (scale !== 1) renderArgs.push(`--scale=${scale}`);
if (!reuse) {
  console.log(`Rendering every frame of ${comp}${scale !== 1 ? ` at ${scale}x` : ''}...`);
  const render = spawnSync('npx', renderArgs, {stdio: 'inherit', shell: true});
  if (render.status !== 0) {
    console.error('Render failed.');
    process.exit(2);
  }
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.png'))
  .map((f) => ({f, n: Number(f.match(/(\d+)\.png$/)[1])}))
  .sort((a, b) => a.n - b.n);

/** Luma at output size; supersampled renders are box-downsampled like the final encode. */
const toLuma = (png) => {
  const w = Math.floor(png.width / scale);
  const h = Math.floor(png.height / scale);
  const luma = new Float32Array(w * h);
  const area = scale * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = ((y * scale + dy) * png.width + (x * scale + dx)) * 4;
          sum += 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
        }
      }
      luma[y * w + x] = sum / area;
    }
  }
  return {luma, w, h};
};

let prev = null;
let width = 0;
let height = 0;
let cols = 0;
let rows = 0;
const series = []; // one entry per frame transition, keyed by the frame that appears

for (const {f, n} of files) {
  const cur = toLuma(PNG.sync.read(readFileSync(join(dir, f))));
  if (!prev) {
    ({w: width, h: height} = cur);
    cols = Math.ceil(width / TILE);
    rows = Math.ceil(height / TILE);
  } else {
    const sums = new Float64Array(cols * rows);
    const counts = new Uint32Array(cols * rows);
    const lumaSum = new Float64Array(cols * rows);
    const lumaSq = new Float64Array(cols * rows);
    for (let y = 0; y < height; y += STEP) {
      const rowBase = Math.floor(y / TILE) * cols;
      for (let x = 0; x < width; x += STEP) {
        const i = y * width + x;
        const t = rowBase + Math.floor(x / TILE);
        sums[t] += Math.abs(cur.luma[i] - prev.luma[i]);
        lumaSum[t] += cur.luma[i];
        lumaSq[t] += cur.luma[i] * cur.luma[i];
        counts[t]++;
      }
    }
    const tiles = new Float32Array(cols * rows);
    const detail = new Float32Array(cols * rows);
    let total = 0;
    let count = 0;
    for (let t = 0; t < tiles.length; t++) {
      tiles[t] = sums[t] / counts[t];
      const mean = lumaSum[t] / counts[t];
      detail[t] = Math.sqrt(Math.max(0, lumaSq[t] / counts[t] - mean * mean));
      total += sums[t];
      count += counts[t];
    }
    series.push({frame: n, tiles, detail, global: total / count});
  }
  prev = cur;
}

const region = (tileList) => {
  const xs = tileList.map((t) => t % cols);
  const ys = tileList.map((t) => Math.floor(t / cols));
  const x0 = Math.min(...xs) * TILE;
  const x1 = Math.min((Math.max(...xs) + 1) * TILE, width);
  const y0 = Math.min(...ys) * TILE;
  const y1 = Math.min((Math.max(...ys) + 1) * TILE, height);
  return `x ${x0}-${x1}, y ${y0}-${y1}`;
};
const time = (frame) => `${(frame / fps).toFixed(2)}s`;

const neighbours = (t) => {
  const cx = t % cols;
  const cy = Math.floor(t / cols);
  const list = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if ((dx || dy) && x >= 0 && x < cols && y >= 0 && y < rows) list.push(y * cols + x);
    }
  }
  return list;
};

const issues = [];
const warnings = [];
series.forEach((cur, k) => {
  const before = series[k - 1];
  const after = series[k + 1];

  const neighbourGlobal = Math.max(before?.global ?? 0, after?.global ?? 0, STILL);
  if (cur.global >= CUT_MIN && cur.global >= POP_RATIO * neighbourGlobal) {
    if (!allowed.has(cur.frame)) {
      issues.push({type: 'CUT', frame: cur.frame, detail: `whole frame changes at once (mean change ${cur.global.toFixed(1)})`});
    }
    return;
  }

  const pops = [];
  const fast = [];
  const stutters = [];
  for (let t = 0; t < cur.tiles.length; t++) {
    const v = cur.tiles[t];
    const vb = before?.tiles[t] ?? 0;
    const va = after?.tiles[t] ?? 0;
    if (v >= POP_MIN && v >= POP_RATIO * Math.max(vb, va, STILL)) {
      // Change that continues in an adjacent tile on the next/previous frame is a travelling edge, not a pop.
      const travelling = neighbours(t).some(
        (nb) => (before?.tiles[nb] ?? 0) >= VISIBLE || (after?.tiles[nb] ?? 0) >= VISIBLE,
      );
      (travelling ? fast : pops).push(t);
    }
    // A freeze is only visible where the tile has detail (flat card interiors legitimately don't change).
    if (before && after && v <= STILL && vb >= VISIBLE && va >= VISIBLE && cur.detail[t] >= DETAIL) stutters.push(t);
  }
  if (nearAllowed(cur.frame)) return;
  if (pops.length) {
    const peak = Math.max(...pops.map((t) => cur.tiles[t]));
    issues.push({type: 'POP', frame: cur.frame, detail: `appears/changes in one frame at ${region(pops)} (strength ${peak.toFixed(1)})`});
  }
  if (stutters.length) {
    issues.push({type: 'STUTTER', frame: cur.frame, detail: `motion freezes for a frame at ${region(stutters)}`});
  }
  if (fast.length) {
    warnings.push({type: 'FAST', frame: cur.frame, detail: `edge jumps >${TILE}px in one frame at ${region(fast)}`});
  }
});

// Motion timeline: how much the frame changes over time (ASCII, 60 frames per row).
const LEVELS = ' .:-=+*#%@';
const peak = Math.max(...series.map((s) => s.global), STILL);
console.log(`\nMotion timeline (${files.length} frames @ ${fps}fps, one character per frame, '@' = most change):`);
for (let i = 0; i < series.length; i += 60) {
  const row = series
    .slice(i, i + 60)
    .map((s) => (s.global <= STILL ? ' ' : LEVELS[Math.max(1, Math.round((s.global / peak) * (LEVELS.length - 1)))]))
    .join('');
  console.log(`  ${String(series[i].frame).padStart(4)} |${row}|`);
}

let longestStill = {start: 0, length: 0};
let run = null;
for (const s of series) {
  if (s.global <= STILL) {
    run = run ? {start: run.start, length: run.length + 1} : {start: s.frame, length: 1};
    if (run.length > longestStill.length) longestStill = run;
  } else {
    run = null;
  }
}
if (longestStill.length > 0) {
  console.log(
    `  Longest fully static stretch: frames ${longestStill.start}-${longestStill.start + longestStill.length - 1} (${(longestStill.length / fps).toFixed(2)}s) — fine for a reading hold; make sure it isn't dead air.`,
  );
}

console.log('');
for (const item of [...issues, ...warnings].sort((a, b) => a.frame - b.frame)) {
  console.log(`${item.type.padEnd(8)} frame ${String(item.frame).padStart(4)} (${time(item.frame)})  ${item.detail}`);
}
console.log(
  `motion-check: ${issues.length === 0 ? 'no pops, cuts or stutters' : `${issues.length} issue(s)`}, ${warnings.length} fast-motion warning(s)`,
);

writeFileSync(
  join('work', 'motion-check', `${comp}.report.json`),
  JSON.stringify(
    {
      composition: comp,
      fps,
      scale,
      frames: files.length,
      width,
      height,
      issues,
      warnings,
      longestStill,
      globalChange: series.map((s) => ({frame: s.frame, change: Number(s.global.toFixed(3))})),
    },
    null,
    2,
  ),
);
if (!keep) rmSync(dir, {recursive: true, force: true});
process.exit(issues.length > 0 ? 1 : 0);
