import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {COLOR, FONT, RADIUS, SHADOW, TYPE, WEIGHT} from '../design/tokens';
import {durFrames, progress, staggerFrames} from '../lib/animate';
import {Presence} from './Presence';

export type TileBox = {x: number; y: number; w: number; h: number; radius: number};

/**
 * A rounded tile whose border draws itself on, then its icon and label arrive.
 * `box` can be animated by the caller (e.g. the tile growing into a window);
 * `contentOpacity` fades the tile's own content out while `children` fade in.
 */
export const PlatformTile: React.FC<{
  box: TileBox;
  enterAt: number;
  icon: React.ReactNode;
  label: string;
  /** 0 = normal, 1 = fully dimmed (not the focus). */
  dim?: number;
  checkAt?: number;
  exitAt?: number;
  contentOpacity?: number;
  /** Label under the tile (default) or beside it on the right (for vertical stacks). */
  labelSide?: 'below' | 'right';
  labelSize?: number;
  children?: React.ReactNode;
}> = ({box, enterAt, icon, label, dim = 0, checkAt, exitAt, contentOpacity = 1, labelSide = 'below', labelSize, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const draw = progress(frame, enterAt, durFrames('slow', fps));

  return (
    <Presence
      at={enterAt}
      until={exitAt}
      exitTo="below"
      distance={24}
      style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h}}
    >
      <div style={{position: 'absolute', inset: 0, opacity: 1 - 0.65 * dim}}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: box.radius,
            backgroundColor: COLOR.surface,
            boxShadow: SHADOW.card,
          }}
        />
        <svg
          width={box.w}
          height={box.h}
          style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: contentOpacity}}
        >
          <rect
            x={1.5}
            y={1.5}
            width={Math.max(0, box.w - 3)}
            height={Math.max(0, box.h - 3)}
            rx={box.radius}
            pathLength={1}
            fill="none"
            stroke={COLOR.borderStrong}
            strokeWidth={3}
            strokeDasharray={1}
            strokeDashoffset={1 - draw}
          />
        </svg>
        <Presence
          at={enterAt + staggerFrames(1, fps)}
          blur={8}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{opacity: contentOpacity}}>{icon}</div>
        </Presence>
        <Presence
          at={enterAt + staggerFrames(2, fps)}
          style={
            labelSide === 'right'
              ? {
                  position: 'absolute',
                  left: box.w + 36,
                  top: 0,
                  height: box.h,
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  fontFamily: FONT.sans,
                  fontSize: labelSize ?? TYPE.h3.size,
                  fontWeight: WEIGHT.bold,
                  color: COLOR.fg,
                }
              : {
                  position: 'absolute',
                  left: -40,
                  right: -40,
                  top: box.h + 22,
                  textAlign: 'center',
                  fontFamily: FONT.sans,
                  fontSize: labelSize ?? TYPE.caption.size,
                  fontWeight: TYPE.caption.weight,
                  color: COLOR.fgSecondary,
                }
          }
        >
          <div style={{opacity: contentOpacity}}>{label}</div>
        </Presence>
        {checkAt !== undefined ? (
          <div style={{opacity: contentOpacity}}>
          <Presence
            at={checkAt}
            scaleFrom={0.9}
            distance={10}
            style={{
              position: 'absolute',
              right: -14,
              top: -14,
              width: 46,
              height: 46,
              borderRadius: RADIUS.pill,
              backgroundColor: COLOR.accent,
              border: `3px solid ${COLOR.surface}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: contentOpacity,
            }}
          >
            <svg width={22} height={22} viewBox="0 0 22 22">
              <polyline
                points="4,11.5 9,16 18,6"
                fill="none"
                stroke={COLOR.onAccent}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Presence>
          </div>
        ) : null}
        {children}
      </div>
    </Presence>
  );
};
