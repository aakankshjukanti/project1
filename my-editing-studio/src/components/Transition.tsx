import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {TRANSITION_PRESETS, type TransitionDirection, type TransitionKind} from '../design/presets';
import {durFrames, perFrame, progress} from '../lib/animate';
import {VelocityBlur} from './VelocityBlur';

/**
 * A named transition between two scenes, built from the motion tokens.
 *
 *   <Transition kind="whipPan" at={cut} direction="left" from={<SceneA />} to={<SceneB />} />
 *
 * The outgoing scene is shown before `at`, the incoming after, and the named preset decides
 * how they hand over. Anything that moves fast carries motion blur, so no hard edge ever
 * jumps across the frame unblurred (law 10).
 */
export const Transition: React.FC<{
  kind: TransitionKind;
  /** Frame the cut lands on. */
  at: number;
  direction?: TransitionDirection;
  from: React.ReactNode;
  to: React.ReactNode;
}> = ({kind, at, direction = 'left', from, to}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const preset = TRANSITION_PRESETS[kind];
  const dur = durFrames(preset.dur, fps);

  // The move is centred on the cut: half before, half after.
  const start = at - Math.round(dur / 2);
  const p = progress(frame, start, dur, EASE.inOut);
  const velocity = perFrame((f) => progress(f, start, dur, EASE.inOut), frame);

  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const span = (axis === 'x' ? width : height) * preset.travel;

  const shift = (amount: number) =>
    axis === 'x' ? `translateX(${amount.toFixed(2)}px)` : `translateY(${amount.toFixed(2)}px)`;

  const before = p < 1;
  const after = p > 0;

  /* ---------------------------------------------------------------- flash-based presets */

  if (preset.flash) {
    // colourFlip / dip: a hard cut through a solid frame, no sliding.
    const half = dur / 2;
    const showFlash = frame >= start && frame < start + dur;
    const showTo = frame >= start + half;
    return (
      <AbsoluteFill>
        {showTo ? to : from}
        {showFlash ? <AbsoluteFill style={{backgroundColor: preset.flash}} /> : null}
      </AbsoluteFill>
    );
  }

  /* ---------------------------------------------------------------- moving presets */

  // motion-ok: #000 is mask opacity here, not a design colour.
  const maskEdge = `linear-gradient(${axis === 'x' ? (sign < 0 ? 'to left' : 'to right') : sign < 0 ? 'to top' : 'to bottom'}, #000 ${(p * 100).toFixed(1)}%, transparent ${(p * 100 + 12).toFixed(1)}%)`;

  const outStyle: React.CSSProperties =
    kind === 'maskWipe'
      ? {opacity: 1}
      : kind === 'matchCut'
        ? {transform: `scale(${(1 + (preset.scale! - 1) * p).toFixed(4)})`, opacity: 1 - p}
        : {transform: shift(sign * span * p)};

  const inStyle: React.CSSProperties =
    kind === 'maskWipe'
      ? {
          // A soft-edged wipe: the leading edge softens instead of cutting hard.
          // motion-ok: #000 here is mask opacity, not a design colour.
          WebkitMaskImage: maskEdge,
          maskImage: maskEdge,
        }
      : kind === 'matchCut'
        ? {transform: `scale(${(1 + (preset.scale! - 1) * (1 - p)).toFixed(4)})`, opacity: p}
        : {transform: shift(-sign * span * (1 - p))};

  const speed = velocity * span;
  const wrap = (node: React.ReactNode, style: React.CSSProperties) =>
    preset.blur ? (
      <VelocityBlur vx={axis === 'x' ? speed : 0} vy={axis === 'y' ? speed : 0}>
        <AbsoluteFill style={style}>{node}</AbsoluteFill>
      </VelocityBlur>
    ) : (
      <AbsoluteFill style={style}>{node}</AbsoluteFill>
    );

  return (
    <AbsoluteFill>
      {before ? wrap(from, outStyle) : null}
      {after ? wrap(to, inStyle) : null}
    </AbsoluteFill>
  );
};
