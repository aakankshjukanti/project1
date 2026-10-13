import React, {type CSSProperties} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {progress} from '../lib/animate';

/**
 * Ghosted type-ahead — text typing into a container that grows with it, with the words still to
 * come already present in pale grey.
 *
 * The approved beat, and the cheapest way to make an interface feel alive. A plain typewriter
 * makes the viewer wait to find out where a sentence is going; showing the rest faintly means
 * they read the whole thought immediately and then watch it get committed. The container growing
 * with the text is what stops it feeling like a caption pasted over a box.
 *
 * Typing is linear on purpose. A character count is a count, not a motion, and easing it makes
 * the speaker sound like they are slowing down.
 */
export const TypeAhead: React.FC<{
  text: string;
  /** Frame typing starts, relative to the enclosing sequence. */
  at: number;
  /** Characters per frame. 1.6 reads as fast but followable at 30fps. */
  speed?: number;
  /** Colour of the committed text. */
  colour: string;
  /** Colour of the text still to come. Keep it faint — it is a hint, not content. */
  ghost: string;
  /** The pill behind it. Pass `null` for bare text. */
  background?: string | null;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  style?: CSSProperties;
}> = ({text, at, speed = 1.6, colour, ghost, background = null, fontSize = 40, fontFamily, fontWeight, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const typed = Math.max(0, Math.min(text.length, Math.floor((frame - at) * speed)));
  const written = text.slice(0, typed);
  const ahead = text.slice(typed);

  /**
   * The pill grows in once at the start rather than tracking each character — a container that
   * resizes on every frame judders, and the text inside it never settles.
   */
  const open = progress(frame, at - 2, Math.round(0.26 * fps), EASE.outDecisive);
  if (open <= 0) return null;

  return (
    <div
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'baseline',
        padding: background ? `${fontSize * 0.34}px ${fontSize * 0.58}px` : 0,
        borderRadius: 999,
        backgroundColor: background ?? undefined,
        fontFamily,
        fontSize,
        fontWeight,
        lineHeight: 1.1,
        whiteSpace: 'pre',
        opacity: open,
        transform: `scale(${0.94 + open * 0.06})`,
        transformOrigin: 'left center',
      }}
    >
      <span style={{color: colour}}>{written}</span>
      <span style={{color: ghost}}>{ahead}</span>
    </div>
  );
};
