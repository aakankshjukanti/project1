import type {CSSProperties} from 'react';
import {interpolate, measureSpring, spring} from 'remotion';
import {
  DUR,
  EASE,
  EXIT_RATIO,
  LIMITS,
  OPACITY_LEAD,
  READ,
  SPRING,
  STAGGER,
  type Dur,
  type SpringKind,
  type StaggerKind,
} from '../design/motion';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const msToFrames = (ms: number, fps: number): number =>
  Math.max(1, Math.round((ms / 1000) * fps));

export const durFrames = (dur: Dur, fps: number): number => msToFrames(DUR[dur], fps);

/** Exit length for an element that entered with `dur` (law 3). */
export const exitFrames = (dur: Dur, fps: number): number =>
  Math.max(1, Math.round(durFrames(dur, fps) * EXIT_RATIO));

export const staggerFrames = (index: number, fps: number, kind: StaggerKind = 'normal'): number =>
  index * msToFrames(STAGGER[kind], fps);

/** How long a piece of text must stay fully visible (law 11). */
export const readFrames = (text: string, fps: number): number => {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return msToFrames(Math.max(READ.minHoldMs, READ.baseMs + READ.perWordMs * words), fps);
};

/** Sub-linear distance-to-duration coupling (law 9). */
export const travelFrames = (px: number, fps: number): number => {
  const ms = DUR.base * Math.sqrt(Math.abs(px) / LIMITS.referenceTravelPx);
  return msToFrames(Math.min(DUR.scene, Math.max(DUR.fast, ms)), fps);
};

/** Spring driven by a token config; returns 0 to 1. */
export const settle = (frame: number, fps: number, at: number, kind: SpringKind = 'snap'): number =>
  spring({frame: frame - at, fps, config: SPRING[kind]});

export const springFrames = (fps: number, kind: SpringKind = 'snap'): number =>
  measureSpring({fps, config: SPRING[kind]});

/** 0 to 1 progress for draw-ons, counters, wipes — always eased. */
export const progress = (frame: number, at: number, frames: number, easing = EASE.out): number =>
  interpolate(frame - at, [0, frames], [0, 1], {...clamp, easing});

/** Rate of change per frame of any frame-driven value (drives velocity motion blur). */
export const perFrame = (fn: (frame: number) => number, frame: number): number =>
  fn(frame + 0.5) - fn(frame - 0.5);

/**
 * Vertical offset for text rising from behind a mask, as a fraction of the line height.
 * 1.3 (not 1.0) so descenders (g, p, y, commas) fully clear the mask.
 * Prefer the <MaskReveal> component, which adds the mask and motion blur.
 */
export const maskRevealOffset = ({
  frame,
  fps,
  at,
  until,
  dur = 'slow',
}: {
  frame: number;
  fps: number;
  at: number;
  until?: number;
  dur?: Dur;
}): number => {
  const travel = 1.3;
  let y = (1 - progress(frame, at, durFrames(dur, fps), EASE.out)) * travel;
  if (until !== undefined) {
    y -= progress(frame, until, exitFrames(dur, fps), EASE.in) * travel;
  }
  return y;
};

/**
 * Left-to-right reveal mask with a motion-blurred leading edge: the edge softens in
 * proportion to its speed (180-degree shutter), so fast wipes don't strobe.
 * `p` is 0-1 progress; `pPerFrame` its change per frame (use perFrame()).
 */
export const wipeMask = (p: number, pPerFrame: number): CSSProperties => {
  const feather = Math.abs(pPerFrame) * 100 * 0.5;
  const edge = p * (100 + feather);
  const mask = `linear-gradient(90deg, black ${(edge - feather).toFixed(3)}%, transparent ${edge.toFixed(3)}%)`;
  return {maskImage: mask, WebkitMaskImage: mask};
};

export type Place = 'below' | 'above' | 'left' | 'right' | 'none';

const placeOffset = (place: Place, px: number): [number, number] => {
  switch (place) {
    case 'below':
      return [0, px];
    case 'above':
      return [0, -px];
    case 'left':
      return [-px, 0];
    case 'right':
      return [px, 0];
    default:
      return [0, 0];
  }
};

export type PresenceOptions = {
  frame: number;
  fps: number;
  /** Frame the entrance starts. */
  at: number;
  /** Frame the exit starts. Omit to stay on screen. */
  until?: number;
  dur?: Dur;
  from?: Place;
  exitTo?: Place;
  /** Pixels of travel; clamped to LIMITS.maxTravelPx. */
  distance?: number;
  /** Clamped to >= LIMITS.minScaleFrom. */
  scaleFrom?: number;
  /** Pixels; clamped to LIMITS.maxBlurPx. */
  blur?: number;
};

export type PresenceValues = {x: number; y: number; scale: number; opacity: number; blur: number};

/**
 * Standard entrance + exit values for any element, following the motion laws:
 * ease-out in, ease-in out, exits faster than entrances, opacity leads the
 * transform, never opacity alone, bounded scale and blur.
 * Prefer the <Presence> component, which adds velocity motion blur.
 */
export const presenceValues = ({
  frame,
  fps,
  at,
  until,
  dur = 'base',
  from = 'below',
  exitTo = 'above',
  distance = LIMITS.defaultTravelPx,
  scaleFrom = 1,
  blur = 0,
}: PresenceOptions): PresenceValues => {
  const travel = Math.min(Math.abs(distance), LIMITS.maxTravelPx);
  const s0 = Math.min(1, Math.max(LIMITS.minScaleFrom, scaleFrom));
  const b0 = Math.min(LIMITS.maxBlurPx, Math.max(0, blur));

  const inDur = durFrames(dur, fps);
  const t = frame - at;
  const p = interpolate(t, [0, inDur], [0, 1], {...clamp, easing: EASE.out});
  let opacity = interpolate(t, [0, Math.max(1, Math.round(inDur * OPACITY_LEAD))], [0, 1], {
    ...clamp,
    easing: EASE.outSoft,
  });
  const blurPx = interpolate(t, [0, Math.max(1, Math.round(inDur * 0.8))], [b0, 0], {
    ...clamp,
    easing: EASE.out,
  });

  const [fx, fy] = placeOffset(from, travel);
  let x = fx * (1 - p);
  let y = fy * (1 - p);
  const scale = s0 + (1 - s0) * p;

  if (until !== undefined) {
    const outDur = exitFrames(dur, fps);
    const u = frame - until;
    const q = interpolate(u, [0, outDur], [0, 1], {...clamp, easing: EASE.in});
    const fade = interpolate(u, [Math.round(outDur * 0.4), outDur], [1, 0], {...clamp, easing: EASE.in});
    const [ex, ey] = placeOffset(exitTo, travel);
    x += ex * q;
    y += ey * q;
    opacity *= fade;
  }

  return {x, y, scale, opacity, blur: blurPx};
};

/** Style for presence values (no motion blur). */
export const presenceStyle = (v: PresenceValues): CSSProperties => ({
  opacity: v.opacity,
  transform: `translate3d(${v.x.toFixed(3)}px, ${v.y.toFixed(3)}px, 0) scale(${v.scale.toFixed(4)})`,
  filter: v.blur > 0.01 ? `blur(${v.blur.toFixed(2)}px)` : undefined,
});

/** Presence as a plain style, for elements that barely move. Prefer <Presence>. */
export const presence = (options: PresenceOptions): CSSProperties => presenceStyle(presenceValues(options));
