"""Home hub banners — full body on one continuous studio field (no side bands)."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ASSETS = Path(r"C:\Users\Administrator\.cursor\projects\d-cursoe-code\assets")
OUT = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2")
SRC = OUT / "_src"

# User-supplied studio shots (person / toy / pet) — Aug 2026 refresh
HUB_SRC = {
    "person": ASSETS
    / "c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_1d81622f97ba35ba49cfee8c5db3046f_images____________2-a9ef1c10-2c29-4ec0-b1c0-3ca4f619e506-9516aa4d-75d5-40cf-842d-d0de4540c939-7d02d95a-e676-404c-9573-64a3b76a8367.png",
    "toy": ASSETS
    / "c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_1d81622f97ba35ba49cfee8c5db3046f_images_____1-79edf009-23bf-40bb-9645-eff245b44068-62684ff3-53e3-4412-adfa-1beb701e428d-a04bbb28-e17d-4bc4-a6ef-c1a28ed4b01a.png",
    "pet": ASSETS
    / "c__Users_Administrator_AppData_Roaming_Cursor_User_workspaceStorage_1d81622f97ba35ba49cfee8c5db3046f_images__1-25e13b4b-bfc3-4e9c-a7fb-b1b26cd11f4b-2ceb00fc-446e-40b0-bf1c-6374b2f0f287-a0d9f51b-2f2f-4966-b7d8-d1b1b107fa39.png",
}

TW, TH = 1432, 692


def open_rgb(path: Path) -> Image.Image:
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def subject_bbox(arr: np.ndarray) -> tuple[int, int, int, int]:
    """Rough subject window for centering — does not build a soft matte."""
    h, w, _ = arr.shape
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    sat = cv2.cvtColor(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR), cv2.COLOR_BGR2HSV)[:, :, 1]
    blur = cv2.GaussianBlur(g, (0, 0), 24)
    diff = cv2.subtract(blur, g)
    core = ((g < 215) | (sat > 22) | (diff > 8)).astype(np.uint8) * 255
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
        return 0, 0, w, h
    x0 = stats[best, cv2.CC_STAT_LEFT]
    y0 = stats[best, cv2.CC_STAT_TOP]
    bw = stats[best, cv2.CC_STAT_WIDTH]
    bh = stats[best, cv2.CC_STAT_HEIGHT]
    pad_x = int(max(bw * 0.45, w * 0.10))
    pad_y = int(max(bh * 0.18, h * 0.06))
    return (
        max(0, x0 - pad_x),
        max(0, y0 - pad_y),
        min(w, x0 + bw + pad_x),
        min(h, y0 + bh + pad_y),
    )


def scrub_white_studio_wm(im: Image.Image) -> Image.Image:
    """Remove 豆包AI生成 corner glyphs — never wipe subject paws/fur."""
    arr = np.asarray(im).copy()
    h, w = arr.shape[:2]
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    mask_full = np.zeros((h, w), np.uint8)
    # Protect subject (incl. white fur/paws) from any wipe
    sx0, sy0, sx1, sy1 = subject_bbox(arr)
    protect = np.zeros((h, w), np.uint8)
    protect[sy0:sy1, sx0:sx1] = 255
    protect = cv2.dilate(protect, np.ones((21, 21), np.uint8), iterations=2)

    for x0, y0, x1, y1 in [
        (int(w * 0.55), int(h * 0.84), w, h),
        (0, 0, int(w * 0.38), int(h * 0.12)),
        (int(w * 0.70), 0, w, int(h * 0.12)),
    ]:
        zone = arr[y0:y1, x0:x1]
        g = cv2.cvtColor(zone, cv2.COLOR_RGB2GRAY).astype(np.float32)
        med = cv2.medianBlur(g.astype(np.uint8), 25).astype(np.float32)
        m = (((med - g) > 6) & (g < 245) & (med > 185)).astype(np.uint8) * 255
        m = cv2.dilate(m, np.ones((5, 5), np.uint8), iterations=2)
        # Clear protect overlap inside this zone
        pz = protect[y0:y1, x0:x1]
        m[pz > 0] = 0
        mask_full[y0:y1, x0:x1] = np.maximum(mask_full[y0:y1, x0:x1], m)
    if mask_full.any():
        arr = cv2.cvtColor(cv2.inpaint(bgr, mask_full, 6, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    # Soft glyph pass only — hard BR rectangle fills create visible white patches
    return Image.fromarray(arr)


def subject_alpha(arr: np.ndarray) -> np.ndarray:
    """Soft alpha for subject + contact shadow only (no studio plate halo)."""
    h, w, _ = arr.shape
    g = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    sat = hsv[:, :, 1]

    blur = cv2.GaussianBlur(g, (0, 0), 28)
    diff = cv2.subtract(blur, g)

    core = ((g < 205) | (sat > 28) | (diff > 10)).astype(np.uint8) * 255
    core = cv2.morphologyEx(core, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))

    n, labels, stats, cents = cv2.connectedComponentsWithStats(core, 8)
    keep = np.zeros((h, w), np.uint8)
    best, best_score = -1, -1.0
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < h * w * 0.008:
            continue
        cx, cy = cents[i]
        score = float(area) - abs(cx - w / 2) * 50 - abs(cy - h * 0.55) * 8
        if score > best_score:
            best_score, best = score, i
    if best >= 0:
        keep[labels == best] = 255
    else:
        keep = core

    # Light clothes / fur: expand a little, then GrabCut
    keep = cv2.dilate(keep, np.ones((7, 7), np.uint8), iterations=1)

    ys, xs = np.where(keep > 0)
    if len(ys) > 50:
        x0, x1 = max(0, xs.min() - 12), min(w, xs.max() + 12)
        y0, y1 = max(0, ys.min() - 12), min(h, ys.max() + 12)
        rect = (x0, y0, max(1, x1 - x0), max(1, y1 - y0))
        gc = np.full((h, w), cv2.GC_BGD, np.uint8)
        gc[keep > 0] = cv2.GC_PR_FGD
        gc[:3, :] = gc[-3:, :] = gc[:, :3] = gc[:, -3:] = cv2.GC_BGD
        sure = cv2.erode(keep, np.ones((7, 7), np.uint8), iterations=2)
        gc[sure > 0] = cv2.GC_FGD
        # sure bg: bright low-sat outside a padded subject box
        bright = (g > 228) & (sat < 25)
        pad = np.zeros((h, w), np.uint8)
        pad[y0:y1, x0:x1] = 1
        gc[(bright) & (pad == 0)] = cv2.GC_BGD
        try:
            cv2.grabCut(
                arr, gc, rect,
                np.zeros((1, 65), np.float64),
                np.zeros((1, 65), np.float64),
                4,
                cv2.GC_INIT_WITH_MASK,
            )
            keep = np.where((gc == cv2.GC_FGD) | (gc == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
        except cv2.error:
            pass

    # Contact shadow only (darker floor near feet) — not a plate halo
    ys, xs = np.where(keep > 0)
    shadow = np.zeros((h, w), np.uint8)
    if len(ys):
        y0s, y1s = int(max(ys.min(), h * 0.50)), min(h, int(ys.max() + h * 0.035))
        x0s, x1s = max(0, int(xs.min() - w * 0.05)), min(w, int(xs.max() + w * 0.05))
        region = g[y0s:y1s, x0s:x1s]
        if region.size:
            thr = float(np.percentile(region, 45))
            shadow[y0s:y1s, x0s:x1s] = ((region < thr) & (region > 40) & (sat[y0s:y1s, x0s:x1s] < 40)).astype(np.uint8) * 255
            near = cv2.dilate(keep, np.ones((21, 21), np.uint8), iterations=1)
            shadow = cv2.bitwise_and(shadow, near)

    # Hard-kill studio white so we never paste the original plate rectangle
    studio = (g > 225) & (sat < 22) & (diff < 6)
    keep[studio] = 0
    # shadow may sit on mid-grey floor — allow back
    keep = cv2.bitwise_or(keep, shadow)

    # Soft edge from distance transform (no big dilate halo)
    binmask = (keep > 0).astype(np.uint8)
    if binmask.any():
        dist = cv2.distanceTransform(binmask, cv2.DIST_L2, 5)
        inv = cv2.distanceTransform(1 - binmask, cv2.DIST_L2, 5)
        # inside solid, outside falloff ~3px
        alpha = np.ones((h, w), np.float32)
        alpha[binmask == 0] = np.clip(1.0 - inv[binmask == 0] / 3.0, 0, 1)
        # slight soften
        alpha = cv2.GaussianBlur(alpha, (0, 0), 0.8)
    else:
        alpha = np.zeros((h, w), np.float32)

    # Final: never keep near-white (except already-dark shadow handled above)
    alpha[studio] = 0
    return np.clip(alpha, 0, 1)


def build_studio_field(h: int, w: int, wall: np.ndarray, floor: np.ndarray, seed: int = 42) -> np.ndarray:
    yy = np.linspace(0, 1, h, dtype=np.float32).reshape(h, 1, 1)
    t = np.clip((yy - 0.62) / 0.28, 0, 1)
    t = t * t * (3 - 2 * t)
    wall = np.asarray(wall, dtype=np.float32).reshape(1, 1, 3)
    floor = np.asarray(floor, dtype=np.float32).reshape(1, 1, 3)
    field = np.broadcast_to(wall * (1 - t) + floor * t, (h, w, 3)).copy()
    xx = np.linspace(-1, 1, w, dtype=np.float32).reshape(1, w, 1)
    field *= 1.0 - 0.012 * (xx * xx)
    rng = np.random.default_rng(seed)
    field = np.clip(field + rng.normal(0, 0.9, (h, w, 1)).astype(np.float32), 0, 255)
    return field.astype(np.float32)


def sample_wall_floor(arr: np.ndarray, alpha: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    h, w, _ = arr.shape
    solid = alpha < 0.12
    top = arr[: int(h * 0.2)][solid[: int(h * 0.2)]]
    if top.size < 40:
        top = arr[: int(h * 0.12), int(w * 0.3) : int(w * 0.7)].reshape(-1, 3)
    wall = np.median(top.reshape(-1, 3), axis=0)
    bot = arr[int(h * 0.8) :][solid[int(h * 0.8) :]]
    if bot.size < 40:
        bot = arr[int(h * 0.88) :, int(w * 0.25) : int(w * 0.75)].reshape(-1, 3)
    floor = np.median(bot.reshape(-1, 3), axis=0)
    # Unify to bright seamless studio (kills grey plate bands)
    base = np.maximum(wall, floor)
    wall = np.clip(base + 2, 0, 255)
    floor = np.clip(base - 5, 0, 255)
    return wall, floor


def is_seamless_studio(im: Image.Image) -> bool:
    g = np.asarray(im.convert("L"))
    h, w = g.shape
    top = float(np.median(g[: max(1, h // 5), int(w * 0.2) : int(w * 0.8)]))
    bot = float(np.median(g[int(h * 0.85) :, int(w * 0.2) : int(w * 0.8)]))
    return top > 200 and bot > 185


def hub_banner_opaque(im: Image.Image, tw: int = TW, th: int = TH) -> Image.Image:
    """
    Seamless white-studio sources: no GrabCut/matte (paws & fur stay intact).
    Crop tight to subject so the character fills the home card media.
    """
    arr = np.asarray(im).astype(np.float32)
    h, w, _ = arr.shape
    sx0, sy0, sx1, sy1 = subject_bbox(arr.astype(np.uint8))
    bw, bh = sx1 - sx0, sy1 - sy0
    # Tight pad: keep head/feet/shadow, drop empty studio wings
    pad_x = int(max(bw * 0.28, w * 0.04))
    pad_top = int(max(bh * 0.06, h * 0.02))
    pad_bot = int(max(bh * 0.10, h * 0.03))  # feet + contact shadow
    x0 = max(0, sx0 - pad_x)
    x1 = min(w, sx1 + pad_x)
    y0 = max(0, sy0 - pad_top)
    y1 = min(h, sy1 + pad_bot)
    crop = arr[y0:y1, x0:x1]
    sh, sw = crop.shape[:2]

    wall = np.median(crop[: max(1, sh // 8), int(sw * 0.3) : int(sw * 0.7)].reshape(-1, 3), axis=0)
    floor = np.median(crop[int(sh * 0.88) :, int(sw * 0.25) : int(sw * 0.75)].reshape(-1, 3), axis=0)
    base = np.maximum(wall, floor)
    wall = np.clip(base + 1, 0, 255)
    floor = np.clip(base - 4, 0, 255)

    # Fill ~92% of banner height with subject (larger hero)
    v_margin = 0.04
    scale = (th * (1 - 2 * v_margin)) / sh
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    rgb = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_LANCZOS4)

    canvas = build_studio_field(th, tw, wall, floor, seed=11)
    if nw > tw:
        # Keep tall subject; crop empty sides
        x_off = (nw - tw) // 2
        rgb = rgb[:, x_off : x_off + tw]
        nw = tw
        x = 0
    else:
        x = (tw - nw) // 2
    bottom_pad = max(4, int(th * 0.03))
    y = max(0, th - nh - bottom_pad)
    if nh > th:
        cut = nh - th
        rgb = rgb[cut:]
        nh = th
        y = 0
    canvas[y : y + nh, x : x + nw] = rgb
    if y + nh < th:
        canvas[y + nh : th, x : x + nw] = rgb[-1:]
    if y > 0:
        canvas[:y, x : x + nw] = rgb[:1]
    if x > 0:
        canvas[:, :x] = canvas[:, x : x + 1]
    if x + nw < tw:
        canvas[:, x + nw :] = canvas[:, x + nw - 1 : x + nw]
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))


def hub_banner(im: Image.Image, tw: int = TW, th: int = TH) -> Image.Image:
    """
    Full subject on one continuous studio field.
    White studio shots use opaque path (no soft matte that melts paws).
    """
    if is_seamless_studio(im):
        return hub_banner_opaque(im, tw, th)

    arr = np.asarray(im).astype(np.float32)
    alpha = subject_alpha(arr.astype(np.uint8))
    wall, floor = sample_wall_floor(arr, alpha)

    # Crop source to subject bbox + generous margin (drop empty plate sides early)
    ys, xs = np.where(alpha > 0.2)
    h, w, _ = arr.shape
    if len(ys):
        x0 = max(0, int(xs.min() - w * 0.08))
        x1 = min(w, int(xs.max() + w * 0.08))
        y0 = max(0, int(ys.min() - h * 0.04))
        y1 = min(h, int(ys.max() + h * 0.05))
        arr = arr[y0:y1, x0:x1]
        alpha = alpha[y0:y1, x0:x1]

    sh, sw = arr.shape[:2]
    # Fill most of banner height with subject
    v_margin = 0.04
    scale = (th * (1 - 2 * v_margin)) / sh
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    rgb = cv2.resize(arr, (nw, nh), interpolation=cv2.INTER_LANCZOS4)
    a = cv2.resize(alpha, (nw, nh), interpolation=cv2.INTER_LINEAR)
    a = np.clip(a, 0, 1)[..., None]

    canvas = build_studio_field(th, tw, wall, floor, seed=7)
    if nw > tw:
        x_off = (nw - tw) // 2
        rgb = rgb[:, x_off : x_off + tw]
        a = a[:, x_off : x_off + tw]
        nw = tw
        x = 0
    else:
        x = (tw - nw) // 2
    bottom_pad = max(4, int(th * 0.03))
    y = max(0, th - nh - bottom_pad)
    y = max(0, min(y, th - nh))

    if nh > th:
        cut = nh - th
        rgb = rgb[cut:]
        a = a[cut:]
        nh = th
        y = 0

    roi = canvas[y : y + nh, x : x + nw]
    canvas[y : y + nh, x : x + nw] = roi * (1 - a) + rgb * a
    if x > 0:
        canvas[:, :x] = canvas[:, x : x + 1]
    if x + nw < tw:
        canvas[:, x + nw :] = canvas[:, x + nw - 1 : x + nw]
    return Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))


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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SRC.mkdir(parents=True, exist_ok=True)
    for key in ("person", "pet", "toy"):
        src = HUB_SRC[key]
        (SRC / f"hub_{key}_home_src.png").write_bytes(src.read_bytes())
        im = scrub_white_studio_wm(open_rgb(src))
        banner = hub_banner(im, TW, TH)
        save(banner, f"hub-banner-{key}.png")
    print("done")


if __name__ == "__main__":
    main()
