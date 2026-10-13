import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {HIGHLIGHT} from '../design/tokens';
import {durFrames, perFrame, progress, wipeMask} from '../lib/animate';

/**
 * Brand signature emphasis: a flat accent marker that wipes in left to right
 * behind a phrase, after the phrase has landed. The wipe edge is motion-blurred
 * by its speed. `at` is in the frame space of the enclosing Sequence.
 */
export const HighlightMark: React.FC<{at: number; children: React.ReactNode}> = ({at, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wipeAt = (f: number) => progress(f, at, durFrames('slow', fps), EASE.emphasis);

  return (
    <span style={{position: 'relative', display: 'inline-block', padding: `0 ${HIGHLIGHT.padX}`}}>
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: HIGHLIGHT.top,
          bottom: HIGHLIGHT.bottom,
          backgroundColor: HIGHLIGHT.color,
          borderRadius: HIGHLIGHT.radius,
          ...wipeMask(wipeAt(frame), perFrame(wipeAt, frame)),
        }}
      />
      <span style={{position: 'relative'}}>{children}</span>
    </span>
  );
};
