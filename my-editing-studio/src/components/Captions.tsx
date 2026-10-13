import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {CAPTION, FONT} from '../design/tokens';
import {CAPTION_PRESETS, type CaptionVariant} from '../design/presets';
import {exitFrames, msToFrames} from '../lib/animate';
import type {SpokenWord} from '../lib/spine';
import {Presence} from './Presence';

export type CaptionPlacement = {x: number; y: number; width: number; align: 'left' | 'center'; /** Font size (defaults to CAPTION.size). */ size?: number};

type Chunk = {words: Array<{text: string; at: number}>; start: number; end: number};

const MAX_WORDS = 6;
const HOLD_MS = 350;
const MAX_GAP_SEC = 0.6;

/**
 * Split the script into short caption chunks: at sentence ends, clauses, pauses, paragraph
 * changes, forced breaks (e.g. layout moves), and around hidden words.
 */
export const buildChunks = (words: SpokenWord[], fps: number, hidden: Set<number>, breaks: number[]): Chunk[] => {
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;
  let prev: SpokenWord | null = null;

  const close = () => {
    if (current && current.words.length) chunks.push(current);
    current = null;
  };

  words.forEach((w, i) => {
    const at = Math.round(w.start * fps);
    if (hidden.has(i)) {
      close();
      prev = w;
      return;
    }
    if (current && prev) {
      const first = current.words[0].at;
      const shouldBreak =
        current.words.length >= MAX_WORDS ||
        /[.?!]$/.test(prev.text) ||
        (/[,;:]$/.test(prev.text) && current.words.length >= 3) ||
        w.start - prev.end > MAX_GAP_SEC ||
        w.paragraph !== prev.paragraph ||
        breaks.some((b) => b > first && b <= at);
      if (shouldBreak) close();
    }
    if (!current) current = {words: [], start: at, end: at};
    current.words.push({text: w.text, at});
    current.end = Math.round(w.end * fps);
    prev = w;
  });
  close();

  return chunks.map((c, i) => {
    const next = chunks[i + 1];
    const natural = c.end + msToFrames(HOLD_MS, fps);
    // A layout change (break) just after the last word ends the chunk there, so a caption never
    // lingers into the next scene.
    const nextBreak = breaks.find((b) => b > c.start && b < natural);
    const end = Math.min(natural, nextBreak !== undefined ? nextBreak - 1 : natural, next ? next.start - 1 : natural);
    return {...c, end: Math.max(c.start + 1, end)};
  });
};

/**
 * Word-by-word captions: each word sharpens into place as it is spoken, in short chunks.
 * `placement` is evaluated once per chunk (at its start), so text never reflows mid-chunk.
 */
export const Captions: React.FC<{
  words: SpokenWord[];
  hidden?: number[];
  breaks?: number[];
  placement: (frame: number) => CaptionPlacement | null;
  /** Named caption look from src/design/presets.ts. Defaults to the house style. */
  variant?: CaptionVariant;
}> = ({words, hidden = [], breaks = [], placement, variant = 'clean'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chunks = React.useMemo(() => buildChunks(words, fps, new Set(hidden), breaks), [words, fps, hidden, breaks]);

  const preset = CAPTION_PRESETS[variant];
  const chunk = chunks.find((c) => frame >= c.start - 1 && frame <= c.end);
  if (!chunk) return null;
  const place = placement(chunk.start);
  if (!place) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: place.x,
        top: place.y,
        width: place.width,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: place.align === 'center' ? 'center' : 'flex-start',
        fontFamily: FONT.sans,
        fontSize: place.size ?? CAPTION.size,
        fontWeight: CAPTION.weight,
        lineHeight: CAPTION.lineHeight,
        letterSpacing: CAPTION.tracking,
        color: CAPTION.color,
        textShadow: CAPTION.shadow,
      }}
    >
      {chunk.words.map((w, i) => {
        // "Being said now" runs from this word until the next one starts.
        const next = chunk.words[i + 1];
        const speaking = frame >= w.at && (!next || frame < next.at);
        return (
          <Presence
            key={`${chunk.start}-${i}`}
            as="span"
            at={w.at - 1}
            until={chunk.end - exitFrames('fast', fps)}
            dur="fast"
            distance={14}
            blur={8}
            scaleFrom={preset.scaleFrom}
            style={{display: 'inline-block', marginRight: '0.26em'}}
          >
            <span
              style={{
                display: 'inline-block',
                color: speaking && preset.activeColor ? preset.activeColor : undefined,
                backgroundColor: preset.background,
                padding: preset.padding,
                borderRadius: preset.radius,
                textShadow: preset.background ? 'none' : undefined,
              }}
            >
              {w.text}
            </span>
          </Presence>
        );
      })}
    </div>
  );
};
