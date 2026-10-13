#!/usr/bin/env node
/**
 * Sound design pass: turn a cut list into placed, timed, ducked SFX cues.
 *
 *   npm run sound -- --cuts <assembly.json|*.trim.json|cuts.json> [--beats <beats.json>]
 *                    [--words <words.json>] [--project <name>] [--fps 30] [--sfx <dir>]
 *
 * Writes work/<project>/sound/:
 *   SFX-CUES.txt      the numbered, timecoded cue sheet the user rebalances from
 *   sound-cues.json   the same thing for the composition
 *   mix.txt           a ready ffmpeg filter_complex: SFX bus, ducked off the voice,
 *                     high-passed, then the final loudness stage
 *
 * The rules come straight from the audio standard in CLAUDE.md, and they are applied,
 * not suggested: nothing over 0.8s sits under a word unless it is 24 dB down, risers go
 * in pauses, whooshes lead the picture by TRANSITION.sfxLeadMs, everything is
 * high-passed off the voice. Claude cannot hear — this engineers the mix so the user
 * only has to judge taste, not fix collisions.
 */
import {existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';
import {fmt, timecode} from './lib/media.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};

const cutsPath = flag('cuts', null);
const beatsPath = flag('beats', null);
const wordsPath = flag('words', null);
const project = flag('project', null);
const fps = Number(flag('fps', 30));
const sfxDir = flag('sfx', null);

if (!cutsPath || !existsSync(cutsPath)) {
  console.error('Usage: npm run sound -- --cuts <assembly.json|*.trim.json|cuts.json> [--beats <beats.json>] [--words <words.json>] [--sfx <dir>]');
  process.exit(2);
}

/** From src/design/motion.ts — kept in step by hand; these two are the whole contract. */
const SFX_LEAD = 0.133;
const SFX_TAIL = 0.267;

/* ---------------------------------------------------------------- read the cut list */

const raw = JSON.parse(readFileSync(cutsPath, 'utf8'));
let cuts = [];
let phases = [];
let source = cutsPath;

if (Array.isArray(raw) && raw.every((n) => typeof n === 'number')) {
  // scripts/find_cuts.py output: bare frame numbers.
  cuts = raw.map((f) => ({at: f / fps, kind: 'jump', phase: 'talk'}));
} else if (raw.shots) {
  // assembly.json
  phases = raw.phases || [];
  cuts = raw.shots
    .filter((s) => s.transitionIn && s.transitionIn !== 'none')
    .map((s) => ({at: s.startSeconds, kind: s.transitionIn, phase: s.phase, beats: s.beats}));
  source = raw.music || cutsPath;
} else if (raw.punchIns) {
  // trim.json
  cuts = raw.punchIns.map((p) => ({at: p.atSeconds, kind: 'punchIn', phase: 'talk'}));
  source = raw.source || cutsPath;
} else {
  console.error('Unrecognised cut list. Expected assembly.json, a .trim.json, or cuts.json.');
  process.exit(1);
}

if (!cuts.length) {
  console.error('That cut list has no cuts in it.');
  process.exit(1);
}

/* ---------------------------------------------------------------- speech windows */

let speech = [];
if (wordsPath && existsSync(wordsPath)) {
  try {
    const w = JSON.parse(readFileSync(wordsPath, 'utf8'));
    speech = (Array.isArray(w) ? w : w.words || [])
      .filter((x) => Number.isFinite(x.start) && Number.isFinite(x.end))
      .map((x) => ({start: Number(x.start), end: Number(x.end)}));
  } catch {
    console.error(`Could not read ${wordsPath} — placing cues without voice awareness.`);
  }
} else if (raw.keep) {
  // A trim list already tells us exactly where the voice is.
  speech = raw.keep.map((k) => ({start: k.atSeconds, end: k.atSeconds + k.seconds}));
}

const underVoice = (from, to) => speech.some((s) => from < s.end && to > s.start);
/** Nearest gap in the voice, within reach, so a riser can move instead of being dropped. */
const nearestGap = (t, need) => {
  for (let shift = 0; shift <= 0.25; shift += 0.02) {
    for (const cand of [t - shift, t + shift]) {
      if (cand >= 0 && !underVoice(cand, cand + need)) return Number(cand.toFixed(3));
    }
  }
  return null;
};

/* ---------------------------------------------------------------- beats, drop, bars */

let beats = null;
let dropAt = null;
let barSeconds = null;
if (beatsPath && existsSync(beatsPath)) {
  beats = JSON.parse(readFileSync(beatsPath, 'utf8'));
  const db = beats.downbeatSeconds || [];
  if (db.length > 1) barSeconds = db[1] - db[0];
}
const dropPhase = phases.find((p) => p.name === 'drop');
if (dropPhase) dropAt = dropPhase.fromSeconds;

/* ---------------------------------------------------------------- the cue rules */

/**
 * Each cue type carries its own shape. Durations are the top of the range in the audio
 * standard; gains are relative to the music bus, before ducking.
 */
const TYPES = {
  whoosh: {durationMs: 600, gainDb: -8, highpassHz: 140, fadeOutMs: 90, note: 'movement — leads the picture'},
  impact: {durationMs: 450, gainDb: -6, highpassHz: 120, fadeOutMs: 70, note: 'lands on the cut'},
  riser: {durationMs: 2000, gainDb: -10, highpassHz: 180, fadeOutMs: 120, note: 'tension into a change — pauses only'},
  sub: {durationMs: 800, gainDb: -7, highpassHz: 30, fadeOutMs: 120, note: 'weight under the drop'},
  tick: {durationMs: 120, gainDb: -18, highpassHz: 400, fadeOutMs: 40, note: 'text arriving'},
};

const cues = [];
const moved = [];
const dropped = [];
let dropCuts = 0;

const add = (type, at, reason, extra = {}) => {
  const spec = TYPES[type];
  const need = spec.durationMs / 1000;
  let start = Number(at.toFixed(3));
  let gainDb = spec.gainDb;
  let durationMs = spec.durationMs;
  let placement = 'clear';

  if (speech.length && underVoice(start, start + need)) {
    if (type === 'riser' || type === 'sub') {
      // Long, tonal, and unmissable under a word — the exact mistake that broke an early video.
      const gap = nearestGap(start, need);
      if (gap === null) {
        dropped.push({type, at: start, reason: 'no gap in the voice long enough — add it by hand or shorten the VO'});
        return;
      }
      moved.push({type, from: start, to: gap});
      start = gap;
    } else {
      // Short cues may stay, but only well under the voice, and trimmed to the motion.
      durationMs = Math.min(durationMs, 800);
      gainDb = Math.min(gainDb, -24);
      placement = 'under voice — trimmed and 24 dB down';
    }
  }

  cues.push({
    n: cues.length + 1,
    type,
    atSeconds: start,
    atFrame: Math.round(start * fps),
    timecode: timecode(start),
    durationMs,
    gainDb,
    highpassHz: spec.highpassHz,
    fadeOutMs: spec.fadeOutMs,
    placement,
    reason,
    ...extra,
  });
};

/** Whooshes lead the picture; impacts land on it. Which one depends on what the cut is. */
for (const cut of cuts) {
  if (cut.kind === 'whipPan' || cut.kind === 'push' || cut.kind === 'punchIn') {
    add('whoosh', Math.max(0, cut.at - SFX_LEAD), `${cut.kind} at ${timecode(cut.at)}`);
  } else if (cut.kind === 'colourFlip' || cut.kind === 'dip') {
    add('impact', cut.at, `${cut.kind} at ${timecode(cut.at)}`);
  } else if (cut.kind === 'jump') {
    add('whoosh', Math.max(0, cut.at - SFX_LEAD), `jump cut at ${timecode(cut.at)} — the zoom needs a sound`);
  } else if (cut.phase === 'drop') {
    // A sound on every cut through the drop is noise, and silence through it is worse.
    // Accent every third, so the section has a pulse without turning into a drum fill.
    if (dropCuts++ % 3 === 0) add('impact', cut.at, 'accent on the drop');
  }
}

/** The riser goes two bars before the drop, the sub lands on it. */
if (dropAt !== null) {
  const lead = barSeconds ? barSeconds * 2 : 2;
  add('riser', Math.max(0, dropAt - lead), 'two bars into the drop');
  add('sub', dropAt, 'the drop itself');
}

/** Text arriving gets a tick, but only where nothing else is already happening. */
if (speech.length && raw.shots) {
  for (const s of speech.slice(0, 40)) {
    const clash = cues.some((c) => Math.abs(c.atSeconds - s.start) < 0.25);
    if (!clash) add('tick', s.start, 'text lands on this word');
  }
}

cues.sort((a, b) => a.atSeconds - b.atSeconds);
cues.forEach((c, i) => {
  c.n = i + 1;
});

/* ---------------------------------------------------------------- match real files */

let library = {};
if (sfxDir && existsSync(sfxDir)) {
  // Real SFX libraries are folders of folders ("Whooshs", "Risers", "Impacts"), so walk
  // the whole tree and match on the full relative path — the folder name is usually the
  // only thing that says what a file is.
  const walk = (dir) =>
    readdirSync(dir, {withFileTypes: true}).flatMap((e) => {
      const p = join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      return /\.(wav|mp3|aif|aiff|flac|m4a)$/i.test(e.name) ? [p] : [];
    });
  const files = walk(sfxDir);
  const pick = (re) => files.filter((f) => re.test(f));
  library = {
    whoosh: pick(/whoosh|swoosh|swish|transition/i),
    impact: pick(/impact|hit|boom|thud|punch/i),
    riser: pick(/riser|rise|build|uplift/i),
    sub: pick(/sub|drop|bass|808/i),
    tick: pick(/tick|click|pop|blip|ui/i),
  };
  for (const c of cues) {
    const pool = library[c.type] || [];
    if (pool.length) c.file = pool[(c.n - 1) % pool.length];
  }
}

/* ---------------------------------------------------------------- the mix */

const placed = cues.filter((c) => c.file);
const mixLines = [];
mixLines.push('# SFX bus — one input per cue, trimmed, high-passed, faded, delayed into place.');
mixLines.push('# Inputs: 0 = voice/picture audio, 1 = music, 2.. = the SFX files below, in cue order.');
mixLines.push('');
if (placed.length) {
  const parts = placed.map((c, i) => {
    const idx = i + 2;
    const delayMs = Math.round(c.atSeconds * 1000);
    return `[${idx}:a]atrim=0:${fmt(c.durationMs / 1000, 3)},highpass=f=${c.highpassHz},afade=t=out:st=${fmt((c.durationMs - c.fadeOutMs) / 1000, 3)}:d=${fmt(c.fadeOutMs / 1000, 3)},volume=${c.gainDb}dB,adelay=${delayMs}|${delayMs}[s${i}]`;
  });
  mixLines.push(`${parts.join(';\n')};`);
  mixLines.push('');
  mixLines.push(`${placed.map((_, i) => `[s${i}]`).join('')}amix=inputs=${placed.length}:normalize=0[sfxraw];`);
  mixLines.push('[sfxraw]alimiter=limit=0.9[sfx];');
  mixLines.push('# Duck the SFX bus off the voice, then sit it under the music.');
  mixLines.push('[sfx][0:a]sidechaincompress=threshold=0.04:ratio=6:attack=8:release=260[sfxducked];');
  mixLines.push('[1:a][sfxducked]amix=inputs=2:normalize=0[bed];');
  mixLines.push('[0:a][bed]amix=inputs=2:normalize=0[mixout]');
  mixLines.push('');
  mixLines.push('# Final stage — one encode, per the audio standard:');
  mixLines.push('#   -map "[mixout]" -af "loudnorm=I=-14:TP=-1:LRA=11:print_format=summary" -c:a aac -b:a 256k');
  mixLines.push('# Stems: render voice.wav (untouched), sfx.wav ([sfx] before ducking), music.wav separately.');
} else {
  mixLines.push('# No --sfx directory given, so no files are wired up yet.');
  mixLines.push('# Point --sfx at a folder with whoosh*/impact*/riser*/sub*/tick* files and run again.');
}

/* ---------------------------------------------------------------- write */

const dir = join('work', project || basename(cutsPath).replace(/\..*$/, ''), 'sound');
mkdirSync(dir, {recursive: true});

const json = {
  source,
  cutList: cutsPath,
  fps,
  sfxLeadSeconds: SFX_LEAD,
  sfxTailSeconds: SFX_TAIL,
  voiceAware: speech.length > 0,
  cues,
  moved,
  dropped,
};
writeFileSync(join(dir, 'sound-cues.json'), JSON.stringify(json, null, 2));
writeFileSync(join(dir, 'mix.txt'), `${mixLines.join('\n')}\n`);

const sheet = `SFX CUES — ${basename(String(source))}
${'='.repeat(60)}
Cut list   ${cutsPath}
Voice      ${speech.length ? `${speech.length} spoken windows — cues are placed around them` : 'not supplied — cues are NOT voice-aware, check every one under speech'}
Lead       whooshes start ${Math.round(SFX_LEAD * 1000)}ms before the picture changes

 #   TIME     FRAME  TYPE    LEN    GAIN   HPF     WHY
${cues
  .map(
    (c) =>
      `${String(c.n).padStart(2, '0')}   ${c.timecode}    ${String(c.atFrame).padStart(5)}  ${c.type.padEnd(7)} ${String(c.durationMs).padStart(4)}ms ${String(c.gainDb).padStart(4)}dB ${String(c.highpassHz).padStart(4)}Hz  ${c.reason}${c.placement !== 'clear' ? ` [${c.placement}]` : ''}${c.file ? `\n                                                  file: ${basename(c.file)}` : ''}`,
  )
  .join('\n')}

${moved.length ? `MOVED (would have played under a word)\n${moved.map((m) => `- ${m.type}: ${timecode(m.from)} → ${timecode(m.to)}`).join('\n')}\n` : ''}${dropped.length ? `DROPPED (nowhere clear to put them)\n${dropped.map((d) => `- ${d.type} at ${timecode(d.at)} — ${d.reason}`).join('\n')}\n` : ''}
HOW THIS WAS BUILT
- Whooshes lead the picture, impacts land on it, risers only go in pauses.
- Nothing longer than 0.8s sits under a word unless it is at least 24 dB down.
- Everything is high-passed off the voice (120-180Hz), except the sub.
- The SFX bus is ducked off the voice with sidechaincompress — see mix.txt.

BEFORE DELIVERY
- Measure: voice-vs-mix per 0.5s window; fix any window where SFX is within 12 dB of the voice.
- Final: -14 LUFS integrated, true peak <= -1 dBTP, one AAC encode at 256k.
- Ship voice.wav + sfx.wav + this sheet alongside the MP4.

Claude cannot hear any of this. Listen once and send timecoded notes.
`;
writeFileSync(join(dir, 'SFX-CUES.txt'), sheet);

const byType = Object.keys(TYPES)
  .map((t) => `${cues.filter((c) => c.type === t).length} ${t}`)
  .filter((s) => !s.startsWith('0 '))
  .join(', ');

console.log(`Cues       ${cues.length} (${byType})`);
console.log(`Voice      ${speech.length ? `${speech.length} spoken windows — cues placed around them` : 'not supplied — cues are not voice-aware'}`);
if (moved.length) console.log(`Moved      ${moved.length} cue(s) out from under the voice`);
if (dropped.length) console.log(`Dropped    ${dropped.length} cue(s) with nowhere clear to sit`);
console.log(`Files      ${placed.length ? `${placed.length} matched from ${sfxDir}` : 'none matched — pass --sfx <dir> to wire real files'}`);
console.log(`Written    ${join(dir, 'SFX-CUES.txt')}`);
console.log('\nThe mix is engineered, not guessed — but only you can hear it. Listen once, send timecodes.');
