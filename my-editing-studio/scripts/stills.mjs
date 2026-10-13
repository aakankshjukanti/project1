#!/usr/bin/env node
/**
 * Render many stills of a composition from one bundle, then tile them into contact sheets for review.
 *
 *   node scripts/stills.mjs <CompositionId> [--every=45] [--from=0] [--to=<last>] [--frames=10,200]
 *                           [--scale=0.4] [--cols=8] [--out=work/stills/<id>]
 *
 * Writes s000.jpg, s001.jpg... , sheet-0.jpg, sheet-1.jpg... (cols x 2 per sheet) and frames.txt.
 */
import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderStill} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

// Never hardcode a tool path. media.mjs finds the ffmpeg that ships with the studio
// (ffmpeg-static, pulled in by npm install) before it looks at PATH, which is what lets this
// run on a machine that has never had ffmpeg installed on it.
import {FFMPEG} from './lib/media.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
if (!id) {
  console.error('Usage: node scripts/stills.mjs <CompositionId> [--every=45] [--frames=a,b,c] [--scale=0.4]');
  process.exit(2);
}
const scale = Number(opt('scale') ?? 0.4);
const cols = Number(opt('cols') ?? 8);
const out = opt('out') ?? join('work', 'stills', id);
rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});

const serveUrl = await bundle({entryPoint: resolve('src/index.ts'), publicDir: resolve('assets')});
const comp = (await getCompositions(serveUrl)).find((c) => c.id === id);
if (!comp) throw new Error(`No composition ${id}`);

let frames;
if (opt('frames')) {
  frames = opt('frames').split(',').map(Number);
} else {
  frames = [];
  const every = Number(opt('every') ?? 45);
  const to = Number(opt('to') ?? comp.durationInFrames - 1);
  for (let f = Number(opt('from') ?? 0); f <= to; f += every) frames.push(f);
}

const browser = await openBrowser('chrome');
for (const [i, frame] of frames.entries()) {
  const name = `s${String(i).padStart(3, '0')}.jpg`;
  await renderStill({composition: comp, serveUrl, frame, output: join(out, name), imageFormat: 'jpeg', scale, puppeteerInstance: browser});
  process.stdout.write(`${frame} `);
}
writeFileSync(join(out, 'frames.txt'), frames.map((f, i) => `s${String(i).padStart(3, '0')} = frame ${f}`).join('\n'));

const perSheet = cols * 2;
for (let s = 0; s * perSheet < frames.length; s++) {
  spawnSync(
    FFMPEG,
    ['-y', '-loglevel', 'error', '-start_number', String(s * perSheet), '-i', join(out, 's%03d.jpg'), '-frames:v', '1', '-vf', `tile=${cols}x2:padding=6:color=black`, join(out, `sheet-${s}.jpg`)],
    {stdio: 'inherit'},
  );
}
await browser.close({silent: true});
// The bundle holds a full copy of assets/ (cutouts are GBs) — never leave it behind.
rmSync(serveUrl, {recursive: true, force: true});
console.log(`\n${frames.length} stills and ${Math.ceil(frames.length / perSheet)} sheets -> ${out}`);
