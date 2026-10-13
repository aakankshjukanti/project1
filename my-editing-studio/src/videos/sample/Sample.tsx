import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {HighlightMark} from '../../components/HighlightMark';
import {RollingNumber} from '../../components/RollingNumber';
import {durFrames} from '../../lib/animate';
import {COLOR, FONT, LAYOUT, TYPE} from '../../design/tokens';

/**
 * Your first video. It exists to prove the studio works end to end and to show the
 * shape of every video you will make: timing comes from token helpers, never from
 * hand-typed frame numbers, and everything visual comes from design/tokens.ts.
 *
 * Render it with:  npm run render Sample out/sample.mp4
 * Then delete it and make your own:  npm run new-video -- my-first-reel
 */

export const Sample: React.FC = () => {
  const {fps} = useVideoConfig();

  // Timing comes from the motion tokens, so it stays right at 30fps or 60fps.
  const headlineAt = durFrames('base', fps);
  const numberAt = headlineAt + durFrames('scene', fps);

  return (
    <AbsoluteFill style={{backgroundColor: COLOR.surfaceAlt, justifyContent: 'center', padding: LAYOUT.margin}}>
      <span
        style={{
          fontFamily: FONT.sans,
          fontSize: TYPE.h1.size,
          fontWeight: TYPE.h1.weight,
          lineHeight: TYPE.h1.lineHeight,
          letterSpacing: TYPE.h1.tracking,
          color: COLOR.fg,
        }}
      >
        Your studio <HighlightMark at={headlineAt}>works</HighlightMark>
      </span>

      {/* RollingNumber inherits its type from this parent and offsets each digit by sizePx.
          Without a fontSize here the digits inherit the browser default 16px while the roll
          still moves them by sizePx, so they slide clean out of the clip window and the
          counter renders as two tiny motionless zeros. The component says as much —
          "set font styles on the parent; sizePx must equal its font size" — and the sample
          ignored it, which made every first render look broken. */}
      <div
        style={{
          marginTop: 60,
          display: 'flex',
          alignItems: 'baseline',
          gap: 20,
          fontFamily: FONT.sans,
          fontSize: TYPE.stat.size,
          fontWeight: TYPE.stat.weight,
          lineHeight: TYPE.stat.lineHeight,
          letterSpacing: TYPE.stat.tracking,
          color: COLOR.fg,
        }}
      >
        {/* No `from` — digits roll up from zero on their own. from="0" against value="100"
            throws, because RollingNumber requires both to have the same shape. */}
        <RollingNumber value="100" at={numberAt} sizePx={TYPE.stat.size} />
        <span
          style={{
            fontFamily: FONT.sans,
            fontSize: TYPE.bodyLg.size,
            fontWeight: TYPE.bodyLg.weight,
            color: COLOR.fgSecondary,
          }}
        >
          percent yours
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const SAMPLE_FRAMES = 150;
