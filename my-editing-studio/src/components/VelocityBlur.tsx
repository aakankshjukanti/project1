import React, {useId, type CSSProperties} from 'react';
import {BLUR} from '../design/motion';

/** Below this Gaussian sigma (px) the blur is invisible, so it is skipped. */
const MIN_SIGMA = 0.25;

/**
 * Directional motion blur sized to how far the element moves this frame, using the
 * same 180-degree shutter as film / After Effects — but analytic, so it costs almost
 * nothing to render. It fades to zero as the element settles.
 *
 * vx / vy: the element's movement in px per frame (use perFrame()).
 * bleed:   how far the blur may spread beyond the element, as a fraction of its size.
 *          Use 0 on full-frame wrappers that clip their content.
 */
export const VelocityBlur: React.FC<{
  vx?: number;
  vy?: number;
  bleed?: number;
  as?: 'div' | 'span';
  style?: CSSProperties;
  children: React.ReactNode;
}> = ({vx = 0, vy = 0, bleed = 0.5, as: Tag = 'div', style, children}) => {
  const id = `vblur${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const shutter = BLUR.shutterAngle / 360;
  // A box blur of length L spreads like a Gaussian with sigma ~ 0.29 L.
  const sx = Math.abs(vx) * shutter * 0.29;
  const sy = Math.abs(vy) * shutter * 0.29;
  const active = sx >= MIN_SIGMA || sy >= MIN_SIGMA;
  const filter = [active ? `url(#${id})` : undefined, style?.filter].filter(Boolean).join(' ') || undefined;

  return (
    <Tag style={{...style, filter}}>
      {active ? (
        <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden>
          <defs>
            <filter
              id={id}
              x={`${-bleed * 100}%`}
              y={`${-bleed * 100}%`}
              width={`${100 + bleed * 200}%`}
              height={`${100 + bleed * 200}%`}
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation={`${sx.toFixed(3)} ${sy.toFixed(3)}`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      {children}
    </Tag>
  );
};
