"""Pet stylize covers — subject on pure white card aspect (no plate rectangle)."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

OUT = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2")
PREV = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\samples\shadow-previews")
TW, TH = 905, 1240
WHITE = np.array([255, 255, 255], dtype=np.float32)


def open_rgb(p: Path) -> Image.Image:
    return Image.open(p).convert("RGB")


def find_prev(*keys: str) -> Path:
    for p in PREV.glob("*.png"):
        if all(k in p.name for k in keys):
            return p
    raise FileNotFoundError(keys)


def soft_scrub_wm(arr: np.ndarray) -> np.ndarray:
    h, w = arr.shape[:2]
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    mask = np.zeros((h, w), np.uint8)
    for x0, y0, x1, y1 in [
        (int(w * 0.55), int(h * 0.82), w, h),
        (0, 0, int(w * 0.35), int(h * 0.12)),
    ]:
        zone = arr[y0:y1, x0:x1]
        g = cv2.cvtColor(zone, cv2.COLOR_RGB2GRAY).astype(np.float32)
        med = cv2.medianBlur(g.astype(np.uint8), 21).astype(np.float32)
        m = (((med - g) > 7) & (g < 235) & (med > 185)).astype(np.uint8) * 255
        m = cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=1)
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], m)
    if mask.any():
        arr = cv2.cvtColor(cv2.inpaint(bgr, mask, 4, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    return arr


def subject_alpha(arr: np.ndarray) -> np.ndarray:
    """Keep figurine + soft contact shadow; drop studio plate."""
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1].astype(np.float32)
    blur = cv2.GaussianBlur(g, (0, 0), 18)
    diff = np.clip(blur - g, 0, 255)

    # Core subject
    core = ((g < 235) & ((sat > 12) | (diff > 5) | (g < 210))).astype(np.uint8) * 255
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    n, labels, stats, cents = cv2.connectedComponentsWithStats(core, 8)
    keep = np.zeros(g.shape, np.uint8)
    best, best_score = -1, -1.0
    h, w = g.shape
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < h * w * 0.01:
            continue
        cx, cy = cents[i]
        score = float(area) - abs(cx - w / 2) * 30 - abs(cy - h / 2) * 5
        if score > best_score:
            best_score, best = score, i
    if best >= 0:
        keep[labels == best] = 255
    else:
        keep = core

    keep = cv2.dilate(keep, np.ones((5, 5), np.uint8), iterations=1)

    # Soft shadow under feet
    ys, xs = np.where(keep > 0)
    if len(ys):
        y0, y1 = int(max(ys.min(), h * 0.45)), min(h, int(ys.max() + h * 0.04))
        x0, x1 = max(0, int(xs.min() - w * 0.04)), min(w, int(xs.max() + w * 0.04))
        region = g[y0:y1, x0:x1]
        if region.size:
            thr = float(np.percentile(region, 50))
            shadow = np.zeros_like(keep)
            shadow[y0:y1, x0:x1] = ((region < thr) & (region > 30)).astype(np.uint8) * 255
            near = cv2.dilate(keep, np.ones((17, 17), np.uint8), iterations=1)
            keep = cv2.bitwise_or(keep, cv2.bitwise_and(shadow, near))

    # Kill remaining bright studio inside keep
    studio = (g > 242) & (sat < 15) & (diff < 4)
    keep[studio] = 0

    binmask = (keep > 0).astype(np.uint8)
    inv = cv2.distanceTransform(1 - binmask, cv2.DIST_L2, 5)
    alpha = np.ones(g.shape, np.float32)
    alpha[binmask == 0] = np.clip(1.0 - inv[binmask == 0] / 2.5, 0, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.6)
    alpha[studio] = 0
    return np.clip(alpha, 0, 1)


def to_card_matte(im: Image.Image, margin: float = 0.07) -> Image.Image:
    arr = soft_scrub_wm(np.asarray(im).copy())
    alpha = subject_alpha(arr)
    ys, xs = np.where(alpha > 0.15)
    h, w = alpha.shape
    if len(xs) == 0:
        ys, xs = np.array([0, h - 1]), np.array([0, w - 1])
    pad = int(min(h, w) * 0.04)
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    rgb = arr[y0:y1, x0:x1].astype(np.float32)
    a = alpha[y0:y1, x0:x1]
    sh, sw = a.shape

    max_w = TW * (1 - 2 * margin)
    max_h = TH * (1 - 2 * margin)
    scale = min(max_w / sw, max_h / sh)
    nw, nh = max(1, int(round(sw * scale))), max(1, int(round(sh * scale)))
    rgb_r = cv2.resize(rgb, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    a_r = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_LINEAR)
    a_r = np.clip(a_r, 0, 1)[..., None]

    canvas = np.broadcast_to(WHITE, (TH, TW, 3)).copy()
    x = (TW - nw) // 2
    y = int((TH - nh) * 0.45)
    roi = canvas[y : y + nh, x : x + nw]
    canvas[y : y + nh, x : x + nw] = roi * (1 - a_r) + rgb_r * a_r
    g = cv2.cvtColor(canvas.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    t = np.clip((g - 248) / 7.0, 0, 1)[..., None]
    canvas = canvas * (1 - t) + WHITE * t
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))


def to_card_flatten(im: Image.Image, margin_v: float = 0.04) -> Image.Image:
    """Light subjects: bleach studio, then width-fill card so no side plate box."""
    arr = soft_scrub_wm(np.asarray(im).copy()).astype(np.float32)
    g = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)
    hsv = cv2.cvtColor(arr.astype(np.uint8), cv2.COLOR_RGB2HSV)
    sat = hsv[:, :, 1].astype(np.float32)
    t = np.clip((g - 245) / 10.0, 0, 1) * np.clip((20 - sat) / 20.0, 0, 1)
    t = cv2.GaussianBlur(t, (0, 0), 0.8)[..., None]
    flat = np.clip(arr * (1 - t) + WHITE * t, 0, 255).astype(np.uint8)

    h, w = flat.shape[:2]
    # Width-fill: eliminate L/R plate margins; small vertical margins only
    scale = TW / w
    nw, nh = TW, max(1, int(round(h * scale)))
    if nh > TH * (1 - margin_v):
        scale = (TH * (1 - margin_v)) / h
        nw = max(1, int(round(w * scale)))
        nh = max(1, int(round(h * scale)))
    resized = cv2.resize(flat, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    canvas = np.broadcast_to(WHITE, (TH, TW, 3)).copy().astype(np.uint8)
    x = (TW - nw) // 2
    y = (TH - nh) // 2
    canvas[y : y + nh, x : x + nw] = resized
    gg = cv2.cvtColor(canvas, cv2.COLOR_RGB2GRAY).astype(np.float32)
    bleach = np.clip((gg - 248) / 7.0, 0, 1)[..., None]
    canvas = (canvas.astype(np.float32) * (1 - bleach) + WHITE * bleach).astype(np.uint8)
    return Image.fromarray(canvas)


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
    print("OK", name, im.size)


def main() -> None:
    # Clay cream fur ≈ white → flatten plate, width-fill card
    save(to_card_flatten(open_rgb(find_prev("粘土"))), "tpl-03-clay-dog.png")
    # Felt has clear contrast → matte onto pure white
    save(to_card_matte(open_rgb(find_prev("羊毛")), margin=0.06), "tpl-04-felt-cat.png")
    print("done")


if __name__ == "__main__":
    main()
