import React from 'react';
import {AbsoluteFill, Freeze, useCurrentFrame} from 'remotion';
import {BLUR} from '../design/motion';

/**
 * Film-style motion blur, sampled symmetrically around the current frame.
 * Unlike @remotion/motion-blur's CameraMotionBlur (which samples ahead of the frame),
 * blurred and unblurred frames share the same timing, so switching blur on only
 * while things move never causes a hitch. Costs `samples`x render time while active.
 * Keep static backgrounds outside this component.
 */
export const MotionBlur: React.FC<{
  children: React.ReactNode;
  active: (frame: number) => boolean;
  shutterAngle?: number;
  samples?: number;
}> = ({children, active, shutterAngle = BLUR.shutterAngle, samples = BLUR.samples}) => {
  const frame = useCurrentFrame();

  if (!active(frame) || samples < 2 || shutterAngle <= 0) {
    return <AbsoluteFill>{children}</AbsoluteFill>;
  }

  const shutter = shutterAngle / 360;
  return (
    <AbsoluteFill style={{isolation: 'isolate'}}>
      {Array.from({length: samples}, (_, i) => (
        <AbsoluteFill key={i} style={{mixBlendMode: 'plus-lighter', filter: `opacity(${1 / samples})`}}>
          <Freeze frame={frame + (i / (samples - 1) - 0.5) * shutter}>{children}</Freeze>
        </AbsoluteFill>
      ))}
    </AbsoluteFill>
  );
};
