import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {perFrame} from '../lib/animate';
import {sequence, type Keyframe} from '../lib/continuity';
import {VelocityBlur} from './VelocityBlur';

/** A camera on a screenshot: top-left image pixel (x, y) and content px per image px. */
export type ViewKey = 'x' | 'y' | 'scale';
export type View = Record<ViewKey, number>;

/**
 * A screenshot inside a frame (e.g. a browser window) that pans and zooms between views.
 * Children are overlays positioned in the screenshot's own pixels, so annotations stay glued
 * to the content while it moves.
 */
export const ScreenView: React.FC<{
  src: string;
  width: number;
  height: number;
  start: View;
  keys?: Keyframe<ViewKey>[];
  children?: React.ReactNode;
}> = ({src, width, height, start, keys = [], children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const viewAt = (f: number) => sequence(f, fps, start, keys);
  const v = viewAt(frame);

  return (
    <VelocityBlur
      bleed={0}
      vx={perFrame((f) => -viewAt(f).x * viewAt(f).scale, frame)}
      vy={perFrame((f) => -viewAt(f).y * viewAt(f).scale, frame)}
      style={{position: 'absolute', inset: 0, overflow: 'hidden'}}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          transformOrigin: '0 0',
          transform: `translate3d(${(-v.x * v.scale).toFixed(3)}px, ${(-v.y * v.scale).toFixed(3)}px, 0) scale(${v.scale.toFixed(5)})`,
        }}
      >
        <Img src={staticFile(src)} style={{display: 'block', width, height}} />
        {children}
      </div>
    </VelocityBlur>
  );
};
