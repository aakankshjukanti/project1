#!/usr/bin/env node
/**
 * One-command prep for a video, run by the user before a session so the session starts on design.
 *
 *   npm run prep -- <name>
 *
 * Reads assets/projects/<name>/BRIEF.md and footage/, then:
 *   1. probes every clip (codec, frame rate, HDR, size, length, variable frame rate)
 *   2. conforms the talking head (+ green-screen twin) to H.264, SDR, constant 30fps when needed —
 *      audio is stream-copied, never re-encoded (see the Audio standard in CLAUDE.md)
 *   3. transcribes it (WhisperX) and aligns the brief's script to the speech
 *   4. finds jump cuts, checks the green-screen twin lines up frame for frame
 *   5. conforms b-roll: crops black bars, 30fps, muted; flags genuinely vertical clips
 *   6. pulls frames for every "Moments from references" line into contact sheets
 *   7. writes work/<name>/prep/PREP.md — the first thing Claude reads in the session
 *
 * Safe to re-run: finished steps are skipped (delete work/<name>/prep to force a full redo).
 */
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {basename, extname, join} from 'node:path';

/**
 * Tool paths come from lib/media.mjs, which resolves them per platform. Hardcoding a
 * Windows path here is exactly what broke this on a Mac: the resolver already existed and
 * its own docs said "every script goes through this" — and this one quietly did not.
 */
import {FFMPEG, FFPROBE, PYTHON} from './lib/media.mjs';
// Clips shot at 25 or 30fps (constant) keep their native rate: converting 25 -> 30 duplicates frames
// and stutters. 25fps is what to shoot under 50Hz mains lighting (India) to avoid flicker.
const NATIVE_FPS = [25, 30];
const FPS = 30;
const VIDEO_EXT = new Set(['.mp4', '.mov', '.m4v', '.webm', '.mkv']);

const name = process.argv[2];
if (!name) {
  console.error('Usage: npm run prep -- <video-name>');
  process.exit(2);
}
const assets = join('assets', 'projects', name);
const footageDir = join(assets, 'footage');
const processedDir = join(assets, 'processed');
const code = join('src', 'videos', name);
const prepDir = join('work', name, 'prep');
if (!existsSync(footageDir)) {
  console.error(`No footage folder at ${footageDir}. Run "npm run new-video -- ${name}" first.`);
  process.exit(1);
}
for (const d of [processedDir, code, prepDir]) mkdirSync(d, {recursive: true});

const report = [];
const problems = [];
const log = (line) => {
  console.log(line);
  report.push(line);
};
const run = (cmd, args, opts = {}) => {
  // PYTHONIOENCODING: the Python helpers print em dashes; without it Windows mangles them.
  const r = spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 1e8, env: {...process.env, PYTHONIOENCODING: 'utf-8'}, ...opts});
  return {ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`};
};

/* ------------------------------------------------------------------ brief */

const briefPath = join(assets, 'BRIEF.md');
const brief = existsSync(briefPath) ? readFileSync(briefPath, 'utf8').replace(/<!--[\s\S]*?-->/g, '') : '';
const section = (title) => {
  const m = brief.match(new RegExp(`^## ${title}[^\\n]*\\n([\\s\\S]*?)(?=^## |^---|$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
};
const field = (label) => {
  const m = brief.match(new RegExp(`^${label}:[ \\t]*([^\\n]*)$`, 'm'));
  return m ? m[1].trim() : '';
};
const language = field('Language') || 'en';
const format = field('Format') || '(not set)';

/* ------------------------------------------------------------------ probe */

const probe = (file) => {
  const r = run(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,color_transfer:format=duration', '-of', 'json', file]);
  if (!r.ok) return null;
  const j = JSON.parse(r.out);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  if (!v) return null;
  const rate = (s) => {
    const [n, d] = s.split('/').map(Number);
    return d ? n / d : n;
  };
  const fps = rate(v.avg_frame_rate);
  return {
    codec: v.codec_name,
    width: v.width,
    height: v.height,
    fps: Number(fps.toFixed(3)),
    vfr: Math.abs(rate(v.r_frame_rate) - fps) > 0.05,
    hdr: ['smpte2084', 'arib-std-b67'].includes(v.color_transfer),
    audio: a ? a.codec_name : null,
    duration: Number(Number(j.format.duration).toFixed(2)),
  };
};

const clips = readdirSync(footageDir)
  .filter((f) => VIDEO_EXT.has(extname(f).toLowerCase()))
  .map((f) => ({file: f, path: join(footageDir, f), info: probe(join(footageDir, f)), size: statSync(join(footageDir, f)).size}));
if (!clips.length) {
  console.error(`No video files in ${footageDir}.`);
  process.exit(1);
}

// Talking head: the brief's choice, else the clip that has a "-GS"/greenscreen twin, else the largest.
const isTwinName = (f) => /(-|_| )(gs|greenscreen|green)\.[a-z0-9]+$/i.test(f);
const twinOf = (f) => clips.find((c) => c.file !== f && isTwinName(c.file) && c.file.replace(/(-|_| )(gs|greenscreen|green)(?=\.[a-z0-9]+$)/i, '') === f);
const named = field('Talking head file');
const main =
  clips.find((c) => named && c.file === named) ?? clips.find((c) => !isTwinName(c.file) && twinOf(c.file)) ?? [...clips].filter((c) => !isTwinName(c.file)).sort((a, b) => b.size - a.size)[0];
const twinNamed = field('Green-screen twin');
const twin = clips.find((c) => twinNamed && c.file === twinNamed) ?? twinOf(main.file) ?? null;
const broll = clips.filter((c) => c !== main && c !== twin);

log(`# Prep: ${name}`);
log('');
log(`Format: ${format} · Language: ${language}`);
log(`Talking head: ${main.file}${twin ? ` · green-screen twin: ${twin.file}` : ' · no green-screen twin (no text behind the subject)'}`);
log('');
log('## Footage');
log('| File | Role | Size | fps | Codec | HDR | VFR | Length | Audio |');
log('|---|---|---|---|---|---|---|---|---|');
for (const c of clips) {
  const i = c.info;
  const role = c === main ? 'talking head' : c === twin ? 'green twin' : 'b-roll';
  if (!i) {
    log(`| ${c.file} | ${role} | unreadable | | | | | | |`);
    problems.push(`${c.file} could not be read.`);
    continue;
  }
  log(`| ${c.file} | ${role} | ${i.width}x${i.height} | ${i.fps} | ${i.codec} | ${i.hdr ? 'YES' : 'no'} | ${i.vfr ? 'YES' : 'no'} | ${i.duration}s | ${i.audio ?? 'none'} |`);
}
log('');

/* ------------------------------------------------------------------ conform talking head (+ twin) */

const targetFps = (i) => NATIVE_FPS.find((f) => Math.abs(i.fps - f) < 0.02) ?? FPS;
const needsConform = (i) => i.codec !== 'h264' || i.hdr || i.vfr || Math.abs(i.fps - targetFps(i)) > 0.02;
const tonemap = 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';
const conform = (c) => {
  if (!c.info || !needsConform(c.info)) return c.path;
  const out = join(processedDir, `${basename(c.file, extname(c.file))}.mp4`);
  if (existsSync(out)) return out;
  const vf = [c.info.hdr ? tonemap : null, `fps=${targetFps(c.info)}`, 'format=yuv420p'].filter(Boolean).join(',');
  console.log(`Conforming ${c.file} (${[c.info.hdr && 'HDR', c.info.vfr && 'variable frame rate', c.info.codec !== 'h264' && c.info.codec, Math.abs(c.info.fps - targetFps(c.info)) > 0.02 && `${c.info.fps}fps`].filter(Boolean).join(', ')})...`);
  // Audio is copied untouched — the voice is never re-encoded.
  const r = run(FFMPEG, ['-y', '-loglevel', 'error', '-i', c.path, '-vf', vf, '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-c:a', 'copy', '-movflags', '+faststart', out]);
  if (!r.ok) {
    problems.push(`Conforming ${c.file} failed: ${r.out.slice(-300)}`);
    return c.path;
  }
  return out;
};
const talk = conform(main);
// The edit runs at the talking head's frame rate; b-roll is conformed to match it.
const talkFps = main.info ? targetFps(main.info) : FPS;
const talkTwin = twin ? conform(twin) : null;
log('## Talking head');
log(`Edit frame rate: ${talkFps}fps (build the composition at this rate)`);
log(`Use in the edit: \`${talk.split('\\').join('/').replace(/^assets\//, '')}\` (path inside assets/)${talk === main.path ? ' — already clean, used as recorded' : ' — conformed, audio copied untouched'}`);
if (talkTwin) log(`Green twin: \`${talkTwin.split('\\').join('/').replace(/^assets\//, '')}\``);
log('');

/* ------------------------------------------------------------------ script, transcript, alignment */

const scriptFromBrief = section('Script');
const scriptPath = join(code, 'script.txt');
if (scriptFromBrief && (!existsSync(scriptPath) || !readFileSync(scriptPath, 'utf8').trim())) writeFileSync(scriptPath, `${scriptFromBrief}\n`);
const script = existsSync(scriptPath) ? readFileSync(scriptPath, 'utf8').trim() : '';

const stem = basename(talk, extname(talk));
const transcript = join('work', name, stem, 'words.json');
if (!existsSync(transcript)) {
  console.log('Transcribing (a few minutes)...');
  const r = run(PYTHON, ['scripts/transcribe.py', talk, '--language', language, '--project', name]);
  if (!r.ok) problems.push(`Transcription failed: ${r.out.slice(-400)}`);
}
log('## Words');
if (existsSync(transcript)) {
  const said = JSON.parse(readFileSync(transcript, 'utf8'));
  const text = (said.words ?? said).map((w) => w.word ?? w.text).join(' ');
  if (script) {
    const r = run(PYTHON, ['scripts/align_script.py', scriptPath, transcript, join(code, 'words.json')]);
    const stats = r.out.split('\n').filter((l) => /script words|interpolated/.test(l));
    stats.forEach((l) => log(`- ${l.trim()}`));
    if (!r.ok) problems.push(`Script alignment failed: ${r.out.slice(-300)}`);
  } else {
    problems.push('No script in BRIEF.md or script.txt — captions would follow the raw transcription. Paste the script and re-run.');
  }
  log('');
  log(`Heard: "${text}"`);
} else {
  log('- no transcript');
}
log('');

/* ------------------------------------------------------------------ cuts + twin check */

log('## Jump cuts and green twin');
const cutsPath = join(code, 'cuts.json');
if (!existsSync(cutsPath)) run(PYTHON, ['scripts/find_cuts.py', talk, cutsPath]);
if (existsSync(cutsPath)) {
  const cuts = JSON.parse(readFileSync(cutsPath, 'utf8'));
  log(`- ${cuts.length} jump cut(s) at frames ${cuts.join(', ') || '—'} (${cuts.map((f) => `${(f / talkFps).toFixed(2)}s`).join(', ')}) — zoom through each (Stage cutZoom).`);
} else {
  problems.push('Jump-cut detection failed.');
}
if (talkTwin) {
  const r = run(PYTHON, ['scripts/check_pair.py', talk, talkTwin]);
  const result = r.out.split('\n').find((l) => l.startsWith('RESULT')) ?? 'no result';
  log(`- Green twin: ${result.trim()}`);
  if (!/offset of \+0/.test(result)) problems.push(`Green twin is not frame-aligned: ${result.trim()}`);
}
log('');

/* ------------------------------------------------------------------ b-roll */

log(`## B-roll (conformed: black bars cropped, ${talkFps}fps, muted)`);
if (!broll.length) log('- none');
for (const c of broll) {
  if (!c.info) continue;
  const slug = basename(c.file, extname(c.file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const out = join(processedDir, `broll-${slug}.mp4`);
  const detect = run(FFMPEG, ['-hide_banner', '-ss', '0.5', '-t', '8', '-i', c.path, '-vf', 'cropdetect=limit=24:round=2:reset=0', '-f', 'null', '-']);
  const crops = [...detect.out.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].map((m) => m.slice(1).map(Number));
  const [cw, ch, cx, cy] = crops.length ? crops[crops.length - 1] : [c.info.width, c.info.height, 0, 0];
  const letterboxed = ch < c.info.height * 0.85 || cw < c.info.width * 0.85;
  const vertical = cw / ch < 0.9;
  if (!existsSync(out)) {
    const scale = cw >= ch ? 'scale=min(1920\\,iw):-2' : 'scale=-2:min(1920\\,ih)';
    const vf = [letterboxed ? `crop=${cw}:${ch}:${cx}:${cy}` : null, c.info.hdr ? tonemap : null, scale, `fps=${talkFps}`, 'format=yuv420p'].filter(Boolean).join(',');
    const r = run(FFMPEG, ['-y', '-loglevel', 'error', '-i', c.path, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-movflags', '+faststart', out]);
    if (!r.ok) problems.push(`B-roll ${c.file} failed: ${r.out.slice(-200)}`);
  }
  log(`- ${c.file} → \`processed/${basename(out)}\` · picture ${cw}x${ch}${letterboxed ? ' (black bars removed)' : ''}${vertical ? ' · **genuinely vertical**' : ''}${c.info.width < 1280 && c.info.height < 1280 ? ' · low resolution — use small, not full screen' : ''}`);
}
log('');

/* ------------------------------------------------------------------ reference moments */

log('## Moments from references (contact sheets to describe back before building)');
const moments = section('Moments from references')
  .split('\n')
  .map((l) => l.match(/^-\s*(.+?\.(?:mp4|mov|webm|m4v))\s+(\d{1,2}:\d{2})(?:\s*[-–]\s*(\d{1,2}:\d{2}))?\s*[—–-]*\s*(.*)$/i))
  .filter(Boolean);
const secs = (t) => t.split(':').reduce((s, v) => s * 60 + Number(v), 0);
if (!moments.length) log('- none listed');
moments.forEach(([, file, from, to, note], i) => {
  const src = join('references', file.trim());
  if (!existsSync(src)) {
    problems.push(`Reference clip not found: references/${file.trim()}`);
    return;
  }
  const start = Math.max(0, secs(from) - 0.3);
  const len = Math.max(1, (to ? secs(to) : secs(from) + 1) - start + 0.3);
  const sheet = join(prepDir, `ref-${i + 1}.jpg`);
  run(FFMPEG, ['-y', '-loglevel', 'error', '-ss', String(start), '-t', String(len), '-i', src, '-vf', `fps=${Math.min(8, Math.max(3, Math.round(18 / len)))},scale=320:-2,tile=6x3`, '-frames:v', '1', sheet]);
  log(`- ${i + 1}. ${file.trim()} ${from}${to ? `–${to}` : ''} — ${note || '(no note)'} → \`${sheet.split('\\').join('/')}\``);
});
log('');

/* ------------------------------------------------------------------ brief summary */

log('## From the brief');
for (const title of ['The one thing viewers must remember', 'Must-have moments', 'Effects from the library', 'B-roll', 'Screenshots / things to blur', 'CTA / ending', 'Sound', "Don't want"]) {
  const body = section(title.replace(/[/()]/g, '.'));
  if (body) {
    log(`### ${title}`);
    log(body);
    log('');
  }
}

log('## Problems');
if (!problems.length) log('- none');
problems.forEach((p) => log(`- ${p}`));

writeFileSync(join(prepDir, 'PREP.md'), `${report.join('\n')}\n`);
console.log(`\nPrep written to ${join(prepDir, 'PREP.md')}${problems.length ? ` — ${problems.length} problem(s) listed at the end` : ''}.`);
process.exit(problems.length ? 1 : 0);
