import {HERO} from './tokens';

/** Accent glow for hero text; `strength` 0-1 fades it (e.g. when the text shrinks into a pill). */
export const heroGlow = (strength = 1): string => {
  const s = Math.max(0, Math.min(1, strength));
  return [
    `0 0 26px rgba(${HERO.glowRgb},${(0.55 * s).toFixed(3)})`,
    `0 0 90px rgba(${HERO.glowRgb},${(0.35 * s).toFixed(3)})`,
    `0 8px 30px rgba(${HERO.liftRgb},${(0.3 * s).toFixed(3)})`,
  ].join(', ');
};
