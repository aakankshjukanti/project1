import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {heroGlow} from '../design/glow';
import {CAPTION, FONT, HERO, TYPE, WEIGHT} from '../design/tokens';
import {durFrames, perFrame, progress, wipeMask, type Place} from '../lib/animate';
import {Presence} from './Presence';

const labelStyle: React.CSSProperties = {
  fontWeight: WEIGHT.bold,
  letterSpacing: TYPE.eyebrow.tracking,
  textTransform: 'uppercase',
  color: CAPTION.color,
  textShadow: CAPTION.shadow,
};

/**
 * Big glowing accent headline, centred horizontally. Place it between the stage video and the
 * stage cutout to sit behind the subject. `children` is the headline (HeroWords, a RollingNumber...).
 * The block itself only moves on exit — its words bring their own entrance.
 */
export const HeroBlock: React.FC<{
  at: number;
  until?: number;
  top: number;
  exitTo?: Place;
  size?: number;
  /** Font size of the eyebrow / subline labels. */
  labelSize?: number;
  /** Small white label above the headline. */
  eyebrow?: {text: string; at: number};
  /** White line below the headline. */
  subline?: {text: string; at: number};
  children: React.ReactNode;
}> = ({at, until, top, exitTo = 'above', size = HERO.size, labelSize, eyebrow, subline, children}) => (
  <Presence
    at={at}
    until={until}
    from="none"
    exitTo={exitTo}
    dur="base"
    distance={40}
    style={{position: 'absolute', left: 0, right: 0, top, textAlign: 'center', fontFamily: FONT.sans}}
  >
    {eyebrow ? (
      <Presence at={eyebrow.at} dur="base" blur={8} style={{...labelStyle, fontSize: labelSize ?? TYPE.eyebrow.size + 8, marginBottom: 10}}>
        {eyebrow.text}
      </Presence>
    ) : null}
    <div
      style={{
        fontSize: size,
        fontWeight: TYPE.display.weight,
        letterSpacing: TYPE.display.tracking,
        lineHeight: 1,
        color: HERO.color,
        textShadow: heroGlow(),
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </div>
    {subline ? (
      <Presence at={subline.at} dur="base" blur={8} style={{...labelStyle, fontSize: labelSize ?? TYPE.h3.size, marginTop: 18}}>
        {subline.text}
      </Presence>
    ) : null}
  </Presence>
);

/** Words of a hero headline, each rising out of a blur on its spoken frame. */
export const HeroWords: React.FC<{words: Array<{text: string; at: number}>; from?: Place}> = ({words, from = 'below'}) => (
  <>
    {words.map((w, i) => (
      <Presence
        key={`${w.text}-${i}`}
        as="span"
        at={w.at}
        from={from}
        dur="slow"
        distance={40}
        blur={12}
        style={{display: 'inline-block', marginRight: i < words.length - 1 ? '0.24em' : 0}}
      >
        {w.text}
      </Presence>
    ))}
  </>
);

/** A line drawn through a headline, left to right with a motion-blurred leading edge. */
export const Strike: React.FC<{at: number; color: string; children: React.ReactNode}> = ({at, color, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const drawAt = (f: number) => progress(f, at, durFrames('slow', fps), EASE.emphasis);
  return (
    <span style={{position: 'relative', display: 'inline-block'}}>
      {children}
      <span
        style={{
          position: 'absolute',
          left: '-0.04em',
          right: '-0.04em',
          top: '50%',
          height: '0.09em',
          borderRadius: '0.05em',
          backgroundColor: color,
          boxShadow: `0 0 0.12em ${color}`,
          ...wipeMask(drawAt(frame), perFrame(drawAt, frame)),
        }}
      />
    </span>
  );
};
