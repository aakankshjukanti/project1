import type {CSSProperties} from 'react';
import {interpolate} from 'remotion';
import {EASE, type Dur} from '../design/motion';
import {durFrames} from './animate';

/**
 * Virtual camera over one large canvas. Scenes are regions of the canvas and the
 * camera glides between them, so the viewer's eye is carried instead of cut.
 * A shot is the canvas point at the centre of the frame, plus zoom.
 */

export type Shot = {x: number; y: number; zoom?: number};
export type CameraMove = {at: number; to: Shot; dur?: Dur};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const moveFrames = (move: CameraMove, fps: number) => durFrames(move.dur ?? 'scene', fps);

const sorted = (moves: CameraMove[], fps: number): CameraMove[] => {
  const list = [...moves].sort((a, b) => a.at - b.at);
  list.forEach((move, i) => {
    const prev = list[i - 1];
    if (prev && move.at < prev.at + moveFrames(prev, fps)) {
      throw new Error(`Camera move at frame ${move.at} starts before the previous move finishes.`);
    }
  });
  return list;
};

export const cameraShot = (frame: number, fps: number, start: Shot, moves: CameraMove[]): Required<Shot> => {
  let shot = {x: start.x, y: start.y, zoom: start.zoom ?? 1};
  for (const move of sorted(moves, fps)) {
    if (frame <= move.at) break;
    const p = interpolate(frame - move.at, [0, moveFrames(move, fps)], [0, 1], {...clamp, easing: EASE.inOut});
    const to = {x: move.to.x, y: move.to.y, zoom: move.to.zoom ?? 1};
    shot = {
      x: shot.x + (to.x - shot.x) * p,
      y: shot.y + (to.y - shot.y) * p,
      // Geometric zoom interpolation so zoom speed feels even.
      zoom: Math.exp(Math.log(shot.zoom) + (Math.log(to.zoom) - Math.log(shot.zoom)) * p),
    };
    if (p < 1) break;
  }
  return shot;
};

/** Apply to the canvas element (positioned at 0,0). */
export const cameraTransform = (shot: Required<Shot>, width: number, height: number): CSSProperties => ({
  position: 'absolute',
  left: 0,
  top: 0,
  transformOrigin: '0 0',
  transform: `translate3d(${width / 2}px, ${height / 2}px, 0) scale(${shot.zoom.toFixed(5)}) translate3d(${(-shot.x).toFixed(3)}px, ${(-shot.y).toFixed(3)}px, 0)`,
});

/** True while any move is in progress (plus a frame of padding) — use to enable motion blur. */
export const cameraMoving = (frame: number, fps: number, moves: CameraMove[], pad = 1): boolean =>
  moves.some((move) => frame >= move.at - pad && frame <= move.at + moveFrames(move, fps) + pad);
