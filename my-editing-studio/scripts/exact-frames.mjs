#!/usr/bin/env node
/**
 * Pull EXACT frame numbers out of a rendered file.
 *
 *   node scripts/exact-frames.mjs <file.mp4> <frame,frame,...> <outDir>
 *
 * Why this exists: `-ss` seeking is not frame accurate. Checking v4's cut boundaries with it
 * returned frames 1-3 later than asked for, which made clean cuts look like defects and nearly
 * sent a good edit back for rework. Decoding from the start and selecting by frame index is
 * slower and is the only thing that can be trusted for a boundary check.
 *
 * The select expression is passed as one argv entry through spawnSync, never a shell — its
 * commas are exactly what breaks a shell-quoted filter graph.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {FFMPEG} from './lib/media.mjs';

const [, , file, framesArg, outDir = 'work/exact'] = process.argv;
if (!file || !framesArg) {
  console.error('Usage: node scripts/exact-frames.mjs <file> <frame,frame,...> [outDir]');
  process.exit(2);
}

const frames = framesArg.split(',').map(Number).sort((a, b) => a - b);
rmSync(outDir, {recursive: true, force: true});
mkdirSync(outDir, {recursive: true});

// eq(n\,N) — the backslash has to survive into the filter string, so it is doubled here.
const expr = frames.map((f) => `eq(n\\,${f})`).join('+');

const r = spawnSync(
  FFMPEG,
  [
    '-y', '-v', 'error',
    '-i', file,
    '-vf', `select='${expr}',scale=440:-1`,
    '-fps_mode', 'passthrough',
    '-frames:v', String(frames.length),
    join(outDir, 'x%03d.png'),
  ],
  {encoding: 'utf8'},
);
if (r.status !== 0) {
  console.error(r.stderr?.slice(0, 900));
  process.exit(1);
}

console.log(frames.map((f, i) => `x${String(i + 1).padStart(3, '0')}.png = frame ${f}`).join('\n'));
