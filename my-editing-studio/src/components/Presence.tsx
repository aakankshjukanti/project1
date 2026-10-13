import React, {type CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {perFrame, presenceStyle, presenceValues, type PresenceOptions} from '../lib/animate';
import {VelocityBlur} from './VelocityBlur';

/**
 * Standard entrance/exit (see presenceValues) with velocity motion blur.
 * Renders the element itself — put its layout styles in `style`.
 */
export const Presence: React.FC<
  Omit<PresenceOptions, 'frame' | 'fps'> & {as?: 'div' | 'span'; style?: CSSProperties; children?: React.ReactNode}
> = ({as, style, children, ...options}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const valuesAt = (f: number) => presenceValues({...options, frame: f, fps});

  return (
    <VelocityBlur
      as={as}
      vx={perFrame((f) => valuesAt(f).x, frame)}
      vy={perFrame((f) => valuesAt(f).y, frame)}
      style={{...style, ...presenceStyle(valuesAt(frame))}}
    >
      {children}
    </VelocityBlur>
  );
};
