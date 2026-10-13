"""Give every word of the written script a time, using the WhisperX word timings.

Usage (from the project root):
    python scripts/align_script.py <script.txt> <words.json> <out.json>

The script is the text truth (spelling, names, numbers); the transcript only provides timing.
Script words are matched to spoken words in order (difflib). Words the speaker skipped or
changed get times interpolated between the nearest matched neighbours, proportional to length.
Spoken ad-libs that are not in the script are ignored.
"""

import difflib
import json
import re
import sys


def keys(token: str) -> list[str]:
    """Comparable keys for a word: lowercase, no punctuation, hyphenated parts split,
    so "12-pack" matches spoken "12 pack" and "$26.50" matches spoken "2650"."""
    parts = re.split(r"[-/]", token.lower())
    out = []
    for part in parts:
        norm = re.sub(r"[^a-z0-9]", "", part.replace("'", ""))
        if norm:
            out.append(norm)
    return out


def main() -> None:
    script_path, words_path, out_path = sys.argv[1:4]
    script = open(script_path, encoding="utf-8").read()
    spoken = json.load(open(words_path, encoding="utf-8"))["words"]

    # Script tokens, remembering sentence and paragraph boundaries.
    tokens = []
    for p_index, paragraph in enumerate(l for l in script.splitlines() if l.strip()):
        for raw in paragraph.split():
            tokens.append({"text": raw, "paragraph": p_index, "keys": keys(raw)})

    script_keys, key_owner = [], []
    for i, t in enumerate(tokens):
        for k in t["keys"]:
            script_keys.append(k)
            key_owner.append(i)

    spoken_keys, spoken_owner = [], []
    for j, w in enumerate(spoken):
        for k in keys(w["word"]):
            spoken_keys.append(k)
            spoken_owner.append(j)

    matcher = difflib.SequenceMatcher(a=script_keys, b=spoken_keys, autojunk=False)
    times: dict[int, list[float]] = {}
    for block in matcher.get_matching_blocks():
        for n in range(block.size):
            ti = key_owner[block.a + n]
            w = spoken[spoken_owner[block.b + n]]
            if w["start"] is None:
                continue
            span = times.setdefault(ti, [w["start"], w["end"]])
            span[0] = min(span[0], w["start"])
            span[1] = max(span[1], w["end"])

    audio_end = max(w["end"] for w in spoken if w["end"] is not None)
    matched = sorted(times)
    # Interpolate unmatched runs between matched neighbours, weighted by text length.
    i = 0
    while i < len(tokens):
        if i in times:
            i += 1
            continue
        run_start = i
        while i < len(tokens) and i not in times:
            i += 1
        left = times[run_start - 1][1] if run_start - 1 in times else 0.0
        right = times[i][0] if i in times else audio_end
        run = tokens[run_start:i]
        total = sum(len(t["text"]) for t in run) or 1
        cursor = left
        for offset, t in enumerate(run):
            share = (right - left) * len(t["text"]) / total
            times[run_start + offset] = [cursor, cursor + share]
            cursor += share

    out = []
    for i, t in enumerate(tokens):
        start, end = times[i]
        out.append(
            {
                "text": t["text"],
                "start": round(start, 3),
                "end": round(end, 3),
                "paragraph": t["paragraph"],
                "matched": i in matched,
            }
        )
    json.dump({"audioEnd": round(audio_end, 3), "words": out}, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

    unmatched = [(o["text"], o["start"]) for o in out if not o["matched"]]
    print(f"script words: {len(out)} | matched to speech: {len(matched)} | interpolated: {len(unmatched)}")
    print("interpolated:", " ".join(f"{t}@{s:.1f}" for t, s in unmatched))


if __name__ == "__main__":
    main()
