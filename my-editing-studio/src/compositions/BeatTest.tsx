import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {DataLine} from '../components/DataLine';
import {MorphState} from '../components/MorphState';
import {TypeAhead} from '../components/TypeAhead';
import {withAlpha} from '../design/color';
import {COLOR, FONT, SHADOW, WEIGHT} from '../design/tokens';

/**
 * The three beats added from the UI-motion reference, side by side so they can be judged before
 * any video uses them. Each runs on a loop of its own so a still at almost any frame shows
 * something mid-move rather than at rest.
 *
 * Render stills with:  node scripts/stills.mjs BeatTest --frames=14,30,46,70
 */

const ACCENT = COLOR.accent;

const Label: React.FC<{children: React.ReactNode}> = ({children}) => (
  <div style={{fontFamily: FONT.sans, fontSize: 24, fontWeight: WEIGHT.semibold, letterSpacing: '0.06em', color: COLOR.fgSecondary, textTransform: 'uppercase'}}>
    {children}
  </div>
);

export const BEAT_TEST_FRAMES = 90;

export const BeatTest: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: COLOR.surfaceAlt, fontFamily: FONT.sans, padding: 80, gap: 56, display: 'flex', flexDirection: 'column'}}>
    {/* 1. Morph into state — a payment row becoming its own confirmation. */}
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Label>Morph into state</Label>
      <MorphState
        at={10}
        style={{boxShadow: SHADOW.pop}}
        from={{
          width: 620,
          height: 104,
          radius: 999,
          background: COLOR.surface,
          colour: COLOR.fg,
          children: (
            <span style={{fontSize: 34, fontWeight: WEIGHT.medium, padding: '0 36px'}}>
              Send ₹2,000 to Wise account
            </span>
          ),
        }}
        to={{
          width: 340,
          height: 104,
          radius: 999,
          background: ACCENT,
          colour: COLOR.onAccent,
          children: <span style={{fontSize: 36, fontWeight: WEIGHT.bold}}>Received ✓</span>,
        }}
      />
    </div>

    {/* 2. Live data morph — the panel holds still, only the line changes. */}
    <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
      <Label>Live data morph</Label>
      <div style={{width: 820, height: 260, borderRadius: 24, backgroundColor: COLOR.surface, border: `1px solid ${COLOR.borderSubtle}`, padding: 32, boxShadow: SHADOW.pop}}>
        <DataLine
          width={756}
          height={196}
          drawAt={2}
          drawFrames={26}
          at={38}
          frames={20}
          from={[0.22, 0.44, 0.3, 0.58, 0.41, 0.69, 0.52, 0.78, 0.6, 0.72]}
          to={[0.3, 0.26, 0.52, 0.38, 0.72, 0.5, 0.86, 0.62, 0.9, 0.84]}
          colour={COLOR.fgSecondary}
          toColour={ACCENT}
          fill={withAlpha(ACCENT, 0.1)}
        />
      </div>
    </div>

    {/* 3. Ghosted type-ahead — the rest of the sentence is already there, faintly. */}
    <div style={{display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start'}}>
      <Label>Ghosted type-ahead</Label>
      <Sequence from={0} layout="none">
        <TypeAhead
          text="cut the gaps and add captions"
          at={8}
          speed={1.3}
          colour={COLOR.onAccent}
          ghost={withAlpha(COLOR.fg, 0.22)}
          background={ACCENT}
          fontSize={42}
          fontFamily={FONT.sans}
          fontWeight={WEIGHT.semibold}
        />
      </Sequence>
    </div>
  </AbsoluteFill>
);
