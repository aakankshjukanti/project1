/** `#rrggbb` + alpha (0-1) -> `rgba()` string, for fading token colours. */
export const withAlpha = (hex: string, alpha: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(4)})`;
};
