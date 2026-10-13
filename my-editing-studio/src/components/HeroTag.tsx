import React from 'react';
import {interpolateColors, useCurrentFrame, useVideoConfig} from 'remotion';
import {withAlpha} from '../design/color';
import {heroGlow} from '../design/glow';
import {COLOR, FONT, HERO, RADIUS, TYPE} from '../design/tokens';
import {perFrame} from '../lib/animate';
import {morph} from '../lib/continuity';
import {Presence} from './Presence';
import {VelocityBlur} from './VelocityBlur';

/**
 * A big glowing accent headline that later shrinks into a small corner pill and stays on screen
 * as a section label (the element is never removed and re-added — it becomes the tag).
 * Place it between the stage video and the stage cutout to sit behind the subject.
 */
export const HeroTag: React.FC<{
  words: string[];
  /** Frame each word appears (spoken time). */
  wordAt: number[];
  shrinkAt: number;
  big: {centerX: number; top: number; size?: number};
  pill: {x: number; y: number; scale: number};
  until?: number;
}> = ({words, wordAt, shrinkAt, big, pill, until}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stateAt = (f: number) =>
    morph(
      f,
      fps,
      shrinkAt,
      {left: big.centerX, top: big.top, shift: -50, scale: 1, chrome: 0},
      {left: pill.x, top: pill.y, shift: 0, scale: pill.scale, chrome: 1},
    );
  const s = stateAt(frame);
  const border = 2 / pill.scale;

  return (
    <Presence at={wordAt[0]} until={until} dur="fast" from="none" style={{position: 'absolute', inset: 0}}>
      <VelocityBlur
        vx={perFrame((f) => stateAt(f).left, frame)}
        vy={perFrame((f) => stateAt(f).top, frame)}
        style={{
          position: 'absolute',
          left: s.left,
          top: s.top,
          transformOrigin: '0 0',
          transform: `translateX(${s.shift.toFixed(3)}%) scale(${s.scale.toFixed(5)})`,
          display: 'inline-flex',
          alignItems: 'center',
          whiteSpace: 'nowrap',
          padding: `${(0.22 * s.chrome).toFixed(4)}em ${(0.55 * s.chrome).toFixed(4)}em`,
          borderRadius: RADIUS.pill,
          border: `${border}px solid ${withAlpha(COLOR.borderSubtle, s.chrome)}`,
          backgroundColor: withAlpha(COLOR.paper, s.chrome),
          fontFamily: FONT.sans,
          fontSize: big.size ?? HERO.size,
          fontWeight: TYPE.display.weight,
          letterSpacing: TYPE.display.tracking,
          lineHeight: 1,
          color: interpolateColors(s.chrome, [0, 1], [HERO.color, COLOR.fg]),
          textShadow: heroGlow(1 - s.chrome),
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: `${(0.3 * s.chrome).toFixed(4)}em`,
            height: `${(0.3 * s.chrome).toFixed(4)}em`,
            marginRight: `${(0.3 * s.chrome).toFixed(4)}em`,
            borderRadius: RADIUS.pill,
            backgroundColor: COLOR.fg,
            boxShadow: `0 0 0 ${(0.08 * s.chrome).toFixed(4)}em ${COLOR.accent}`,
          }}
        />
        {words.map((word, i) => (
          <Presence
            key={word}
            as="span"
            at={wordAt[i]}
            dur="slow"
            distance={40}
            blur={12}
            style={{display: 'inline-block', marginRight: i < words.length - 1 ? '0.24em' : 0}}
          >
            {word}
          </Presence>
        ))}
      </VelocityBlur>
    </Presence>
  );
};
