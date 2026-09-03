#!/usr/bin/env python3
"""Generate Lumina's custom app icon assets from one vector-like drawing."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "src" / "renderer" / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

# Brand mark: an indigo dawn halo around a focused light/page shape.
def draw_icon(size: int) -> Image.Image:
    scale = size / 1024
    im = Image.new("RGBA", (size, size), (15, 15, 19, 255))
    d = ImageDraw.Draw(im)
    def xy(box): return tuple(round(v * scale) for v in box)
    # Soft concentric halo and outer frame.
    for inset, color in [(76, (108, 99, 255, 28)), (98, (108, 99, 255, 46)), (120, (108, 99, 255, 255))]:
        d.ellipse(xy((inset, inset, 1024-inset, 1024-inset)), outline=color, width=max(2, round(14*scale)))
    d.ellipse(xy((184, 184, 840, 840)), fill=(108, 99, 255, 18))
    # Open page / wing silhouette.
    d.polygon([xy(p) for p in [(238, 566), (512, 244), (786, 566), (672, 520), (512, 724), (352, 520)]], fill=(137, 128, 255, 240))
    # Light beam and center lens.
    d.polygon([xy(p) for p in [(512, 278), (598, 610), (512, 706), (426, 610)]], fill=(180, 174, 255, 230))
    d.ellipse(xy((440, 440, 584, 584)), fill=(244, 243, 255, 255))
    d.ellipse(xy((476, 476, 548, 548)), fill=(108, 99, 255, 255))
    # Tiny north star accent.
    d.line([xy((512, 130)), xy((512, 188))], fill=(244, 243, 255, 220), width=max(2, round(10*scale)))
    d.line([xy((483, 159)), xy((541, 159))], fill=(244, 243, 255, 220), width=max(2, round(10*scale)))
    return im

icon = draw_icon(1024)
icon.resize((256, 256), Image.Resampling.LANCZOS).save(ASSETS / "icon.png", optimize=True)
icon.resize((512, 512), Image.Resampling.LANCZOS).save(ASSETS / "icon-512.png", optimize=True)
icon.resize((1024, 1024), Image.Resampling.LANCZOS).save(ASSETS / "icon-1024.png", optimize=True)
icon.save(ASSETS / "icon.ico", format="ICO", sizes=[(16,16), (32,32), (48,48), (64,64), (128,128), (256,256)])
print(f"Generated custom Lumina icon assets in {ASSETS}")
for size in (48, 72, 96, 144, 192, 512, 1024):
    icon.resize((size, size), Image.Resampling.LANCZOS).save(ASSETS / f"icon-{size}.png", optimize=True)
