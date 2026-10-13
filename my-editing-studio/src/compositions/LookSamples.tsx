import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CAPTION, COLOR, FONT, TYPE} from '../design/tokens';

/** Look samples: title stack, two-tone split title, and a spoken caption, on a dark ground like the reference. */
const title = (size: number, color: string): React.CSSProperties => ({
  fontFamily: FONT.sans,
  fontSize: size,
  lineHeight: 0.98,
  textTransform: 'uppercase',
  color,
  margin: 0,
});

export const LookSamples: React.FC<{frame: 0 | 1 | 2; wide?: boolean}> = ({frame, wide}) => {
  const pad = wide ? 120 : 96;
  const big = wide ? TYPE.display.size * 1.3 : TYPE.display.size * 1.5;
  const small = wide ? 64 : 76;
  const stage: React.CSSProperties = {backgroundColor: COLOR.surfaceDark, padding: pad, justifyContent: 'center'};
  if (frame === 0) {
    return (
      <AbsoluteFill style={stage}>
        <p style={title(small, COLOR.accent2)}>Are my 3</p>
        <p style={title(big, COLOR.accent)}>These</p>
        <p style={{fontFamily: FONT.script, fontSize: small * 1.3, color: COLOR.accent2, margin: 0, transform: 'rotate(-3deg)'}}>go to edits</p>
      </AbsoluteFill>
    );
  }
  if (frame === 1) {
    return (
      <AbsoluteFill style={stage}>
        <p style={title(big, COLOR.accent)}>
          Sp<span style={{color: COLOR.accent2}}>lit</span>
        </p>
        <p style={title(big, COLOR.accent)}>
          Fra<span style={{color: COLOR.accent2}}>me</span>
        </p>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={stage}>
      <p style={title(big * 0.8, COLOR.accent)}>It's just</p>
      <p style={{fontFamily: FONT.script, fontSize: big * 0.7, color: COLOR.fgOnDark, margin: 0, transform: 'rotate(-3deg)'}}>absolutely</p>
      <p style={title(big * 0.8, COLOR.accent2)}>Clean</p>
      <p style={{fontFamily: CAPTION.family, fontSize: CAPTION.size * 1.4, color: CAPTION.color, marginTop: 60}}>very static.</p>
    </AbsoluteFill>
  );
};
