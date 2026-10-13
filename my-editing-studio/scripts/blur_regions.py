"""Bake blurred regions (brand names, logos, personal names) into copies of screenshots.

Usage (from the project root):
    python scripts/blur_regions.py assets/projects/<video>/screenshots/blur-regions.json

JSON: {"<source file next to the json>": {"out": "<name>.png", "regions": [[x0, y0, x1, y1], ...]}}
Coordinates are in the source image's own pixels. Outputs go to the sibling processed/ folder
(assets/projects/<video>/processed/).
Blurring is baked in (not done live) so it is identical on every frame and costs nothing to render.
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

def main() -> None:
    config_path = Path(sys.argv[1])
    config = json.load(open(config_path, encoding="utf-8"))
    SRC = config_path.parent
    OUT = SRC.parent / "processed"
    OUT.mkdir(parents=True, exist_ok=True)
    for source, spec in config.items():
        image = Image.open(SRC / source).convert("RGB")
        for x0, y0, x1, y1 in spec["regions"]:
            box = (x0, y0, x1, y1)
            patch = image.crop(box)
            # Pixelate then blur: shapes of bold wordmarks stay unreadable even when zoomed in.
            small = patch.resize((max(1, (x1 - x0) // 16), max(1, (y1 - y0) // 16)), Image.BILINEAR)
            patch = small.resize(patch.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(radius=9))
            mask = Image.new("L", patch.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, patch.size[0] - 1, patch.size[1] - 1), radius=min(patch.size) // 3, fill=255)
            image.paste(patch, box, mask.filter(ImageFilter.GaussianBlur(radius=2)))
        image.save(OUT / spec["out"], optimize=True)
        print(f"{source} -> {OUT / spec['out']} ({len(spec['regions'])} regions)")


if __name__ == "__main__":
    main()
