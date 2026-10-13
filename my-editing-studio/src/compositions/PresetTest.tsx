import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {Transition} from '../components/Transition';
import {COLOR, FONT, TYPE} from '../design/tokens';
import {TRANSITION_PRESETS, type TransitionKind} from '../design/presets';

/**
 * Every transition preset, back to back, so they can be judged side by side
 * (and so motion-check sees them). Reference composition — not a video.
 */

const Panel: React.FC<{label: string; bg: string; fg: string}> = ({label, bg, fg}) => (
  <AbsoluteFill style={{backgroundColor: bg, justifyContent: 'center', alignItems: 'center'}}>
    <span
      style={{
        fontFamily: FONT.sans,
        fontSize: TYPE.display.size,
        fontWeight: TYPE.display.weight,
        letterSpacing: TYPE.display.tracking,
        color: fg,
      }}
    >
      {label}
    </span>
  </AbsoluteFill>
);

const KINDS = Object.keys(TRANSITION_PRESETS) as TransitionKind[];
const HOLD_SECONDS = 1.6;

export const PresetTest: React.FC = () => {
  const {fps} = useVideoConfig();
  const hold = Math.round(HOLD_SECONDS * fps);

  return (
    <AbsoluteFill style={{backgroundColor: COLOR.surfaceAlt}}>
      {KINDS.map((kind, i) => (
        <Sequence key={kind} from={i * hold} durationInFrames={hold} layout="none">
          <Transition
            kind={kind}
            at={Math.round(hold / 2)}
            direction={i % 2 ? 'right' : 'left'}
            from={<Panel label={kind} bg={COLOR.surfaceDark} fg={COLOR.accent} />}
            to={<Panel label="→" bg={COLOR.accent} fg={COLOR.onAccent} />}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const PRESET_TEST_FRAMES = KINDS.length * Math.round(HOLD_SECONDS * 30);
