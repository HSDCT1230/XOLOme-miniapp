# -*- coding: utf-8 -*-
"""Prepare slot-specific covers from Desktop 小程序DIY图.

Rules:
- Every output fills its target aspect (cover crop OR baked canvas) — no letterbox / photo edges.
- L1 hub banners (wide ~2.5:1) and L2 replica (2:3) use DIFFERENT crops even from same source.
"""
from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

from PIL import Image

DESK = Path(r"C:\Users\Administrator\Desktop\小程序DIY图")
SRC = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2\_src")
OUT = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\covers-v2")
WHITE = (252, 252, 252)

# Exact Desktop filename → alias (from 小程序DIY图)
DESK_TO_ALIAS = {
    "B-zen-stoneware.png": "img_00",
    "bjd古典宫廷.png": "img_01",
    "bjd古典宫廷Q版.png": "img_02",
    "bjd暗黑哥特.png": "img_03",
    "bjd爱豆高定.png": "img_04",
    "bjd自拍.png": "img_05",
    "乐高角色.png": "img_06",
    "打工人盲盒.png": "img_07",
    "机甲角色.png": "img_08",
    "毛线娃娃1.png": "img_09",
    "狗.png": "img_10",
    "狗2.png": "img_11",
    "生成纯白底小女孩打招呼1.png": "img_12",  # landscape 2304x1728
    "生成纯白底小女孩打招呼图片.png": "img_13",  # portrait 1728x2304
    "真人机甲.png": "img_14",
    "自拍盲盒.png": "img_15",
}


def open_rgb(path: Path) -> Image.Image:
    im = Image.open(path)
    if im.mode in ("RGBA", "LA"):
        bg = Image.new("RGB", im.size, WHITE)
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def nonwhite_bbox(im: Image.Image, thresh: int = 228, step: int = 3):
    w, h = im.size
    px = im.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            if min(r, g, b) < thresh or (r + g + b) / 3 < thresh + 5:
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
    pad = max(6, min(w, h) // 60)
    return (
        max(0, minx - pad),
        max(0, miny - pad),
        min(w, maxx + pad + 1),
        min(h, maxy + pad + 1),
    )


def cover_crop(im: Image.Image, tw: int, th: int, fx: float = 0.5, fy: float = 0.45) -> Image.Image:
    iw, ih = im.size
    scale = max(tw / iw, th / ih)
    nw, nh = max(tw, int(round(iw * scale))), max(th, int(round(ih * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = int(round((nw - tw) * fx))
    top = int(round((nh - th) * fy))
    left = max(0, min(left, nw - tw))
    top = max(0, min(top, nh - th))
    return resized.crop((left, top, left + tw, top + th))


def subject_region(im: Image.Image, expand: float = 0.06) -> Image.Image:
    x0, y0, x1, y1 = nonwhite_bbox(im)
    bw, bh = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    side_w = bw * (1 + expand)
    side_h = bh * (1 + expand)
    left = max(0, int(cx - side_w / 2))
    top = max(0, int(cy - side_h / 2))
    right = min(im.size[0], int(cx + side_w / 2))
    bottom = min(im.size[1], int(cy + side_h / 2))
    return im.crop((left, top, right, bottom))


def contain_on_canvas(im: Image.Image, tw: int, th: int, pad: float = 0.06) -> Image.Image:
    sub = subject_region(im, 0.04)
    iw, ih = sub.size
    max_w = tw * (1 - pad * 2)
    max_h = th * (1 - pad * 2)
    scale = min(max_w / iw, max_h / ih)
    nw, nh = max(1, int(round(iw * scale))), max(1, int(round(ih * scale)))
    resized = sub.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (tw, th), WHITE)
    canvas.paste(resized, ((tw - nw) // 2, (th - nh) // 2))
    return canvas


def zoom_subject(im: Image.Image, zoom: float = 1.35, fx: float = 0.5, fy: float = 0.4) -> Image.Image:
    sub = subject_region(im, 0.02)
    w, h = sub.size
    cw, ch = max(1, int(w / zoom)), max(1, int(h / zoom))
    left = int((w - cw) * fx)
    top = int((h - ch) * fy)
    left = max(0, min(left, w - cw))
    top = max(0, min(top, h - ch))
    return sub.crop((left, top, left + cw, top + ch))


def save(im: Image.Image, name: str) -> None:
    path = OUT / name
    tmp = OUT / f".tmp_{name}"
    im.save(tmp, "PNG", optimize=False)
    try:
        tmp.replace(path)
    except OSError:
        # Windows file lock: write alternate then copy bytes
        alt = OUT / f"_new_{name}"
        im.save(alt, "PNG", optimize=False)
        data = alt.read_bytes()
        path.write_bytes(data)
        alt.unlink(missing_ok=True)
        tmp.unlink(missing_ok=True)
    print(f"  {name:32s} {im.size[0]}x{im.size[1]}")


def file_md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sync_src() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    print("== Sync Desktop → _src ==")
    for fname, alias in DESK_TO_ALIAS.items():
        src_path = DESK / fname
        if not src_path.exists():
            print(f"  MISS {fname}")
            continue
        im = Image.open(src_path)
        w, h = im.size
        # Prefer landscape for img_12 / portrait for img_13 — verify
        dest = SRC / f"{alias}_{w}x{h}.png"
        for old in SRC.glob(f"{alias}_*.png"):
            if old.resolve() != dest.resolve():
                old.unlink(missing_ok=True)
        need = True
        if dest.exists() and dest.stat().st_size == src_path.stat().st_size:
            if file_md5(dest) == file_md5(src_path):
                need = False
        if need:
            shutil.copy2(src_path, dest)
            print(f"  sync {alias} ← {fname} ({w}x{h})")
        else:
            print(f"  ok   {alias} ← {fname}")


def resolve(alias: str) -> Path:
    hits = sorted(SRC.glob(f"{alias}_*.png"))
    if not hits:
        raise FileNotFoundError(alias)
    return hits[0]


def main() -> None:
    sync_src()

    person_land = open_rgb(resolve("img_12"))
    person_port = open_rgb(resolve("img_13"))
    if person_land.size[0] < person_land.size[1]:
        raise SystemExit(f"img_12 must be landscape, got {person_land.size}")
    if person_port.size[0] > person_port.size[1]:
        raise SystemExit(f"img_13 must be portrait, got {person_port.size}")
    pet_a = open_rgb(resolve("img_10"))
    pet_b = open_rgb(resolve("img_11"))
    mecha = open_rgb(resolve("img_08"))
    yarn = open_rgb(resolve("img_09"))
    lego = open_rgb(resolve("img_06"))
    office = open_rgb(resolve("img_07"))
    person_mecha = open_rgb(resolve("img_14"))
    selfie_box = open_rgb(resolve("img_15"))
    bjd_idol = open_rgb(resolve("img_04"))
    bjd_selfie = open_rgb(resolve("img_05"))
    plant = open_rgb(resolve("img_00"))

    # L1 media ≈ 358×146 → 2.452:1；用同比例避免 FILL 时上下露底
    BW, BH = 1400, 571
    print("== L1 hub banners wide (edge-to-edge cover, distinct from L2) ==")
    # Prefer user-supplied white-studio hub covers when present
    hub_srcs = {
        "hub-banner-person.png": SRC / "hub_person_src.png",
        "hub-banner-pet.png": SRC / "hub_pet_src.png",
        "hub-banner-toy.png": SRC / "hub_toy_src.png",
    }
    hub_fy = {"hub-banner-person.png": 0.42, "hub-banner-pet.png": 0.62, "hub-banner-toy.png": 0.40}
    for out_name, src_path in hub_srcs.items():
        if src_path.exists():
            save(cover_crop(open_rgb(src_path), BW, BH, fx=0.5, fy=hub_fy[out_name]), out_name)
        elif out_name == "hub-banner-person.png":
            save(cover_crop(subject_region(person_land, 0.02), BW, BH, fx=0.5, fy=0.32), out_name)
        elif out_name == "hub-banner-pet.png":
            pw, ph = pet_b.size
            pet_band = pet_b.crop((0, int(ph * 0.55), pw, ph))
            save(cover_crop(subject_region(pet_band, 0.06), BW, BH, fx=0.5, fy=0.42), out_name)
        else:
            save(cover_crop(subject_region(mecha, 0.02), BW, BH, fx=0.42, fy=0.38), out_name)

    print("== L2 replica 2:3 (different crop from L1) ==")
    RW, RH = 768, 1152
    save(cover_crop(subject_region(person_port, 0.04), RW, RH, fx=0.5, fy=0.48), "diy-realtime-person-clean.png")
    # 宠物复刻：全身 contain，避免耳朵/侧边被 cover 裁掉、露原图边
    save(contain_on_canvas(pet_a, RW, RH, pad=0.07), "diy-realtime-pet-clean.png")
    save(cover_crop(subject_region(mecha, 0.06), RW, RH, fx=0.48, fy=0.46), "diy-realtime-toy-clean.png")

    print("== Waterfall / style cards 3:4 cover ==")
    CW, CH = 900, 1200
    save(cover_crop(subject_region(yarn, 0.04), CW, CH, fx=0.5, fy=0.45), "tpl-20-yarn-doll.png")
    save(contain_on_canvas(person_mecha, CW, CH, pad=0.1), "tpl-23-person-mecha.png")
    # 易裁头：先加头顶留白再 cover，避免 FILL 时头顶贴边
    def with_headroom(im, top=0.16, side=0.05, bot=0.06):
        w, h = im.size
        t, s, b = int(h * top), int(w * side), int(h * bot)
        canvas = Image.new("RGB", (w + s * 2, h + t + b), WHITE)
        canvas.paste(im, (s, t))
        return canvas

    save(cover_crop(with_headroom(subject_region(lego, 0.08), 0.14), CW, CH, fx=0.5, fy=0.28), "tpl-10-pixel.png")
    save(cover_crop(with_headroom(subject_region(selfie_box, 0.10), 0.20), CW, CH, fx=0.5, fy=0.22), "tpl-05-blindbox.png")
    save(cover_crop(with_headroom(subject_region(office, 0.10), 0.16), CW, CH, fx=0.5, fy=0.24), "tpl-16-office.png")
    save(cover_crop(subject_region(bjd_idol, 0.04), CW, CH, fx=0.5, fy=0.4), "tpl-21-bjd-idol.png")
    save(cover_crop(subject_region(bjd_selfie, 0.04), CW, CH, fx=0.5, fy=0.4), "tpl-22-bjd-school-id.png")
    # Q版机甲：flood 清棚拍灰底后 cover，避免原图灰边
    def flood_white_bg(im: Image.Image, thr: int = 225) -> Image.Image:
        from collections import deque

        out = im.copy()
        px = out.load()
        w, h = out.size
        seen = bytearray(w * h)
        q = deque()

        def is_bg(rgb):
            r, g, b = rgb
            return abs(r - g) < 18 and abs(g - b) < 18 and abs(r - b) < 18 and min(r, g, b) >= thr

        def push(x, y):
            i = y * w + x
            if seen[i] or not is_bg(px[x, y]):
                return
            seen[i] = 1
            q.append((x, y))

        for x in range(w):
            push(x, 0)
            push(x, h - 1)
        for y in range(h):
            push(0, y)
            push(w - 1, y)
        while q:
            x, y = q.popleft()
            px[x, y] = WHITE
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    i = ny * w + nx
                    if not seen[i] and is_bg(px[nx, ny]):
                        seen[i] = 1
                        q.append((nx, ny))
        return out

    mecha_clean = flood_white_bg(mecha)
    save(cover_crop(with_headroom(subject_region(mecha_clean, 0.02), 0.12), CW, CH, fx=0.5, fy=0.30), "tpl-17-mecha.png")
    save(cover_crop(subject_region(plant, 0.08), CW, CH, fx=0.5, fy=0.45), "tpl-09-season.png")

    print("== Vehicle: full car on white canvas matching card ~181:160 ==")
    vehicle_src = OUT / "tpl-12-vehicle.png"
    if vehicle_src.exists():
        v = open_rgb(vehicle_src)
        save(contain_on_canvas(v, 1086, 960, pad=0.05), "tpl-12-vehicle-full.png")

    print("== Remaining waterfall assets ==")
    skip = {
        "tpl-20-yarn-doll.png",
        "tpl-23-person-mecha.png",
        "tpl-10-pixel.png",
        "tpl-05-blindbox.png",
        "tpl-16-office.png",
        "tpl-21-bjd-idol.png",
        "tpl-22-bjd-school-id.png",
        "tpl-17-mecha.png",
        "tpl-09-season.png",
        "tpl-12-vehicle-full.png",
        "tpl-12-vehicle.png",
        "tpl-11-rpg.png",
        "tpl-03-clay-dog.png",
        "tpl-04-felt-cat.png",
    }
    # RPG / 粘土小狗 / 羊毛毡小猫：偏上 cover + 头顶留白
    samples = Path(r"d:\cursoe_code\XOLOME DIY Tab Prototype\samples")
    previews = samples / "shadow-previews"
    rpg_p = next(samples.rglob("RPG立绘立体化.png"), None)
    clay_p = next((p for p in previews.glob("*.png") if "粘土小狗" in p.name), None)
    felt_p = next((p for p in previews.glob("*.png") if "羊毛毡小猫" in p.name), None)
    if rpg_p:
        save(cover_crop(with_headroom(subject_region(open_rgb(rpg_p), 0.08), 0.16), CW, CH, fx=0.5, fy=0.22), "tpl-11-rpg.png")
    if clay_p:
        save(cover_crop(with_headroom(subject_region(open_rgb(clay_p), 0.06), 0.14), CW, CH, fx=0.5, fy=0.30), "tpl-03-clay-dog.png")
    if felt_p:
        save(cover_crop(with_headroom(subject_region(open_rgb(felt_p), 0.06), 0.14), CW, CH, fx=0.5, fy=0.28), "tpl-04-felt-cat.png")

    print("== Upload shooting guides: FULL subject contain (never crop) ==")
    # 拍摄示意图必须全身/全貌；宁可留白，禁止 cover 截取
    guide_map = {
        "guide-person.png": "真实卡片机小孩图.png",
        "guide-pet.png": "真实卡片机宠物图.png",
        "guide-toy.png": "真实卡片机机甲图.png",
    }
    for out_name, desk_name in guide_map.items():
        src = DESK / desk_name
        if not src.exists():
            print(f"  MISS {desk_name}")
            continue
        save(contain_on_canvas(open_rgb(src), 768, 1024, pad=0.06), out_name)

    for path in sorted(OUT.glob("tpl-*.png")):
        if path.name in skip:
            continue
        try:
            im = open_rgb(path)
            save(cover_crop(subject_region(im, 0.06), CW, CH, fx=0.5, fy=0.40), path.name)
        except Exception as e:
            print("  skip", path.name, e)

    print("done")


if __name__ == "__main__":
    main()
