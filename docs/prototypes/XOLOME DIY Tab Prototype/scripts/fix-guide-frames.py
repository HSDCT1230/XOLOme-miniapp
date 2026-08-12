"""Rebuild shooting guides: remove Doubao BR watermarks, re-frame cleanly.

Surgical scrub on source (dark→#000, floor glyphs→clone from above),
then extract photo with extra bottom/right trim so the watermark band
is cropped off before framing into a fresh black rounded viewfinder.
"""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2")
SRC = OUT / "_src"

SOURCES = {
    "person": SRC / "guide_person_viewfinder_src.png",
    "pet": SRC / "guide_pet_viewfinder_src.png",
    "toy": SRC / "guide_toy_viewfinder_src.png",
}


def open_rgb(path: Path) -> Image.Image:
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (0, 0, 0))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def scrub_source(im: Image.Image) -> Image.Image:
    arr = np.asarray(im).copy()
    h, w = arr.shape[:2]
    x0, y0 = int(w * 0.55), int(h * 0.925)
    roi = arr[y0:h, x0:w]
    g = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY)
    sat = cv2.cvtColor(roi, cv2.COLOR_RGB2HSV)[:, :, 1]
    med = cv2.medianBlur(g, 21)
    protect = sat > 35

    above = arr[max(0, y0 - 20) : y0, x0:w]
    above_row = above[-1] if above.size else roi[0].copy()

    dark = g < 58
    glyphs = ((g.astype(np.int16) - med.astype(np.int16)) > 12) | ((g > 90) & (med < 60))
    glyphs &= ~protect
    glyphs = cv2.dilate(glyphs.astype(np.uint8), np.ones((2, 2), np.uint8), iterations=1).astype(bool)
    glyphs &= ~protect

    out = roi.copy()
    out[dark & ~protect] = (0, 0, 0)
    floor_hit = glyphs & (~dark)
    if floor_hit.any():
        ys, xs = np.where(floor_hit)
        out[ys, xs] = above_row[xs]
    g_out = cv2.cvtColor(out, cv2.COLOR_RGB2GRAY)
    near_black = cv2.blur((g_out < 35).astype(np.float32), (9, 9)) > 0.4
    out[(g_out > 28) & near_black & (~protect)] = (0, 0, 0)
    arr[y0:h, x0:w] = out

    g2 = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    s2 = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[:, :, 1]
    yy = np.arange(h)[:, None]
    xx = np.arange(w)[None, :]
    dark_nb = cv2.blur((g2 < 30).astype(np.float32), (15, 15))
    speck = (yy > h * 0.93) & (xx > w * 0.55) & (g2 > 32) & (dark_nb > 0.55) & (s2 < 35)
    arr[speck] = (0, 0, 0)
    arr[(yy > h * 0.93) & (xx > w * 0.50) & (g2 < 28) & (s2 < 30)] = (0, 0, 0)
    return Image.fromarray(arr)


def heal_photo_br(photo: Image.Image) -> Image.Image:
    """Inpaint a small BR band where Doubao text sits on the studio floor."""
    arr = np.asarray(photo).copy()
    h, w = arr.shape[:2]
    sat = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[:, :, 1]
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    # Watermark band: bottom ~4.5%, right ~40%
    y0, x0 = int(h * 0.955), int(w * 0.58)
    mask = np.zeros((h, w), np.uint8)
    # Prefer glyph pixels; fall back to full band if few hits
    zone = g[y0:h, x0:w]
    zs = sat[y0:h, x0:w]
    med = cv2.medianBlur(zone, 21)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (48, 9))
    tophat = cv2.morphologyEx(zone, cv2.MORPH_TOPHAT, kernel)
    glyphs = ((tophat > 16) | ((zone.astype(np.int16) - med.astype(np.int16)) > 10)) & (zs < 38)
    local = glyphs.astype(np.uint8) * 255
    if int(local.sum() // 255) < 80:
        local[:, :] = 255
    local = cv2.dilate(local, np.ones((3, 3), np.uint8), iterations=2)
    local[zs > 38] = 0
    mask[y0:h, x0:w] = local
    if not mask.any():
        return photo
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    out = cv2.inpaint(bgr, mask, 5, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))


def extract_photo(im: Image.Image, thr: int = 40) -> Image.Image:
    gray = np.asarray(im.convert("L"))
    mask = (gray > thr).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((11, 11), np.uint8))
    h, w = mask.shape
    for y in range(h - 1, int(h * 0.80), -1):
        if float(np.median(gray[y])) < 40 or (mask[y] > 0).mean() < 0.12:
            mask[y, :] = 0
        else:
            break
    for x in range(w - 1, int(w * 0.80), -1):
        if float(np.median(gray[:, x])) < 40 or (mask[:, x] > 0).mean() < 0.12:
            mask[:, x] = 0
        else:
            break
    ys, xs = np.where(mask > 0)
    if len(xs) < 200:
        return im
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    pad = 1
    x0, y0 = min(x0 + pad, x1 - 10), min(y0 + pad, y1 - 10)
    x1, y1 = max(x1 - pad, x0 + 10), max(y1 - pad, y0 + 10)
    # Slight BR trim only — watermark is at extreme corner; keep full subject (feet)
    trim_b = max(12, int((y1 - y0) * 0.018))
    trim_r = max(10, int((x1 - x0) * 0.015))
    y1 = max(y0 + 40, y1 - trim_b)
    x1 = max(x0 + 40, x1 - trim_r)
    return im.crop((x0, y0, x1, y1))


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


def subject_portrait_crop(im: Image.Image, aspect: float = 3 / 4) -> Image.Image:
    """Crop wide studio shot to a portrait window that keeps the full subject."""
    arr = np.asarray(im)
    h, w = arr.shape[:2]
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    sat = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[:, :, 1]
    blur = cv2.GaussianBlur(g, (0, 0), 24)
    diff = cv2.subtract(blur, g)
    core = ((g < 210) | (sat > 26) | (diff > 8)).astype(np.uint8) * 255
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(core, 8)
    best, best_score = -1, -1.0
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < h * w * 0.006:
            continue
        cx, cy = cents[i]
        score = float(area) - abs(cx - w / 2) * 40 - abs(cy - h * 0.55) * 6
        if score > best_score:
            best_score, best = score, i
    if best < 0:
        return im
    x0 = stats[best, cv2.CC_STAT_LEFT]
    y0 = stats[best, cv2.CC_STAT_TOP]
    bw = stats[best, cv2.CC_STAT_WIDTH]
    bh = stats[best, cv2.CC_STAT_HEIGHT]
    # Pad so head/feet/shadow stay inside
    pad_x = int(bw * 0.55)
    pad_y_top = int(bh * 0.14)
    pad_y_bot = int(bh * 0.22)  # extra room for feet + floor
    sx0 = max(0, x0 - pad_x)
    sx1 = min(w, x0 + bw + pad_x)
    sy0 = max(0, y0 - pad_y_top)
    sy1 = min(h, y0 + bh + pad_y_bot)
    # Expand to target portrait aspect without clipping subject box
    box_w, box_h = sx1 - sx0, sy1 - sy0
    target_h = max(box_h, int(round(box_w / aspect)))
    target_w = max(box_w, int(round(target_h * aspect)))
    if target_w > w:
        target_w = w
        target_h = int(round(target_w / aspect))
    if target_h > h:
        target_h = h
        target_w = int(round(target_h * aspect))
    cx = (sx0 + sx1) // 2
    # Bias down slightly so feet have room
    cy = int((sy0 + sy1) * 0.52)
    nx0 = max(0, min(w - target_w, cx - target_w // 2))
    ny0 = max(0, min(h - target_h, cy - target_h // 2))
    # Prefer keeping bottom (feet) if we had to shift
    if sy1 > ny0 + target_h:
        ny0 = max(0, sy1 - target_h)
    if sy0 < ny0:
        # Shift up only enough to keep head; never sacrifice feet box
        ny0 = max(0, min(h - target_h, sy1 - target_h))
    return im.crop((nx0, ny0, nx0 + target_w, ny0 + target_h))


def scrub_white_studio_wm(im: Image.Image) -> Image.Image:
    """Remove 豆包AI生成 / ghosted BR glyphs on white studio — inpaint + hard floor wipe."""
    arr = np.asarray(im).copy()
    h, w = arr.shape[:2]
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    mask = np.zeros((h, w), np.uint8)
    # Broad BR + mid-right floor where Doubao text sits
    for x0, y0, x1, y1 in [
        (int(w * 0.50), int(h * 0.82), w, h),
        (int(w * 0.62), int(h * 0.70), w, h),
    ]:
        zone = arr[y0:y1, x0:x1]
        g = cv2.cvtColor(zone, cv2.COLOR_RGB2GRAY)
        sat = cv2.cvtColor(zone, cv2.COLOR_RGB2HSV)[:, :, 1]
        med = cv2.medianBlur(g, 21)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (64, 13))
        tophat = cv2.morphologyEx(g, cv2.MORPH_TOPHAT, kernel)
        # Light text on bright floor OR mid-grey ghosted strokes
        glyphs = (
            ((tophat > 8) | (np.abs(g.astype(np.int16) - med.astype(np.int16)) > 6))
            & (sat < 45)
            & (g > 40)
            & (g < 252)
        )
        local = glyphs.astype(np.uint8) * 255
        local = cv2.dilate(local, np.ones((3, 3), np.uint8), iterations=2)
        mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], local)
    if int(mask.sum() // 255) < 60:
        # Guaranteed wipe of extreme BR corner (empty studio, away from feet)
        mask[int(h * 0.90) :, int(w * 0.68) :] = 255
    if mask.any():
        arr = cv2.cvtColor(cv2.inpaint(bgr, mask, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    # Final hard blend: extreme BR floor → sample nearby studio color
    y0b, x0b = int(h * 0.91), int(w * 0.70)
    sample = arr[int(h * 0.78) : int(h * 0.88), int(w * 0.35) : int(w * 0.55)]
    sg = cv2.cvtColor(sample, cv2.COLOR_RGB2GRAY)
    bright = sample[sg > 220]
    fill = (
        tuple(int(c) for c in np.median(bright.reshape(-1, 3), axis=0))
        if len(bright)
        else (250, 250, 250)
    )
    br = arr[y0b:h, x0b:w]
    bg = cv2.cvtColor(br, cv2.COLOR_RGB2GRAY)
    # Only wipe non-subject (bright / mid studio), keep dark feet if they spill in
    wipe = bg > 175
    br[wipe] = fill
    arr[y0b:h, x0b:w] = br
    return Image.fromarray(arr)


def strip_green_crosshair(im: Image.Image) -> Image.Image:
    """Remove baked neon-green aiming cross from AI viewfinder sources."""
    arr = np.asarray(im).copy()
    h, w, _ = arr.shape
    r, g, b = arr[:, :, 0].astype(np.int16), arr[:, :, 1].astype(np.int16), arr[:, :, 2].astype(np.int16)
    green = (g > 140) & (g > r + 40) & (g > b + 25) & (r < 160)
    # Prefer center region (viewfinder crosshair)
    yy = np.arange(h)[:, None]
    xx = np.arange(w)[None, :]
    center = (np.abs(yy - h / 2) < h * 0.18) & (np.abs(xx - w / 2) < w * 0.18)
    mask = np.zeros((h, w), np.uint8)
    mask[green & center] = 255
    # Also catch any green arms that spilled slightly outside
    mask[green] = np.maximum(mask[green], 255)
    if not mask.any():
        return im
    # Keep only components near center
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, 8)
    keep = np.zeros((h, w), np.uint8)
    for i in range(1, n):
        cx, cy = cents[i]
        if abs(cx - w / 2) < w * 0.22 and abs(cy - h / 2) < h * 0.22:
            keep[labels == i] = 255
    if not keep.any():
        keep = mask
    keep = cv2.dilate(keep, np.ones((5, 5), np.uint8), iterations=3)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    out = cv2.inpaint(bgr, keep, 7, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))


def soft_scrub_photo_br(photo: Image.Image) -> Image.Image:
    """Inpaint Doubao glyph pixels in photo BR — never hard-fill rectangles."""
    arr = np.asarray(photo).copy()
    h, w = arr.shape[:2]
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    sat = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)[:, :, 1]
    y0, x0 = int(h * 0.86), int(w * 0.48)
    zone = g[y0:h, x0:w]
    zs = sat[y0:h, x0:w]
    med = cv2.medianBlur(zone, 31)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (56, 11))
    tophat = cv2.morphologyEx(zone, cv2.MORPH_TOPHAT, kernel)
    blackhat = cv2.morphologyEx(zone, cv2.MORPH_BLACKHAT, kernel)
    # White text + dark outline strokes on light floor / Polaroid margin
    bright = (tophat > 10) | ((zone.astype(np.int16) - med.astype(np.int16)) > 8)
    dark_outline = (blackhat > 8) | ((med.astype(np.int16) - zone.astype(np.int16)) > 8)
    glyphs = (bright | dark_outline) & (zs < 50)
    local = glyphs.astype(np.uint8) * 255
    if int(local.sum() // 255) < 40:
        return photo
    local = cv2.dilate(local, np.ones((3, 3), np.uint8), iterations=2)
    mask = np.zeros((h, w), np.uint8)
    mask[y0:h, x0:w] = local
    # Protect saturated subject pixels (feet, toy parts)
    protect = sat > 55
    mask[protect] = 0
    if not mask.any():
        return photo
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    out = cv2.inpaint(bgr, mask, 6, cv2.INPAINT_TELEA)
    return Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))


def trim_polaroid_margin(im: Image.Image) -> Image.Image:
    """If source is a Polaroid-style white matte, crop to the photo island."""
    g = np.asarray(im.convert("L"))
    h, w = g.shape
    # White margin: top/side median very bright AND bottom band also bright
    edge = float(np.median(np.concatenate([g[:20, :].ravel(), g[:, :20].ravel(), g[:, -20:].ravel()])))
    bottom = float(np.median(g[int(h * 0.92) :, :]))
    if edge < 220 or bottom < 200:
        return im
    # Find darker content (carpet / subject) vs white matte
    content = (g < 230).astype(np.uint8) * 255
    content = cv2.morphologyEx(content, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    ys, xs = np.where(content > 0)
    if len(xs) < 500:
        return im
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    # Require meaningful inset from edges
    if x0 < 8 or y0 < 8 or (w - x1) < 8:
        return im
    pad = 2
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))


def pad_feet_floor(photo: Image.Image, pad_frac: float = 0.07) -> Image.Image:
    """Extend canvas below with side-floor texture so toes clear rounded corners."""
    arr = np.asarray(photo)
    h, w = arr.shape[:2]
    pad = max(28, int(round(h * pad_frac)))
    y0, y1 = max(0, h - max(24, h // 18)), h
    left = arr[y0:y1, 0 : max(8, w // 5)]
    right = arr[y0:y1, w - max(8, w // 5) : w]
    sample = np.concatenate([left.reshape(-1, 3), right.reshape(-1, 3)], axis=0)
    fill = np.median(sample, axis=0).astype(np.uint8)
    # Build textured pad from side floor strips (avoid stretching toes)
    strip = np.concatenate([left, right], axis=1)
    if strip.size == 0:
        stretched = np.tile(fill, (pad, w, 1))
    else:
        tile = np.tile(strip, (1, int(np.ceil(w / strip.shape[1])) + 1, 1))[:, :w]
        stretched = cv2.resize(tile, (w, pad), interpolation=cv2.INTER_LINEAR)
        # Pull toward median so seams are quiet
        stretched = (
            stretched.astype(np.float32) * 0.55 + fill.astype(np.float32) * 0.45
        ).astype(np.uint8)
    out = np.vstack([arr, stretched])
    blend = min(8, pad // 2)
    for i in range(blend):
        t = (i + 1) / (blend + 1)
        out[h + i] = (
            arr[h - 1].astype(np.float32) * (1 - t) + stretched[i].astype(np.float32) * t
        ).astype(np.uint8)
    return Image.fromarray(out)


def apply_barrel_distortion(im: Image.Image, strength: float = 0.11) -> Image.Image:
    """Mild barrel distortion — phone / compact-lens look (subtle, not fisheye)."""
    arr = np.asarray(im)
    h, w = arr.shape[:2]
    if h < 32 or w < 32:
        return im
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) * 0.5, (h - 1) * 0.5
    # Normalize by half-diagonal so corners ≈ 1.0
    scale = max(cx, cy)
    xn = (xx - cx) / scale
    yn = (yy - cy) / scale
    r2 = xn * xn + yn * yn
    # Sample farther out at edges → barrel curve
    factor = 1.0 + strength * r2
    map_x = (cx + xn * factor * scale).astype(np.float32)
    map_y = (cy + yn * factor * scale).astype(np.float32)
    out = cv2.remap(
        arr,
        map_x,
        map_y,
        interpolation=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return Image.fromarray(out)


def apply_lens_vignette(
    im: Image.Image,
    *,
    start: float = 0.45,
    amount: float = 0.38,
    floor: float = 0.58,
) -> Image.Image:
    """Radial falloff toward corners (optical vignette)."""
    arr = np.asarray(im).astype(np.float32)
    h, w = arr.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = (w - 1) * 0.5, (h - 1) * 0.5
    # Elliptical normalize to window
    nx = (xx - cx) / max(1.0, cx)
    ny = (yy - cy) / max(1.0, cy)
    r = np.sqrt(nx * nx + ny * ny)
    # Smoothstep falloff past `start`
    t = np.clip((r - start) / max(1e-6, 1.35 - start), 0.0, 1.0)
    t = t * t * (3.0 - 2.0 * t)
    vig = np.clip(1.0 - amount * t, floor, 1.0)[..., None]
    out = np.clip(arr * vig, 0, 255).astype(np.uint8)
    return Image.fromarray(out)


def draw_viewfinder_overlay(
    im: Image.Image,
    window: tuple[int, int, int, int],
    *,
    color: tuple[int, int, int] = (64, 232, 92),
) -> Image.Image:
    """Camera-lens chrome: segmented AF +, corner brackets, thin LCD rim."""
    out = im.copy()
    x0, y0, x1, y1 = window
    ww, wh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    draw = ImageDraw.Draw(out)

    # Inner LCD rim just inside black bezel
    inset = 3
    draw.rounded_rectangle(
        [x0 + inset, y0 + inset, x1 - inset - 1, y1 - inset - 1],
        radius=max(8, min(ww, wh) // 18),
        outline=(28, 32, 30),
        width=2,
    )

    # Corner AF brackets
    br = max(18, min(ww, wh) // 14)
    bt = max(3, min(ww, wh) // 90)
    corners = [
        (x0 + 14, y0 + 14, 1, 1),
        (x1 - 14, y0 + 14, -1, 1),
        (x0 + 14, y1 - 14, 1, -1),
        (x1 - 14, y1 - 14, -1, -1),
    ]
    for ox, oy, sx, sy in corners:
        hx0, hx1 = sorted((ox, ox + sx * br))
        hy0, hy1 = oy - bt // 2, oy + bt // 2
        draw.rectangle([hx0, hy0, hx1, hy1], fill=color)
        vx0, vx1 = ox - bt // 2, ox + bt // 2
        vy0, vy1 = sorted((oy, oy + sy * br))
        draw.rectangle([vx0, vy0, vx1, vy1], fill=color)

    # Segmented center crosshair
    arm = max(40, min(78, ww // 9))
    gap = max(8, arm // 6)
    t = max(3, arm // 16)
    seg = max(10, arm // 3)
    draw.rectangle([cx - gap - arm, cy - t // 2, cx - gap - seg, cy + t // 2], fill=color)
    draw.rectangle([cx + gap + seg, cy - t // 2, cx + gap + arm, cy + t // 2], fill=color)
    draw.rectangle([cx - t // 2, cy - gap - arm, cx + t // 2, cy - gap - seg], fill=color)
    draw.rectangle([cx - t // 2, cy + gap + seg, cx + t // 2, cy + gap + arm], fill=color)
    draw.rectangle([cx - gap - seg + 2, cy - t // 2, cx - gap, cy + t // 2], fill=color)
    draw.rectangle([cx + gap, cy - t // 2, cx + gap + seg - 2, cy + t // 2], fill=color)
    draw.rectangle([cx - t // 2, cy - gap - seg + 2, cx + t // 2, cy - gap], fill=color)
    draw.rectangle([cx - t // 2, cy + gap, cx + t // 2, cy + gap + seg - 2], fill=color)
    tick = max(2, t)
    draw.rectangle([cx - tick, cy - 1, cx + tick, cy + 1], fill=color)
    draw.rectangle([cx - 1, cy - tick, cx + 1, cy + tick], fill=color)

    return out


def rebuild_guide(
    photo: Image.Image,
    tw: int = 768,
    th: int = 1024,
    radius: int = 52,
    *,
    feet_room: bool = False,
) -> Image.Image:
    """Frame photo in a camera-like black viewfinder with lens look + AF overlay."""
    margin_x, margin_top = 40, 36
    margin_bot = 110 if feet_room else 52
    max_w, max_h = tw - margin_x * 2, th - margin_top - margin_bot
    iw, ih = photo.size
    scale = min(max_w / iw, max_h / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = photo.resize((nw, nh), Image.Resampling.LANCZOS)
    # Optical look: barrel + vignette on the photo plate only
    resized = apply_barrel_distortion(resized, strength=0.10)
    resized = apply_lens_vignette(resized, start=0.42, amount=0.42, floor=0.55)
    x = (tw - nw) // 2
    y = margin_top + max(0, (max_h - nh) // 3)
    s = 4
    mask_hi = Image.new("L", (tw * s, th * s), 0)
    ImageDraw.Draw(mask_hi).rounded_rectangle(
        [x * s, y * s, (x + nw) * s, (y + nh) * s],
        radius=radius * s,
        fill=255,
    )
    mask = mask_hi.resize((tw, th), Image.Resampling.LANCZOS)
    photo_layer = Image.new("RGB", (tw, th), (0, 0, 0))
    photo_layer.paste(resized, (x, y))
    black = Image.new("RGB", (tw, th), (0, 0, 0))
    framed = Image.composite(photo_layer, black, mask)
    return draw_viewfinder_overlay(framed, (x, y, x + nw, y + nh))

def is_viewfinder_framed(im: Image.Image) -> bool:
    """True if image already has a dark rounded viewfinder bezel."""
    g = np.asarray(im.convert("L"))
    h, w = g.shape
    edge = float(np.median(np.concatenate([g[:, :16].ravel(), g[:, -16:].ravel(), g[:16, :].ravel()])))
    return edge < 40


def main() -> None:
    for key in ("person", "pet", "toy"):
        src = SOURCES[key]
        if not src.exists():
            src = OUT / f"guide-{key}.png"
        print(key)
        raw = strip_green_crosshair(open_rgb(src))
        if is_viewfinder_framed(raw):
            # Drop old bezel (and BR watermark on it); rebuild clean rounded frame
            photo = extract_photo(raw, thr=35)
            pw, ph = photo.size
            # Mild BR trim only — keep feet (watermark usually on dropped black bezel)
            photo = photo.crop((0, 0, pw - max(6, int(pw * 0.01)), ph - max(8, int(ph * 0.012))))
            photo = strip_green_crosshair(photo)
            print(f"  extract+reframe {photo.size[0]}x{photo.size[1]}")
            guide = rebuild_guide(photo, feet_room=(key == "person"))
            save(guide, f"guide-{key}.png")
            continue
        gray = np.asarray(raw.convert("L"))
        is_studio = float(np.median(gray[: gray.shape[0] // 5])) > 180
        if is_studio:
            before = raw.size
            photo = trim_polaroid_margin(raw)
            was_polaroid = photo.size != before
            photo = subject_portrait_crop(photo)
            pw, ph = photo.size
            if was_polaroid:
                # Watermark lived on white matte (already trimmed) — keep full feet
                photo = photo.crop((0, 0, pw - max(4, int(pw * 0.006)), ph))
            else:
                # Doubao on studio floor: trim thin BR strip only (avoid chopping feet)
                photo = photo.crop(
                    (0, 0, pw - max(10, int(pw * 0.018)), ph - max(12, int(ph * 0.022)))
                )
        else:
            raw = scrub_source(raw)
            photo = extract_photo(raw)
            pw, ph = photo.size
            photo = photo.crop((0, 0, pw - max(8, int(pw * 0.012)), ph - max(12, int(ph * 0.02))))
        photo = strip_green_crosshair(photo)
        print(f"  photo {photo.size[0]}x{photo.size[1]} studio={is_studio}")
        guide = rebuild_guide(photo, feet_room=(key == "person"))
        save(guide, f"guide-{key}.png")
    print("done")


if __name__ == "__main__":
    main()
