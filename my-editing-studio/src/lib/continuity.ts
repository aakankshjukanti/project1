import {interpolate} from 'remotion';
import {EASE, TRANSITION, type Dur} from '../design/motion';
import {durFrames, msToFrames, type Place} from './animate';

/**
 * Continuity helpers — what keeps beats feeling connected instead of cut together.
 */

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** How many frames consecutive beats overlap. */
export const overlapFrames = (fps: number): number => msToFrames(TRANSITION.idealOverlapMs, fps);

/** Start of the next beat: before the previous one has settled, never after. */
export const nextBeatAt = (prevSettledAt: number, fps: number): number => prevSettledAt - overlapFrames(fps);

/**
 * Velocity handoff: where the next entrance should come from so it continues
 * the direction of the previous exit. Exit upward -> next enters from below.
 */
export const handoff = (exitTo: Place): Place =>
  ({above: 'below', below: 'above', left: 'right', right: 'left', none: 'none'} as const)[exitTo];

export type Keyframe<K extends string> = {at: number; to: Record<K, number>; dur?: Dur};

const checkOrder = <K extends string>(keys: Keyframe<K>[], fps: number): Keyframe<K>[] => {
  const list = [...keys].sort((a, b) => a.at - b.at);
  list.forEach((k, i) => {
    const prev = list[i - 1];
    if (prev && k.at < prev.at + durFrames(prev.dur ?? 'scene', fps)) {
      throw new Error(`Keyframe at frame ${k.at} starts before the previous move finishes.`);
    }
  });
  return list;
};

/**
 * A value that moves through a series of states over time (e.g. a video that goes
 * full screen -> card -> full screen). Each move eases in-out from wherever the
 * previous move ended, so the element is never reset or re-entered.
 */
export const sequence = <K extends string>(
  frame: number,
  fps: number,
  start: Record<K, number>,
  keys: Keyframe<K>[],
): Record<K, number> => {
  let current = start;
  for (const k of checkOrder(keys, fps)) {
    if (frame <= k.at) break;
    current = morph(frame, fps, k.at, current, k.to, k.dur);
    if (frame < k.at + durFrames(k.dur ?? 'scene', fps)) break;
  }
  return current;
};

/** Where a sequence is heading: its destination if a move is in progress, else its current state. */
export const sequenceTarget = <K extends string>(
  frame: number,
  fps: number,
  start: Record<K, number>,
  keys: Keyframe<K>[],
): Record<K, number> => {
  const moving = checkOrder(keys, fps).find((k) => frame >= k.at && frame < k.at + durFrames(k.dur ?? 'scene', fps));
  return moving ? moving.to : sequence(frame, fps, start, keys);
};

/**
 * Shared-element morph: interpolate any numeric properties (x, y, width, radius...)
 * between two layouts. The element never exits and re-enters.
 */
export const morph = <K extends string>(
  frame: number,
  fps: number,
  at: number,
  from: Record<K, number>,
  to: Record<K, number>,
  dur: Dur = 'scene',
): Record<K, number> => {
  const p = interpolate(frame - at, [0, durFrames(dur, fps)], [0, 1], {...clamp, easing: EASE.inOut});
  const out = {} as Record<K, number>;
  for (const key of Object.keys(from) as K[]) {
    out[key] = from[key] + (to[key] - from[key]) * p;
  }
  return out;
};
