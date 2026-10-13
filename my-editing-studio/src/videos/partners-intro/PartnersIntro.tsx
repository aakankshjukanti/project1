import React from 'react';
import {AbsoluteFill, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {MaskReveal} from '../../components/MaskReveal';
import {Presence} from '../../components/Presence';
import {EASE} from '../../design/motion';
import {COLOR, FLICKER, FONT, GRADE, LAYOUT, SPLIT, TITLE_SHADOW, TYPE} from '../../design/tokens';
import {durFrames, exitFrames, staggerFrames} from '../../lib/animate';
import {
  BRAND_NAME,
  DURATION_S,
  END_AT,
  FLICKER_AT,
  HOOK,
  INTROS,
  NAME,
  ROLE,
  SPLIT_AT,
  SPLIT_FOR_S,
  SPLIT_ROWS,
  TAGS,
  TAG_HOLD_S,
  type Partner,
} from './beats';

const FOOTAGE = staticFile('projects/partners-intro/footage/partners.mp4');

export const useSec = () => {
  const {fps} = useVideoConfig();
  return (s: number) => Math.round(s * fps);
};

const anton = (size: number, color: string): React.CSSProperties => ({
  fontFamily: FONT.sans,
  fontSize: size,
  lineHeight: 0.98,
  textTransform: 'uppercase',
  letterSpacing: TYPE.display.tracking,
  color,
  textShadow: TITLE_SHADOW,
  margin: 0,
});

/** One line of title that rises out of a mask. */
const Line: React.FC<{at: number; until?: number; size: number; color: string; children: React.ReactNode}> = ({
  at,
  until,
  size,
  color,
  children,
}) => (
  <div style={{display: 'block'}}>
    <MaskReveal at={at} until={until} lineHeightPx={size * 0.98}>
      <span style={anton(size, color)}>{children}</span>
    </MaskReveal>
  </div>
);

/** Brush accent word, tilted like the reference's "GO TO EDITS". */
const Script: React.FC<{at: number; until?: number; size: number; color: string; children: React.ReactNode}> = ({
  at,
  until,
  size,
  color,
  children,
}) => (
  <Presence at={at} until={until} dur="base" from="left" distance={60} blur={8} style={{display: 'block'}}>
    <span
      style={{
        fontFamily: FONT.script,
        fontSize: size,
        color,
        textShadow: TITLE_SHADOW,
        display: 'inline-block',
        transform: 'rotate(-3deg)',
        lineHeight: 1.1,
      }}
    >
      {children}
    </span>
  </Presence>
);

/** Flicker: a few frames of light across a cut. */
const Flicker: React.FC = () => {
  const frame = useCurrentFrame();
  const step = FLICKER[frame];
  if (!step || step.opacity === 0) return null;
  return (
    <AbsoluteFill
      style={{backgroundColor: step.tone === 'accent' ? COLOR.accent : COLOR.fgOnDark, opacity: step.opacity}}
    />
  );
};

const Hook: React.FC<{len: number}> = ({len}) => {
  const {fps} = useVideoConfig();
  const out = len - exitFrames('slow', fps);
  const step = staggerFrames(1, fps, 'normal');
  return (
    <AbsoluteFill style={{paddingTop: LAYOUT.safeTop, paddingLeft: LAYOUT.margin}}>
      <Line at={0} until={out} size={TYPE.h2.size} color={COLOR.accent2}>
        Meet the
      </Line>
      <Line at={step} until={out} size={TYPE.display.size * 0.9} color={COLOR.accent}>
        3 Co-Founders
      </Line>
      <Script at={step * 2} until={out} size={TYPE.h1.size} color={COLOR.accent2}>
        behind the build
      </Script>
    </AbsoluteFill>
  );
};

const BigIntro: React.FC<{who: Partner; len: number}> = ({who, len}) => {
  const {fps} = useVideoConfig();
  const out = len - exitFrames('base', fps);
  const step = staggerFrames(1, fps, 'normal');
  return (
    <AbsoluteFill style={{paddingTop: LAYOUT.safeTop, paddingLeft: LAYOUT.margin}}>
      <Line at={0} until={out} size={TYPE.h2.size} color={COLOR.accent2}>
        {ROLE}
      </Line>
      <Line at={step} until={out} size={TYPE.display.size * 1.2} color={COLOR.accent}>
        {NAME[who]}
      </Line>
    </AbsoluteFill>
  );
};

const CornerTag: React.FC<{who: Partner; len: number}> = ({who, len}) => {
  const {fps} = useVideoConfig();
  const out = len - exitFrames('fast', fps);
  return (
    <Presence
      at={0}
      until={out}
      dur="fast"
      from="left"
      distance={50}
      blur={6}
      style={{position: 'absolute', top: LAYOUT.safeTop, left: LAYOUT.margin, display: 'flex', alignItems: 'baseline', gap: 16}}
    >
      <span style={anton(TYPE.h3.size, COLOR.accent2)}>{ROLE}</span>
      <span style={anton(TYPE.h1.size, COLOR.accent)}>{NAME[who]}</span>
    </Presence>
  );
};

/** Three stacked clips of the three partners, one live and two cut-ins. */
const Split: React.FC<{len: number}> = ({len}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const sec = useSec();
  const rowH = (LAYOUT.height - SPLIT.gap * (SPLIT.rows - 1)) / SPLIT.rows;
  const inDur = durFrames('slow', fps);
  const outStart = len - exitFrames('base', fps);
  return (
    <AbsoluteFill style={{backgroundColor: COLOR.surfaceDark}}>
      {SPLIT_ROWS.map((row, i) => {
        const at = staggerFrames(i, fps, 'normal');
        const rise = interpolate(frame, [at, at + inDur], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE.out,
        });
        const fall = interpolate(frame, [outStart, len], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: EASE.in,
        });
        const open = Math.min(rise, fall);
        const clip = (1 - open) * 100;
        return (
          <div
            key={row.who}
            style={{
              position: 'absolute',
              top: i * (rowH + SPLIT.gap),
              left: 0,
              width: LAYOUT.width,
              height: rowH,
              overflow: 'hidden',
              clipPath: `inset(0 ${clip}% 0 0)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: rowH / 2 - row.faceY * LAYOUT.height,
                width: LAYOUT.width,
                height: LAYOUT.height,
                transform: `scale(${SPLIT.zoom})`,
                transformOrigin: `50% ${row.faceY * 100}%`,
              }}
            >
              <OffthreadVideo
                src={FOOTAGE}
                muted
                startFrom={sec(row.from)}
                style={{width: '100%', height: '100%', objectFit: 'cover', filter: GRADE.filter}}
              />
            </div>
            <div style={{position: 'absolute', inset: 0, backgroundColor: GRADE.tint}} />
            <div style={{position: 'absolute', left: LAYOUT.margin, bottom: 28, display: 'flex', gap: 14, alignItems: 'baseline'}}>
              <span style={anton(TYPE.h3.size * 0.7, COLOR.accent2)}>{ROLE}</span>
              <span style={anton(TYPE.h2.size * 0.9, COLOR.accent)}>{NAME[row.who]}</span>
            </div>
          </div>
        );
      })}
      <div style={{position: 'absolute', top: 70, left: LAYOUT.margin, right: LAYOUT.margin}}>
        <Line at={staggerFrames(2, fps, 'normal')} until={outStart} size={TYPE.h1.size} color={COLOR.accent}>
          The 3 <span style={{color: COLOR.accent2}}>of us</span>
        </Line>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{len: number}> = ({len}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const step = staggerFrames(1, fps, 'normal');
  const scrim = interpolate(frame, [0, durFrames('base', fps)], [0, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.out,
  });
  void len;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{backgroundColor: COLOR.surfaceDark, opacity: scrim}} />
      <AbsoluteFill style={{paddingTop: LAYOUT.safeTop, paddingLeft: LAYOUT.margin}}>
        <Line at={0} size={TYPE.h2.size} color={COLOR.accent2}>
          Built by
        </Line>
        <Line at={step} size={TYPE.display.size * 0.9} color={COLOR.accent}>
          3 Co-Founders
        </Line>
        <Script at={step * 2} size={TYPE.h1.size} color={COLOR.fgOnDark}>
          {BRAND_NAME}
        </Script>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PartnersIntro: React.FC = () => {
  const sec = useSec();
  const hold = (a: number, b: number) => ({from: sec(a), durationInFrames: sec(b) - sec(a)});
  return (
    <AbsoluteFill style={{backgroundColor: COLOR.surfaceDark}}>
      {/* The camera footage, muted. The original audio is muxed back in untouched after the render. */}
      <OffthreadVideo
        src={FOOTAGE}
        muted
        style={{width: '100%', height: '100%', objectFit: 'cover', filter: GRADE.filter}}
      />
      <AbsoluteFill style={{backgroundColor: GRADE.tint}} />
      <AbsoluteFill style={{backgroundImage: GRADE.vignette}} />

      <Sequence {...hold(SPLIT_AT, SPLIT_AT + SPLIT_FOR_S)}>
        <Split len={sec(SPLIT_AT + SPLIT_FOR_S) - sec(SPLIT_AT)} />
      </Sequence>

      <Sequence {...hold(HOOK.at, HOOK.until)}>
        <Hook len={sec(HOOK.until) - sec(HOOK.at)} />
      </Sequence>

      {INTROS.map((s) => (
        <Sequence key={s.at} {...hold(s.at, s.until)}>
          <BigIntro who={s.who} len={sec(s.until) - sec(s.at)} />
        </Sequence>
      ))}

      {TAGS.map((s) => (
        <Sequence key={s.at} from={sec(s.at)} durationInFrames={sec(TAG_HOLD_S)}>
          <CornerTag who={s.who} len={sec(TAG_HOLD_S)} />
        </Sequence>
      ))}

      <Sequence {...hold(END_AT, DURATION_S)}>
        <EndCard len={sec(DURATION_S) - sec(END_AT)} />
      </Sequence>

      {FLICKER_AT.map((s) => (
        <Sequence key={s} from={sec(s) - 1} durationInFrames={FLICKER.length}>
          <Flicker />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const PARTNERS_INTRO_FRAMES = Math.round(DURATION_S * 30);
