import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Dur} from '../design/motion';
import {maskRevealOffset, perFrame} from '../lib/animate';
import {VelocityBlur} from './VelocityBlur';

/**
 * Text that rises out of a mask (and exits upward through it), with velocity
 * motion blur. `lineHeightPx` = fontSize x lineHeight of the text inside.
 */
export const MaskReveal: React.FC<{
  at: number;
  until?: number;
  dur?: Dur;
  lineHeightPx: number;
  children: React.ReactNode;
}> = ({at, until, dur, lineHeightPx, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const offsetAt = (f: number) => maskRevealOffset({frame: f, fps, at, until, dur}) * lineHeightPx;

  return (
    // Padding gives descenders and the highlight room inside the mask.
    <span style={{display: 'inline-block', overflow: 'hidden', padding: '0.04em 0 0.16em'}}>
      <VelocityBlur
        as="span"
        vy={perFrame(offsetAt, frame)}
        style={{display: 'inline-block', transform: `translate3d(0, ${offsetAt(frame).toFixed(3)}px, 0)`}}
      >
        {children}
      </VelocityBlur>
    </span>
  );
};
