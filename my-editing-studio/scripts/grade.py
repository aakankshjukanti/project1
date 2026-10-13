"""Build a colour-grade LUT that moves footage towards the look of reference images.

Usage (from the project root):
    python scripts/grade.py <source_frames_dir> <out.cube> <ref.png> [<ref.png> ...]
        [--tone 0.8] [--tint 0.85] [--sat 0.8] [--greens 0.8] [--strength 1.0] [--report out.json]

Everything happens in CIE Lab, and every step is a function of the pixel colour only, so the whole
grade bakes into a 33^3 .cube LUT (usable in ffmpeg `lut3d` and Premiere Lumetri):

  1. tone     — contrast shape matched to the references (quantile matching of L), keeping part of the
                footage's own exposure (EXPOSURE_KEEP) so dusk footage isn't lifted flat.
  2. tint     — colour of shadows / mids / highlights (split toning), measured on low-to-moderate
                chroma surfaces, so strongly coloured content (grass, clothes) doesn't leak into the grade.
  3. sat      — overall saturation towards the references' chroma level.
  4. greens   — hue and saturation of foliage towards the references' greens (e.g. olive/yellow).
  Skin (orange hues) is protected: no hue rotation and no desaturation below 95%.
"""

import argparse
import json
import os

import numpy as np
from PIL import Image

M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
M_INV = np.linalg.inv(M)
WHITE = np.array([0.95047, 1.0, 1.08883])
D = 6 / 29


def srgb_to_lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    xyz = c @ M.T / WHITE
    f = np.where(xyz > D**3, np.cbrt(xyz), xyz / (3 * D * D) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def lab_to_srgb(lab):
    fy = (lab[..., 0] + 16) / 116
    f = np.stack([fy + lab[..., 1] / 500, fy, fy - lab[..., 2] / 200], axis=-1)
    xyz = np.where(f > D, f**3, 3 * D * D * (f - 4 / 29)) * WHITE
    lin = np.clip(xyz @ M_INV.T, 0, 1)
    return np.clip(np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055), 0, 1)


def load(path, max_side=640):
    img = Image.open(path).convert("RGB")
    img.thumbnail((max_side, max_side))
    a = np.asarray(img, dtype=np.float64) / 255
    # Trim uniform borders (letterbox bars, white frames) — they are not part of the look.
    rows = a.std(axis=(1, 2)) > 0.02
    cols = a.std(axis=(0, 2)) > 0.02
    if rows.any() and cols.any():
        a = a[np.argmax(rows) : len(rows) - np.argmax(rows[::-1]), np.argmax(cols) : len(cols) - np.argmax(cols[::-1])]
    return a


def pixels(paths):
    lab = np.concatenate([srgb_to_lab(load(p)).reshape(-1, 3) for p in paths])
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    # Drop overlay text / UI (pure white or pure black) from the statistics.
    keep = ~(((lab[:, 0] > 96) & (chroma < 4)) | (lab[:, 0] < 1))
    return lab[keep]


BANDS = (15.0, 45.0, 80.0)  # shadow / mid / highlight centres in L
NEUTRAL_MAX = 32.0  # chroma below this counts towards the tint estimate
EXPOSURE_KEEP = 0.45  # 0 = match reference exposure fully, 1 = keep footage exposure


def band_weights(L):
    w = np.stack([np.exp(-0.5 * ((L - c) / 16) ** 2) for c in BANDS], axis=-1)
    return w / np.maximum(w.sum(axis=-1, keepdims=True), 1e-9)


def neutral_tint(lab):
    """Mean a/b of near-neutral pixels per brightness band (the grade's tint, not the scene's colours)."""
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    # Low-to-moderate chroma surfaces carry the grade's tint (sunlit walls, skin highlights); strongly
    # coloured objects (grass, clothes) are excluded, and lower-chroma pixels count more.
    sel = chroma < NEUTRAL_MAX
    n = lab[sel]
    trust = 1 - chroma[sel] / NEUTRAL_MAX
    w = band_weights(n[:, 0]) * trust[:, None]
    return np.array([[np.average(n[:, k], weights=w[:, i] + 1e-9) for k in (1, 2)] for i in range(len(BANDS))])


def hue_deg(lab):
    return np.degrees(np.arctan2(lab[..., 2], lab[..., 1])) % 360


GREEN = (95.0, 175.0)
SKIN = (15.0, 75.0)


def greens_stats(lab):
    h = hue_deg(lab)
    c = np.hypot(lab[:, 1], lab[:, 2])
    g = (h > GREEN[0]) & (h < GREEN[1]) & (c > 8)
    if g.sum() < 200:
        return None
    ang = np.radians(h[g])
    mean_h = np.degrees(np.arctan2(np.average(np.sin(ang), weights=c[g]), np.average(np.cos(ang), weights=c[g]))) % 360
    return {"hue": float(mean_h), "chroma": float(np.percentile(c[g], 75))}


def window(h, lo, hi, soft=15.0):
    """1 inside [lo, hi], cosine fall-off over `soft` degrees outside."""
    d = np.maximum(lo - h, 0) + np.maximum(h - hi, 0)
    return np.where(d >= soft, 0.0, 0.5 + 0.5 * np.cos(np.pi * np.clip(d / soft, 0, 1)))


def build(src, tgt, tone, tint, sat, greens):
    qs = np.linspace(0.5, 99.5, 41)
    src_q = np.percentile(src[:, 0], qs)
    tgt_q = np.percentile(tgt[:, 0], qs)
    src_q = np.maximum.accumulate(src_q + np.arange(len(qs)) * 1e-6)
    # Match contrast shape, not absolute exposure: pull the target curve part-way back to the
    # footage's own median, so a dusk shot is not lifted into a flat, washed look.
    tgt_q = tgt_q - EXPOSURE_KEEP * (np.median(tgt[:, 0]) - np.median(src[:, 0]))
    tgt_q = np.clip(tgt_q, 0, 100)
    shift = neutral_tint(tgt) - neutral_tint(src)
    sat_ratio = float(np.clip(np.percentile(np.hypot(tgt[:, 1], tgt[:, 2]), 85) / np.percentile(np.hypot(src[:, 1], src[:, 2]), 85), 0.7, 1.15))
    gs, gt = greens_stats(src), greens_stats(tgt)
    if gs and gt:
        g_rot = float(np.clip(((gt["hue"] - gs["hue"] + 180) % 360) - 180, -30, 30))
        g_sat = float(np.clip(gt["chroma"] / gs["chroma"], 0.55, 1.1))
    else:
        g_rot, g_sat = 0.0, 1.0
    params = {"tone_src_q": src_q.tolist(), "tone_tgt_q": tgt_q.tolist(), "tint_shift": shift.tolist(), "sat_ratio": sat_ratio, "green_rot_deg": g_rot, "green_sat": g_sat}

    def apply(lab):
        L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
        # 1. tone
        L2 = L + tone * (np.interp(L, src_q, tgt_q) - L)
        h = hue_deg(lab)
        c = np.hypot(a, b)
        skin = window(h, *SKIN) * np.clip(c / 12, 0, 1)
        grn = window(h, *GREEN, soft=20) * np.clip(c / 8, 0, 1)
        # 3 + 4. saturation (skin never below 95%) and greens
        s = 1 + sat * (sat_ratio - 1)
        s = np.where(skin > 0, np.maximum(s, 0.95 * skin + s * (1 - skin)), s)
        s = s * (1 + greens * grn * (g_sat - 1))
        rot = np.radians(greens * grn * g_rot)
        h2 = np.arctan2(b, a) + rot
        c2 = c * s
        a2, b2 = c2 * np.cos(h2), c2 * np.sin(h2)
        # 2. tint (split toning) by the new brightness; skin gets 70% of it
        w = band_weights(L2)
        da = (w * shift[:, 0]).sum(axis=-1)
        db = (w * shift[:, 1]).sum(axis=-1)
        k = tint * (1 - 0.15 * skin)
        return np.stack([np.clip(L2, 0, 100), a2 + k * da, b2 + k * db], axis=-1)

    return apply, params


def write_cube(path, fn, strength, size=33):
    g = np.linspace(0, 1, size)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")  # red changes fastest in .cube order
    rgb = np.stack([r, gg, b], axis=-1).reshape(-1, 3)
    lab = srgb_to_lab(rgb)
    out = lab_to_srgb(lab + strength * (fn(lab) - lab))
    with open(path, "w", encoding="ascii") as fh:
        fh.write(f'TITLE "{os.path.splitext(os.path.basename(path))[0]}"\nLUT_3D_SIZE {size}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for v in out:
            fh.write(f"{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("frames_dir")
    p.add_argument("out_cube")
    p.add_argument("refs", nargs="+")
    p.add_argument("--tone", type=float, default=0.8)
    p.add_argument("--tint", type=float, default=0.85)
    p.add_argument("--sat", type=float, default=0.8)
    p.add_argument("--greens", type=float, default=0.8)
    p.add_argument("--strength", type=float, default=1.0)
    p.add_argument("--report")
    a = p.parse_args()
    frames = [os.path.join(a.frames_dir, f) for f in sorted(os.listdir(a.frames_dir)) if f.lower().endswith((".png", ".jpg"))]
    src, tgt = pixels(frames), pixels(a.refs)
    fn, params = build(src, tgt, a.tone, a.tint, a.sat, a.greens)
    write_cube(a.out_cube, fn, a.strength)
    summary = {
        "source_L_p5_p50_p95": np.percentile(src[:, 0], [5, 50, 95]).round(1).tolist(),
        "target_L_p5_p50_p95": np.percentile(tgt[:, 0], [5, 50, 95]).round(1).tolist(),
        "tint_shift_ab_shadow_mid_high": np.round(params["tint_shift"], 2).tolist(),
        "sat_ratio": round(params["sat_ratio"], 3),
        "green_rot_deg": round(params["green_rot_deg"], 1),
        "green_sat": round(params["green_sat"], 3),
    }
    print(json.dumps(summary))
    if a.report:
        with open(a.report, "w", encoding="utf-8") as fh:
            json.dump(summary, fh, indent=2)


if __name__ == "__main__":
    main()
