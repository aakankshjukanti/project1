import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BACKGROUND} from '../design/tokens';

/** Cream base, soft accent glow, faint fading grid — the site's hero treatment adapted for vertical video. */
export const BrandBackground: React.FC = () => {
  const {gridLine, gridSize, gridLineWidth, gridMask} = BACKGROUND;
  const lines = (angle: number) =>
    `repeating-linear-gradient(${angle}deg, ${gridLine} 0 ${gridLineWidth}px, transparent ${gridLineWidth}px ${gridSize}px)`;

  return (
    <AbsoluteFill style={{background: BACKGROUND.creamGlow}}>
      <AbsoluteFill
        style={{
          backgroundImage: `${lines(0)}, ${lines(90)}`,
          maskImage: gridMask,
          WebkitMaskImage: gridMask,
        }}
      />
    </AbsoluteFill>
  );
};
