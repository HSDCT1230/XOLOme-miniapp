"""Crop hub entry thumbs: trim white, square-focus subject, 512px."""
from __future__ import annotations

import os
from PIL import Image

OUT = r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2"


def nonwhite_bbox(im: Image.Image, thresh: int = 248) -> tuple[int, int, int, int]:
    im = im.convert("RGB")
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            r, g, b = px[x, y]
            if r < thresh or g < thresh or b < thresh:
                if x < minx:
                    minx = x
                if y < miny:
                    miny = y
                if x > maxx:
                    maxx = x
                if y > maxy:
                    maxy = y
    if maxx < 0:
        return (0, 0, w, h)
    return (max(0, minx - 2), max(0, miny - 2), min(w, maxx + 3), min(h, maxy + 3))


def square_from_bbox(
    im: Image.Image,
    bbox: tuple[int, int, int, int],
    *,
    focus: str = "center",
    zoom: float = 1.0,
) -> Image.Image:
    w, h = im.size
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    if focus == "top":
        # Prefer face / upper body for portrait hub thumb
        cy = y0 + bh * 0.32
        side = max(bw * 1.15, bh * 0.55) / zoom
    elif focus == "bottom":
        # Pet sits low on tall canvas — pin crop to lower subject
        cy = y0 + bh * 0.72
        side = min(w, h) * 0.72 / zoom
    elif focus == "car":
        cy = (y0 + y1) / 2
        # Prefer filling height: crop left/right of wide car rather than white bands
        side = bh * 1.12
    else:
        side = max(bw, bh) * 1.06 / zoom

    side = max(32.0, min(side, float(min(w, h))))
    cx = min(max(cx, side / 2), w - side / 2)
    cy = min(max(cy, side / 2), h - side / 2)
    left = int(round(cx - side / 2))
    top = int(round(cy - side / 2))
    side_i = int(round(side))
    return im.crop((left, top, left + side_i, top + side_i))


def main() -> None:
    jobs = [
        ("diy-realtime-person-clean.png", "hub-thumb-person.png", "top", 1.0),
        ("diy-realtime-pet-clean.png", "hub-thumb-pet.png", "bottom", 1.15),
        ("tpl-12-vehicle.png", "hub-thumb-toy.png", "car", 1.0),
    ]
    for src, dst, focus, zoom in jobs:
        path = os.path.join(OUT, src)
        im = Image.open(path)
        bb = nonwhite_bbox(im)
        print(src, "size", im.size, "bbox", bb)
        sq = square_from_bbox(im, bb, focus=focus, zoom=zoom)
        sq = sq.resize((512, 512), Image.Resampling.LANCZOS)
        out_path = os.path.join(OUT, dst)
        sq.save(out_path, "PNG", optimize=True)
        print(" ->", dst, sq.size, os.path.getsize(out_path))


if __name__ == "__main__":
    main()
