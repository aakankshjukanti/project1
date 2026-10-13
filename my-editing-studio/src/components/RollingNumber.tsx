import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE, type Dur} from '../design/motion';
import {durFrames, perFrame, progress, staggerFrames} from '../lib/animate';
import {VelocityBlur} from './VelocityBlur';

/**
 * Stat reveal where each digit rolls to its final value, rightmost first.
 * With `from` (same format, e.g. "$26.50" -> "$48.94"), each digit rolls from its old value
 * to its new one; otherwise digits roll up from 0.
 * Motion is continuous every frame (a plain counter "ticks" as it slows down), digits are
 * motion-blurred by speed, and every slot keeps its final glyph width so nothing shifts.
 * Set font styles on the parent; `sizePx` must equal its font size.
 * `at` is in the enclosing Sequence's frames.
 */
export const RollingNumber: React.FC<{value: string; from?: string; at: number; sizePx: number; dur?: Dur}> = ({
  value,
  from,
  at,
  sizePx,
  dur = 'scene',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chars = [...value];
  const fromChars = from ? [...from] : null;
  const sameShape =
    fromChars !== null &&
    fromChars.length === chars.length &&
    chars.every((c, i) => /\d/.test(c) === /\d/.test(fromChars[i]) && (/\d/.test(c) || c === fromChars[i]));
  if (from && !sameShape) {
    throw new Error(`RollingNumber: "${from}" and "${value}" must have the same format.`);
  }
  const digitPositions = chars.flatMap((c, i) => (/\d/.test(c) ? [i] : []));

  return (
    <span style={{display: 'inline-flex', alignItems: 'flex-start', lineHeight: 1, whiteSpace: 'pre'}}>
      {chars.map((char, i) => {
        if (!/\d/.test(char)) {
          return (
            <span key={i} style={{height: '1em'}}>
              {char}
            </span>
          );
        }
        const target = Number(char);
        const origin = fromChars ? Number(fromChars[i]) : 0;
        const order = digitPositions.length - 1 - digitPositions.indexOf(i);
        const offsetPx = (f: number) => {
          const p = progress(f, at + staggerFrames(order, fps, 'tight'), durFrames(dur, fps), EASE.out);
          return -(origin + (target - origin) * p) * sizePx;
        };
        return (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
              height: '1em',
              // Clip vertically only, so wide digits can pass through narrow slots.
              clipPath: 'inset(0 -50% 0 -50%)',
            }}
          >
            <span style={{visibility: 'hidden'}}>{char}</span>
            <VelocityBlur
              as="span"
              vy={perFrame(offsetPx, frame)}
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: `translate3d(-50%, ${offsetPx(frame).toFixed(3)}px, 0)`,
              }}
            >
              {Array.from({length: Math.max(target, origin) + 1}, (_, digit) => (
                <span key={digit} style={{height: '1em'}}>
                  {digit}
                </span>
              ))}
            </VelocityBlur>
          </span>
        );
      })}
    </span>
  );
};
