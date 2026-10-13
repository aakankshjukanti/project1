#!/usr/bin/env node
/**
 * Music-driven assembly: a beat map plus a pile of clips becomes a cut that breathes.
 *
 *   npm run assemble -- --beats work/<n>/track.beats.json --clips <dir|file ...>
 *                       [--project <name>] [--fps 30] [--style travel|gym|product|vlog]
 *                       [--duration 30] [--preview]
 *
 * The shape, not just the timing: long shots in the intro, shots that shorten as the
 * track builds, one shot per beat through the drop, then a held shot at the end. Where
 * the drop is comes from the music itself — onset density per bar — not from a guess.
 *
 * Writes work/<project>/assembly.json + assembly.md:
 *   phases[]  intro / build / drop / outro, with the bar each one starts on
 *   shots[]   clip, in/out, timeline position, length in beats, transition in
 *
 * --preview renders a rough cut with ffmpeg (picture only + the track) so the rhythm
 * can be judged at playback speed. It is a preview: the real edit is built in the
 * composition from assembly.json, where the motion laws apply.
 */
import {existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs';
import {basename, extname, join} from 'node:path';
import {FFMPEG, fmt, probe, run, timecode} from './lib/media.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const flagList = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]);
  return out;
};
const has = (name) => args.includes(`--${name}`);

const beatsPath = flag('beats', null);
const clipArgs = flagList('clips');
const project = flag('project', null);
const fps = Number(flag('fps', 30));
const style = flag('style', 'travel');
const wantSeconds = has('duration') ? Number(flag('duration', 30)) : null;

if (!beatsPath || !existsSync(beatsPath) || !clipArgs.length) {
  console.error('Usage: npm run assemble -- --beats <beats.json> --clips <dir|file ...> [--style travel] [--duration 30] [--preview]');
  process.exit(2);
}

const beats = JSON.parse(readFileSync(beatsPath, 'utf8'));
const beatTimes = beats.beatSeconds || [];
const downbeats = new Set(beats.downbeatSeconds || []);
const onsets = beats.onsetSeconds || [];
if (beatTimes.length < 8) {
  console.error('That beat map has too few beats to cut to. Run npm run beats on a longer track.');
  process.exit(1);
}

/* ---------------------------------------------------------------- clips */

const VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi)$/i;
const clipFiles = clipArgs.flatMap((p) => {
  if (!existsSync(p)) return [];
  if (statSync(p).isDirectory()) {
    return readdirSync(p)
      .filter((f) => VIDEO.test(f))
      .sort()
      .map((f) => join(p, f));
  }
  return VIDEO.test(p) ? [p] : [];
});

if (!clipFiles.length) {
  console.error('No video clips found at that path.');
  process.exit(1);
}

const clips = clipFiles
  .map((path) => {
    const info = probe(path);
    return info && info.duration > 0.4 ? {path, name: basename(path), duration: info.duration, width: info.width, height: info.height, cursor: 0.3} : null;
  })
  .filter(Boolean);

if (!clips.length) {
  console.error('Those clips could not be probed, or all of them are under half a second.');
  process.exit(1);
}

/* ---------------------------------------------------------------- energy per bar */

const barStarts = beats.downbeatSeconds?.length ? beats.downbeatSeconds : beatTimes.filter((_, i) => i % 4 === 0);
const barEnergy = barStarts.map((t, i) => {
  const next = barStarts[i + 1] ?? t + (barStarts[1] - barStarts[0] || 2);
  const hits = onsets.filter((o) => o >= t && o < next).length;
  return {bar: i, start: t, end: next, hits};
});
const maxHits = Math.max(1, ...barEnergy.map((b) => b.hits));
// Smooth over three bars so one busy fill does not read as the drop.
const energy = barEnergy.map((b, i) => {
  const window = barEnergy.slice(Math.max(0, i - 1), Math.min(barEnergy.length, i + 2));
  return {...b, level: window.reduce((s, w) => s + w.hits, 0) / window.length / maxHits};
});

/**
 * The drop is the loudest sustained stretch, ignoring the first bars (an intro fill is
 * not a drop). The build is where the level first climbs past two thirds of it.
 */
const searchFrom = Math.max(1, Math.floor(energy.length * 0.12));
let dropBar = searchFrom;
for (let i = searchFrom; i < energy.length; i++) if (energy[i].level > energy[dropBar].level) dropBar = i;
const peak = energy[dropBar].level;
let buildBar = 0;
for (let i = dropBar; i >= 0; i--) {
  if (energy[i].level < peak * 0.66) {
    buildBar = i;
    break;
  }
}
let outroBar = energy.length;
for (let i = dropBar + 1; i < energy.length; i++) {
  if (energy[i].level < peak * 0.7) {
    outroBar = i;
    break;
  }
}

const barAt = (t) => {
  let b = 0;
  for (let i = 0; i < barStarts.length; i++) if (barStarts[i] <= t) b = i;
  return b;
};
const phaseAt = (t) => {
  const b = barAt(t);
  if (b < buildBar) return 'intro';
  if (b < dropBar) return 'build';
  if (b < outroBar) return 'drop';
  return 'outro';
};

/* ---------------------------------------------------------------- shot lengths */

/** Beats per shot, per phase. A gym cut is tighter than a travel cut; a vlog breathes. */
const STYLE = {
  travel: {intro: 8, build: [6, 2], drop: 2, outro: 8},
  gym: {intro: 4, build: [4, 1], drop: 1, outro: 4},
  product: {intro: 8, build: [4, 2], drop: 2, outro: 8},
  vlog: {intro: 8, build: [8, 4], drop: 4, outro: 8},
};
const plan = STYLE[style] || STYLE.travel;

const endSeconds = Math.min(
  beats.durationSeconds || beatTimes[beatTimes.length - 1],
  wantSeconds ? beatTimes[0] + wantSeconds : Infinity,
);

const slots = [];
let bi = 0;
while (bi < beatTimes.length - 1) {
  const t = beatTimes[bi];
  if (t >= endSeconds) break;
  const phase = phaseAt(t);
  let step;
  if (phase === 'build') {
    // Accelerate smoothly across the build instead of stepping down once.
    const span = Math.max(1, dropBar - buildBar);
    const through = Math.min(1, Math.max(0, (barAt(t) - buildBar) / span));
    const [from, to] = plan.build;
    step = Math.max(1, Math.round(from + (to - from) * through));
  } else {
    step = plan[phase];
  }
  const endBeat = Math.min(beatTimes.length - 1, bi + step);
  const end = Math.min(beatTimes[endBeat], endSeconds);
  if (end - t < 0.12) break;
  slots.push({start: t, end, beats: step, phase, onDownbeat: downbeats.has(t)});
  bi = endBeat;
}

if (!slots.length) {
  console.error('No shot slots came out of that beat map — try a longer --duration.');
  process.exit(1);
}

/* ---------------------------------------------------------------- clips into slots */

/**
 * Clips are used in order and cycled. Each clip keeps a cursor so the second time it
 * comes round you get a different part of it, not the same three seconds again.
 */
const shots = slots.map((slot, i) => {
  const need = slot.end - slot.start;
  let chosen = null;
  for (let k = 0; k < clips.length; k++) {
    const c = clips[(i + k) % clips.length];
    if (c.duration - c.cursor >= need) {
      chosen = c;
      break;
    }
  }
  let needsRamp = false;
  let speed = 1;
  if (!chosen) {
    // Nothing long enough left: take the longest clip and slow it to fill the slot.
    chosen = clips.reduce((a, b) => (b.duration > a.duration ? b : a), clips[0]);
    chosen.cursor = 0.3;
    const available = Math.max(0.3, chosen.duration - chosen.cursor);
    if (available < need) {
      needsRamp = true;
      speed = Number((available / need).toFixed(3));
    }
  }
  const inPoint = Math.min(chosen.cursor, Math.max(0, chosen.duration - need));
  const outPoint = Math.min(chosen.duration, inPoint + need * (needsRamp ? speed : 1));
  chosen.cursor = outPoint + 0.2;
  if (chosen.cursor > chosen.duration - 0.4) chosen.cursor = 0.3;

  const prev = slots[i - 1];
  let transitionIn = 'cut';
  if (i === 0) transitionIn = 'none';
  else if (prev.phase !== slot.phase) transitionIn = slot.phase === 'drop' ? 'whipPan' : slot.phase === 'outro' ? 'dip' : 'push';
  else if (slot.onDownbeat && slot.phase === 'drop' && i % 4 === 0) transitionIn = 'colourFlip';

  return {
    index: i,
    clip: chosen.name,
    path: chosen.path,
    in: Number(inPoint.toFixed(3)),
    out: Number(outPoint.toFixed(3)),
    speed: needsRamp ? speed : 1,
    needsRamp,
    startSeconds: Number((slot.start - beatTimes[0]).toFixed(3)),
    startFrame: Math.round((slot.start - beatTimes[0]) * fps),
    durationFrames: Math.round(need * fps),
    seconds: Number(need.toFixed(3)),
    beats: slot.beats,
    phase: slot.phase,
    transitionIn,
  };
});

/**
 * Whatever is left over when the track (or --duration) runs out lands on the final shot,
 * which can leave a stub too short to register as anything but a mistake. Fold it back
 * into the shot before it, so the edit ends on a held frame rather than a flinch.
 */
if (shots.length > 1) {
  const tail = shots[shots.length - 1];
  const prev = shots[shots.length - 2];
  if (tail.seconds < 0.6 * prev.seconds) {
    const clip = clips.find((c) => c.path === prev.path);
    const wanted = prev.seconds + tail.seconds;
    const available = clip ? clip.duration - prev.in : wanted;
    prev.seconds = Number(wanted.toFixed(3));
    prev.durationFrames = Math.round(wanted * fps);
    prev.out = Number(Math.min(prev.in + wanted, clip ? clip.duration : prev.in + wanted).toFixed(3));
    if (available < wanted) {
      prev.needsRamp = true;
      prev.speed = Number((available / wanted).toFixed(3));
    }
    shots.pop();
  }
}

// The last shot is the one people remember: let it hold, with a slow push instead of a cut.
const last = shots[shots.length - 1];
last.hold = true;
last.note = 'Hold. Slow push-in (DUR.drift) instead of another cut.';

/* ---------------------------------------------------------------- write */

const stem = basename(beatsPath, '.beats.json').replace(/\.json$/, '');
const dir = project ? join('work', project) : join('work', 'assembly');
mkdirSync(dir, {recursive: true});

const phases = [
  {name: 'intro', fromBar: 0, fromSeconds: Number(barStarts[0].toFixed(3))},
  {name: 'build', fromBar: buildBar, fromSeconds: Number((barStarts[buildBar] ?? 0).toFixed(3))},
  {name: 'drop', fromBar: dropBar, fromSeconds: Number((barStarts[dropBar] ?? 0).toFixed(3))},
  {name: 'outro', fromBar: outroBar, fromSeconds: Number((barStarts[outroBar] ?? barStarts[barStarts.length - 1]).toFixed(3))},
];

const totalSeconds = shots.reduce((s, x) => s + x.seconds, 0);
const out = {
  music: beats.source,
  beatsFile: beatsPath,
  bpm: beats.bpm,
  fps,
  style,
  startsAtSeconds: Number(beatTimes[0].toFixed(3)),
  totalSeconds: Number(totalSeconds.toFixed(3)),
  totalFrames: Math.round(totalSeconds * fps),
  phases,
  clips: clips.map((c) => ({name: c.name, seconds: Number(c.duration.toFixed(2))})),
  shots,
};
const jsonPath = join(dir, 'assembly.json');
writeFileSync(jsonPath, JSON.stringify(out, null, 2));

const md = `# Assembly — ${stem}

- **Track:** ${basename(String(beats.source || ''))} · **${fmt(beats.bpm, 1)} BPM** · cut starts at ${timecode(beatTimes[0])}
- **Style:** ${style} · **${shots.length} shots** across ${fmt(totalSeconds, 1)}s (${Math.round(totalSeconds * fps)} frames @ ${fps}fps)
- **Clips used:** ${clips.length}

## Shape

| phase | starts | shot length |
|---|---|---|
| intro | ${timecode(phases[0].fromSeconds)} | ${plan.intro} beats — let it breathe |
| build | ${timecode(phases[1].fromSeconds)} | ${plan.build[0]} → ${plan.build[1]} beats, accelerating |
| drop | ${timecode(phases[2].fromSeconds)} | ${plan.drop} beat${plan.drop > 1 ? 's' : ''} — hardest cutting |
| outro | ${timecode(phases[3].fromSeconds)} | ${plan.outro} beats — hold the last shot |

The drop was found from the music: bar ${dropBar} has the highest sustained onset density.

## Edit list

| # | at | len | clip | in → out | phase | transition in |
|---|---|---|---|---|---|---|
${shots.map((s) => `| ${String(s.index + 1).padStart(2, '0')} | ${timecode(s.startSeconds)} (f${s.startFrame}) | ${fmt(s.seconds, 2)}s | ${s.clip} | ${fmt(s.in, 2)} → ${fmt(s.out, 2)} | ${s.phase} | ${s.transitionIn} |`).join('\n')}

${shots.filter((s) => s.needsRamp).length ? `## Needs a ramp\n\n${shots.filter((s) => s.needsRamp).map((s) => `- Shot ${s.index + 1} (${s.clip}) is shorter than its slot. Slow it to ×${fmt(s.speed, 2)}:\n  \`npm run ramp -- "${s.path}" --ramp "${fmt(s.in, 2)}-${fmt(s.out, 2)}:1->${fmt(s.speed, 2)}" --ease inOut\`` ).join('\n')}\n` : ''}
## Notes

- Cuts land on beats; phase changes get a named transition, everything else is a straight cut.
- ${last.note}
- Run \`npm run sound\` on this file next — it places whooshes, impacts and the riser off these cuts.
`;
writeFileSync(join(dir, 'assembly.md'), md);

/* ---------------------------------------------------------------- preview */

if (has('preview')) {
  const previewPath = join(dir, 'assembly-preview.mp4');
  const inputs = [];
  const parts = [];
  shots.forEach((s, i) => {
    inputs.push('-ss', String(s.in), '-t', String(Math.max(0.05, s.out - s.in)), '-i', s.path);
    const speedFilter = s.needsRamp ? `,setpts=${fmt(1 / Math.max(0.05, s.speed), 4)}*PTS` : '';
    parts.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=${fps},setsar=1${speedFilter}[v${i}]`,
    );
  });
  const music = beats.source && existsSync(beats.source) ? beats.source : null;
  if (music) inputs.push('-ss', String(beatTimes[0]), '-i', music);
  const concat = `${shots.map((_, i) => `[v${i}]`).join('')}concat=n=${shots.length}:v=1:a=0[vout]`;
  const filter = `${parts.join(';')};${concat}`;
  const cmd = ['-y', '-v', 'error', ...inputs, '-filter_complex', filter, '-map', '[vout]'];
  if (music) cmd.push('-map', `${shots.length}:a`, '-c:a', 'aac', '-b:a', '256k', '-shortest');
  cmd.push('-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', previewPath);

  console.log(`Rendering preview (${shots.length} shots)...`);
  const r = run(FFMPEG, cmd);
  if (!r.ok) console.error(`Preview failed: ${r.err.trim().split('\n').slice(-3).join(' ')}`);
  else console.log(`Preview    ${previewPath}`);
}

console.log(`Track      ${fmt(beats.bpm, 1)} BPM, drop at bar ${dropBar} (${timecode(barStarts[dropBar] ?? 0)})`);
console.log(`Shape      intro ${buildBar} bars · build ${dropBar - buildBar} · drop ${outroBar - dropBar} · outro ${Math.max(0, energy.length - outroBar)}`);
console.log(`Shots      ${shots.length} over ${fmt(totalSeconds, 1)}s from ${clips.length} clip(s)`);
console.log(`Written    ${jsonPath}`);
console.log('\nCuts land on beats. Feed assembly.json to the composition, then run npm run sound on it.');
