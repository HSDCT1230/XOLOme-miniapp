"""Regen guide + hub banners from new viewfinder shots.

Guides: keep camera frame + green crosshair; wipe Doubao marks on black corners.
Hubs: strip vignette + crosshair, full-bleed landscape with studio side fill.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ASSETS = Path(r"C:\Users\Administrator\.cursor\projects\d-cursoe-code\assets")
OUT = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2")
SRC = OUT / "_src"

NEW_SRC = {
    "toy": ASSETS
    / "c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_1d81622f97ba35ba49cfee8c5db3046f_images_________1-c71aee92-fd26-4d30-9af6-68a4fed05fbf-6c547b51-b4a4-45c2-8311-3f391072401b.png",
    "person": ASSETS
    / "c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_1d81622f97ba35ba49cfee8c5db3046f_images_________1-d2b1e297-4c5d-4704-ba5d-0defbe07e0dc-443dcbad-96da-437a-b871-a6948baccb33.png",
    "pet": ASSETS
    / "c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_1d81622f97ba35ba49cfee8c5db3046f_images_________1-47a147d0-da7e-424b-bb1d-4dc411763e7e-aec10861-7c99-48c3-9489-8c9778deee6c.png",
}


def open_rgb(path: Path) -> Image.Image:
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (0, 0, 0))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def scrub_corner_watermarks(im: Image.Image) -> Image.Image:
    """Wipe Doubao glyphs on black vignette (TL + BR)."""
    arr = np.asarray(im).copy()
    h, w = arr.shape[:2]
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)

    # Black vignette connected to each corner → dilate → paint black (covers white glyphs)
    black = (gray < 28).astype(np.uint8) * 255
    num, labels = cv2.connectedComponents(black, connectivity=8)
    seeds = [
        (1, 1),
        (w - 2, 1),
        (1, h - 2),
        (w - 2, h - 2),
    ]
    vignette = np.zeros((h, w), np.uint8)
    for sx, sy in seeds:
        lab = int(labels[sy, sx])
        if lab == 0:
            continue
        vignette[labels == lab] = 255

    # Dilate enough to swallow white watermark strokes on the black field
    vignette = cv2.dilate(vignette, np.ones((15, 15), np.uint8), iterations=2)

    # Only apply wipe inside corner ROIs so we don't eat subject shadows in center
    roi = np.zeros((h, w), np.uint8)
    roi[0 : int(h * 0.16), 0 : int(w * 0.48)] = 255
    roi[0 : int(h * 0.14), int(w * 0.70) : w] = 255
    roi[int(h * 0.84) : h, 0 : int(w * 0.42)] = 255
    roi[int(h * 0.84) : h, int(w * 0.50) : w] = 255

    wipe = cv2.bitwise_and(vignette, roi)
    arr[wipe > 0] = (0, 0, 0)

    # Extra: any residual bright glyph still in BR/TL black median field
    for x0, y0, x1, y1 in [
        (int(w * 0.55), int(h * 0.88), w, h),
        (0, 0, int(w * 0.40), int(h * 0.12)),
    ]:
        zone = arr[y0:y1, x0:x1]
        g = cv2.cvtColor(zone, cv2.COLOR_RGB2GRAY)
        med = cv2.medianBlur(g, 35)
        zone[med < 60] = (0, 0, 0)
        arr[y0:y1, x0:x1] = zone

    return Image.fromarray(arr)


def strip_black_vignette(im: Image.Image, thr: int = 36, pad: int = 2) -> Image.Image:
    gray = np.asarray(im.convert("L"))
    ys, xs = np.where(gray > thr)
    if len(xs) < 100:
        return im
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(im.size[0], x1 + pad)
    y1 = min(im.size[1], y1 + pad)
    crop = im.crop((x0, y0, x1, y1))
    # Rounded viewfinder leaves black crescents inside the bbox — fill with studio tone
    arr = np.asarray(crop).copy()
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    fill = studio_fill_color(crop)
    # soft: near-black → fill; keep AA fringe blended
    mask = g < 45
    arr[mask] = fill
    # also kill dark notch bars on edges
    edge = (g < 70) & (
        (np.arange(arr.shape[0])[:, None] < 8)
        | (np.arange(arr.shape[0])[:, None] >= arr.shape[0] - 8)
        | (np.arange(arr.shape[1])[None, :] < 8)
        | (np.arange(arr.shape[1])[None, :] >= arr.shape[1] - 8)
    )
    arr[edge] = fill
    return Image.fromarray(arr)


def remove_green_crosshair(im: Image.Image) -> Image.Image:
    """Remove viewfinder green + for hub banners."""
    arr = np.asarray(im).copy()
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    mask = ((g > 120) & (g > r + 28) & (g > b + 28) & (r < 160) & (b < 170)).astype(
        np.uint8
    ) * 255
    if mask.sum() == 0:
        return im
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=2)
    # Telea inpaint needs BGR
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    out = cv2.inpaint(bgr, mask, 4, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))


def studio_fill_color(im: Image.Image) -> tuple[int, int, int]:
    a = np.asarray(im)
    h, w = a.shape[:2]
    bands = np.concatenate(
        [
            a[2:22, 2 : max(3, w // 5)].reshape(-1, 3),
            a[2:22, 4 * w // 5 : w - 2].reshape(-1, 3),
            a[h - 22 : h - 2, 2 : max(3, w // 5)].reshape(-1, 3),
            a[h - 22 : h - 2, 4 * w // 5 : w - 2].reshape(-1, 3),
        ],
        axis=0,
    )
    lum = bands.mean(axis=1)
    keep = bands[lum > 160] if (lum > 160).any() else bands
    return tuple(int(c) for c in np.median(keep, axis=0))


def hub_fullbleed(im: Image.Image, tw: int = 1400, th: int = 571) -> Image.Image:
    photo = strip_black_vignette(im)
    photo = remove_green_crosshair(photo)
    # Crop past rounded-corner residue so the subject plate is a clean rectangle
    iw, ih = photo.size
    ix, iy = max(4, int(iw * 0.035)), max(4, int(ih * 0.025))
    photo = photo.crop((ix, iy, iw - ix, ih - iy))
    iw, ih = photo.size
    fill = studio_fill_color(photo)

    # Slight zoom: subject fills height and most of width; crop extra from top (wall)
    scale = max(th / ih, (tw * 0.78) / iw)
    nw = max(1, int(round(iw * scale)))
    nh = max(1, int(round(ih * scale)))
    resized = photo.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (tw, th), fill)
    x0 = (nw - tw) // 2
    if nw >= tw and nh >= th:
        # Prefer keeping feet: crop surplus mainly from top
        y0 = max(0, nh - th)
        return resized.crop((x0, y0, x0 + tw, y0 + th))

    if nw >= tw:
        y = (th - nh) // 2
        canvas.paste(resized.crop((x0, 0, x0 + tw, nh)), (0, y))
        return canvas

    x = (tw - nw) // 2
    if nh >= th:
        y0 = nh - th
        canvas.paste(resized.crop((0, y0, nw, y0 + th)), (x, 0))
    else:
        y = (th - nh) // 2
        canvas.paste(resized, (x, y))

    # Tiny feather at photo side seams only
    arr = np.asarray(canvas).astype(np.float32)
    fill_v = np.array(fill, np.float32)
    feather = 12
    left = x
    right = x + nw - 1
    for i in range(feather):
        a = (i + 1) / (feather + 1)
        lx, rx = left + i, right - i
        if 0 <= lx < tw:
            arr[:, lx] = arr[:, lx] * a + fill_v * (1 - a)
        if 0 <= rx < tw:
            arr[:, rx] = arr[:, rx] * a + fill_v * (1 - a)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def guide_canvas(im: Image.Image, tw: int = 768, th: int = 1024) -> Image.Image:
    iw, ih = im.size
    scale = min(tw / iw, th / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), (0, 0, 0))
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def save(im: Image.Image, name: str) -> None:
    path = OUT / name
    tmp = OUT / f".tmp_{name}"
    im.save(tmp, "PNG")
    try:
        tmp.replace(path)
    except OSError:
        alt = OUT / f"_new_{name}"
        im.save(alt, "PNG")
        path.write_bytes(alt.read_bytes())
        alt.unlink(missing_ok=True)
        tmp.unlink(missing_ok=True)
    print(f"OK {name} {im.size[0]}x{im.size[1]}")


def residual_br(path: Path) -> int:
    a = np.asarray(Image.open(path).convert("RGB"))
    h, w = a.shape[:2]
    br = a[int(h * 0.88) : h, int(w * 0.58) : w]
    g = br.mean(axis=2)
    med = cv2.medianBlur(g.astype(np.uint8), 15)
    return int(((np.abs(g - med) > 18) & (med < 50)).sum())


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SRC.mkdir(parents=True, exist_ok=True)

    print("== Guides ==")
    for key, out_name in [
        ("person", "guide-person.png"),
        ("pet", "guide-pet.png"),
        ("toy", "guide-toy.png"),
    ]:
        src = NEW_SRC[key]
        archived = SRC / f"guide_{key}_viewfinder_src.png"
        archived.write_bytes(src.read_bytes())
        im = scrub_corner_watermarks(open_rgb(src))
        save(guide_canvas(im), out_name)
        print(f"  residual_BR {out_name}: {residual_br(OUT / out_name)}")

    print("== Hubs ==")
    for key, out_name in [
        ("person", "hub-banner-person.png"),
        ("pet", "hub-banner-pet.png"),
        ("toy", "hub-banner-toy.png"),
    ]:
        im = scrub_corner_watermarks(open_rgb(NEW_SRC[key]))
        save(hub_fullbleed(im, 1400, 571), out_name)
        a = np.asarray(Image.open(OUT / out_name))
        r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
        green = ((g > 160) & (g > r + 35) & (g > b + 35)).sum()
        print(f"  green_left {out_name}: {green}")

    print("done")


if __name__ == "__main__":
    main()
