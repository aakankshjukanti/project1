#!/usr/bin/env node
/**
 * Does this machine actually have everything the studio claims to do?
 *
 *   npm run doctor
 *
 * This exists because a working setup went quiet. WhisperX had been installed and used
 * (there are words.json files from a fortnight earlier), then the Python environment
 * underneath it was emptied, and nothing noticed until a job needed a transcript. The
 * code was fine the whole time. The environment was not, and there was no way to tell
 * except by running something and watching it fail.
 *
 * So this checks CAPABILITIES rather than files: it runs the binaries, imports the
 * modules, and reports what you can and cannot do right now. A capability that is
 * missing is reported with the command that fixes it, because "not installed" with no
 * next step is what turns a five-minute problem into a phone call.
 *
 * Exit code is 0 when everything the studio needs for a render is present, 1 when
 * something core is broken. Optional pieces report but never fail the run.
 */
import {execFileSync} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// fileURLToPath, not URL.pathname: a path with a space in it comes back percent-encoded
// from pathname, so every existsSync below silently answers false and the report claims
// a working studio is broken.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENV = process.platform === 'win32'
  ? join(ROOT, '.venv', 'Scripts', 'python.exe')
  : join(ROOT, '.venv', 'bin', 'python');

const results = [];
const record = (area, name, ok, detail, fix, core = true) =>
  results.push({area, name, ok, detail, fix, core});

const tryRun = (bin, args, pick = (s) => s.trim().split('\n')[0]) => {
  try {
    return {ok: true, out: pick(execFileSync(bin, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}))};
  } catch (e) {
    return {ok: false, out: (e.stderr || e.message || '').toString().trim().split('\n')[0]};
  }
};

/* ------------------------------------------------------------------ the engine */
const node = process.versions.node;
const nodeMajor = Number(node.split('.')[0]);
record('engine', 'Node', nodeMajor >= 20, `v${node}`, 'Install the LTS build from nodejs.org');

const hasModules = existsSync(join(ROOT, 'node_modules', 'remotion'));
const pkgCount = existsSync(join(ROOT, 'node_modules')) ? readdirSync(join(ROOT, 'node_modules')).length : 0;
record('engine', 'Video engine', hasModules, hasModules ? `${pkgCount} packages` : 'node_modules/remotion missing', 'npm install');

/* ------------------------------------------------------------- media handling */
let FFMPEG = 'ffmpeg', FFPROBE = 'ffprobe';
try {
  const media = await import('./lib/media.mjs');
  FFMPEG = media.FFMPEG;
  FFPROBE = media.FFPROBE;
} catch { /* fall back to PATH and let the run below report it */ }

for (const [name, bin] of [['ffmpeg', FFMPEG], ['ffprobe', FFPROBE]]) {
  const r = tryRun(bin, ['-version']);
  record('media', name, r.ok, r.ok ? r.out.split(' ').slice(0, 3).join(' ') : 'not runnable',
    'Set $FFMPEG / $FFPROBE, or install ffmpeg so it is on PATH');
}

/* ------------------------------------------------------ the transcriber (optional) */
const venvOk = existsSync(VENV);
record('transcriber', 'Python 3.11/3.12 venv', venvOk, venvOk ? VENV.replace(ROOT, '.') : '.venv missing',
  'py -3.12 -m venv .venv   (3.13+ will not build WhisperX)', false);

if (venvOk) {
  const ver = tryRun(VENV, ['-c', 'import sys;print(sys.version.split()[0])']);
  const minor = Number((ver.out || '0.0').split('.')[1]);
  record('transcriber', 'Python version', ver.ok && (minor === 11 || minor === 12),
    ver.out, 'Rebuild the venv with python 3.11 or 3.12', false);

  // Every module the Python half imports, not just the headline one.
  for (const mod of ['whisperx', 'torch', 'numpy', 'PIL', 'certifi']) {
    const r = tryRun(VENV, ['-c', `import ${mod}`], () => 'ok');
    record('transcriber', mod, r.ok, r.ok ? 'ok' : 'not importable',
      '.venv/Scripts/pip install -r requirements.txt', false);
  }
}

/* ------------------------------------------------- the python half, script by script */
if (venvOk) {
  // Importing whisperx is not the same as the scripts running. Compile each one, which
  // catches a missing dependency or a syntax error without doing any of the slow work.
  const py = readdirSync(join(ROOT, 'scripts')).filter((f) => f.endsWith('.py'));
  const bad = [];
  for (const f of py) {
    const r = tryRun(VENV, ['-m', 'py_compile', join(ROOT, 'scripts', f)], () => 'ok');
    if (!r.ok) bad.push(f);
  }
  record('transcriber', 'Python scripts', bad.length === 0,
    bad.length ? `${bad.join(', ')} will not compile` : `${py.length} compile clean`,
    '.venv/Scripts/pip install -r requirements.txt', false);
}

/* ----------------------------------------------------------------------- brand */
const tokens = existsSync(join(ROOT, 'src', 'design', 'tokens.ts'));
record('brand', 'Design tokens', tokens, tokens ? 'src/design/tokens.ts' : 'missing',
  'Restore src/design/tokens.ts, which is where the whole look lives');

// A missing font file does not fail a render: it silently swaps in a fallback, and the
// video comes out looking almost right, which is worse than an error.
const fontDir = join(ROOT, 'assets', 'fonts');
const fonts = existsSync(fontDir) ? readdirSync(fontDir).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f)) : [];
record('brand', 'Fonts', fonts.length > 0,
  fonts.length ? `${fonts.length} file(s): ${fonts.slice(0, 2).join(', ')}` : 'assets/fonts is empty',
  'Put the brand font files back in assets/fonts, or a render falls back to a system face');

/* --------------------------------------------------------------------- report */
const W = 22;
let lastArea = '';
for (const r of results) {
  if (r.area !== lastArea) { console.log(`\n${r.area.toUpperCase()}`); lastArea = r.area; }
  const mark = r.ok ? '  ok  ' : (r.core ? ' FAIL ' : ' --   ');
  console.log(`${mark} ${r.name.padEnd(W)} ${r.detail}`);
  if (!r.ok) console.log(`       ${''.padEnd(W)} fix: ${r.fix}`);
}

const brokenCore = results.filter((r) => !r.ok && r.core);
const brokenOpt = results.filter((r) => !r.ok && !r.core);

console.log('\n' + '-'.repeat(64));
if (!brokenCore.length && !brokenOpt.length) {
  console.log('Everything is present. You can cut, render and caption.');
} else if (!brokenCore.length) {
  console.log(`Rendering works. ${brokenOpt.length} optional piece(s) missing:`);
  console.log(`  ${[...new Set(brokenOpt.map((r) => r.fix))].join('\n  ')}`);
  console.log('Without these: no word-level captions, no auto cut detection, no green-screen cutouts.');
} else {
  console.log(`${brokenCore.length} thing(s) needed for a render are missing. Fix these first:`);
  console.log(`  ${[...new Set(brokenCore.map((r) => r.fix))].join('\n  ')}`);
}

process.exit(brokenCore.length ? 1 : 0);
