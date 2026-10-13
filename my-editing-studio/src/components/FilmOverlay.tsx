import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  FILM_PRESETS,
  GRAIN,
  HALATION,
  LEAK,
  LETTERBOX,
  WEAVE,
  strengthScale,
  type FilmLook,
} from '../design/overlays';

/**
 * Film texture over any scene, driven by tokens.
 *
 *   <FilmOverlay look="film">{<Footage />}</FilmOverlay>
 *
 * Layers, outside in: gate weave moves the whole frame, halation blooms the highlights,
 * a light leak washes across, grain sits on top, letterbox bars crop the result.
 * Every layer is off by default at 'none' and every one of them is frame-driven — no CSS
 * animation, no Math.random — so a re-render is identical to the last one.
 *
 * Individual layers can be overridden per shot when a look is nearly right:
 *   <FilmOverlay look="film" grain="strong" />
 */
export const FilmOverlay: React.FC<{
  look?: FilmLook;
  grain?: (typeof FILM_PRESETS)[FilmLook]['grain'];
  halation?: (typeof FILM_PRESETS)[FilmLook]['halation'];
  leak?: (typeof FILM_PRESETS)[FilmLook]['leak'];
  weave?: (typeof FILM_PRESETS)[FilmLook]['weave'];
  letterbox?: (typeof FILM_PRESETS)[FilmLook]['letterbox'];
  /** Shifts the leak and weave phase, so two shots with the same look do not drift in step. */
  seed?: number;
  children: React.ReactNode;
}> = ({look = 'film', seed = 0, children, ...override}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const preset = FILM_PRESETS[look];

  const grain = strengthScale(override.grain ?? preset.grain);
  const halation = strengthScale(override.halation ?? preset.halation);
  const leak = strengthScale(override.leak ?? preset.leak);
  const weave = strengthScale(override.weave ?? preset.weave);
  const letterbox = override.letterbox ?? preset.letterbox;

  const seconds = frame / fps;
  /** Sum of two slow sines: smooth, continuous, and never on an obvious loop. */
  const wobble = (hz: number, phase: number) => Math.sin(2 * Math.PI * hz * seconds + phase + seed);

  /* ------------------------------------------------------------------ gate weave */

  const weaveX = weave * WEAVE.translatePx * wobble(WEAVE.hz[0], 0);
  const weaveY = weave * WEAVE.translatePx * wobble(WEAVE.hz[1], 1.7);
  const weaveR = weave * WEAVE.rotateDeg * wobble(WEAVE.hz[0] * 0.7, 3.1);
  const weaveStyle: React.CSSProperties = weave
    ? {transform: `translate(${weaveX.toFixed(3)}px, ${weaveY.toFixed(3)}px) rotate(${weaveR.toFixed(4)}deg) scale(1.01)`}
    : {};

  /* ------------------------------------------------------------------ halation */

  // Crush to a highlight-only plate, warm it, blur it, then screen it back on. Screening
  // with black is a no-op, so everything that is not a highlight comes through untouched.
  // motion-ok: a static blur radius on a bloom plate, not motion blur — the 12px cap is about moving edges.
  const bloomFilter = [
    `contrast(${HALATION.contrast})`,
    `brightness(${HALATION.brightness})`,
    `sepia(${HALATION.sepia})`,
    `saturate(${HALATION.saturate})`,
    `blur(${HALATION.blurPx.toFixed(1)}px)`,
  ].join(' ');

  /* ------------------------------------------------------------------ light leak */

  const leakX = 50 + 32 * wobble(1 / LEAK.cycleSeconds, 0.4);
  const leakY = 12 + 14 * wobble(1 / (LEAK.cycleSeconds * 1.6), 2.2);
  const leakStyle: React.CSSProperties = {
    background: `radial-gradient(45% 34% at ${leakX.toFixed(1)}% ${leakY.toFixed(1)}%, ${LEAK.warm} 0%, ${LEAK.cool} 26%, transparent 66%)`,
    mixBlendMode: 'screen',
    opacity: LEAK.opacity * leak,
  };

  /* ------------------------------------------------------------------ grain */

  // A small noise plate scaled up: full-frame turbulence every frame is far too slow to render.
  const plateW = Math.round(width * GRAIN.renderScale);
  const plateH = Math.round(height * GRAIN.renderScale);
  const grainSeed = Math.floor(frame / GRAIN.framesPerSeed);

  /* ------------------------------------------------------------------ letterbox */

  const barHeight = letterbox === 'off' ? 0 : Math.round(height * LETTERBOX.ratio[letterbox]);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={weaveStyle}>
        <AbsoluteFill>{children}</AbsoluteFill>

        {halation > 0 ? (
          <AbsoluteFill style={{filter: bloomFilter, mixBlendMode: 'screen', opacity: HALATION.opacity * halation}}>
            {children}
          </AbsoluteFill>
        ) : null}

        {leak > 0 ? <AbsoluteFill style={leakStyle} /> : null}

        {grain > 0 ? (
          <AbsoluteFill style={{opacity: GRAIN.opacity * grain}}>
            <svg width="100%" height="100%" viewBox={`0 0 ${plateW} ${plateH}`} preserveAspectRatio="none">
              <filter id={`grain-${grainSeed}`} x="0" y="0" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency={GRAIN.frequency}
                  numOctaves={1}
                  seed={grainSeed}
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
                {/* Turbulence varies alpha as well as colour; flatten it so only brightness grains. */}
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0" intercept="1" />
                </feComponentTransfer>
              </filter>
              <rect width={plateW} height={plateH} filter={`url(#grain-${grainSeed})`} />
            </svg>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>

      {barHeight > 0 ? (
        <>
          <AbsoluteFill style={{height: barHeight, top: 0, backgroundColor: LETTERBOX.color}} />
          <AbsoluteFill style={{height: barHeight, top: height - barHeight, backgroundColor: LETTERBOX.color}} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
