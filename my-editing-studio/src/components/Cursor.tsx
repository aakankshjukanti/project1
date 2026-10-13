import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {COLOR, FONT, RADIUS, WEIGHT} from '../design/tokens';
import {durFrames, perFrame, progress, travelFrames} from '../lib/animate';
import {Presence} from './Presence';
import {VelocityBlur} from './VelocityBlur';

/** A point the cursor ARRIVES at by frame `at` (the tip of the arrow). */
export type CursorStop = {at: number; x: number; y: number; click?: boolean};

const CLICK_FRAMES = 6;
/** Pointer size and where its tip sits inside the 64px artwork. */
const POINTER = 68;
const TIP = 6 * (POINTER / 64);

/**
 * An arrow cursor that guides the eye: travels between stops on gentle arcs,
 * arriving exactly on time, and clicks with a press + ripple.
 */
export const Cursor: React.FC<{
  stops: CursorStop[];
  hideAt: number;
  /**
   * A name tag riding behind the arrow, the way a collaborator's cursor is labelled in Figma.
   * Optional and additive: every existing use renders exactly as before without it.
   *
   * Pass a function of the frame to change the word mid-move — "copy" becoming "copied" the
   * instant the click lands reads as the action succeeding, with no second element needed.
   */
  label?: string | ((frame: number) => string);
  /**
   * Arrow colour. Defaults to the brand accent, which is what every earlier use gets.
   *
   * The setup walkthrough passes ink instead, asked for directly ("the arrow should be black"):
   * over a white email and a light desktop a accent arrow reads as a graphic sitting on the shot,
   * where a black one reads as the viewer's own pointer.
   */
  fill?: string;
  /** Tag colour, as a function of the frame where it changes state mid-move. */
  tagColour?: string | ((frame: number) => string);
  /** Tag text colour, for tags too dark for ink to read on. */
  tagText?: string | ((frame: number) => string);
}> = ({
  stops,
  hideAt,
  label,
  fill = COLOR.accent,
  tagColour = COLOR.accent,
  tagText = COLOR.fg,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const positionAt = (f: number) => {
    let x = stops[0].x;
    let y = stops[0].y;
    for (let i = 1; i < stops.length; i++) {
      const from = stops[i - 1];
      const to = stops[i];
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const travel = Math.min(travelFrames(distance, fps), Math.max(1, to.at - from.at));
      const depart = to.at - travel;
      if (f <= depart) break;
      const t = progress(f, depart, travel, EASE.inOut);
      // Arc: bulge perpendicular to the path, peaking mid-way.
      const bulge = Math.sin(Math.PI * t) * distance * 0.1;
      const nx = distance ? -(to.y - from.y) / distance : 0;
      const ny = distance ? (to.x - from.x) / distance : 0;
      x = from.x + (to.x - from.x) * t + nx * bulge;
      y = from.y + (to.y - from.y) * t + ny * bulge;
    }
    return {x, y};
  };

  const {x, y} = positionAt(frame);
  const click = stops.find((s) => s.click && frame >= s.at && frame < s.at + durFrames('slow', fps));
  const pressT = click ? progress(frame, click.at, CLICK_FRAMES, EASE.inOut) : 0;
  const press = 1 - 0.14 * Math.sin(Math.PI * pressT);
  const ripple = click ? progress(frame, click.at, durFrames('slow', fps)) : 0;

  // Resolved first so a label that returns an empty string removes the tag outright, which is
  // how "copied" disappears once the line has been pasted.
  const labelText = typeof label === 'function' ? label(frame) : label;

  return (
    <Presence at={stops[0].at} until={hideAt} dur="fast" from="none" style={{position: 'absolute', inset: 0}}>
      {click ? (
        <div
          style={{
            position: 'absolute',
            left: click.x - 70 * ripple,
            top: click.y - 70 * ripple,
            width: 140 * ripple,
            height: 140 * ripple,
            borderRadius: RADIUS.pill,
            border: `4px solid ${fill}`,
            opacity: 1 - ripple,
          }}
        />
      ) : null}
      <VelocityBlur
        vx={perFrame((f) => positionAt(f).x, frame)}
        vy={perFrame((f) => positionAt(f).y, frame)}
        style={{
          position: 'absolute',
          left: x - TIP,
          top: y - TIP,
          transformOrigin: `${TIP}px ${TIP}px`,
          transform: `scale(${press.toFixed(4)})`,
          filter: `drop-shadow(0 8px 14px ${COLOR.fg}66)`,
        }}
      >
        {/* Solid pointer (as in the reference): tip top-left, notched tail. */}
        <svg width={POINTER} height={POINTER} viewBox="0 0 64 64">
          <path
            d="M6 6 L58 26 Q60 27 58 28 L35 35 L28 58 Q27 60 26 58 Z"
            fill={fill}
            stroke={COLOR.fg}
            strokeWidth={3}
            strokeLinejoin="round"
          />
        </svg>
      </VelocityBlur>

      {labelText ? (
        <div
          style={{
            position: 'absolute',
            // Sits behind and below the tip, where a Figma cursor label sits, so it never
            // covers the thing being pointed at.
            left: x + POINTER * 0.42,
            top: y + POINTER * 0.52,
            display: 'flex',
            alignItems: 'center',
            padding: '7px 16px',
            borderRadius: RADIUS.pill,
            backgroundColor: typeof tagColour === 'function' ? tagColour(frame) : tagColour,
            fontFamily: FONT.sans,
            fontSize: 26,
            fontWeight: WEIGHT.semibold,
            letterSpacing: '-0.015em',
            color: typeof tagText === 'function' ? tagText(frame) : tagText,
            whiteSpace: 'nowrap',
            boxShadow: `0 6px 16px ${COLOR.fg}33`,
          }}
        >
          {labelText}
        </div>
      ) : null}
    </Presence>
  );
};
