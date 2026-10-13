#!/usr/bin/env node
/**
 * Build the voice track ONCE, losslessly, straight from the camera file.
 *
 *   node scripts/voice.mjs --source <clip.mp4> --takes <takes.json> [--drop 17.2333:17.6667] --out <voice.wav>
 *
 * WHY THIS EXISTS. The voice on demo-test went through FOUR lossy generations before it reached
 * the viewer: the camera's own AAC 128k, then the cut, then a second trim, then the render — each
 * one re-encoding what the last one had already damaged. Raising the bitrate on the later passes
 * does not recover anything; it just preserves the damage at a bigger file size. It is audible,
 * and it gets worse with every extra render.
 *
 * The rulebook already says it: render the picture muted and add the original voice back
 * untouched. This is the tool that makes that easy. The voice is cut as PCM and stays PCM until
 * the single encode at delivery, so the viewer hears one generation of loss instead of four.
 *
 * `atrim` takes colon-separated options, so the filter graph carries no commas inside a function
 * call — and it is passed through spawnSync as one argv entry, never a shell.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {FFMPEG} from './lib/media.mjs';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const source = opt('source');
const takesFile = opt('takes');
const out = opt('out');
if (!source || !out) {
  console.error('Usage: node scripts/voice.mjs --source <clip> [--takes <takes.json>] [--drop a:b] --out <voice.wav>');
  process.exit(2);
}

/** The spans to keep, in source seconds. With no takes file, keep the whole clip. */
let keep = [{from: 0, to: null}];
if (takesFile) keep = JSON.parse(readFileSync(takesFile, 'utf8')).keep;

const parts = [];
keep.forEach((k, i) => {
  const range = k.to == null ? `start=${k.from.toFixed(4)}` : `start=${k.from.toFixed(4)}:end=${k.to.toFixed(4)}`;
  parts.push(`[0:a]atrim=${range},asetpts=PTS-STARTPTS[a${i}]`);
});
parts.push(`${keep.map((_, i) => `[a${i}]`).join('')}concat=n=${keep.length}:v=0:a=1[joined]`);

/**
 * A second pass of removals, expressed in the CUT timeline rather than the source — that is where
 * a tightened pause lives, because its position only exists after the first cut.
 */
const drop = opt('drop');
let label = 'joined';
if (drop) {
  const [a, b] = drop.split(':').map(Number);
  parts.push(`[joined]asplit=2[d0][d1]`);
  parts.push(`[d0]atrim=start=0:end=${a.toFixed(4)},asetpts=PTS-STARTPTS[p0]`);
  parts.push(`[d1]atrim=start=${b.toFixed(4)},asetpts=PTS-STARTPTS[p1]`);
  parts.push(`[p0][p1]concat=n=2:v=0:a=1[cut]`);
  label = 'cut';
}

const r = spawnSync(
  FFMPEG,
  [
    '-y', '-v', 'error',
    '-i', source,
    '-filter_complex', parts.join(';'),
    '-map', `[${label}]`,
    // PCM, and the source's own sample rate — no resampling, no encoding.
    '-c:a', 'pcm_s16le',
    out,
  ],
  {encoding: 'utf8'},
);
if (r.status !== 0) {
  console.error(r.stderr?.slice(0, 900));
  process.exit(1);
}

const probe = spawnSync(
  FFMPEG.replace(/ffmpeg(\.exe)?$/i, (m) => (m.endsWith('.exe') ? 'ffprobe.exe' : 'ffprobe')),
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out],
  {encoding: 'utf8'},
);
console.log(`voice written lossless -> ${out}  (${Number(probe.stdout).toFixed(3)}s, pcm_s16le)`);
console.log('Render the picture muted, then mux this in with ONE encode at delivery.');
