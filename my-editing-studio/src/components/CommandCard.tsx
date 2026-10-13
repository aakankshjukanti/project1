import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {withAlpha} from '../design/color';
import {COLOR, FONT, RADIUS, SHADOW, SPACE, TYPE, WEIGHT} from '../design/tokens';
import {EASE} from '../design/motion';
import {progress} from '../lib/animate';

/**
 * A command, typed out, as a designed graphic rather than a screen recording.
 *
 * Why this exists instead of zooming into the capture: the connect command carries the buyer's
 * licence key, and the key IS the URL — anyone who can read it has a free studio. Blurring it in
 * the capture is fragile, because the chat scrolls and the bubble moves, so a static mask misses
 * it and a tracked one drifts. Rebuilding the command as type means there is nothing to miss: the
 * key is never on screen in the first place, it is drawn as a redaction by design.
 *
 * It also reads better. A 1080p capture punched in to fill a 1920 frame is soft; this is sharp at
 * any zoom, in the brand's own colours, and the Mac and Windows variants can sit side by side,
 * which is impossible with one person's screen.
 *
 * MONOSPACE IS A DELIBERATE EXCEPTION. The design system says one family at every weight, and that
 * holds everywhere except here: a command is code, and proportional type makes a URL ambiguous at
 * exactly the moment someone is trying to read one. Nowhere else in the system gets this.
 */

export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export type Segment =
  /** Ordinary command text. */
  | {kind: 'plain'; text: string}
  /** Flags and switches — dimmed, because nobody needs to read them to follow along. */
  | {kind: 'flag'; text: string}
  /** The part that matters, in the accent. */
  | {kind: 'accent'; text: string}
  /**
   * A secret. Never pass the real value: `text` is only used for its LENGTH, so the redaction
   * is the right width. Pass dummy characters.
   */
  | {kind: 'redacted'; text: string; label?: string};

const COLOR_FOR: Record<Segment['kind'], string> = {
  plain: COLOR.fgOnDark,
  flag: COLOR.fgMuted,
  accent: COLOR.accent,
  redacted: 'transparent',
};

/** How long the typing takes, from how much there is to type. Long commands do not crawl. */
const typeFrames = (chars: number, fps: number) => Math.round((chars / 42) * fps);

const Redaction: React.FC<{width: number; label?: string}> = ({width, label}) => (
  <span
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width,
      height: '1.15em',
      verticalAlign: 'middle',
      borderRadius: RADIUS.sm / 2,
      // Accent at low alpha, not a grey smear: it reads as a deliberate mark rather than a mistake.
      backgroundColor: withAlpha(COLOR.accent, 0.18),
      border: `2px solid ${withAlpha(COLOR.accent, 0.4)}`,
    }}
  >
    <span
      style={{
        fontFamily: FONT.sans,
        fontSize: '0.56em',
        fontWeight: WEIGHT.semibold,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: COLOR.accent,
        whiteSpace: 'nowrap',
      }}
    >
      {label ?? 'your key'}
    </span>
  </span>
);

export const CommandCard: React.FC<{
  segments: Segment[];
  /** Frame the card lands on. Typing starts once it has settled. */
  at: number;
  /** Shown in the title bar. Omit for a card that is the same on both platforms. */
  platform?: 'windows' | 'mac';
  /** Replaces the platform chip — e.g. "same on Mac and Windows". */
  note?: string;
  fontSize?: number;
  width?: number;
}> = ({segments, at, platform, note, fontSize = 34, width}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // The card arrives, THEN types. Typing while the card is still moving reads as two
  // competing animations and the eye does not know where to settle.
  const land = progress(frame, at, Math.round(0.4 * fps), EASE.out);

  const total = segments.reduce((n, s) => n + s.text.length, 0);
  const typed = progress(frame, at + Math.round(0.3 * fps), typeFrames(total, fps), EASE.inOut);
  const shown = Math.floor(typed * total);

  // A caret that blinks only once typing has finished, the way a real prompt does.
  const done = typed >= 1;
  const caretOn = !done || Math.floor((frame / fps) * 2) % 2 === 0;

  let consumed = 0;

  return (
    <div
      style={{
        width,
        maxWidth: '100%',
        borderRadius: RADIUS.md,
        backgroundColor: COLOR.surfaceDark,
        boxShadow: SHADOW.pop,
        overflow: 'hidden',
        opacity: land,
        transform: `translateY(${(1 - land) * 28}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          padding: `${SPACE[2]}px ${SPACE[3]}px`,
          backgroundColor: COLOR.borderStrong,
          borderBottom: `2px solid ${withAlpha(COLOR.fgOnDark, 0.08)}`,
        }}
      >
        {[COLOR.fgSecondary, COLOR.fgSecondary, COLOR.fgSecondary].map((c, i) => (
          <span key={i} style={{width: 14, height: 14, borderRadius: RADIUS.pill, backgroundColor: c}} />
        ))}
        <span style={{flex: 1}} />
        <span
          style={{
            fontFamily: FONT.sans,
            fontSize: TYPE.eyebrow.size * 0.62,
            fontWeight: WEIGHT.medium,
            letterSpacing: TYPE.eyebrow.tracking,
            textTransform: 'uppercase',
            color: note ? COLOR.accent : COLOR.fgMuted,
          }}
        >
          {note ?? (platform === 'mac' ? 'macOS' : platform === 'windows' ? 'Windows' : '')}
        </span>
      </div>

      <div
        style={{
          padding: `${SPACE[4]}px ${SPACE[4]}px ${SPACE[4]}px`,
          fontFamily: MONO,
          fontSize,
          lineHeight: 1.65,
          letterSpacing: '-0.01em',
          color: COLOR.fgOnDark,
          wordBreak: 'break-word',
        }}
      >
        {segments.map((seg, i) => {
          const start = consumed;
          consumed += seg.text.length;
          const visible = Math.max(0, Math.min(seg.text.length, shown - start));
          if (visible === 0) return null;

          if (seg.kind === 'redacted') {
            // Reveal the redaction as one block once typing reaches it, rather than growing it
            // character by character, which would look like the secret is being drawn in.
            const w = seg.text.length * fontSize * 0.6;
            return <Redaction key={i} width={w} label={seg.label} />;
          }

          return (
            <span key={i} style={{color: COLOR_FOR[seg.kind]}}>
              {seg.text.slice(0, visible)}
            </span>
          );
        })}
        <span
          style={{
            display: 'inline-block',
            width: fontSize * 0.55,
            height: '1.05em',
            marginLeft: 4,
            verticalAlign: 'text-bottom',
            backgroundColor: COLOR.accent,
            opacity: caretOn ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ the real commands */

/**
 * The connect line. Identical on Mac and Windows, which is worth SAYING rather than showing
 * twice: a Mac viewer watching a Windows walkthrough is waiting to find out what is different
 * for them, and "nothing, here" is the answer that keeps them watching.
 */
export const CONNECT_SEGMENTS: Segment[] = [
  {kind: 'plain', text: 'claude mcp add '},
  {kind: 'flag', text: '--scope user --transport http '},
  {kind: 'accent', text: 'creator-editing-os'},
  {kind: 'plain', text: ' <your connector URL>'},
  {kind: 'redacted', text: 'XXXX-XXXX-XXXX-XXXX'},
];

/** Where the two platforms genuinely differ: installing Node when it is missing. */
export const NODE_INSTALL = {
  windows: [
    {kind: 'plain', text: 'winget install '},
    {kind: 'accent', text: 'OpenJS.NodeJS.LTS'},
  ] as Segment[],
  mac: [
    {kind: 'plain', text: 'brew install '},
    {kind: 'accent', text: 'node'},
  ] as Segment[],
};

/** And where the studio lands. */
export const STUDIO_PATH = {
  windows: [{kind: 'plain', text: 'C:\\Users\\you\\'}, {kind: 'accent', text: 'VideoStudio'}] as Segment[],
  mac: [{kind: 'plain', text: '/Users/you/'}, {kind: 'accent', text: 'VideoStudio'}] as Segment[],
};
