import React, {type CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {perFrame, progress} from '../lib/animate';
import {VelocityBlur} from './VelocityBlur';

/**
 * Morph into state — one element becoming its next state, in place.
 *
 * The approved beat. When something changes meaning — a row that is clicked and confirmed, a
 * button that becomes a success pill, a card that becomes a badge — the element itself stretches,
 * recolours and swaps its contents. It is never covered by a second element that happens to sit
 * in the same place, and it never fades out while a replacement fades in.
 *
 * This is the single change that most reliably makes a sequence feel connected rather than
 * assembled, because the viewer's eye stays on one object for the whole move instead of being
 * handed off between two.
 *
 * What morphs: width, height, corner radius, background and text colour. The children cross-fade
 * across the middle of the move — late enough that the shape has already started changing, so the
 * swap reads as the same object relabelling itself rather than a cut.
 *
 * Travel is velocity-blurred, because nothing fast should be sharp.
 */

export type MorphFace = {
  width: number;
  height: number;
  radius?: number;
  background?: string;
  colour?: string;
  children?: React.ReactNode;
};

export const MorphState: React.FC<{
  /** The state it starts in. */
  from: MorphFace;
  /** The state it becomes. */
  to: MorphFace;
  /** Frame the morph begins, relative to the enclosing sequence. */
  at: number;
  /** How long the morph takes. Default 0.4s — long enough to read, short enough to feel decisive. */
  frames?: number;
  style?: CSSProperties;
}> = ({from, to, at, frames, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dur = frames ?? Math.round(0.4 * fps);

  // One curve drives every property, so nothing arrives out of step with anything else.
  const p = (f: number) => progress(f, at, dur, EASE.emphasis);
  const t = p(frame);

  const mix = (a: number, b: number) => a + (b - a) * t;
  const width = mix(from.width, to.width);
  const height = mix(from.height, to.height);
  const radius = mix(from.radius ?? 999, to.radius ?? 999);

  /**
   * Contents swap across the middle 40% of the move. Swapping at the very start shows the new
   * label in the old shape; swapping at the end looks like a glitch on arrival.
   */
  const swap = Math.max(0, Math.min(1, (t - 0.3) / 0.4));

  // Width is what actually travels here, so that is what the blur is sized from.
  const vx = perFrame((f) => mix2(from.width, to.width, p(f)), frame);
  const vy = perFrame((f) => mix2(from.height, to.height, p(f)), frame);

  return (
    <VelocityBlur
      vx={vx}
      vy={vy}
      bleed={0.4}
      style={{
        ...style,
        width,
        height,
        borderRadius: radius,
        // Backgrounds cross-fade by stacking, which handles gradients and alpha correctly where
        // a numeric colour interpolation would not.
        backgroundColor: from.background,
        position: 'relative',
        overflow: 'hidden',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: to.background,
          opacity: t,
        }}
      />
      <Face opacity={1 - swap} colour={from.colour}>
        {from.children}
      </Face>
      <Face opacity={swap} colour={to.colour}>
        {to.children}
      </Face>
    </VelocityBlur>
  );
};

const mix2 = (a: number, b: number, t: number) => a + (b - a) * t;

/** One of the two labels, centred and clipped to the shape. */
const Face: React.FC<{opacity: number; colour?: string; children?: React.ReactNode}> = ({opacity, colour, children}) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        opacity,
        color: colour,
        whiteSpace: 'nowrap',
        // Never opacity alone: the outgoing label drifts back slightly as it goes.
        transform: `scale(${0.97 + opacity * 0.03})`,
      }}
    >
      {children}
    </div>
  );
};
