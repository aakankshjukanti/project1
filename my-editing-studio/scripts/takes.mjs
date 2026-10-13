#!/usr/bin/env node
/**
 * Best-take selection: one messy take in, one clean cut plan out.
 *
 *   npm run takes -- <words.json> [--media <video>] [--script <script.md>]
 *                    [--project <name>] [--out <file>] [--fps 30]
 *                    [--similar 0.72] [--window 90] [--gap-max 0.6] [--gap-keep 0.25]
 *
 * WHAT IT IS FOR. A talking head is full of second attempts. Somebody fumbles, stops, says the
 * sentence again, and both versions end up in the cut — so a human watches the whole thing to
 * find them. This finds them instead, keeps the better one, and proves afterwards that none are
 * left.
 *
 * THE SPEECH IS THE TRUTH, NOT THE SCRIPT. An earlier version of this file anchored to the
 * written script: every script sentence got one span and anything unmatched was dropped. It
 * threw away six passages of real material on the first take it was pointed at — lines the
 * speaker improvised on the day and meant to keep, including "you don't have to put the brief
 * into the brief file". A repeat that survives is visible and fixable; a good line silently
 * deleted is neither. So the default here is inverted:
 *
 *     KEEP EVERYTHING, UNLESS IT IS A SECOND ATTEMPT AT SOMETHING ELSE THAT IS KEPT.
 *
 * Nothing has to justify its existence. A script, if there is one, is only a checker: it reports
 * lines that never got said and breaks ties between close takes. It can never remove anything,
 * and most people filming to camera do not have one.
 *
 * WHAT IT WRITES  work/<project>/<stem>.takes.json
 *   keep[]      {from, to, units}  source seconds to use, in order
 *   groups[]    every retake cluster, which attempt won and why the others lost
 *   dropped[]   what went, with the reason
 *   checks{}    verification, all of which must pass
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {decodePcm} from './lib/media.mjs';

/* ------------------------------------------------------------------------ args */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const positional = args.filter((a, i) => !a.startsWith('--') && !String(args[i - 1] ?? '').startsWith('--'));

const wordsPath = positional[0];
if (!wordsPath) {
  console.error('usage: npm run takes -- <words.json> [--media <video>] [--script <script.md>]');
  process.exit(1);
}

const FPS = Number(flag('fps', 30));
/** How alike two passages must be before they count as attempts at the same thing. */
const SIMILAR = Number(flag('similar', 0.72));
/** Retakes happen close together. Two matching sentences minutes apart are both wanted. */
const WINDOW = Number(flag('window', 90));
/** A silence longer than this is dead air and gets collapsed. */
const GAP_MAX = Number(flag('gap-max', 0.6));
/** ...down to this. Not zero: speech with every gap removed sounds like a machine. */
const GAP_KEEP = Number(flag('gap-keep', 0.25));
/**
 * Breathing room kept either side of a kept passage.
 *
 * 150ms, not the 60 an earlier version used. Below about 120 the cut lands close enough to the
 * first phoneme to clip it, and the join reads as abrupt even when every word is intact.
 */
const PAD = 0.15;

/* ------------------------------------------------------------------- the words */

const key = (t) => t.toLowerCase().replace(/['‘’]/g, '').replace(/[^a-z0-9]/g, '');

const words = JSON.parse(readFileSync(wordsPath, 'utf8')).words.filter((w) => w.start != null && w.end != null);
if (words.length < 10) {
  console.error('Not enough timed words to work with.');
  process.exit(1);
}

/**
 * Cues that announce a retake out loud.
 *
 * When someone says one of these, the passage BEFORE it was abandoned — they are telling you so.
 * Cheaper and more certain than any similarity measure.
 */
const RESTART_CUES = [
  'let me redo that', 'let me try that again', 'one more time', 'sorry let me',
  'can i do that again', 'take two', 'scratch that', 'let me say that again',
  'start again', 'i will say that again',
];

/* --------------------------------------------------------------- units of speech
 * A unit is one spoken thought: it ends where the speaker put a full stop, or where they left a
 * gap long enough to be a boundary rather than a breath. Working in units rather than fixed word
 * counts means a retake is compared against the whole thought it replaced. */

const units = [];
{
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    const gapAfter = next ? next.start - w.end : Infinity;
    const endsSentence = /[.?!]$/.test(w.word);
    if (endsSentence || gapAfter > 0.7 || i === words.length - 1) {
      const span = words.slice(start, i + 1);
      if (span.length) {
        units.push({
          index: units.length,
          startIndex: start,
          endIndex: i,
          from: span[0].start,
          to: span[span.length - 1].end,
          text: span.map((x) => x.word).join(' '),
          keys: span.map((x) => key(x.word)).filter(Boolean),
          confidence: span.reduce((a, x) => a + (x.score ?? 0.8), 0) / span.length,
          complete: endsSentence,
          worstGap: span.slice(1).reduce((m, x, k) => Math.max(m, x.start - span[k].end), 0),
        });
      }
      start = i + 1;
    }
  }
}

/* -------------------------------------------------------------- energy and pace */

/**
 * Loudness per unit, so a flat read can lose to a committed one.
 *
 * Optional: without --media there is no audio to measure and the score simply does without it,
 * rather than the tool refusing to run.
 */
let rmsOf = () => null;
const mediaPath = flag('media', null);
if (mediaPath && existsSync(mediaPath)) {
  const RATE = 22050;
  const pcm = decodePcm(mediaPath, RATE);
  if (pcm) {
    rmsOf = (from, to) => {
      const a = Math.max(0, Math.floor(from * RATE));
      const b = Math.min(pcm.length, Math.ceil(to * RATE));
      if (b <= a) return null;
      let sum = 0;
      for (let i = a; i < b; i++) sum += pcm[i] * pcm[i];
      return Math.sqrt(sum / (b - a));
    };
  }
}

for (const u of units) {
  u.seconds = u.to - u.from;
  u.wordsPerSecond = u.keys.length / Math.max(0.3, u.seconds);
  u.rms = rmsOf(u.from, u.to);
}

const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const medianRms = median(units.map((u) => u.rms));
const medianPace = median(units.map((u) => u.wordsPerSecond)) ?? 3;

/* ------------------------------------------------------------------ similarity */

/** Longest common subsequence length — tolerant of an inserted stumble or a swapped word. */
const lcs = (a, b) => {
  const prev = new Array(b.length + 1).fill(0);
  const cur = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
};

/**
 * How alike two units are, measured against the SHORTER one.
 *
 * Against the shorter, because an abandoned start — "so the main reason, so the main reason is
 * that…" — is a short fragment entirely contained in the full attempt. Measured against the
 * longer it would score low and be kept; against the shorter it scores 1.0 and is correctly
 * recognised as the same thought, begun twice.
 */
const similarity = (a, b) => {
  if (!a.keys.length || !b.keys.length) return 0;
  const shorter = Math.min(a.keys.length, b.keys.length);
  // Short units match each other on function words alone: two four-word lines sharing "give it"
  // score 0.5 without meaning anything. Below five words there is not enough signal to call
  // something a retake.
  if (shorter < 5) return 0;
  const overlap = lcs(a.keys, b.keys);
  // And the overlap has to be real words, not two articles and a pronoun.
  if (overlap < 4) return 0;
  return overlap / shorter;
};

/* ---------------------------------------------------------------------- groups */

const groupOf = new Array(units.length).fill(-1);
const groups = [];

/**
 * Grouping is against a representative, never transitive.
 *
 * Chaining members together — A matches B, B matches C, so group them all — merges passages that
 * have nothing to do with each other as soon as one ambiguous unit sits between them — two
 * unrelated sentences end up in a single group because each matched the same middle one. A unit
 * joins a group only if it is similar to that group's FIRST member, which keeps a group to one
 * thought said more than once.
 */
for (let i = 0; i < units.length; i++) {
  if (groupOf[i] !== -1) continue;
  const members = [i];
  for (let j = i + 1; j < units.length; j++) {
    if (groupOf[j] !== -1) continue;
    if (units[j].from - units[i].to > WINDOW) break;
    if (similarity(units[i], units[j]) < SIMILAR) continue;
    members.push(j);
  }
  if (members.length < 2) continue;
  groups.push({members});
  for (const m of members) groupOf[m] = groups.length - 1;
}

/** A spoken cue abandons whatever came immediately before it. */
const abandoned = new Set();
for (const u of units) {
  const flat = u.keys.join(' ');
  if (!RESTART_CUES.some((c) => flat.includes(c.replace(/[^a-z0-9 ]/g, '')))) continue;
  const prev = units[u.index - 1];
  if (prev) abandoned.add(prev.index);
}

/* --------------------------------------------------------------------- scoring */

/**
 * One number per attempt.
 *
 * Completeness dominates — a finished sentence beats a smoother fragment every time. Everything
 * else nudges. The tie-break at the end is deliberate and matches how people actually record:
 * they repeat a line until they are happy, so the last attempt is usually the keeper.
 */
const score = (u) => {
  let s = 0;
  s += u.complete ? 6 : 0;
  s += Math.min(u.keys.length / 12, 1) * 3;
  s += u.confidence * 2;
  s -= Math.max(0, u.worstGap - 0.45) * 3;
  if (abandoned.has(u.index)) s -= 20;
  // Pace: too fast reads as rushed, too slow as laboured. Either direction costs the same.
  s -= Math.min(2, Math.abs(u.wordsPerSecond - medianPace) / Math.max(0.8, medianPace) * 2);
  // Energy, only when there was audio to measure.
  if (u.rms != null && medianRms) s += Math.max(-1.5, Math.min(1.5, (u.rms / medianRms - 1) * 2));
  return s;
};

for (const u of units) u.score = score(u);

/* ------------------------------------------------------- optional script checker
 * A script never removes anything. It reports lines that were never said, and nudges a tie
 * toward whichever attempt is closest to what was written. */

const scriptPath = flag('script', null);
let scriptMissing = [];
if (scriptPath && existsSync(scriptPath)) {
  const raw = readFileSync(scriptPath, 'utf8');
  const body = /^---\s*$/m.test(raw) ? raw.split(/^---\s*$/m).slice(1).join('\n') : raw;
  const lines = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^#.*$/gm, '')
    .replace(/`[^`]*`/g, ' ')
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.split(/\s+/).length >= 4);

  for (const line of lines) {
    const lk = line.split(/\s+/).map(key).filter(Boolean);
    const best = Math.max(0, ...units.map((u) => lcs(lk, u.keys) / Math.max(1, lk.length)));
    if (best < 0.6) scriptMissing.push({text: line, bestMatch: Number(best.toFixed(2))});
  }
  // Closest-to-script wins a close call, but only by a little.
  for (const g of groups) {
    for (const m of g.members) {
      const u = units[m];
      const best = Math.max(0, ...lines.map((l) => lcs(l.split(/\s+/).map(key).filter(Boolean), u.keys) / Math.max(1, u.keys.length)));
      u.score += best * 1.2;
    }
  }
}

/* ----------------------------------------------------------------- the decision */

const drop = new Set();
const groupReport = [];

for (const g of groups) {
  const members = [...new Set(g.members)].sort((a, b) => a - b);
  let winner = members[0];
  for (const m of members) {
    const a = units[m];
    const b = units[winner];
    // Within a hair of each other, the later one wins.
    if (a.score > b.score + 0.3 || (Math.abs(a.score - b.score) <= 0.3 && a.from > b.from)) winner = m;
  }
  for (const m of members) if (m !== winner) drop.add(m);
  groupReport.push({
    kept: {at: Number(units[winner].from.toFixed(2)), text: units[winner].text.slice(0, 90), score: Number(units[winner].score.toFixed(2))},
    dropped: members.filter((m) => m !== winner).map((m) => ({
      at: Number(units[m].from.toFixed(2)),
      text: units[m].text.slice(0, 90),
      score: Number(units[m].score.toFixed(2)),
    })),
  });
}
for (const i of abandoned) drop.add(i);

const kept = units.filter((u) => !drop.has(u.index));

/* ------------------------------------------------------------- building the plan
 * Consecutive survivors become one span, so the cut is not chopped at every sentence. A gap
 * between spans is collapsed only when it is longer than a breath — and a pause in front of a
 * short line is usually deliberate, so those are left alone. */

const keep = [];
for (const u of kept) {
  const last = keep[keep.length - 1];
  if (last && u.startIndex === last.endIndex + 1 && u.from - last.to < GAP_MAX) {
    last.to = u.to;
    last.endIndex = u.endIndex;
    last.units.push(u.index);
  } else {
    keep.push({from: u.from, to: u.to, startIndex: u.startIndex, endIndex: u.endIndex, units: [u.index]});
  }
}

for (const k of keep) {
  k.from = Math.max(0, k.from - PAD);
  k.to += PAD;
}
for (let i = 1; i < keep.length; i++) {
  if (keep[i].from < keep[i - 1].to) {
    const mid = (keep[i].from + keep[i - 1].to) / 2;
    keep[i - 1].to = mid;
    keep[i].from = mid;
  }
}

/** Gaps between spans, after the cut: long dead air collapsed, deliberate beats kept. */
const gaps = [];
for (let i = 1; i < keep.length; i++) {
  const gap = keep[i].from - keep[i - 1].to;
  const nextIsShort = units[keep[i].units[0]].keys.length <= 6;
  const target = gap > GAP_MAX && !nextIsShort ? GAP_KEEP : gap;
  gaps.push({after: i - 1, was: Number(gap.toFixed(2)), becomes: Number(target.toFixed(2)), keptAsBeat: target === gap && gap > GAP_MAX});
}

const dropped = [...drop].sort((a, b) => a - b).map((i) => ({
  from: Number(units[i].from.toFixed(2)),
  to: Number(units[i].to.toFixed(2)),
  reason: abandoned.has(i) ? 'announced-retake' : 'retake',
  text: units[i].text.slice(0, 110),
}));

/* ----------------------------------------------------------------- verification */

const survivors = kept;
const stillAlike = [];
for (let i = 0; i < survivors.length; i++) {
  for (let j = i + 1; j < survivors.length; j++) {
    if (survivors[j].from - survivors[i].to > WINDOW) break;
    if (similarity(survivors[i], survivors[j]) >= SIMILAR) {
      stillAlike.push({
        a: Number(survivors[i].from.toFixed(2)),
        b: Number(survivors[j].from.toFixed(2)),
        text: survivors[j].text.slice(0, 70),
      });
    }
  }
}

const keptSeconds = keep.reduce((a, k) => a + (k.to - k.from), 0);
const sourceSeconds = words[words.length - 1].end - words[0].start;
const checks = {
  noRepeatsLeft: stillAlike.length === 0,
  units: units.length,
  retakeGroups: groups.length,
  unitsDropped: drop.size,
  spans: keep.length,
  keptSeconds: Number(keptSeconds.toFixed(2)),
  sourceSeconds: Number(sourceSeconds.toFixed(2)),
  energyScored: medianRms != null,
};

/* ---------------------------------------------------------------------- output */

const stem = basename(wordsPath).replace(/\.?words\.json$|\.json$/, '') || 'take';
const project = flag('project', null);
const outPath = flag('out', null) ?? (project ? join('work', project, `${stem}.takes.json`) : join(dirname(wordsPath), `${stem}.takes.json`));
mkdirSync(dirname(outPath), {recursive: true});
writeFileSync(outPath, JSON.stringify({fps: FPS, gapMax: GAP_MAX, gapKeep: GAP_KEEP, pad: PAD, checks, keep, gaps, groups: groupReport, dropped, scriptMissing}, null, 2));

console.log(outPath);
console.log(`  ${checks.units} units, ${checks.retakeGroups} retake group(s), ${checks.unitsDropped} dropped`);
console.log(`  ${checks.keptSeconds}s kept of ${checks.sourceSeconds}s (${((keptSeconds / sourceSeconds) * 100).toFixed(0)}%) in ${checks.spans} span(s)`);
console.log(`  energy scoring: ${checks.energyScored ? 'on' : 'off (pass --media to enable)'}`);
if (groupReport.length) {
  console.log('\n  retakes dropped:');
  for (const g of groupReport.slice(0, 8)) {
    for (const d of g.dropped) console.log(`    ${String(d.at).padStart(7)}s  "${d.text}"`);
  }
}
const beats = gaps.filter((g) => g.keptAsBeat).length;
if (beats) console.log(`\n  ${beats} long pause(s) kept as deliberate beats before a short line.`);
if (scriptPath) {
  console.log(`\n  script check: ${scriptMissing.length} line(s) never said`);
  for (const m of scriptMissing.slice(0, 6)) console.log(`    - "${m.text.slice(0, 68)}"`);
}
if (stillAlike.length) {
  console.error(`\n${stillAlike.length} near-duplicate(s) still in the cut:`);
  for (const s of stillAlike.slice(0, 8)) console.error(`  ${s.a}s and ${s.b}s — "${s.text}"`);
  process.exit(1);
}
