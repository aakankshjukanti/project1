#!/usr/bin/env node
/**
 * Find speech the transcriber did not transcribe.
 *
 *   node scripts/coverage.mjs <media> <words.json> [--gap 0.35] [--floor -38]
 *
 * WHY THIS EXISTS. Whisper suppresses repeated phrases. When a speaker says the same line twice,
 * it transcribes it once and silently leaves a hole where the duplicate was — so a transcript can
 * read perfectly clean while the audio plainly repeats. On demo-test that cost four rounds: the
 * owner said three times that "adds a few zooms" repeated, the transcript said it did not, and the
 * hole got mistaken for a pause and trimmed.
 *
 * A transcript is not evidence on its own. This checks it against the audio: any stretch that is
 * loud enough to be speech but carries no word is either a dropped duplicate or a dropped line,
 * and both are faults. Run it after every transcription, before planning anything.
 */
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {FFMPEG} from './lib/media.mjs';

const [, , media, wordsFile, ...rest] = process.argv;
if (!media || !wordsFile) {
  console.error('Usage: node scripts/coverage.mjs <media> <words.json> [--gap 0.35] [--floor -38]');
  process.exit(2);
}
const opt = (n, d) => {
  const i = rest.indexOf(`--${n}`);
  return i >= 0 ? Number(rest[i + 1]) : d;
};
/** Shortest unlabelled speech run worth reporting, in seconds. */
const MIN_GAP = opt('gap', 0.35);
/** Above this RMS it is speech, below it is room tone. */
const FLOOR_DB = opt('floor', -38);

const SR = 16000;
const WIN = Math.round(SR * 0.05);

const pcm = spawnSync(FFMPEG, ['-v', 'error', '-i', media, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'], {
  encoding: 'buffer',
  maxBuffer: 1 << 28,
});
if (pcm.status !== 0) {
  console.error(pcm.stderr?.toString().slice(0, 600));
  process.exit(1);
}
const buf = pcm.stdout;
const samples = buf.length / 2;

const loud = (t) => {
  const a = Math.round(t * SR);
  let s = 0;
  let c = 0;
  for (let i = a; i < a + WIN && i < samples; i++) {
    const v = buf.readInt16LE(i * 2);
    s += v * v;
    c++;
  }
  const r = Math.sqrt(s / Math.max(1, c));
  return r > 0 ? 20 * Math.log10(r / 32768) : -99;
};

const data = JSON.parse(readFileSync(wordsFile, 'utf8'));
const words = data.words ?? data;
const fps = data.fps ?? 30;
/** Words may carry frames (f/t) or seconds (start/end). */
const spans = words.map((w) => ({
  from: w.start ?? w.f / fps,
  to: w.end ?? (w.t ?? w.f) / fps,
}));

const covered = (t) => spans.some((s) => t >= s.from - 0.06 && t <= s.to + 0.06);

const duration = samples / SR;
const holes = [];
let run = null;
for (let t = 0; t < duration; t += 0.05) {
  const speech = loud(t) > FLOOR_DB;
  if (speech && !covered(t)) {
    if (!run) run = {from: t, to: t};
    else run.to = t;
  } else if (run) {
    if (run.to - run.from >= MIN_GAP) holes.push(run);
    run = null;
  }
}
if (run && run.to - run.from >= MIN_GAP) holes.push(run);

/**
 * The detector that actually works.
 *
 * A collapsed duplicate does not leave an untranscribed hole — Whisper stretches the LAST word it
 * did recognise across the speech it dropped. On demo-test the word "adds" came back 0.68s long
 * with the lowest confidence in the sentence, covering a whole repeated phrase, so a coverage test
 * based on spans called the file clean. Word duration is what gives it away.
 */
const lengths = words.map((w, i) => ({w, i, dur: spans[i].to - spans[i].from})).filter((x) => x.dur > 0);
const sortedDur = lengths.map((x) => x.dur).sort((a, b) => a - b);
const median = sortedDur[Math.floor(sortedDur.length / 2)] || 0.2;
const stretched = lengths.filter((x) => x.dur > median * 3);
if (stretched.length) {
  console.log(
    `${stretched.length} word(s) far longer than the ${median.toFixed(2)}s median — ` +
      `each may be covering speech the transcriber dropped:\n`,
  );
  for (const x of stretched) {
    const label = x.w.w ?? x.w.word;
    console.log(
      `  "${label}" ${spans[x.i].from.toFixed(2)}s - ${spans[x.i].to.toFixed(2)}s = ` +
        `${x.dur.toFixed(2)}s (${(x.dur / median).toFixed(1)}x median)`,
    );
  }
  console.log('\nCheck the energy across each one. A single decaying word is fine; a dip to');
  console.log('silence followed by a second loud onset is a repeat the transcript is hiding.');
}

if (!holes.length && !stretched.length) {
  console.log(`clean — every stretch above ${FLOOR_DB}dB has a word on it (${words.length} words, ${duration.toFixed(2)}s)`);
  process.exit(0);
}

if (!holes.length) process.exit(1);

console.log(`${holes.length} stretch(es) of SPEECH WITH NO WORDS — the transcript is missing something:\n`);
for (const h of holes) {
  const before = spans.filter((s) => s.to <= h.from).pop();
  const after = spans.find((s) => s.from >= h.to);
  const bw = before ? words[spans.indexOf(before)] : null;
  const aw = after ? words[spans.indexOf(after)] : null;
  console.log(
    `  ${h.from.toFixed(2)}s - ${h.to.toFixed(2)}s  (${(h.to - h.from).toFixed(2)}s)` +
      `  between "${bw ? bw.w ?? bw.word : 'start'}" and "${aw ? aw.w ?? aw.word : 'end'}"`,
  );
}
console.log('\nMost likely a repeated phrase the transcriber collapsed. Listen to it before cutting it.');
process.exit(1);
