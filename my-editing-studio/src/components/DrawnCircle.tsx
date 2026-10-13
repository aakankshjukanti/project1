import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {COLOR} from '../design/tokens';
import {durFrames, progress} from '../lib/animate';

const SEGMENTS = 72;

/**
 * A hand-drawn loop that draws itself around a rectangle (the emphasis stroke from the
 * references). Slightly irregular and overshoots its start, like a real pen stroke.
 * Coordinates are in the parent's space.
 */
export const DrawnCircle: React.FC<{
  rect: {x: number; y: number; w: number; h: number};
  at: number;
  pad?: number;
  strokeWidth?: number;
  color?: string;
}> = ({rect, at, pad = 14, strokeWidth = 5, color = COLOR.fg}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = progress(frame, at, durFrames('slow', fps), EASE.inOut);
  if (draw <= 0) return null;

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const rx = rect.w / 2 + pad;
  const ry = rect.h / 2 + pad;
  const startAngle = -0.62 * Math.PI;
  const sweep = 2.1 * Math.PI;
  const points = Array.from({length: SEGMENTS + 1}, (_, i) => {
    const t = i / SEGMENTS;
    const a = startAngle + sweep * t;
    // Gentle wobble + a slow spiral outward, so the end overshoots the start.
    const wobble = 1 + 0.03 * Math.sin(2 * a + 1) + 0.015 * Math.sin(5 * a) + 0.05 * t;
    return `${(cx + Math.cos(a) * rx * wobble).toFixed(2)},${(cy + Math.sin(a) * ry * wobble).toFixed(2)}`;
  });

  return (
    <svg style={{position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible'}}>
      <polyline
        points={points.join(' ')}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        strokeDashoffset={1 - draw}
      />
    </svg>
  );
};
