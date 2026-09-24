# -*- coding: utf-8 -*-
"""Снимок страниц сайта целиком через headless Edge + нарезка на куски.

Edge снимает окно, а не документ, поэтому окно делаем заведомо высоким,
после чего обрезаем пустой низ и режем полотно на экраны — так удобно
просматривать вёрстку постранично.

    PYTHONIOENCODING=utf-8 python shot.py                  # все страницы, 1440
    PYTHONIOENCODING=utf-8 python shot.py 500              # все страницы, телефон
    PYTHONIOENCODING=utf-8 python shot.py 1440 index how   # только эти
"""
import os
import subprocess
import sys
import tempfile
import time

from PIL import Image, ImageChops

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if not os.path.exists(EDGE):
    EDGE = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
TALL = 15000          # запас по высоте, лишнее обрежется
CHUNK = 1100          # высота одного куска при нарезке


MIN_WIN = 500     # уже этого Edge окно не делает: просит 420 — рисует 476
                  # и обрезает снимок справа, из-за чего вёрстка кажется битой


def shot(width, dest, name):
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--window-size=%d,%d" % (width, TALL),
                        "--virtual-time-budget=6000",
                        "--screenshot=" + dest,
                        "file:///" + os.path.join(HERE, name + ".html").replace("\\", "/"),
                        "--user-data-dir=" + os.path.join(tmp, "ud")],
                       capture_output=True, timeout=180)
    # Edge иногда отдаёт управление раньше, чем допишет файл
    for _ in range(40):
        if os.path.exists(dest):
            time.sleep(0.5)
            return True
        time.sleep(0.5)
    return False


def trim(path):
    """Обрезать однотонный хвост внизу."""
    im = Image.open(path).convert("RGB")
    bg = Image.new("RGB", im.size, im.getpixel((im.width - 2, im.height - 2)))
    box = ImageChops.difference(im, bg).getbbox()
    if box:
        im = im.crop((0, 0, im.width, min(im.height, box[3] + 2)))
    im.save(path)
    return im


PAGES = ["index", "services", "how", "works", "contact",
         "oferta", "payment", "privacy", "consent"]


def main():
    width = int(sys.argv[1]) if len(sys.argv) > 1 else 1440
    names = sys.argv[2:] or PAGES
    if width < MIN_WIN:
        print("ширина поднята до %d — Edge не рисует окно уже" % MIN_WIN)
        width = MIN_WIN
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    for name in names:
        full = os.path.join(OUT, "%s-%d.png" % (name, width))
        if not shot(width, full, name):
            print(name, "не снялось")
            continue
        im = trim(full)
        n = 0
        for top in range(0, im.height, CHUNK):
            n += 1
            part = os.path.join(OUT, "%s-%d-%02d.png" % (name, width, n))
            im.crop((0, top, im.width, min(im.height, top + CHUNK))).save(part)
        print(name, im.size, "кусков:", n)


if __name__ == "__main__":
    main()
