"""Build a transparent cutout of the subject for a frame range, from ordinary footage.

Usage (from the project root):
    python scripts/make_cutout.py <video> <out_dir> <first_frame> <last_frame>
    python scripts/make_cutout.py <video> <out_dir> <first> <last> --alpha-from <clip>
    python scripts/make_cutout.py <video> <out_dir> <first> <last> --model full

Writes RGBA PNGs named f<frame>.png (absolute source frame numbers), so a composition can map
composition frames to cutout frames directly.

No green screen. The matte is segmented from the footage itself, because asking a customer to
shoot against green makes the feature unavailable to almost all of them - most have never done
it and do not know the term.

--alpha-from stays for the case where a background-free or green copy already exists, which is
faster and still sharper on hair. It is used ONLY for the alpha; colour always comes from the
original clip, so no green ever reaches the subject's edges.

Two things decide whether this reads as real rather than pasted on:

  * The alpha is smoothed ACROSS frames. A per-frame matte shimmers along the edge, and type
    sitting against someone's head is precisely where the eye catches it. A 3-frame median kills
    single-frame flicker without the lag an average introduces on fast motion.
  * The edge is choked before it is feathered, so the old background cannot leak into the seam.

It is worst where it is most visible: flyaway hair, motion blur, a hand crossing the text. If a
shot will not hold, move the text rather than ship a halo.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
import sys as _sys, pathlib as _pl
_sys.path.insert(0, str(_pl.Path(__file__).resolve().parent / 'lib'))
from media import FFMPEG, FFPROBE  # resolved per platform - never hardcode a tool path

MODELS = {"lite": "ZhengPeng7/BiRefNet_lite", "full": "ZhengPeng7/BiRefNet"}
SEG_SIZE = 1024


def probe(path: str):
    """Real dimensions and frame rate. Never assume 1920x1080 at 30 - vertical phone footage is normal."""
    out = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json", "-show_streams", "-select_streams", "v:0", path],
        capture_output=True, text=True, check=True,
    ).stdout
    s = json.loads(out)["streams"][0]
    num, den = (s.get("r_frame_rate") or "30/1").split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den or 1)


def read_frames(path: str, first: int, count: int, w: int, h: int, fps: float):
    proc = subprocess.Popen(
        [FFMPEG, "-v", "error", "-ss", f"{first / fps:.6f}", "-i", path, "-frames:v", str(count),
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE,
    )
    size = w * h * 3
    for _ in range(count):
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    proc.stdout.close()
    proc.wait()


def green_matte(green: np.ndarray) -> np.ndarray:
    """Alpha 0..1 from how green each pixel is, relative to the flat background green."""
    g = green.astype(np.float32)
    greenness = g[..., 1] - np.maximum(g[..., 0], g[..., 2])
    background = np.median(greenness[greenness > 60]) if (greenness > 60).any() else 150.0
    lo, hi = 0.2 * background, 0.7 * background
    t = np.clip((greenness - lo) / (hi - lo), 0, 1)
    return 1 - t * t * (3 - 2 * t)  # smoothstep: soft, stable edge


def load_segmenter(which: str):
    """BiRefNet, lazily. Importing torch costs seconds; do not pay it on the --alpha-from path."""
    try:
        import torch
        from transformers import AutoModelForImageSegmentation
    except ModuleNotFoundError as exc:
        print(f"Cannot import {exc.name}. The matting model needs the studio's Python environment.", file=sys.stderr)
        print("  see what is installed with:  npm run doctor", file=sys.stderr)
        raise SystemExit(2)

    # trust_remote_code: these repos ship their own model class, which transformers executes.
    model = AutoModelForImageSegmentation.from_pretrained(MODELS[which], trust_remote_code=True)
    model.eval()
    # float32 on CPU: half precision is slower there rather than faster, and can produce NaNs.
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model.to(device)
    return torch, model, device


def segment(torch, model, device, rgb: np.ndarray) -> np.ndarray:
    """Alpha 0..1 for one frame, returned at the frame's own resolution."""
    h, w = rgb.shape[:2]
    img = Image.fromarray(rgb).resize((SEG_SIZE, SEG_SIZE), Image.BILINEAR)
    x = np.asarray(img, dtype=np.float32) / 255.0
    x = (x - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    t = torch.from_numpy(x).permute(2, 0, 1).unsqueeze(0).to(device)
    with torch.no_grad():
        pred = model(t)[-1].sigmoid()[0, 0].cpu().numpy()
    return np.asarray(Image.fromarray((pred * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR), np.float32) / 255.0


def smooth_in_time(alphas):
    """3-frame median. Removes single-frame flicker without the lag an average would add."""
    if len(alphas) < 3:
        return alphas
    out = [alphas[0]]
    for i in range(1, len(alphas) - 1):
        out.append(np.median(np.stack([alphas[i - 1], alphas[i], alphas[i + 1]]), axis=0))
    out.append(alphas[-1])
    return out


def clean_edge(alpha: np.ndarray) -> np.ndarray:
    """Choke by a pixel so the old background cannot leak into the seam, then feather lightly."""
    choked = np.minimum.reduce([alpha, np.roll(alpha, 1, 0), np.roll(alpha, -1, 0), np.roll(alpha, 1, 1), np.roll(alpha, -1, 1)])
    return (choked * 4 + np.roll(choked, 1, 0) + np.roll(choked, -1, 0) + np.roll(choked, 1, 1) + np.roll(choked, -1, 1)) / 8


def main() -> None:
    ap = argparse.ArgumentParser(description="Transparent cutout of the subject, from ordinary footage.")
    ap.add_argument("video")
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("first", type=int)
    ap.add_argument("last", type=int)
    ap.add_argument("--alpha-from", default=None,
                    help="Optional background-free or green copy of the SAME take, used only for the alpha.")
    ap.add_argument("--model", choices=sorted(MODELS), default="lite",
                    help="lite is several times faster and good enough for most shots; full is sharper on hair.")
    args = ap.parse_args()

    w, h, fps = probe(args.video)
    count = args.last - args.first + 1
    args.out_dir.mkdir(parents=True, exist_ok=True)

    frames = list(read_frames(args.video, args.first, count, w, h, fps))
    if not frames:
        print("No frames read - check the frame range against the clip's length.", file=sys.stderr)
        raise SystemExit(1)

    if args.alpha_from:
        aw, ah, afps = probe(args.alpha_from)
        if (aw, ah) != (w, h) or abs(afps - fps) > 0.01:
            print(f"The alpha clip does not match: {aw}x{ah}@{afps:.2f} against {w}x{h}@{fps:.2f}.", file=sys.stderr)
            print("A mismatched pair makes a halo or a ghost. Re-export it to match, or drop --alpha-from.", file=sys.stderr)
            raise SystemExit(1)
        print(f"Alpha from the supplied clip, colour from the original - {count} frames.")
        alphas = [green_matte(g) for g in read_frames(args.alpha_from, args.first, count, w, h, fps)]
    else:
        print(f"Segmenting {count} frames at {w}x{h} with BiRefNet ({args.model}).")
        print("The first run downloads the model. On a CPU expect a second or two per frame.")
        torch, model, device = load_segmenter(args.model)
        print(f"Running on {device}.")
        alphas = []
        for i, rgb in enumerate(frames):
            alphas.append(segment(torch, model, device, rgb))
            if (i + 1) % 10 == 0 or i + 1 == count:
                print(f"  {i + 1}/{count}", flush=True)

    for i, a in enumerate(smooth_in_time(alphas)):
        alpha = (clean_edge(a).clip(0, 1) * 255).round().astype(np.uint8)
        Image.fromarray(np.dstack([frames[i], alpha]), "RGBA").save(
            args.out_dir / f"f{args.first + i}.png", compress_level=1
        )

    print(f"wrote {len(alphas)} frames to {args.out_dir}")


if __name__ == "__main__":
    main()
