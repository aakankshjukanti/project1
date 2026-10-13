import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE} from '../design/motion';
import logos from '../design/logos.json';
import {durFrames, progress, staggerFrames} from '../lib/animate';

type IconSet = {width: number; height: number; icons: Record<string, {body: string; width?: number; height?: number}>};
const SET = logos as IconSet;

/**
 * A full-colour brand logo (SVG Logos via Iconify, CC0) that assembles itself: each shape of the
 * logo pops in slightly after the previous one, so the icon feels animated rather than pasted in.
 */
export const LogoIcon: React.FC<{name: keyof typeof logos.icons; size: number; at: number}> = ({name, size, at}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const icon = SET.icons[name];
  const width = icon.width ?? SET.width;
  const height = icon.height ?? SET.height;

  const defs = icon.body.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? '';
  const rest = icon.body.replace(defs, '');
  const parts = rest.match(/<(path|g|circle|rect|polygon|ellipse)\b[\s\S]*?(?:\/>|<\/\1>)/g) ?? [rest];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${width} ${height}`} style={{overflow: 'visible'}}>
      {defs ? <g dangerouslySetInnerHTML={{__html: defs}} /> : null}
      {parts.map((part, i) => {
        const p = progress(frame, at + staggerFrames(i, fps, 'tight'), durFrames('base', fps), EASE.out);
        return (
          <g
            key={i}
            style={{
              opacity: Math.min(1, p * 1.6),
              transformBox: 'fill-box',
              transformOrigin: 'center',
              transform: `scale(${(0.9 + 0.1 * p).toFixed(4)})`,
            }}
            dangerouslySetInnerHTML={{__html: part}}
          />
        );
      })}
    </svg>
  );
};
