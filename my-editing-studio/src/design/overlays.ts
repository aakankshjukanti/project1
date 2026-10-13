import {PALETTE} from './tokens';

/**
 * FILM OVERLAYS — grain, halation, light leaks, gate weave, letterbox.
 *
 * These exist to add the texture a camera and a lens would have added, not to put a
 * filter on top of a video. Every strength is a token, and the defaults are deliberately
 * low: the test is that someone notices the footage looks richer, never that it looks
 * "filtered". If a viewer can name the effect, it is too strong.
 *
 * Add a look here, add its name to templates/BRIEF.md, and the user can ask for it by name.
 */

export type OverlayStrength = 'off' | 'subtle' | 'medium' | 'strong';

const SCALE: Record<OverlayStrength, number> = {off: 0, subtle: 0.5, medium: 1, strong: 1.6};
export const strengthScale = (s: OverlayStrength): number => SCALE[s];

/**
 * Grain lives at low opacity and a coarse-ish cell, so it survives platform compression.
 *
 * It composites normally rather than with `overlay`/`soft-light`. Those blend modes fade
 * to nothing at both ends of the range, and this palette is cream and ink with almost no
 * midtones — measured on a flat cream area, overlay grain came out at a standard deviation
 * of 0.000, i.e. the layer did nothing at all. Normal blending costs a barely-perceptible
 * pull toward grey and works the same on any footage.
 */
export const GRAIN = {
  /**
   * Opacity at 'medium'. Multiplied by the strength scale.
   *
   * Measured at this value: ~0.7 Y stddev on a flat area at 'medium', ~1.0 at 'strong' —
   * enough to stop flat areas banding, which is the job. It is deliberately not louder:
   * normal blending pulls the frame toward mid grey, so grain is paid for in black level
   * (blacks measured 18 → 25 at 'medium'). Turn it up per shot with the `grain` prop if a
   * nostalgia moment is worth the milkier blacks; do not raise this default to get there.
   */
  opacity: 0.045,
  /** feTurbulence base frequency — higher is finer. Fine grain is eaten by the encoder. */
  frequency: 0.72,
  /** The noise plate renders at this fraction of the frame, then scales up. Keeps it cheap. */
  renderScale: 0.28,
  /**
   * New seed every N frames. Real film holds its grain for an exposure, but anything above
   * 1 means the frame is byte-identical to the one before it, which motion-check reports as
   * a STUTTER on every other frame — so every video using a grainy look would fail its own
   * verification gate. At this opacity a fresh seed each frame is invisible anyway.
   */
  framesPerSeed: 1,
} as const;

/**
 * Halation: highlights bleeding into what is next to them, warm, never the whole frame.
 *
 * The bloom plate is a copy of the scene, crushed so that everything but the brightest
 * areas goes to black, then blurred and screened back on. The crush is the whole trick —
 * screen blending with black is a no-op, so the darks stay exactly where they were. Skip
 * it and a cream-heavy frame blooms end to end and the blacks lift to brown, which reads
 * as a filter rather than as a lens.
 */
export const HALATION = {
  /** Blur radius of the bloom plate, in px at 1080 wide. */
  blurPx: 12,
  /** Crush: contrast pushes the mids down, brightness sets how much highlight survives. */
  contrast: 2.6,
  brightness: 0.72,
  /** Warmth of the bleed — film halation is red/orange, never blue. */
  sepia: 0.45,
  saturate: 1.8,
  /** Opacity at 'medium'. */
  opacity: 0.28,
} as const;

/**
 * A slow wash of light across the frame, as if it crept past the gate. A real leak enters
 * from an edge, so this one is biased to the top and kept small — a glow in the middle of
 * the frame is not a leak, it is a smudge.
 */
export const LEAK = {
  opacity: 0.1,
  /** How long one drift cycle takes, in seconds. Slow enough that it is never a "move". */
  cycleSeconds: 9,
  warm: 'rgba(255, 186, 120, 1)',
  cool: 'rgba(255, 238, 198, 1)',
} as const;

/** Gate weave: the sub-pixel drift of film through a projector. Continuous, never random. */
export const WEAVE = {
  /** Maximum translation in px at 'medium'. Anything above ~3px reads as a shake. */
  translatePx: 1.6,
  /** Maximum rotation in degrees. */
  rotateDeg: 0.06,
  /** Two slow frequencies, so the drift never repeats on an obvious loop. */
  hz: [0.19, 0.31] as const,
} as const;

export const LETTERBOX = {
  /** Bar height as a fraction of frame height, per named ratio on a 9:16 frame. */
  ratio: {cinema: 0.11, wide: 0.07},
  color: PALETTE.ink900,
} as const;

export type FilmLook = 'none' | 'clean' | 'film' | 'super8' | 'cinema';

export const FILM_PRESETS: Record<
  FilmLook,
  {
    grain: OverlayStrength;
    halation: OverlayStrength;
    leak: OverlayStrength;
    weave: OverlayStrength;
    letterbox: keyof typeof LETTERBOX.ratio | 'off';
    note: string;
  }
> = {
  none: {grain: 'off', halation: 'off', leak: 'off', weave: 'off', letterbox: 'off', note: 'Graphics, screen recordings, anything with text as the subject.'},
  clean: {grain: 'subtle', halation: 'off', leak: 'off', weave: 'off', letterbox: 'off', note: 'Default for talking head. Just enough grain to stop flat areas banding.'},
  film: {grain: 'medium', halation: 'subtle', leak: 'off', weave: 'subtle', letterbox: 'off', note: 'B-roll and travel. The one to reach for first.'},
  super8: {grain: 'strong', halation: 'medium', leak: 'medium', weave: 'medium', letterbox: 'off', note: 'Memory / nostalgia moments only. Never a whole video.'},
  cinema: {grain: 'subtle', halation: 'medium', leak: 'off', weave: 'off', letterbox: 'cinema', note: 'A held, wide, quiet shot. Bars plus bloom, nothing that moves.'},
};
