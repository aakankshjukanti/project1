/**
 * Script-timed words: every animation start comes from when a word is spoken.
 * Words come from scripts/align_script.py (script text + WhisperX timing).
 */

export type SpokenWord = {text: string; start: number; end: number; paragraph: number; matched: boolean};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const createSpine = (words: SpokenWord[], fps: number) => {
  const find = (phrase: string, occurrence = 1): {first: number; last: number} => {
    const target = phrase.split(/\s+/).map(key).filter(Boolean);
    let seen = 0;
    for (let i = 0; i + target.length <= words.length; i++) {
      if (target.every((k, j) => key(words[i + j].text) === k) && ++seen === occurrence) {
        return {first: i, last: i + target.length - 1};
      }
    }
    throw new Error(`Phrase not found in script: "${phrase}" (occurrence ${occurrence})`);
  };

  return {
    words,
    find,
    /** Frame the phrase starts being spoken. */
    at: (phrase: string, occurrence = 1) => Math.round(words[find(phrase, occurrence).first].start * fps),
    /** Frame the phrase finishes. */
    until: (phrase: string, occurrence = 1) => Math.round(words[find(phrase, occurrence).last].end * fps),
    /** Word indexes covered by a phrase, e.g. to hide them from captions. */
    indexes: (phrase: string, occurrence = 1): number[] => {
      const {first, last} = find(phrase, occurrence);
      return Array.from({length: last - first + 1}, (_, i) => first + i);
    },
  };
};

export type Spine = ReturnType<typeof createSpine>;
