#!/usr/bin/env node
/**
 * Silence + filler trim, with automatic punch-ins.
 *
 *   npm run trim -- <video> [--project <name>] [--words work/<n>/<stem>/words.json]
 *                  [--min-silence 0.35] [--pad 0.08] [--floor <dBFS>] [--fps 30]
 *                  [--write <out.mp4>]
 *
 * Talking-head footage is mostly waiting: breaths, resets, the half second before a
 * sentence starts. This finds those gaps, removes them, and — because every removal
 * leaves a jump cut — assigns each surviving segment a different framing so the cut
 * reads as a deliberate punch-in instead of a splice.
 *
 * Writes work/<project>/<stem>.trim.json + .md:
 *   keep[]      the segments that survive, each with its framing (Stage scale + shift)
 *   removed[]   what went, and why (silence / filler)
 *   punchIns[]  the frame of every join and the framing change across it
 *   ffmpeg      select/aselect expressions, if you want to cut the file directly
 *
 * The voice is never processed here — segments are copied, not filtered. With --write
 * the file is encoded once (law: at most one encode), and the cut list is what the
 * composition should consume so the final render encodes the voice only that once.
 *
 * Detection is energy-based: an adaptive floor from the recording itself, hysteresis so
 * a comma is not a cut, then padding so words keep their attack and tail. No model.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, extname, join} from 'node:path';
import {FFMPEG, decodePcm, energyEnvelope, fmt, probe, run, timecode} from './lib/media.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

if (!file || !existsSync(file)) {
  console.error('Usage: npm run trim -- <video> [--project <name>] [--words <words.json>] [--min-silence 0.35] [--pad 0.08] [--write out.mp4]');
  process.exit(2);
}

const RATE = 22050;
const project = flag('project', null);
const fps = Number(flag('fps', 30));
const minSilence = Number(flag('min-silence', 0.35));
const pad = Number(flag('pad', 0.08));
const floorOverride = has('floor') ? Number(flag('floor', -38)) : null;
const wordsPath = flag('words', null);
const writePath = flag('write', null);

const info = probe(file);
const samples = decodePcm(file, RATE);
if (!samples || samples.length < RATE) {
  console.error('No usable audio in that file.');
  process.exit(1);
}
const duration = info?.duration || samples.length / RATE;

/* ---------------------------------------------------------------- level over time */

const {env, hopSeconds} = energyEnvelope(samples, RATE, 256);
const db = new Float64Array(env.length);
for (let i = 0; i < env.length; i++) db[i] = 20 * Math.log10(env[i] + 1e-9);

const percentile = (arr, p) => {
  const s = Array.from(arr).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};

const noiseFloorDb = percentile(db, 10);
const speechPeakDb = percentile(db, 95);
/**
 * Sit the gate between the room and the voice: well above the floor, well under the
 * peaks. Whichever of those two is stricter wins, so a noisy room does not open the
 * gate and a quiet, close-mic'd take does not clip its own word endings.
 */
const thresholdDb =
  floorOverride ?? Math.min(Math.max(noiseFloorDb + 9, speechPeakDb - 28), speechPeakDb - 14);

/* ---------------------------------------------------------------- speech regions */

const loud = new Uint8Array(db.length);
for (let i = 0; i < db.length; i++) loud[i] = db[i] > thresholdDb ? 1 : 0;

const toRegions = (mask, want) => {
  const out = [];
  let start = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === want && start < 0) start = i;
    if ((mask[i] !== want || i === mask.length - 1) && start >= 0) {
      out.push({from: start, to: i});
      start = -1;
    }
  }
  return out;
};

// Close short gaps first: a gap between two words is not a cut, only a gap between thoughts is.
const gapFrames = Math.round(minSilence / hopSeconds);
for (const gap of toRegions(loud, 0)) {
  if (gap.to - gap.from < gapFrames && gap.from > 0 && gap.to < loud.length - 1) {
    for (let i = gap.from; i <= gap.to; i++) loud[i] = 1;
  }
}
// Then drop specks of "speech" too short to be a word — a chair creak, a mouth click.
const minSpeechFrames = Math.round(0.12 / hopSeconds);
for (const seg of toRegions(loud, 1)) {
  if (seg.to - seg.from < minSpeechFrames) for (let i = seg.from; i <= seg.to; i++) loud[i] = 0;
}

let keep = toRegions(loud, 1).map((r) => ({
  start: Math.max(0, r.from * hopSeconds - pad),
  end: Math.min(duration, r.to * hopSeconds + pad),
}));

/* ---------------------------------------------------------------- filler words */

const FILLERS = new Set(['um', 'umm', 'uhm', 'uh', 'uhh', 'er', 'erm', 'ah', 'ahh', 'hmm', 'mmm', 'eh', 'mm']);
const removedFillers = [];

if (wordsPath && existsSync(wordsPath)) {
  let words = [];
  try {
    const raw = JSON.parse(readFileSync(wordsPath, 'utf8'));
    words = (Array.isArray(raw) ? raw : raw.words || []).map((w) => ({
      text: String(w.text ?? w.word ?? ''),
      start: Number(w.start),
      end: Number(w.end),
    }));
  } catch {
    console.error(`Could not read ${wordsPath} — skipping filler removal.`);
  }
  const hits = words.filter(
    (w) => Number.isFinite(w.start) && Number.isFinite(w.end) && FILLERS.has(w.text.toLowerCase().replace(/[^a-z]/g, '')),
  );
  for (const w of hits) {
    const from = w.start - 0.02;
    const to = w.end + 0.02;
    const next = [];
    for (const seg of keep) {
      if (to <= seg.start || from >= seg.end) {
        next.push(seg);
        continue;
      }
      if (from > seg.start) next.push({start: seg.start, end: from});
      if (to < seg.end) next.push({start: to, end: seg.end});
    }
    keep = next;
    removedFillers.push({start: Number(from.toFixed(3)), end: Number(to.toFixed(3)), word: w.text});
  }
}

// Padding and filler splits can leave overlaps or slivers. Merge, then drop anything too short to read.
keep.sort((a, b) => a.start - b.start);
const merged = [];
for (const seg of keep) {
  const last = merged[merged.length - 1];
  if (last && seg.start <= last.end + 0.001) last.end = Math.max(last.end, seg.end);
  else merged.push({...seg});
}
keep = merged.filter((s) => s.end - s.start >= 0.15);

if (!keep.length) {
  console.error('Everything was gated out. The recording is quieter than expected — pass --floor <dBFS> to set the gate by hand.');
  process.exit(1);
}

/* ---------------------------------------------------------------- punch-ins */

/**
 * Every removal leaves a jump cut, so every cut gets a new framing. The pattern never
 * repeats a framing across a join and never sits on one size for long. Scale stays at
 * or above 1 — a punch-in pushes in, it never pulls back past the frame edge.
 */
const FRAMING = {
  wide: {scale: 1.0, shiftYPct: 0},
  mid: {scale: 1.09, shiftYPct: -1.5},
  close: {scale: 1.2, shiftYPct: -3.2},
};
const PATTERN = ['wide', 'close', 'mid', 'close', 'wide', 'mid'];

const segments = keep.map((seg, i) => {
  const name = PATTERN[i % PATTERN.length];
  return {
    index: i,
    start: Number(seg.start.toFixed(3)),
    end: Number(seg.end.toFixed(3)),
    seconds: Number((seg.end - seg.start).toFixed(3)),
    framing: name,
    ...FRAMING[name],
  };
});

// Timeline positions after the gaps close.
let cursor = 0;
for (const s of segments) {
  s.atSeconds = Number(cursor.toFixed(3));
  s.atFrame = Math.round(cursor * fps);
  s.durationFrames = Math.round(s.seconds * fps);
  cursor += s.seconds;
}
const newDuration = cursor;

const punchIns = segments.slice(1).map((s, i) => ({
  atSeconds: s.atSeconds,
  atFrame: s.atFrame,
  from: segments[i].framing,
  to: s.framing,
  scale: s.scale,
  shiftYPct: s.shiftYPct,
}));

/* ---------------------------------------------------------------- what went */

const removed = [];
let prevEnd = 0;
for (const s of keep) {
  if (s.start - prevEnd > 0.001) {
    removed.push({start: Number(prevEnd.toFixed(3)), end: Number(s.start.toFixed(3)), seconds: Number((s.start - prevEnd).toFixed(3)), kind: 'silence'});
  }
  prevEnd = s.end;
}
if (duration - prevEnd > 0.001) {
  removed.push({start: Number(prevEnd.toFixed(3)), end: Number(duration.toFixed(3)), seconds: Number((duration - prevEnd).toFixed(3)), kind: 'tail'});
}
for (const f of removedFillers) {
  const hit = removed.find((r) => Math.abs(r.start - f.start) < 0.05);
  if (hit) hit.kind = `filler "${f.word.trim()}"`;
}

const saved = duration - newDuration;

/* ---------------------------------------------------------------- what other gates would find */

/**
 * The gate is the one judgement call in here, and it is invisible unless we show it. A
 * take that comes back barely trimmed is usually just tightly delivered — but it can also
 * mean the gate sat under the breaths. This says which, without anyone having to guess.
 *
 * Raising it finds more pauses and eventually starts eating quiet word endings, so the
 * default stays conservative: damaging the voice is a worse failure than leaving a pause.
 */
const gateTable = [-50, -45, -40, -37, -34, -31, -28]
  .concat(Math.round(thresholdDb * 10) / 10)
  .sort((a, b) => a - b)
  .filter((v, i, arr) => arr.indexOf(v) === i)
  .map((th) => {
    let gaps = 0;
    let total = 0;
    let run = 0;
    for (let i = 0; i < db.length; i++) {
      if (db[i] <= th) run++;
      else {
        if (run * hopSeconds >= minSilence) {
          gaps++;
          total += run * hopSeconds;
        }
        run = 0;
      }
    }
    if (run * hopSeconds >= minSilence) {
      gaps++;
      total += run * hopSeconds;
    }
    return {th, gaps, total};
  });

/* ---------------------------------------------------------------- ffmpeg */

const between = keep.map((s) => `between(t,${fmt(s.start, 3)},${fmt(s.end, 3)})`).join('+');
const vf = `select='${between}',setpts=N/FRAME_RATE/TB`;
const af = `aselect='${between}',asetpts=N/SR/TB`;

/* ---------------------------------------------------------------- write */

const stem = basename(file, extname(file));
const dir = project ? join('work', project) : join('work', 'trim');
mkdirSync(dir, {recursive: true});

const out = {
  source: file,
  fps,
  durationSeconds: Number(duration.toFixed(3)),
  newDurationSeconds: Number(newDuration.toFixed(3)),
  savedSeconds: Number(saved.toFixed(3)),
  gate: {
    thresholdDb: Number(thresholdDb.toFixed(1)),
    noiseFloorDb: Number(noiseFloorDb.toFixed(1)),
    speechPeakDb: Number(speechPeakDb.toFixed(1)),
    minSilence,
    pad,
  },
  keep: segments,
  removed,
  punchIns,
  ffmpeg: {vf, af},
};

const jsonPath = join(dir, `${stem}.trim.json`);
writeFileSync(jsonPath, JSON.stringify(out, null, 2));

const md = `# Trim — ${stem}

- **Was** ${fmt(duration, 2)}s → **now** ${fmt(newDuration, 2)}s (**${fmt(saved, 2)}s removed**, ${fmt((saved / duration) * 100, 0)}%)
- **Segments kept:** ${segments.length} · **cuts created:** ${punchIns.length}
- **Gate:** ${fmt(thresholdDb, 1)} dBFS (room floor ${fmt(noiseFloorDb, 1)}, voice peaks ${fmt(speechPeakDb, 1)})
- **Filler words removed:** ${removedFillers.length || '—'}${removedFillers.length ? ` (${removedFillers.map((f) => f.word.trim()).join(', ')})` : ''}

## Cut list

| # | source in → out | length | on timeline | framing |
|---|---|---|---|---|
${segments.map((s) => `| ${String(s.index + 1).padStart(2, '0')} | ${timecode(s.start)} → ${timecode(s.end)} | ${fmt(s.seconds, 2)}s | ${timecode(s.atSeconds)} (f${s.atFrame}) | ${s.framing} ×${fmt(s.scale, 2)} |`).join('\n')}

## Punch-ins

Every join below is a jump cut. The framing changes across it, so it reads as a push-in.
Zoom through each one (Stage \`cutZoom\`) — never leave a bare splice.

${punchIns.length ? punchIns.map((p) => `- frame ${p.atFrame} (${timecode(p.atSeconds)}): ${p.from} → **${p.to}** (×${fmt(p.scale, 2)}, shift ${fmt(p.shiftYPct, 1)}%)`).join('\n') : '- none — the take had no gaps worth cutting.'}

## Removed

${removed.map((r) => `- ${timecode(r.start)} → ${timecode(r.end)} (${fmt(r.seconds, 2)}s) — ${r.kind}`).join('\n')}

## The gate

Used **${fmt(thresholdDb, 1)} dBFS**${floorOverride === null ? ' (chosen from this recording)' : ' (set by hand with --floor)'}.
If the trim looks too light, the take is probably just tightly delivered — this says so either way.
Raising the gate finds more pauses and eventually starts eating quiet word endings, so it is
deliberately conservative. Override with \`--floor <dBFS>\`.

| gate | pauses ≥ ${minSilence}s | total |
|---|---|---|
${gateTable.map((g) => `| ${fmt(g.th, 1)} dBFS${Math.abs(g.th - thresholdDb) < 0.05 ? ' ← used' : ''} | ${g.gaps} | ${fmt(g.total, 1)}s |`).join('\n')}

## Using it

The cut list is the deliverable: feed \`keep[]\` to the composition so the voice is encoded
once, at final render. To cut the file directly for a preview:

\`\`\`
ffmpeg -i "${file}" -vf "${vf}" -af "${af}" -c:v libx264 -crf 18 -c:a aac -b:a 256k out.mp4
\`\`\`
`;
writeFileSync(join(dir, `${stem}.trim.md`), md);

if (writePath) {
  console.log('Encoding trimmed file (one encode, voice not otherwise processed)...');
  const r = run(FFMPEG, ['-y', '-v', 'error', '-i', file, '-vf', vf, '-af', af, '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '256k', writePath]);
  if (!r.ok) {
    console.error(r.err.trim() || 'ffmpeg failed');
    process.exit(1);
  }
  console.log(`Written    ${writePath}`);
}

console.log(`Was        ${fmt(duration, 2)}s`);
console.log(`Now        ${fmt(newDuration, 2)}s  (${fmt(saved, 2)}s removed, ${fmt((saved / duration) * 100, 0)}%)`);
console.log(`Segments   ${segments.length} kept, ${punchIns.length} punch-in(s)`);
console.log(`Gate       ${fmt(thresholdDb, 1)} dBFS (floor ${fmt(noiseFloorDb, 1)}, peaks ${fmt(speechPeakDb, 1)})`);
if (saved / duration < 0.05) {
  const louder = gateTable.filter((g) => g.th > thresholdDb && g.gaps > removed.length);
  console.log(
    louder.length
      ? `           Barely trimmed — either the take is tight, or the gate sat under the breaths.\n           A gate of ${fmt(louder[0].th, 0)} dBFS would find ${louder[0].gaps} pauses (${fmt(louder[0].total, 1)}s): --floor ${fmt(louder[0].th, 0)}`
      : '           Barely trimmed, and no higher gate finds more — this take is genuinely tight.',
  );
}
if (removedFillers.length) console.log(`Fillers    ${removedFillers.map((f) => f.word.trim()).join(', ')}`);
console.log(`Written    ${jsonPath}`);
console.log('\nEvery join is a jump cut — zoom through each one. The punch-in list says which way.');
