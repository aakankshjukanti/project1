import {Easing} from 'remotion';

/**
 * MOTION TOKENS
 * The ONLY file where timing, curves and springs are defined.
 * Durations are milliseconds so the system works at 30 or 60 fps —
 * convert with msToFrames()/durFrames() from src/lib/animate.ts.
 */

export const DUR = {
  instant: 133, // micro state changes
  fast: 267, // small elements
  base: 400, // standard element entrance
  slow: 600, // hero elements, long travel, line draws
  scene: 800, // camera moves, scene handoffs
  drift: 2400, // slow push-ins on the footage
} as const;
export type Dur = keyof typeof DUR;

/** Raw cubic-bezier control points (also usable for After Effects handoff). */
export const CURVE = {
  out: [0.16, 1, 0.3, 1], // entrances — brand --ease-out-expo
  outDecisive: [0.22, 1, 0.36, 1], // slightly softer landing than expo
  outSoft: [0.33, 1, 0.68, 1], // gentle entrances, opacity
  in: [0.64, 0, 0.78, 0], // exits
  inOut: [0.65, 0, 0.35, 1], // A-to-B moves while on screen
  emphasis: [0.2, 0, 0, 1], // hero moments
  overshoot: [0.34, 1.56, 0.64, 1], // brand --ease-spring; scale only, sparingly
} as const;
export type Curve = keyof typeof CURVE;

export const EASE: Record<Curve, (t: number) => number> = {
  out: Easing.bezier(...CURVE.out),
  outDecisive: Easing.bezier(...CURVE.outDecisive),
  outSoft: Easing.bezier(...CURVE.outSoft),
  in: Easing.bezier(...CURVE.in),
  inOut: Easing.bezier(...CURVE.inOut),
  emphasis: Easing.bezier(...CURVE.emphasis),
  overshoot: Easing.bezier(...CURVE.overshoot),
};

export const SPRING = {
  snap: {damping: 200, mass: 0.5, stiffness: 200}, // settles, no bounce
  soft: {damping: 26, mass: 1, stiffness: 120}, // slight overshoot
} as const;
export type SpringKind = keyof typeof SPRING;

/** Delay between items in a group. */
export const STAGGER = {
  tight: 67, // ~2 frames @30fps
  normal: 100, // ~3 frames @30fps
  dramatic: 167, // ~5 frames @30fps
} as const;
export type StaggerKind = keyof typeof STAGGER;

/** Exits run at this fraction of the matching entrance duration (law 3). */
export const EXIT_RATIO = 0.65;

/** Opacity completes at this fraction of the transform duration (law 5). */
export const OPACITY_LEAD = 0.6;

export const LIMITS = {
  minScaleFrom: 0.9, // never scale from below this (law 6)
  maxBlurPx: 12, // blur-in cap (law 7)
  defaultTravelPx: 16, // default entrance offset
  maxTravelPx: 48, // element entrances, not camera moves
  referenceTravelPx: 200, // distance that maps to DUR.base (law 9)
  motionBlurFrameWidthShare: 0.15, // needs motion blur above this travel within DUR.fast (law 10)
} as const;

/** Minimum on-screen time for readable text (law 11). */
export const READ = {
  minHoldMs: 900,
  baseMs: 250,
  perWordMs: 55,
} as const;

/** Film-style motion blur for camera moves and fast elements (law 10). */
export const BLUR = {
  shutterAngle: 180, // classic film look: blur spans half the frame interval
  samples: 10, // render cost multiplier while active
} as const;

/** Scene handoffs overlap, never gap (continuity rules). */
export const TRANSITION = {
  minOverlapMs: 133,
  idealOverlapMs: 200,
  sfxLeadMs: 133, // whoosh starts this early
  sfxTailMs: 267, // and tails this long after the change
} as const;
