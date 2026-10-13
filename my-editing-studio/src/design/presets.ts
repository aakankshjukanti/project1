import type {Dur} from './motion';
import {COLOR, RADIUS} from './tokens';

/**
 * PRESETS — named looks and transitions, so a brief can say "whip pan here" or
 * "block captions" instead of describing it every time.
 *
 * Every preset is built from the motion tokens, so they all obey the same laws.
 * Add one here, add its name to templates/BRIEF.md, and it becomes something the
 * user can ask for by name.
 */

export type TransitionKind =
  /** Fast pan with motion blur — energy, no meaning. Good between unrelated shots. */
  | 'whipPan'
  /** The new scene pushes the old one out. Direction carries the story forward. */
  | 'push'
  /** A soft-edged wipe reveals the next scene. Calm, premium. */
  | 'maskWipe'
  /** A hard cut to a solid accent screen, then to the next scene. A burst, used on a phrase. */
  | 'colourFlip'
  /** Both scenes share a shape or motion; the cut lands inside the movement. */
  | 'matchCut'
  /** Quick dip through the background colour. The quietest way to change subject. */
  | 'dip';

export type TransitionDirection = 'left' | 'right' | 'up' | 'down';

export const TRANSITION_PRESETS: Record<
  TransitionKind,
  {dur: Dur; travel: number; blur: boolean; scale?: number; flash?: string; note: string}
> = {
  whipPan: {dur: 'fast', travel: 1.0, blur: true, note: 'Between unrelated shots. Never twice in a row.'},
  push: {dur: 'base', travel: 1.0, blur: true, note: 'Moving forward through a list or a sequence.'},
  maskWipe: {dur: 'slow', travel: 0.35, blur: false, note: 'Calm reveal. Pairs with a soft sound.'},
  colourFlip: {dur: 'instant', travel: 0, blur: false, flash: COLOR.accent, note: 'A burst on a phrase. Two or three, then back to smooth.'},
  matchCut: {dur: 'base', travel: 0.12, blur: true, scale: 1.08, note: 'Only when both shots share a shape or a direction.'},
  dip: {dur: 'fast', travel: 0, blur: false, flash: COLOR.surfaceAlt, note: 'Changing subject without drama.'},
};

export type CaptionVariant =
  /** Crisp white with a soft shadow. The default. */
  | 'clean'
  /** Each word on an accent block. Loud, good on busy footage. */
  | 'block'
  /** The spoken word is accent-coloured, the rest stays white. */
  | 'highlight'
  /** Words arrive with a small scale pop. Use on fast, energetic cuts. */
  | 'pop';

export const CAPTION_PRESETS: Record<
  CaptionVariant,
  {activeColor?: string; background?: string; padding?: string; radius?: number; scaleFrom?: number; note: string}
> = {
  clean: {note: 'Default. Works over almost anything.'},
  block: {
    background: COLOR.accent,
    activeColor: COLOR.fg,
    padding: '0.06em 0.22em',
    radius: RADIUS.sm,
    note: 'Busy or bright footage, where white alone would get lost.',
  },
  highlight: {activeColor: COLOR.accent, note: 'Keeps the eye on the word being said right now.'},
  pop: {scaleFrom: 0.94, note: 'Fast edits. Do not combine with heavy motion behind the text.'},
};
