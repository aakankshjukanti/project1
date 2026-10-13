import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

/**
 * YOUR LOOK. Every colour, size, radius and shadow in every video comes from this file.
 * Nothing else in the studio is allowed to hand-type a colour or a font size.
 *
 * This is the one file that is yours rather than the system's. Change these values and
 * every component, every caption and every video changes with them. Everything else —
 * the components, the motion laws, the checks — stays the same for everybody.
 *
 * To set it up from a brand you like, ask: "build my design system from <url>".
 *
 * Sizes are for a 1080-wide frame watched on a phone. Web body 16px ≈ video body 42px,
 * which is roughly a 2.6x scale if you are translating a website.
 */

/**
 * The starting font. It loads from Google Fonts, so there is no file to find and your
 * first render works immediately.
 *
 * When you switch to your real brand font, put the files in `assets/fonts/` and swap
 * these three lines for:
 *
 *   import {loadFont} from '@remotion/fonts';
 *   import {staticFile} from 'remotion';
 *   const fontFamily = 'YourFont';
 *   loadFont({family: fontFamily, url: staticFile('fonts/YourFont.ttf'), weight: '100 900', style: 'normal'});
 *
 * A font that fails to load does not error — it silently falls back and nothing looks
 * like your brand, so check a still after changing this.
 */
const fontFamily = 'Anton';
loadFont({family: fontFamily, url: staticFile('fonts/Anton.ttf'), weight: '400', style: 'normal'});
loadFont({family: 'Playfair Display', url: staticFile('fonts/PlayfairDisplay.ttf'), weight: '400 900', style: 'normal'});
loadFont({family: 'Kaushan Script', url: staticFile('fonts/KaushanScript.ttf'), weight: '400', style: 'normal'});

/** sans = heavy titles (Anton). serif = spoken captions (Playfair Display). script = brush accent words (Kaushan Script). */
export const FONT = {
  sans: `"${fontFamily}", Impact, "Arial Narrow", sans-serif`,
  serif: `"Playfair Display", Georgia, serif`,
  script: `"Kaushan Script", cursive`,
} as const;

/** Anton ships one weight. Asking for bold would fake it and smear the letters. */
export const WEIGHT = {
  regular: 400,
  medium: 400,
  semibold: 400,
  bold: 400,
  black: 400,
} as const;

/**
 * Your raw brand colours. Name them however your brand names them.
 *
 * These are deliberately plain placeholders — a neutral grey and one restrained blue.
 * They are meant to be replaced, not shipped. Nothing here belongs to anyone else's
 * brand, so a video made before you set your own look is obviously unbranded rather
 * than quietly wearing somebody else's colours.
 */
export const PALETTE = {
  ink900: '#111111',
  ink800: '#1a1a1a',
  ink600: '#444444',
  stone600: '#6b6b6b',
  stone400: '#a3a3a3',
  stone200: '#e6e6e6',
  cream: '#f5f5f5',
  paper: '#fafafa',
  white: '#ffffff',
  accent: '#d80000',
  accentStrong: '#a80000',
  yellow: '#f8bc3c',
} as const;

/**
 * What each colour is FOR. Components read these, never PALETTE directly, so you can
 * change your accent in one place. Keep one accent colour — two is already a design
 * problem, three is a mess.
 */
export const COLOR = {
  accent: PALETTE.accent,
  /** Second title colour from the reference edit. Use it for small lead-in words and two-tone titles, never for body text. */
  accent2: PALETTE.yellow,
  accentStrong: PALETTE.accentStrong,
  onAccent: PALETTE.white,
  fg: PALETTE.ink800,
  /** Secondary text. Must stay above 4.5:1 on your background or it is decoration, not text. */
  fgSecondary: PALETTE.stone600,
  /** Decoration only — too light to read. Never put words people must read in this. */
  fgMuted: PALETTE.stone400,
  fgOnDark: PALETTE.white,
  surface: PALETTE.white,
  surfaceAlt: PALETTE.cream,
  surfaceDark: PALETTE.ink900,
  paper: PALETTE.paper,
  borderSubtle: PALETTE.stone200,
  borderStrong: PALETTE.ink800,
} as const;

/** Display is capped so a long word still fits a 1080 frame. */
export const TYPE = {
  display: {size: 170, lineHeight: 1.05, tracking: '0em', weight: WEIGHT.black},
  h1: {size: 124, lineHeight: 1.08, tracking: '0em', weight: WEIGHT.black},
  h2: {size: 92, lineHeight: 1.1, tracking: '0em', weight: WEIGHT.bold},
  h3: {size: 66, lineHeight: 1.2, tracking: '0em', weight: WEIGHT.semibold},
  bodyLg: {size: 48, lineHeight: 1.4, tracking: '0em', weight: WEIGHT.regular},
  body: {size: 42, lineHeight: 1.45, tracking: '0em', weight: WEIGHT.regular},
  caption: {size: 34, lineHeight: 1.3, tracking: '0em', weight: WEIGHT.medium},
  eyebrow: {size: 30, lineHeight: 1.2, tracking: '0.08em', weight: WEIGHT.medium},
  stat: {size: 150, lineHeight: 1, tracking: '0em', weight: WEIGHT.black},
} as const;

/** 10px base. Use these, not arbitrary numbers. */
export const SPACE = {
  1: 10, 2: 20, 3: 30, 4: 40, 5: 50, 6: 60, 8: 80, 10: 100, 12: 120, 16: 160, 20: 200,
} as const;

export const RADIUS = {
  sm: 20,
  md: 36,
  lg: 52,
  xl: 72,
  pill: 999,
} as const;

/** Soft, large-radius, low-contrast. Never a hard drop shadow. */
export const SHADOW = {
  card: '0 3px 6px rgba(23,23,20,0.04), 0 20px 60px -20px rgba(23,23,20,0.08)',
  pop: '0 5px 10px rgba(23,23,20,0.06), 0 40px 100px -30px rgba(23,23,20,0.14)',
} as const;

/** The marker that wipes behind a key phrase. em units so it scales with the text. */
export const HIGHLIGHT = {
  color: PALETTE.accent,
  padX: '0.12em',
  radius: '0.12em',
  top: '0.1em',
  bottom: '-0.02em',
} as const;

export const BACKGROUND = {
  heroGradient: `linear-gradient(135deg, ${PALETTE.accent} 0%, ${PALETTE.cream} 45%, ${PALETTE.paper} 100%)`,
  creamGlow: `radial-gradient(60% 40% at 85% 12%, ${PALETTE.accent}55 0%, ${PALETTE.cream}00 70%), ${PALETTE.cream}`,
  gridLine: 'rgba(255,255,255,0.6)',
  gridSize: 108,
  gridLineWidth: 2,
  gridMask: 'radial-gradient(circle at 70% 28%, rgba(0,0,0,0.9) 0%, transparent 62%)',
} as const;

/** Captions: readable on light walls and dark footage alike. */
export const CAPTION = {
  size: 46,
  weight: WEIGHT.bold,
  lineHeight: 1.16,
  tracking: '0em',
  color: PALETTE.white,
  /** Spoken captions in the reference are serif, not the title face. */
  family: FONT.serif,
  shadow: '0 2px 2px rgba(18,18,16,0.35), 0 4px 18px rgba(18,18,16,0.45)',
} as const;

/** Big headline text behind the subject. */
export const HERO = {
  size: 300,
  color: PALETTE.accent,
  /** RGB of the glow, so it can fade with the text. */
  /** Must match `accent` above, as r,g,b. Change both together. */
  glowRgb: '216,0,0',
  /** Dark lift under the glow, so the colour separates from a light wall. */
  liftRgb: '18,18,16',
} as const;

/** Dark fade at the bottom of a video card, so white captions sit on it. */
export const SCRIM =
  'linear-gradient(to top, rgba(18,18,16,0.72) 0%, rgba(18,18,16,0.35) 22%, rgba(18,18,16,0) 42%)';

/** The browser window mockup. Light Mac-style chrome. */
export const MOCKUP = {
  bar: '#E9E9EB',
  barDivider: '#DCDCDF',
  close: '#E5484D',
  minimize: '#F2B21B',
  maximize: '#2EB67D',
  navButton: '#FFFFFF',
  navIcon: '#77777C',
  urlField: '#FFFFFF',
  urlText: '#8A8A8F',
  content: '#FFFFFF',
  barHeight: 64,
  radius: 28,
} as const;

/** 9:16 — Reels, Shorts, TikTok. safeTop/safeBottom keep text out of the platform UI. */
export const LAYOUT = {
  width: 1080,
  height: 1920,
  fps: 30,
  margin: 96,
  safeTop: 250,
  safeBottom: 420,
} as const;

/** 16:9 — YouTube and landscape deliverables. */
export const WIDE = {
  width: 1920,
  height: 1080,
  fps: 30,
  margin: 96,
} as const;

/**
 * Cinematic grade for talking-head footage, from the cool, muted reference stills: pull saturation
 * back slightly, add contrast, then wash a cold tint and a soft vignette over the top. Footage
 * must already be tone-mapped to SDR (phone HLG clips look milky otherwise).
 */
export const GRADE = {
  filter: 'contrast(1.1) saturate(0.84)',
  tint: 'rgba(8, 26, 38, 0.2)',
  vignette: 'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
} as const;

/**
 * The flicker edit (reference 0:22-0:28): a few frames of light that punch a cut. One entry per
 * frame, in order: which colour flashes and how strongly. 'light' = white, 'accent' = brand red.
 */
export const FLICKER = [
  {tone: 'light', opacity: 0.85},
  {tone: 'light', opacity: 0},
  {tone: 'accent', opacity: 0.7},
  {tone: 'light', opacity: 0},
  {tone: 'light', opacity: 0.35},
] as const;

/** Soft dark lift behind titles so red and yellow hold up on mid-grey concrete and bright sky alike. */
export const TITLE_SHADOW = '0 4px 28px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4)';

/** The stacked split frame (reference 0:05-0:11): three rows with a thin gap of ink between. */
export const SPLIT = {
  rows: 3,
  gap: 8,
  /** How far each row's footage is scaled up so faces read at a third of the frame. */
  zoom: 1.3,
} as const;
