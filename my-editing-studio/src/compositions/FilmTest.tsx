import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {FilmOverlay} from '../components/FilmOverlay';
import {FILM_PRESETS, type FilmLook} from '../design/overlays';
import {BACKGROUND, COLOR, FONT, TYPE} from '../design/tokens';

/**
 * Every film look, back to back, over the same plate — so they can be judged against
 * each other and against no overlay at all. Reference composition, not a video.
 *
 * The plate deliberately has a bright area (for halation), a flat mid tone (where grain
 * shows worst) and a hard edge (where gate weave would be visible if it were too strong).
 */

const Plate: React.FC<{label: string; note: string}> = ({label, note}) => (
  <AbsoluteFill style={{background: BACKGROUND.creamGlow}}>
    <AbsoluteFill style={{backgroundColor: COLOR.surfaceDark, top: '55%'}} />
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 96, textAlign: 'center'}}>
      <span
        style={{
          fontFamily: FONT.sans,
          fontSize: TYPE.h1.size,
          fontWeight: TYPE.h1.weight,
          letterSpacing: TYPE.h1.tracking,
          color: COLOR.fg,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT.sans,
          fontSize: TYPE.caption.size,
          fontWeight: TYPE.caption.weight,
          color: COLOR.fgSecondary,
          marginTop: 24,
          maxWidth: 820,
          lineHeight: TYPE.caption.lineHeight,
        }}
      >
        {note}
      </span>
    </AbsoluteFill>
  </AbsoluteFill>
);

const LOOKS = Object.keys(FILM_PRESETS) as FilmLook[];
const HOLD_SECONDS = 2;

export const FilmTest: React.FC = () => {
  const {fps} = useVideoConfig();
  const hold = Math.round(HOLD_SECONDS * fps);

  return (
    <AbsoluteFill style={{backgroundColor: COLOR.surfaceAlt}}>
      {LOOKS.map((look, i) => (
        <Sequence key={look} from={i * hold} durationInFrames={hold} layout="none">
          <FilmOverlay look={look} seed={i}>
            <Plate label={look} note={FILM_PRESETS[look].note} />
          </FilmOverlay>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const FILM_TEST_FRAMES = LOOKS.length * Math.round(HOLD_SECONDS * 30);
