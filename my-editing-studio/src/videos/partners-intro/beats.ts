/**
 * Hand-timed beat sheet for the partners clip, in seconds of the SOURCE (cut points found with
 * ffmpeg scene detection, who is on screen read from stills). The studio's spine normally comes
 * from a transcript; this clip had none because the speech models cannot be downloaded in the
 * sandbox this was built in, so every beat hangs off a visible cut instead of a spoken word.
 */
/** Who is who, by shirt: maroon polo, white shirt, blue shirt. Names confirmed by the owner. */
export const NAME = {maroon: 'Sampreeth', white: 'Aakanksh', blue: 'Prathyush'} as const;
export type Partner = keyof typeof NAME;
export const ROLE = 'Co-Founder';

/** Their Instagram handle, shown on the end card. */
export const BRAND_NAME = 'Civil Sense';

export const DURATION_S = 56.6;

/** Big name intros, where each partner first appears. */
export const INTROS: {at: number; until: number; who: Partner}[] = [
  {at: 3.4, until: 4.7, who: 'maroon'},
  {at: 5.0, until: 6.2, who: 'white'},
  {at: 6.45, until: 7.8, who: 'blue'},
];

/** Small corner tags when a partner comes back for a longer stretch. */
export const TAGS: {at: number; who: Partner}[] = [
  {at: 7.9, who: 'maroon'},
  {at: 12.1, who: 'white'},
  {at: 17.1, who: 'blue'},
  {at: 21.55, who: 'white'},
  {at: 29.2, who: 'blue'},
  {at: 36.7, who: 'maroon'},
];
export const TAG_HOLD_S = 1.6;

/** Cuts that get a flicker. The two cuts already hidden in the camera's own flash are left alone. */
export const FLICKER_AT = [3.33, 7.83, 12.03, 29.1, 36.57, 47.3, 51.7, 54.7];

export const SPLIT_AT = 38.4;
export const SPLIT_FOR_S = 3.6;
/** Source time each split row plays from. Row 0 is the live shot, so it continues the timeline. */
export const SPLIT_ROWS: {from: number; faceY: number; who: Partner}[] = [
  {from: SPLIT_AT, faceY: 0.4, who: 'maroon'},
  {from: 12.9, faceY: 0.34, who: 'white'},
  {from: 30.5, faceY: 0.27, who: 'blue'},
];

export const HOOK = {at: 0.25, until: 3.2};
export const END_AT = 54.7;
