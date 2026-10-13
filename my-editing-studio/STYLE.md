<!-- This is YOUR style guide, and it starts deliberately half-empty.

     Parts 1 to 6 are craft standards: things that hold for any brand, most of them
     measured rather than argued. Leave them alone until you have a reason not to, and
     your edits will come out clean rather than random.

     Parts 7 and 8 are yours and begin blank. Every time you approve or reject something,
     write it down there. That is the half that makes edits look like YOURS instead of
     merely competent, and it is the half nobody can hand you. -->

# House style

What every edit must look, move and sound like. `CLAUDE.md` says *how* to build; this
file says *what it must come out like*.

When this file and a reference disagree, this file wins unless you say otherwise.

---

## 1. Your identity

Everything visual comes from `src/design/tokens.ts`. That file is the single source of
your typeface, your colours, your spacing and your type scale — change it there and every
video changes with it. Never hard-code a colour or a font family into a composition.

- **Type (matched to Edit_ref_1.mp4 by eye, not identified from the source):** Anton for heavy titles, one weight, capitals, never a faked bold. Playfair Display for spoken captions. Kaushan Script for brush accent words (e.g. "GO TO EDITS", "ABSOLUTELY"), used sparingly.
- **Palette:** red #D80000 and yellow #F8BC3C, sampled from the reference, plus white and near-black (#111). Red is the lead; yellow is for lead-in words and the second half of two-tone titles.
- **Type (original note):** one display typeface. Heavy weights for headlines, numbers and hero words;
  medium for labels and pointers.
- **Colour (default guidance, overridden above: this brand uses red + yellow from its reference):** one accent, plus ink and a light ground. Resist a second accent — two
  accents read as a template, one reads as a brand.
- On footage: accent text, with a soft glow so it survives a busy frame.
- On a light ground: ink text, with the accent used only to mark the word that matters.

## 2. Type scale

Sizes are a starting ladder, not a law. What matters is that you keep to *a* ladder.

| Role | 16:9 (1920x1080) | 9:16 (1080x1920) | Notes |
|---|---|---|---|
| Hero word | 200–320px | 130–220px | One on screen at a time, never two |
| Headline | ~116px | ~100px | Tight tracking, around -0.03em |
| Big number | ~170px | ~150px | Tabular digits while a counter runs |
| Label / eyebrow | ~40px | ~32px | Uppercase, open tracking, ~0.14em |
| Pointer / list item | ~42px | ~36px | |
| Captions | 46px | 42px | Crisp white, bold, soft dark shadow |

**If a word needs to be bigger than the ladder to feel important, the layout is wrong,
not the size.** Oversized type is the most common way an edit starts looking amateur.

## 3. Layout

- **The speaker stays full screen by default.** Rounded cards and frames around a talking
  head make the edit look assembled rather than shot. A card is fine as a *transition*,
  not as a container.
- Put text in the clear space the shot already gives you: sky, a wall, out-of-focus
  background. Check where the head lands on every cut before committing a position.
- Captions live in one consistent zone per layout, over a dark area. They hide while the
  same words are on screen as a graphic, and never linger into the next scene.
- Graphics are built from type, numbers, real screenshots and real footage. Decorative
  shapes that mean nothing age badly and read as filler.

## 4. Motion

- The motion laws in `CLAUDE.md`, always. Eased, motion-blurred, nothing pops into place.
- **Zoom through jump cuts.** A small push on the cut hides the join; a hard snap exposes it.
- **Hard cuts only as a deliberate burst** — a few beats of solid colour synced to the
  words, then back to smooth. Everything else morphs from one state to the next.
- Cover anything off-camera — reading, looking away, a fumble — with a graphic or a cut.
- Counters start at zero and only go up. No grey placeholder digits.
- Vary your shot lengths. Cutting everything to the same duration is the clearest sign
  an edit was made by a machine rather than by someone making decisions.

## 5. Sound (half the reel)

- **The voice is never processed.** No reverb, no heavy compression, no "enhancement".
- Sound effects are short — whooshes 0.4–0.8s, hits 0.3–0.6s — faded, and placed in the
  gaps between words rather than under them.
- Every new visual gets its own fitting sound. Reusing a sound that belonged to a
  different look is the audio version of a template.
- **Subtle beats loud.** Big cinematic impacts on text almost always read as too much.
- Hand over voice and SFX stems plus a timecoded cue sheet with every delivery.

## 6. Colour, film looks and presets

**Most of a look comes from the shoot, not the grade.** Golden hour or one good window,
light behind or beside the subject, background well behind the subject, white balance
fixed rather than auto. Automated grading is a starting point and only when the footage's
light already resembles the reference — on mismatched light it will look wrong, and you
should trust your eye over any automatic match.

| Transition | When |
|---|---|
| whipPan | Between unrelated shots. Never twice in a row. |
| push | Moving forward through a list or a sequence. |
| maskWipe | A calm reveal. Pairs with a soft sound. |
| colourFlip | A burst on a phrase. Two or three, then back to smooth. |
| matchCut | Only when both shots share a shape or a direction. |
| dip | Changing subject without drama. |

| Caption look | When |
|---|---|
| clean | Default. Works over almost anything. |
| block | Busy or bright footage, where white alone gets lost. |
| highlight | Keeps the eye on the word being spoken. |
| pop | Fast edits. Not over heavy motion. |

| Film look | When |
|---|---|
| none | Graphics, screen recordings, anything where text is the subject. |
| clean | Default for a talking head. Enough grain to stop flat areas banding. |
| film | B-roll and travel. The one to reach for first. |
| super8 | Memory and nostalgia moments only. Never a whole video. |
| cinema | A held, wide, quiet shot. |

**Three things here were measured, not guessed. Do not quietly undo them:**

- Grain composites **normally**, not with `overlay`. On flat cream or flat ink there are
  no midtones, and overlay grain measures 0.000 stddev — the layer does nothing at all.
- Grain is paid for in black level — blacks lift measurably at medium strength. Raise it
  per shot when a nostalgia moment is worth milkier blacks; never raise the default.
- Halation blooms **highlights only**. The plate is crushed to black before it is blurred
  and screened back. Without that crush, a bright frame blooms end to end and the blacks
  go brown.

Speed ramps are eased, never a hard speed switch. Below 0.4x needs 50fps or higher source
footage — you cannot rescue slow motion that was not shot for it.

---

## 7. Where these defaults end and you begin

The sections above are **defaults**: a starting point tuned so that a video made on day one,
before you have told the system anything, comes out clean rather than embarrassing. Captions
sit at a readable size with a measured shadow, cuts are eased, grain is restrained, the voice
is untouched.

Defaults are also the reason an edit can come out *anonymous*. They are what everybody gets.
Three things move an edit from the default toward yours, in increasing order of power:

**1. Your tokens.** `src/design/tokens.ts` carries your typeface, your colours, your scale.
This makes an edit *yours to look at* immediately.

**2. Your references.** Saved moments from edits you admire, each with a timecode and a note
on what you like about that exact moment. These are read before the plan for every video, and
they beat the defaults wherever the two disagree — a default is a guess that suits everyone,
a reference is a fact about you.

Roughly: **none** gives you clean and forgettable. **Three** is enough to spot a pattern.
**Seven or eight** is enough to tell a preference from a coincidence, and it is where edits
start looking authored.

**3. This file, as it fills up.** Sections 8 and 9 are the part no default can supply and no
competitor can copy, because they are a record of decisions only you have made. Every entry
narrows the next edit toward what you actually want.

Nothing here learns on its own. It gets better because the brief gets richer — so the ten
minutes spent writing down why you rejected something is the highest-return ten minutes
available to you.

---

## 8. Approved (your effects library)

<!-- Empty on purpose. When something works, write it down here: what it is, and where
     you approved it. Next time you can ask for it by name instead of describing it
     again, and every future video inherits the decision. -->

| Beat | What it is | Where you approved it |
|---|---|---|
| | | |

## 9. Rejected (don't do these again)

<!-- This table is worth more than the one above. A list of things you have ruled out is
     the fastest way to stop an edit drifting back toward generic, because it removes
     options rather than adding them. Add a line every time you say "not that". -->

| What | Why | Where |
|---|---|---|
| | | |
