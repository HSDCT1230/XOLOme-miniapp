"""Fix remaining display issues on specific L2 example covers."""
from pathlib import Path

from PIL import Image

OUT = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2")
SRC = OUT / "_src"
SAMPLES = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\samples")
PREV = SAMPLES / "shadow-previews"
WHITE = (252, 252, 252)


def open_rgb(p: Path) -> Image.Image:
    return Image.open(p).convert("RGB")


def resolve(alias: str) -> Path:
    return sorted(SRC.glob(f"{alias}_*.png"))[0]


def bbox(im: Image.Image, thr: int = 220, step: int = 3):
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if min(r, g, b) < thr or (r + g + b) / 3 < thr + 5:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    pad = max(8, min(w, h) // 55)
    return max(0, minx - pad), max(0, miny - pad), min(w, maxx + pad + 1), min(h, maxy + pad + 1)


def subject(im: Image.Image, expand: float = 0.06, thr: int = 220) -> Image.Image:
    x0, y0, x1, y1 = bbox(im, thr)
    bw, bh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sw, sh = bw * (1 + expand), bh * (1 + expand)
    left = max(0, int(cx - sw / 2))
    top = max(0, int(cy - sh / 2))
    right = min(im.size[0], int(cx + sw / 2))
    bottom = min(im.size[1], int(cy + sh / 2))
    return im.crop((left, top, right, bottom))


def cover(im: Image.Image, tw: int, th: int, fx: float = 0.5, fy: float = 0.45) -> Image.Image:
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    nw, nh = max(tw, int(round(iw * scale))), max(th, int(round(ih * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, min(int(round((nw - tw) * fx)), nw - tw))
    top = max(0, min(int(round((nh - th) * fy)), nh - th))
    return resized.crop((left, top, left + tw, top + th))


def pad(im: Image.Image, top: float = 0.2, side: float = 0.05, bot: float = 0.08) -> Image.Image:
    w, h = im.size
    t, s, b = int(h * top), int(w * side), int(h * bot)
    canvas = Image.new("RGB", (w + 2 * s, h + t + b), WHITE)
    canvas.paste(im, (s, t))
    return canvas


def contain(
    im: Image.Image, tw: int, th: int, pad_frac: float = 0.04, ybias: float = 0.42, thr: int = 220
) -> Image.Image:
    sub = subject(im, 0.1, thr)
    iw, ih = sub.size
    max_w = tw * (1 - pad_frac * 2)
    max_h = th * (1 - pad_frac * 2)
    scale = min(max_w / iw, max_h / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = sub.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), WHITE)
    canvas.paste(resized, ((tw - nw) // 2, int((th - nh) * ybias)))
    return canvas


def scrub_br_text(im: Image.Image, frac_x: float = 0.55, frac_y: float = 0.82) -> Image.Image:
    # Only scrub faint watermark glyphs in bottom-right.
    out = im.copy()
    px = out.load()
    w, h = out.size
    x0, y0 = int(w * frac_x), int(h * frac_y)
    for y in range(y0, h):
        for x in range(x0, w):
            r, g, b = px[x, y]
            if abs(r - g) < 25 and abs(g - b) < 25 and abs(r - b) < 25 and 150 <= min(r, g, b) <= 235:
                px[x, y] = WHITE
    return out


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
    print("OK", name)


def main() -> None:
    CW, CH, RW, RH = 900, 1200, 768, 1152

    save(
        contain(open_rgb(resolve("img_10")), RW, RH, pad_frac=0.03, ybias=0.48, thr=228),
        "diy-realtime-pet-clean.png",
    )

    clay = next(p for p in PREV.glob("*.png") if "粘土小狗" in p.name)
    felt = next(p for p in PREV.glob("*.png") if "羊毛毡小猫" in p.name)
    save(cover(pad(subject(open_rgb(clay), 0.05), 0.22, 0.05, 0.08), CW, CH, 0.5, 0.28), "tpl-03-clay-dog.png")
    save(cover(pad(subject(open_rgb(felt), 0.05), 0.22, 0.05, 0.10), CW, CH, 0.5, 0.26), "tpl-04-felt-cat.png")

    lego = cover(pad(subject(open_rgb(resolve("img_06")), 0.06), 0.22, 0.05, 0.10), CW, CH, 0.5, 0.26)
    save(scrub_br_text(lego, 0.58, 0.86), "tpl-10-pixel.png")

    office = cover(pad(subject(open_rgb(resolve("img_07")), 0.08), 0.18, 0.05, 0.08), CW, CH, 0.5, 0.22)
    save(scrub_br_text(office, 0.62, 0.88), "tpl-16-office.png")

    mecha = open_rgb(OUT / "tpl-17-mecha.png")
    save(scrub_br_text(mecha, 0.62, 0.88), "tpl-17-mecha.png")
    print("done")


if __name__ == "__main__":
    main()
