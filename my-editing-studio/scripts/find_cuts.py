"""Find jump cuts in a talking-head clip (frames where the picture jumps instead of moving).

Usage (from the project root):
    python scripts/find_cuts.py <video> <out.json>

Writes a JSON array of frame numbers: each is the first frame AFTER a cut. Used to
 - punch in/out on each cut (the Stage `punchIns` prop), so cuts read as intentional camera changes
 - tell motion-check these changes are in the footage (--allow-file)
"""

import json
import subprocess
import sys

import numpy as np
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent / 'lib'))
from media import FFMPEG, FFPROBE  # resolved per platform - never hardcode a tool path



def main() -> None:
    video, out_path = sys.argv[1], sys.argv[2]
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", video, "-vf", "scale=320:180", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        capture_output=True,
        check=True,
    ).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, 180, 320).astype(np.float32)
    change = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
    typical = float(np.median(change))

    cuts = []
    for i in range(2, len(change) - 2):
        neighbours = float(np.median(np.concatenate([change[i - 2 : i], change[i + 1 : i + 3]])))
        # A cut: one transition far larger than both the clip's typical motion and its neighbours.
        if change[i] > 6 and change[i] > 4 * max(neighbours, typical):
            cuts.append(i + 1)

    json.dump(cuts, open(out_path, "w"), indent=0)
    print(f"{len(cuts)} cuts -> {out_path}: {cuts}")


if __name__ == "__main__":
    main()
