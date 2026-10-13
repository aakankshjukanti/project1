"""Check that a green-screen clip is frame-aligned with its original.

Usage (from the project root):
    python scripts/check_pair.py <original> <greenscreen> [--samples 7]

At several points through the clip, compares the subject pixels of green-screen frame K with
original frames K-2..K+2. The offset with the smallest difference is the alignment; it must be the
same at every sample (otherwise the clips drift).
"""

import argparse
import json
import subprocess

import numpy as np
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent / 'lib'))
from media import FFMPEG, FFPROBE  # resolved per platform - never hardcode a tool path




OFFSETS = range(-2, 3)


def probe(path):
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0", "-count_frames",
         "-show_entries", "stream=width,height,r_frame_rate,nb_read_frames", "-of", "json", path],
        capture_output=True, text=True, check=True,
    )
    s = json.loads(out.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den), int(s["nb_read_frames"])


def frames(path, start, count, width, height, fps):
    out = subprocess.run(
        [FFMPEG, "-v", "error", "-ss", f"{start / fps:.6f}", "-i", path, "-frames:v", str(count),
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        capture_output=True, check=True,
    )
    data = np.frombuffer(out.stdout, dtype=np.uint8)
    return data.reshape(-1, height, width, 3).astype(np.float32)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("original")
    parser.add_argument("greenscreen")
    parser.add_argument("--samples", type=int, default=7)
    args = parser.parse_args()

    w1, h1, fps1, n1 = probe(args.original)
    w2, h2, fps2, n2 = probe(args.greenscreen)
    print(f"original:    {w1}x{h1} @ {fps1:.3f}fps, {n1} frames")
    print(f"greenscreen: {w2}x{h2} @ {fps2:.3f}fps, {n2} frames")
    if (w1, h1) != (w2, h2) or abs(fps1 - fps2) > 1e-3:
        print("MISMATCH: resolution or frame rate differ")
        return

    last = min(n1, n2) - 3
    points = np.linspace(3, last, args.samples).astype(int)
    results = []
    for k in points:
        green = frames(args.greenscreen, k, 1, w2, h2, fps2)[0]
        r, g, b = green[..., 0], green[..., 1], green[..., 2]
        background = (g > 120) & (g > r * 1.35) & (g > b * 1.35)
        subject = ~background
        # Erode the subject mask so blended edge pixels don't bias the comparison.
        for _ in range(4):
            subject = subject & np.roll(subject, 1, 0) & np.roll(subject, -1, 0) & np.roll(subject, 1, 1) & np.roll(subject, -1, 1)
        coverage = subject.mean()
        originals = frames(args.original, k + OFFSETS.start, len(OFFSETS), w1, h1, fps1)
        diffs = {off: float(np.abs(originals[i][subject] - green[subject]).mean()) for i, off in enumerate(OFFSETS) if i < len(originals)}
        best = min(diffs, key=diffs.get)
        results.append(best)
        pretty = "  ".join(f"{off:+d}:{d:5.2f}" for off, d in diffs.items())
        print(f"frame {k:5d} ({k / fps1:6.2f}s) subject {coverage:5.1%}  best offset {best:+d}   [{pretty}]")

    if len(set(results)) == 1:
        off = results[0]
        print(f"\nRESULT: aligned with a constant offset of {off:+d} frame(s)"
              + (" — perfect." if off == 0 else " — shift the green-screen clip to match."))
    else:
        print(f"\nRESULT: offsets vary {sorted(set(results))} — clips drift; re-export both from the same timeline.")


if __name__ == "__main__":
    main()
