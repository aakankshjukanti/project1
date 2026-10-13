import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {progress} from '../lib/animate';

/**
 * Live data morph — the chart holds still and only the data moves.
 *
 * The approved beat. When a value, a line or a list changes, the frame does not reset: the axes,
 * the panel and the grid stay exactly where they are, and the line redraws into its new shape and
 * recolours as it goes. Re-entering the whole panel to show a new number throws away the viewer's
 * orientation and makes an update read as a new scene.
 *
 * Two series morph into each other point by point, so they must have the same number of points —
 * resample before passing them in if they do not. Values are 0..1, bottom to top.
 *
 * `draw` handles the first appearance: the line is drawn on left to right by a dash offset, which
 * is a playhead rather than a motion, so it runs linear in time.
 */
export const DataLine: React.FC<{
  /** The series it starts on. Values 0..1. */
  from: number[];
  /** The series it becomes. Same length as `from`. Omit to only draw `from`. */
  to?: number[];
  /** Frame the morph begins, relative to the enclosing sequence. */
  at: number;
  /** How long the morph takes. Default 0.6s. */
  frames?: number;
  /** Frame the line draws itself on. Omit to have it present from the start. */
  drawAt?: number;
  drawFrames?: number;
  width: number;
  height: number;
  colour: string;
  /** Colour it becomes, if the state change carries a colour change too. */
  toColour?: string;
  strokeWidth?: number;
  /** Faint fill under the line. */
  fill?: string;
}> = ({from, to, at, frames, drawAt, drawFrames, width, height, colour, toColour, strokeWidth = 5, fill}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  if (to && to.length !== from.length) {
    throw new Error(`DataLine: series must be the same length (${from.length} vs ${to.length}). Resample first.`);
  }

  const t = to ? progress(frame, at, frames ?? Math.round(0.6 * fps), EASE.inOut) : 0;
  const values = from.map((v, i) => (to ? v + (to[i] - v) * t : v));

  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - v * height;
    return [x, y] as const;
  });

  /** A Catmull-Rom style smoothing, so the line curves rather than kinking at every sample. */
  const d = pts
    .map(([x, y], i) => {
      if (i === 0) return `M${x.toFixed(2)} ${y.toFixed(2)}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `C${cx.toFixed(2)} ${py.toFixed(2)} ${cx.toFixed(2)} ${y.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  // Generous over-estimate of the path length; exactness does not matter for a dash wipe.
  const LEN = width * 2.2;
  const drawn =
    drawAt === undefined ? 1 : Math.max(0, Math.min(1, (frame - drawAt) / (drawFrames ?? Math.round(1 * fps))));

  const stroke = toColour ? blend(colour, toColour, t) : colour;

  return (
    <svg width={width} height={height} style={{overflow: 'visible'}}>
      {fill ? (
        <path d={`${d} L${width} ${height} L0 ${height} Z`} fill={fill} opacity={drawn} stroke="none" />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={drawAt === undefined ? undefined : LEN}
        strokeDashoffset={drawAt === undefined ? undefined : LEN * (1 - drawn)}
      />
    </svg>
  );
};

/** Straight sRGB blend. Good enough between two brand colours; not a perceptual mix. */
const blend = (a: string, b: string, t: number): string => {
  const parse = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
};
