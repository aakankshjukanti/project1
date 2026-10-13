import React from 'react';
import {Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import {SCRIM, SHADOW} from '../design/tokens';
import {durFrames, perFrame} from '../lib/animate';
import {sequence, type Keyframe} from '../lib/continuity';
import {VelocityBlur} from './VelocityBlur';

export type StageKey = 'x' | 'y' | 'w' | 'h' | 'radius' | 'focusX' | 'focusY' | 'zoom' | 'shadow' | 'scrim';
export type StageState = Record<StageKey, number>;

export type StageSource = {
  /** Path inside assets/. */
  video: string;
  width: number;
  height: number;
  /** Frame-aligned RGBA cutout frames (assets/<dir>/f<frame>.png) for the given frame ranges. */
  cutout?: {dir: string; ranges: Array<[number, number]>};
};

/** Cover the stage box with the video (times `zoom`), keeping the focus point centred where possible. */
const mediaRect = (s: StageState, src: StageSource) => {
  const scale = Math.max(s.w / src.width, s.h / src.height) * s.zoom;
  const width = src.width * scale;
  const height = src.height * scale;
  const left = Math.min(0, Math.max(s.w - width, s.w / 2 - s.focusX * scale));
  const top = Math.min(0, Math.max(s.h - height, s.h / 2 - s.focusY * scale));
  return {left, top, width, height};
};

/**
 * 0..1 zoom envelope around a jump cut (d = frames from the cut): ease-in-out push that is fastest at
 * the cut, then a slow ease-out back to rest.
 */
const cutZoomPulse = (d: number, fps: number): number => {
  const push = durFrames('fast', fps); // frames on each side of the cut
  const relax = durFrames('drift', fps) / 2; // settle back afterwards
  if (d < -push || d > push + relax) return 0;
  if (d <= push) return EASE.inOut((d + push) / (2 * push));
  return 1 - EASE.inOut((d - push) / relax);
};

/**
 * The talking-head video, moving between layouts (full frame, card, push-in...) without ever cutting.
 * Render it twice with the same keys: layer="video" at the bottom, layer="cutout" above anything
 * that should sit behind the subject. Both layers share one geometry, so they always line up.
 */
export const Stage: React.FC<{
  source: StageSource;
  start: StageState;
  keys: Keyframe<StageKey>[];
  layer: 'video' | 'cutout';
  /**
   * Jump cuts in the footage (first frame after each cut). The framing alternates between normal
   * and `zoom` at every cut, so a cut reads as a deliberate camera change instead of a skip.
   */
  punchIns?: {frames: number[]; zoom: number};
  /**
   * Zoom THROUGH each jump cut instead of snapping: the frame pushes in, moving fastest at the cut
   * (so the eye reads motion, not a jump), then eases back out. `amount` is the extra zoom at the peak.
   */
  cutZoom?: {frames: number[]; amount: number};
}> = ({source, start, keys, layer, punchIns, cutZoom}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stateAt = (f: number) => sequence(f, fps, start, keys);
  const s = stateAt(frame);

  const sourceFrame = Math.round(frame);
  if (layer === 'cutout' && !source.cutout?.ranges.some(([a, b]) => sourceFrame >= a && sourceFrame <= b)) {
    return null;
  }

  const cutsSoFar = punchIns ? punchIns.frames.filter((cut) => sourceFrame >= cut).length : 0;
  const punch = punchIns && cutsSoFar % 2 === 1 ? punchIns.zoom : 1;
  const through = cutZoom ? 1 + cutZoom.amount * Math.max(0, ...cutZoom.frames.map((cut) => cutZoomPulse(frame - cut, fps))) : 1;
  const rect = mediaRect({...s, zoom: s.zoom * punch * through}, source);
  const media =
    layer === 'video' ? (
      <OffthreadVideo src={staticFile(source.video)} style={{position: 'absolute', ...rect}} />
    ) : (
      <Img src={staticFile(`${source.cutout!.dir}/f${sourceFrame}.png`)} style={{position: 'absolute', ...rect}} />
    );

  return (
    <VelocityBlur
      bleed={0.05}
      vx={perFrame((f) => stateAt(f).x + stateAt(f).w / 2, frame)}
      vy={perFrame((f) => stateAt(f).y + stateAt(f).h / 2, frame)}
      style={{position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h}}
    >
      {layer === 'video' && s.shadow > 0.01 ? (
        <div style={{position: 'absolute', inset: 0, borderRadius: s.radius, boxShadow: SHADOW.pop, opacity: s.shadow}} />
      ) : null}
      <div style={{position: 'absolute', inset: 0, borderRadius: s.radius, overflow: 'hidden'}}>
        {media}
        {layer === 'video' && s.scrim > 0.01 ? (
          <div style={{position: 'absolute', inset: 0, backgroundImage: SCRIM, opacity: s.scrim}} />
        ) : null}
      </div>
    </VelocityBlur>
  );
};
