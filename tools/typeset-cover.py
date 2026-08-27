#!/usr/bin/env python3
"""Typeset title + episode number onto a clean-plate cover.

The cover stage deliberately renders no text — a generative model mangles CJK
often enough that a wrong-title cover is worse than none. This puts the words
on deterministically: a large vertical brush-style title on the right edge, an
episode seal under it, both with stroke and a soft scrim so they read on any
plate.

Usage:
  typeset-cover.py --plate cover.png --title 寒门贵子 --episode 1 --out ep1.png
  (repeat per episode; --subtitle for a tagline is optional)
  --intro "line1|line2|line3" replaces the episode seal with a synopsis block —
  the series poster variant. --episode 0 omits the seal.
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONTS = [
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]
CN_NUM = "零一二三四五六七八九十"

IVORY = "#F5F0E6"
GOLD = "#D6B26A"
INK = "#0C0E12"


def episode_cn(n: int) -> str:
    if n <= 10:
        return CN_NUM[n]
    if n < 20:
        return f"十{CN_NUM[n % 10]}"
    return str(n)


def load_font(px: int) -> ImageFont.FreeTypeFont:
    for path in FONTS:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, px)
            except OSError:
                continue
    print("FONT_ERROR: no usable CJK font", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plate", required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--episode", type=int, default=0)
    ap.add_argument("--intro", default="", help="synopsis lines separated by |")
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    img = Image.open(args.plate).convert("RGBA")
    W, H = img.size

    # The cover stage leaves the upper quarter as clean negative space for
    # exactly this — the title runs horizontally across it, clear of faces.
    title_px = W // 6
    font = load_font(title_px)
    stroke = max(3, title_px // 14)
    d = ImageDraw.Draw(img)

    tw = d.textlength(args.title, font=font)
    tx, ty = (W - tw) / 2, H // 22
    d.text((tx, ty), args.title, font=font, fill=IVORY, stroke_width=stroke, stroke_fill=INK)

    # Episode seal: small vertical 「第X集」 hugging the right edge below the
    # title, gold so it reads as a chapter mark rather than part of the name.
    if args.episode > 0:
        seal_px = title_px // 3
        seal_font = load_font(seal_px)
        seal = f"第{episode_cn(args.episode)}集"
        sx = W - seal_px - W // 28
        sy = ty + title_px + seal_px
        pad = seal_px // 3
        d.rounded_rectangle(
            [sx - pad, sy - pad, sx + seal_px + pad, sy + int(seal_px * 1.25) * len(seal) + pad],
            radius=pad, fill=(12, 14, 18, 150), outline=GOLD, width=2,
        )
        for ch in seal:
            w = d.textlength(ch, font=seal_font)
            d.text((sx + (seal_px - w) / 2, sy), ch, font=seal_font, fill=GOLD,
                   stroke_width=max(2, seal_px // 14), stroke_fill=INK)
            sy += int(seal_px * 1.25)

    # Synopsis block: the poster variant. Sits in the lower third over a soft
    # ink panel so it stays readable without hiding the two leads' hands.
    if args.intro:
        lines = [ln.strip() for ln in args.intro.split("|") if ln.strip()]
        intro_px = W // 30
        intro_font = load_font(intro_px)
        lh = int(intro_px * 1.7)
        block_h = lh * len(lines) + intro_px * 2
        y0 = H - block_h - int(H * 0.035) - (intro_px * 4 if args.subtitle else 0)
        panel = Image.new("RGBA", img.size, (0, 0, 0, 0))
        pd = ImageDraw.Draw(panel)
        pd.rounded_rectangle(
            [W // 16, y0, W - W // 16, y0 + block_h],
            radius=intro_px, fill=(12, 14, 18, 130),
        )
        img = Image.alpha_composite(img, panel)
        d = ImageDraw.Draw(img)
        yy = y0 + intro_px
        for ln in lines:
            w = d.textlength(ln, font=intro_font)
            d.text(((W - w) / 2, yy), ln, font=intro_font, fill=IVORY,
                   stroke_width=max(1, intro_px // 14), stroke_fill=INK)
            yy += lh

    if args.subtitle:
        sub_px = W // 26
        sub_font = load_font(sub_px)
        w = d.textlength(args.subtitle, font=sub_font)
        d.text(((W - w) / 2, H - sub_px * 3), args.subtitle, font=sub_font,
               fill=IVORY, stroke_width=max(2, sub_px // 12), stroke_fill=INK)

    img.convert("RGB").save(args.out, quality=92)
    print(args.out)


if __name__ == "__main__":
    main()
