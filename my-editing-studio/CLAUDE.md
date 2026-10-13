# Editing studio — rulebook

Read this at the start of every session. It is how this studio edits, and it is not
optional. Quality lives in the system — the tokens, the components, the lint, the
frame-by-frame checks — never in one-off hacks. Never bypass the system to get something
on screen faster; that is the one habit that makes every later video worse.

## Project map

```
src/design/        tokens.ts is the look — colour, type, layout. Everything visual reads from it.
                   motion.ts is the timing. presets.ts is the named transitions and caption looks.
                   overlays.ts is the film looks. Only tokens.ts is yours to change freely.
src/lib/           animate, continuity, camera, spine, project — the helpers every video uses.
src/components/    the effects library, as real components. Captions, Transition, Stage, and the rest.
src/compositions/  PresetTest and FilmTest — reference comps showing every preset side by side.
src/videos/<name>/ one folder per video. This is where your work goes.
scripts/           the tools: prep, beats, trim, assemble, sound, and the two checks.
assets/            footage, screenshots, audio, fonts. Reachable as staticFile('footage/clip.mp4').
work/<name>/       everything the scripts produce: transcripts, beat maps, cut lists, cue sheets.
out/               finished renders.
```

## Commands

- `npm run studio` — preview everything
- `npm run new-video -- <name>` — create a video's folders and its BRIEF.md
- `npm run prep -- <name>` — probe and conform footage, transcribe, align the script, find jump cuts
- `npm run trim -- <clip> [--words <words.json>]` — cut silence and filler, assign punch-in framings
- `npm run beats -- <music>` — tempo, beat, downbeat and onset map
- `npm run assemble -- --beats <beats.json> --clips <dir>` — build a cut off the music
- `npm run sound -- --cuts <cut list>` — place whooshes, impacts and risers, ducked under the voice
- `npm run ramp -- <clip> --ramp "3-5:1->0.4"` — eased speed ramps
- `npm run sync -- <a> <b>` — line up a second angle or a separate mic
- `npm run refstyle -- <reference clip>` — measure a reference edit's pacing and colour
- `npm run stills -- <Comp> --every=45` — many stills at once, with contact sheets
- `npm run check` — typecheck plus motion lint. Must pass.
- `npm run motion-check -- <Comp> --scale=2` — frame-by-frame POP / CUT / STUTTER detection
- `npm run render <Comp> out/video.mp4` — render

## Your look comes first

`src/design/tokens.ts` ships with neutral placeholder values. Before making anything real,
set it up — ask *"build my design system from &lt;url&gt;"* and point it at a brand you
like, or hand over your own colours, fonts and sizes. Put font files in `assets/fonts/`.

Everything else in `src/design/` is the system and should be left alone. If a video needs
a colour or a size that is not in tokens.ts, the answer is to add it to tokens.ts, never to
type it into a component.

## The order of work

Two things are fixed: **you read their references before you design anything**, and **they see
the edit as a plan before you render it.** Everything else bends to the job in front of you.

### 0. References first. Always. Before the brief, before the footage.

This is the first thing you do in any editing session, and it is not optional, because it is the
only reason their edits look like theirs instead of like everyone's.

Read both, in this order:

1. **The references for this project** — anything they put in the video's own folder or named in
   its `BRIEF.md`: a clip they want it to feel like, a screenshot, a link, a sentence like
   "similar to that last one but calmer".
2. **The references saved for them generally** — `references/references.md` and the contact
   sheets in `work/refs/`, plus `STYLE.md` §9 Rejected and §8 Approved. §9 first: ruling options
   out is faster than adding them.

Then say back, in one or two lines, which of their references you are using and for what. Not a
summary of all of them — the ones that will show up in this edit.

A reference beats a house default wherever the two disagree. A default is a guess that suits
everyone; a reference is a fact about them.

**If they have no references yet, do not stall and do not nag.** Say so in one line, use the
house defaults, and ask for one reference at the end when they are reacting to something real —
that is when people can actually name what they like.

### 1. Prep and transcribe

`npm run prep -- <name>`. Real duration, fps and resolution for every clip — never assumed.
Then transcribe with word-level timings. **The transcript is the truth, not the script and not
what they remember saying.**

### 2. The first cut, before the plan

Cut the silence, the filler and the retakes first. This is mechanical — no design decisions in
it — so it does not need their approval, and doing it first is what makes the plan possible:
every beat is anchored to a word, and words only have frame numbers once the cut exists.

Re-map the word timings onto the cut timeline before going further.

### 3. The plan — and this is where you stop

Two things, neither of them a file for them to open. A plan only gets corrected if it is in
front of them.

**The plan goes in the reply, as a table**, one row per beat:

| # | In | Out | Trigger word (frame) | What is on screen | Audio under it |
|---|---|---|---|---|---|

Then the runtime, the caption script, and a short note on what you chose not to do and why.

**The motion sheet is a PNG of real rendered frames.** Build the graphics, render one still per
beat with `npm run stills`, and lay them out as a numbered contact sheet — each tile labelled
with its timecode, the words that trigger it, and the approved beat it comes from. Prose about
motion cannot be corrected, because they cannot see it. A picture can: they point at a tile
number and say what to change.

Every graphic names the beat it comes from, out of `STYLE.md` §8 or their references. **A
graphic that cannot name its beat is not approved and does not go on the sheet.** That rule is
what stops motion graphics drifting into generic.

Then stop and ask: *here is the plan, change anything that is off, say go ahead and I will cut
it.* Wait for a yes. "Go ahead", "yes", "approved", "ship it" is a yes. Silence is not.

### Keep it proportionate

The plan is there to save them a rebuild, not to put a form in front of them.

- **A short or simple job gets a short plan.** Three beats, three rows, three tiles. Do not pad
  a thirty-second clip into a fifteen-row table.
- **A fix to an edit they have already approved is not a new plan.** They said "captions lower,
  hold that shot longer" — do it, show it, done. Re-plan only when the structure changes.
- **If they say "just do it", do it.** Put the table in one short message and cut straight
  after, so there is still a record of what was intended — but do not block on an answer.
- **Never ask a question you can answer yourself.** Probe the file, read the brief, pick the
  sensible default and say which one you picked. Questions are for the things that would
  genuinely change the edit.
- **One round of questions, not a drip.** If you need to ask, ask everything at once.

The failure this is guarding against is a whole edit rendered the wrong way. Anything that does
not risk that should move fast.

## What makes motion read as expensive

The twelve motion laws stop an edit looking broken. These seven are what separate motion that
looks competent from motion that looks paid for. They were taken from studying reference edits
frame by frame, and they apply to UI, graphics and footage alike.

**1. Blur anything that moves fast.** In the edits that feel most expensive, nothing travels
sharp. An element crossing the frame in six frames should be a smear that only resolves as it
slows — and that includes digits rolling from one number to another, and a line redrawing on a
chart. Sharp fast motion is the single clearest tell of cheap animation, because real cameras and
real eyes do not work that way. Use the velocity blur helpers rather than deciding per element.

**2. Morph, don't replace.** When something becomes something else, animate the thing itself
rather than fading one out and another in. A row that is clicked and confirmed should stretch and
turn into the confirmation; it should not be covered by a new element that happens to sit in the
same place. An element that exists in two moments travels between them. This is the law that most
reliably makes a sequence feel connected rather than assembled.

**3. Overshoot, then settle.** Things that arrive exactly at their final size and stop look
pasted on. Let an arrival come in slightly too large, or slightly past its mark, and ease back.
The overshoot is small — a few per cent — and it is the difference between landing and being
placed.

**4. Animate the data, not the container.** When a value, a chart or a list changes, hold the
frame still and change only what actually changed. Re-entering the whole panel to show a new
number throws away the viewer's orientation and makes the change read as a new scene instead of
an update.

**5. Reveal one thing at a time.** Rows, cards, icons and bullets arrive in reading order with a
few frames between them, never as a group. If a container also needs to grow, grow it slowly
underneath while the contents arrive — two speeds, not one.

**6. Earn the hard cut.** In a piece built from continuous motion, a single hard cut to a flat
colour lands hard precisely because it is the only one. Bursts of hard cuts are their own beat
and work too, but mixing the two at random wastes both. Decide which the piece is.

**7. Show what is coming.** Small anticipations make an interface feel alive: text typing into a
pill that grows with it, with the next word already faintly present; a cursor that starts moving
before the thing it will click appears. The viewer reads intent, not just motion.

A note on where these come from. Every one of them was found by studying an edit frame by frame
and writing down what it actually did — not by reading about animation. When something looks good
to you, save the clip and the timecode and do the same. That habit is worth more than any list,
including this one.

## Verify the render before you call it done

You have not seen the video. The timeline in your head is not evidence. Before you say an
edit is finished, pull real frames out of the **rendered file** and look at them:

```
npm run stills -- --file out/<name>.mp4 --at 2,5,8,11,14,17,20
```

Put a still on **both sides of every cut** in the plan, and on any beat you are unsure of.
Then say what you saw. Never write "this is fixed" about something you have not looked at.

## Faults that keep recurring — check for these every time

**Slivers of footage between graphics.** When two full-screen graphics run back to back, the
second must start on the exact frame the first ends — `out` of one *is* `in` of the next.
A gap of even one frame flashes the talking head for 30ms and reads as a broken edit, not a
cut. Assert it in code: walk the beat list and fail if any `in` is greater than the previous
`out`.

**A caption word left alone on screen.** A word-by-word caption holds until the next word
arrives. If the speaker pauses for a second mid-phrase, one word sits there alone and the
viewer reads it as a stutter or a repeat. Cap any single word's hold at about 0.5s — after
that, show the rest of the line greyed ahead, or drop the line and start the next one.

**A graphic that renders invisible.** `zIndex` on one child creates a stacking context and can
hide every sibling painted after it. Prefer paint order to `zIndex`. If a beat is in the plan
and not in the stills, it did not render — find out why before shipping.

**A nested video restarting.** Inside a `Sequence`, `useCurrentFrame()` is local. An
`OffthreadVideo` placed in one starts from its own frame 0 and plays its own audio over the
live line. Pass an explicit `startFrom`, and mute it unless its sound is wanted.

**Something they can hear and you cannot.** When they report a fault you cannot find, your check
is the thing most likely to be wrong, not them. Three rules, learned the hard way:

- **Transcribe the WHOLE file, not the window they named.** A seven-second sample came back clean
  and was used to tell the owner he was imagining a repeat that was really there.
- **Check every render in `out/`, not the one you just made.** They are probably playing an older
  file, because nothing on their machine says which is current. Ask which file, or test them all.
- **If they say it more than once, stop checking and start believing.** A repeated complaint is
  evidence your method is wrong. Change the method.

If the audio really is clean, the repeat is visual — a held caption, a reused graphic, a duplicated
framing — and that is still a real fault, not a misunderstanding to explain away.

**A transcript is not evidence.** Whisper suppresses repeated phrases: when someone says a line
twice it transcribes it once and stretches the last recognised word across the speech it dropped,
so the transcript reads clean while the audio plainly repeats. Run `node scripts/coverage.mjs
<media> <words.json>` after every transcription and before planning anything — it flags any word
far longer than the median, and any stretch above the noise floor with no word on it. Both mean
the transcript is hiding speech. Check the energy across the flagged word: one decaying word is
fine, a dip to silence followed by a second loud onset is a repeat.

**Four generations of lossy audio.** The voice must be cut as PCM and encoded exactly once, at
delivery. Cutting an AAC file, trimming the result, and then letting the renderer re-encode it
puts the voice through four generations of loss, and raising the bitrate on the later passes
preserves the damage rather than repairing it. It is clearly audible and it gets worse with
every extra render. Use `node scripts/voice.mjs` to pull the voice losslessly from the camera
file, render the picture muted, and mux the two together at the end.

## Non-negotiables

1. **No magic numbers.** Durations, curves, springs, staggers, blur come from `src/design/motion.ts`.
   Colours, fonts, sizes, spacing come from `src/design/tokens.ts`. If a needed token does not
   exist, add it to the token file (with a comment) instead of inlining a value.
2. **Timing derives from the spine.** Animation start frames come from word timestamps, beats,
   or other elements' timings via helpers — never hand-typed frame numbers.
3. **`npm run check` and `motion-check --scale=2` must pass** before any render is shown to the user.
4. **Verify visually before claiming done** (see Verification). Never say something "looks good"
   without having rendered and viewed the frames.

---

## The 12 motion laws

1. **No linear easing** — except constant-velocity loops/scrolls (mark with `// motion-ok`).
2. **Entrances ease-out (`EASE.out`), exits ease-in (`EASE.in`), on-screen A-to-B moves ease-in-out (`EASE.inOut`).**
3. **Exits are faster than entrances** — `EXIT_RATIO` (0.65). Use `exitFrames()`.
4. **Max 2–3 animated properties per element.** No fade + scale + rotate + blur together.
5. **Never opacity alone.** Pair with 8–24px travel or scale >= 0.94. Opacity completes at
   `OPACITY_LEAD` (60%) of the transform.
6. **Never scale from below 0.9.** Text scaling from zero is the #1 AI-edit tell.
7. **Blur-in capped at 12px**, fully resolved before the transform ends.
8. **Groups always stagger** (`STAGGER.tight/normal/dramatic`). Never simultaneous.
9. **Distance couples to duration sub-linearly** (`travelFrames()`), never linearly.
10. **Anything that moves fast is motion-blurred** (see Smoothness system). No hard edge may jump
    across the frame unblurred.
11. **Readable hold:** text stays fully visible >= `readFrames(text)` (min 0.9s, +55ms/word).
12. **Continuity:** every transition inherits the outgoing motion (see below).

### Continuity (what makes it feel connected, not cut together)

- **Shared elements never re-enter.** If an element exists across two beats, `morph()` its
  position/size/radius between layouts; never exit and re-animate it. (TransitionTest: the
  eyebrow dot stays on screen and grows into the next card's icon tile.)
- **Velocity handoff.** An exit toward a direction is answered by an entrance continuing that
  direction — `handoff(exitTo)`.
- **Overlap, never gap.** The next beat starts before the previous one settles —
  `nextBeatAt(prevSettled)`.
- **One camera over cuts.** Lay scenes out on one canvas and glide a camera between them
  (`src/lib/camera.ts`) instead of hard-cutting between unrelated layouts. Content that should
  stay put during a move (shared elements) lives in screen space, outside the camera.
- **Nothing is cut off.** Compute exit start times backward from the end so the slowest,
  most-staggered exit completes on or before the last frame.
- **Sound glues cuts.** Whooshes start `TRANSITION.sfxLeadMs` before a visual change and tail
  `sfxTailMs` after.

---

## Smoothness system (every one of these was a real defect found by motion-check)

- **Use the components, not raw transforms.** `<Presence>`, `<MaskReveal>`, `<HighlightMark>`,
  `<RollingNumber>` add velocity motion blur automatically. Anything else that moves wraps its
  moving element in `<VelocityBlur vx vy>` with `perFrame()` velocities.
- **Velocity motion blur** (`VelocityBlur`): directional blur sized to this frame's movement with
  a 180-degree shutter; fades to zero as the element settles. Near-free to render.
- **Wipes** use `wipeMask(p, perFrame(...))`: the leading edge softens with speed. Never wipe with
  a hard `clipPath` edge.
- **Camera moves**: wrap the camera canvas in a full-frame `VelocityBlur` with `bleed={0}` and
  `overflow: hidden`, velocity from `cameraShot` (see TransitionTest).
- **Zooms / rotations** (not translations): use `<MotionBlur active>` (temporal sampling, centred
  on the frame so toggling it never shifts timing). It costs 10x render time while active —
  enable only during the move. Never use `@remotion/motion-blur`'s `CameraMotionBlur`: it samples
  ahead of the frame, so switching it on/off causes a timing hitch.
- **Counters roll, never tick.** Use `<RollingNumber>`. A counting number changes glyphs in single
  frames as it slows, which motion-check flags as pops.
- **Never `will-change`.** It makes each parallel render tab cache text at a different sub-pixel
  position, so settled elements flicker between 4 versions. (Lint enforces this.)
- **Screen recordings used as b-roll usually scroll in steps** (they judder). Use a still frame with a
  smooth `ScreenView` pan instead, and blur names on the still.
- **Presence `dur` sets entrance AND exit length.** `dur="instant"` makes exits last 3 frames (a snap) —
  for containers that only fade in, use at least `"base"`.
- **Final renders are supersampled at `--scale=2`**, then downscaled to 1080x1920. At 1x, Chrome
  snaps text to whole pixels, so the slow tail of every ease-out steps ("move 1px, hold, move 1px")
  and motion-check reports stutters. Run motion-check with the same `--scale`.
- **Frame rate:** match the footage. If footage is 60fps, build at 60 — per-frame jumps halve.
  All tokens are in ms, so compositions work at either rate.

---

## Design rules

**Read `STYLE.md` before any design decision.** It is the house style (type scale, layout, motion,
sound, approved and rejected beats) and wins over anything below or in a reference. Update it
whenever the user approves or rejects something.

- Everything visual comes from `src/design/tokens.ts`, which is yours to define.
- **Brand essentials:** your display typeface only, at every weight (headlines/stats 800). One accent: accent
  `your accent` on ink and cream/white. No blue, no purple, no serif. Signature emphasis is the accent
  marker behind the key phrase — use `<HighlightMark>`; don't invent other emphasis styles.
  Headlines are short two-part fragments with the payoff highlighted. Numbers are shown raw and
  bold ("$1.3M", "11x") and roll in. Eyebrows are uppercase pills with a accent-ringed dot.
  Radii are generous, shadows soft, buttons/badges pills.
- Secondary text uses `COLOR.fgSecondary`; `COLOR.fgMuted` fails contrast on cream — decoration only.
- **User style decisions (first project):**
  - Captions are **crisp white** (`CAPTION` token, tight + soft dark shadow). Never ink text with a light glow.
    Over the cream background white is invisible, so in card layouts captions go **inside the video
    card's bottom edge** on the card's dark scrim (`StageState.scrim`).
  - Big headline text is **accent with a glow** (`HeroBlock` / `HeroTag`, `heroGlow()`).
  - Pointer is a **solid accent arrow** like the reference (`Cursor`), ~68px.
  - Brand logos are **real full-colour logos** (`LogoIcon`, SVG Logos CC0 via `src/design/logos.json` —
    extract only the icons used). Never approximate a logo that isn't in the set; use a neutral
    icon and ask for the official file (Klaviyo is missing).
  - A corner tag (e.g. "11 MINUTES" pill) is removed when the video returns full screen.
- **Text behind the subject must stay readable:** the head covers only the lower ~20–30% of the
  headline. Head height changes shot to shot (leaning forward lifts it ~80px) — check a still of
  EVERY hero moment and raise the block (`top`; put labels above as `eyebrow`) where needed.
- Keep accent highlights away from the accent background glow so they don't disappear into it.
- Stats use proportional figures, not tabular (tabular makes "11" look gappy in your display typeface).
- **Web design systems do not map 1:1 to video.** Keep colour, font families/weights, type-scale
  ratios, radii, spacing rhythm, iconography and imagery style — but rescale sizes for a
  1080-wide frame viewed on a phone (body roughly 40–48px, not 16px). Web UI components mostly
  do not apply.
- Respect safe zones: `LAYOUT.safeTop` / `LAYOUT.safeBottom` for Reels/Shorts UI.
- Text contrast >= 4.5:1 against whatever is behind it, including over footage.
- Draw graphics in code (SVG/CSS) so every part can animate. Use flat images only for things
  that must be real (logos, screenshots, photos). Avoid AI-generated imagery for anything the
  viewer is meant to look at.
- Icons: SVG drawn in code or an installed icon library, never image files.

---

## Compositing: text behind the subject

Layer order, bottom to top:

```
background plate (designed, or the original footage)
  text / graphics          <- 1–3px blur to sit on the background's focal plane
    subject cutout         <- same clip, frame-aligned
      light wrap           <- blurred background screened onto the subject's inner edge, 15–30%
        grain + grade      <- applied over everything so layers share one look
```

- **The cutout must come from the same clip as its background plate**, frame-aligned. Never
  combine a cutout from one take with footage from another.
- **The matte is built automatically from ordinary footage.** No green screen, and never ask the
  user for one — most people have never shot against green and do not know the term. Segment the
  subject per frame, then **temporally smooth the alpha**, which is not optional: a per-frame matte
  shimmers along the edge, and type sitting against a head is exactly where that shows. Finish with
  spill-free cleanup: ~0.5px choke, 0.5–1px feather.
- **Quality is worst where it is most visible:** flyaway hair, motion blur, and a hand crossing in
  front of the text. The light wrap below hides a good deal of it. If a shot simply will not hold,
  say so and move the text rather than shipping a halo.
- **If the user happens to have a background-free or green version, prefer it** — chroma keying
  still beats automatic matting on hair. Use it **only for the alpha** and take the subject's colour
  from the original, so no green ever reaches the edges. Verify the pair first: identical duration,
  fps, resolution and frame count, subject aligned on the same frame (one frame out makes a ghost).
  This is an upgrade for people who already work that way, never a requirement.
- **Supplied cutouts** must have real transparency (ProRes 4444, WebM with alpha, or PNG sequence).
  An MP4 cannot hold transparency — if one arrives, stop and tell the user.
- Play transparent video with `<OffthreadVideo transparent src={staticFile(...)} />`.
- Text behind a moving subject gets 0.85–0.95x counter-parallax; static text reads as a sticker.
- Text should animate in while already partly occluded, not appear fully and then get covered.
- Pull text colour toward the footage's black/white points; pure white over graded footage looks
  pasted on.

---

## Per-video pipeline

1. **Ingest:** probe every clip (fps, resolution, colour, alpha).
   - **Phone footage is usually variable frame rate (VFR).** Conform it to constant frame rate
     with ffmpeg before use, or it stutters and drifts out of sync in Remotion.
   - Conform everything to one fps. Never mix frame rates.
2. **Spine:** word-level timings + music beats -> `work/<video>/spine.json`.
   Cut pauses/filler from word gaps. All animation timing reads from the spine.
   - If the user supplies a script or SRT, it is the **text truth** (spelling, names, brand words):
     force-align that exact text to the audio with WhisperX's aligner. Never use SRT timings
     directly — they are line-level and padded for readability, not word-accurate.
   - With no script, transcribe with WhisperX, then show the transcript for correction before building.
3. **Cutouts:** build the matte from the footage automatically, or validate a supplied cutout (see above). Only needed for shots that want text behind the subject.
4. **Beat sheet:** from the script and the user's marked punch lines, write a short plan — which
   moment gets which treatment — and confirm with the user before building.
   - **Read their saved references first** (`editing_os_references`). They are the whole reason
     the edit should look like theirs rather than like the defaults, and a plan written without
     them is a plan written for anybody. Say which reference each decision came from, so the
     user can see their own taste being applied and correct it when it is being misread.
   - Where references are silent, the defaults in STYLE.md apply. Where references and defaults
     disagree, the reference wins — it is a real preference, and the default is only a sensible
     starting point.
5. **Build** in `src/compositions/<Video>.tsx` from components + helpers + tokens only.
6. **Verify** (below), then show the user.
7. **Sound:** the user adds SFX and music themselves. Deliver a cue list (timestamps of every
   transition and hit, with suggested whoosh start = `TRANSITION.sfxLeadMs` before the change) so
   they can place sounds quickly. Render without music unless asked.
8. **Render** at `--scale=2`, downscaled to 1080x1920 unless told otherwise.

---

## Audio standard (audio is half the reel — the user will not accept a bad mix)

What went wrong on an early video: the voice itself was bit-for-bit intact (measured against the source),
but 2.3–3.5s whoosh files and a 2.4s riser kept playing UNDER the speech, which made the voice sound
wrong. Claude cannot hear, so the mix must be engineered and measured, never guessed.

1. **The voice is never touched.** Render the picture `--muted`. The voice in every deliverable is the
   original recording's audio (stream-copied, or at most one encode), plus only a single gain change.
   No limiter, no dynamic normaliser (ffmpeg `loudnorm` single-pass pumps), no repeated AAC encodes.
2. **Sound effects are short and placed in gaps.** Trim every SFX to what the motion needs (whoosh
   0.4–0.8s, hits 0.3–0.6s) with a 60–120ms fade-out. Nothing longer than ~0.8s may sit under a spoken
   word unless it is at least 24 dB under the voice. Risers go in pauses, not under speech.
3. **Duck SFX under the voice**: mix with ffmpeg `sidechaincompress` keyed from the voice (SFX drop
   ~6 dB while a word is spoken), and high-pass whooshes/impacts around 120–150 Hz so they don't muddy it.
4. **Measure before delivering** (the window scan in the project folder used `f32le` PCM from ffmpeg):
   voice-vs-mix difference per 0.5s window — any window where SFX energy is within 12 dB of the
   voice while a word is spoken gets fixed. Final: -14 LUFS integrated, true peak <= -1 dBTP, one
   AAC encode at 256k.
5. **Always also deliver stems + a cue sheet**: `voice.wav`, `sfx.wav` (the placed, trimmed SFX bus),
   and `SFX-CUES.txt` with numbered, timecoded SFX files — so the user can rebalance in Premiere in
   minutes. Picture-only MP4 alongside.
6. The user picks and judges sounds by ear; Claude says plainly that it cannot hear and asks for
   timecoded audio notes on the first draft.

---

## Verification (required before saying anything is done)

Claude cannot watch video. Quality is checked with frames and maths, and the user makes the
final call at playback speed. Be explicit about that when reporting.

1. `npm run check` passes.
2. `npm run motion-check -- <Comp> --scale=2` reports **no POP, CUT or STUTTER**. Allow intentional
   cuts with `--allow=<frame>`. For each FAST warning, render that frame and confirm the moving
   edge is blurred. Read the motion timeline for dead air and rhythm.
3. Render stills and **look at them**: first frame, each element mid-entrance, peak-speed frames
   (blur visible), fully settled (crisp), mid-exit, and the **last frame** (clean).
4. Check: no text collides with the subject's face, safe zones respected, contrast holds,
   no clipped descenders (g, p, y, commas) in masked text.
5. Report what was verified and what still needs the user's eyes at full speed.

---

## Remotion gotchas

- Never use CSS `transition`/`animation` — drive everything from `useCurrentFrame()`.
- Never use `Math.random()` — use `random(seed)` from `remotion`.
- Never use `will-change` (render-tab flicker, see Smoothness system).
- **`<Presence>` owns its element's `transform` and `opacity`.** Any extra transform (centring with
  `translateX(-50%)`) or opacity (fading content) passed in `style` is silently overwritten — put it
  on an inner wrapper. This bug appeared twice in the first project (off-centre tag, labels that
  never faded).
- em-based spacing (gaps, padding) resolves against the element's own font-size: set `fontSize`
  on the container, or word gaps collapse.
- Masked text needs travel > 100% and container padding, or descenders stay visible.
- Load fonts through `@remotion/fonts` (brand your display typeface is local in `assets/fonts/`) so renders wait for them.

---

## Feedback format from the user

Notes arrive as timecode + specific issue ("0:14 title lands 3 frames late, bounce too strong").
Translate each note into token or timing changes; if a note conflicts with a law, say so and ask.

---

## What is already installed

Everything needed to cut, render, handle footage and mix audio arrived with the studio.
Nothing else to set up, and nothing for the customer to think about.

## The transcriber — installed on first use, not before

Word-by-word captions need a transcriber, and it is a large download. It is deliberately
**not** part of setup, because most people's first video does not need it and it would
double the time before they see something working.

The first time a video needs captions on the exact word, install it then — say plainly that
it is a one-time download of a couple of GB and will take a few minutes:

```bash
python --version          # needs 3.11 or 3.12 — not the newest, it is unsupported
pip install whisperx
```

If Python is missing: **python.org/downloads**, version 3.11 or 3.12, and on Windows tick
**"Add Python to PATH"** on the first screen — missing that tickbox is the single most
common failure.

**How captions actually work, and why this matters:** transcribe to find out what was *said*,
then force-align the customer's written *script* to that audio. Never use the raw transcript's
timings — the script is what goes on screen, and the alignment is what makes each word land
on the exact frame it is spoken.

## Hardware

Rendering is CPU-heavy and transcription is slower the first time while the model loads.
On a laptop, expect a 60-second video to take a few minutes to render at `--scale=2`.
If a render is too slow, drop to `--scale=1` while you are still judging the edit, and
only supersample for the final.

## When you are stuck

Every named effect lives in `src/components/` and every one of them is real, working code —
read it before inventing anything. If something you want is not there, ask for a reference
clip and a timecode, work out the technique, build it as a component in `src/components/`,
and add its name to `templates/BRIEF.md` so it can be asked for by name next time.

The studio gets updates. When new components, scripts or rules ship, run `editing_os_update`
and they are written into this project alongside your own work, which is never touched.

## Updating the studio

New effects, fixes and rules ship as releases. The studio's release is in `.studio.json`. To update,
run this inside the studio folder — add `--dry-run` first to see what it would do:

```bash
npx creator-editing-studio@latest update
```

It never touches `src/design/tokens.ts`, your videos or your footage. Every other file is sorted:
files you never edited are replaced, files you edited are kept, and a file that both you and the
release changed is left exactly as it is, with the new version saved beside it in `.studio-update/`.
Merge those keeping your changes, delete `.studio-update/`, then `npm install` if `package.json`
changed, and `npm run check`.

Do not update by copying files across or comparing them by eye. The command knows every version of
every file ever shipped, which is the only way to tell your edit from an older release.

