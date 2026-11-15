"""Render the site at key scroll points.

Usage: python tools/shot.py [width=1440] [height=900] [page=index]
Serves the folder on a local port, scrolls to each point, writes out/shot_<page>_<w>_<nn>.jpg and a contact sheet.
"""
import functools
import http.server
import pathlib
import socketserver
import sys
import threading

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
OUT.mkdir(exist_ok=True)
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1440
H = int(sys.argv[2]) if len(sys.argv) > 2 else 900
PAGE = sys.argv[3] if len(sys.argv) > 3 else "index"

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
handler.log_message = lambda *a: None
socketserver.ThreadingTCPServer.daemon_threads = True
socketserver.ThreadingTCPServer.request_queue_size = 128
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

# (selector, progress): for .scrub the progress is 0..1 of its scroll length, else a fraction of the element height
POINTS = {
    "index": [
        (".scrub", 0.0), (".scrub", 0.25), (".scrub", 0.5), (".scrub", 0.72), (".scrub", 0.98),
        (".manifest", 0.3), (".manifest", 0.9), (".marquee", 0.0),
        ("#uslugi", 0.0), ("#uslugi", 0.5),
        (".scrub--steps", 0.05), (".scrub--steps", 0.35), (".scrub--steps", 0.62), (".scrub--steps", 0.95),
        (".scrub--cta", 0.2), (".scrub--cta", 0.62), (".scrub--cta", 0.98), (".foot", 0.5),
    ],
}.get(PAGE, [("main", 0.0), ("main", 0.4), ("main", 0.8), (".foot", 0.5)])

files = []
with sync_playwright() as p:
    browser = p.chromium.launch(channel="msedge", headless=True)
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/{PAGE}.html", wait_until="networkidle")
    page.wait_for_timeout(1800)
    for n, (sel, prog) in enumerate(POINTS):
        y = page.evaluate(
            """([sel, prog]) => { const el = document.querySelector(sel); const r = el.getBoundingClientRect();
            const top = r.top + scrollY; const len = Math.max(0, el.offsetHeight - innerHeight);
            return Math.round(top + (el.classList.contains('scrub') ? len * prog : el.offsetHeight * prog)); }""",
            [sel, prog],
        )
        page.evaluate("y => { if (window.__lenis) window.__lenis.scrollTo(y, {immediate: true}); window.scrollTo(0, y); }", y)
        page.wait_for_timeout(1700)
        f = OUT / f"shot_{PAGE}_{W}_{n:02d}.jpg"
        page.screenshot(path=str(f), type="jpeg", quality=74)
        files.append(f)
    browser.close()
srv.shutdown()
print("console errors:", errors or "none")

tw = 480 if W > 800 else 240
th = int(tw * H / W)
cols = 4 if W > 800 else 6
rows = -(-len(files) // cols)
sheet = Image.new("RGB", (cols * tw, rows * th), "#222")
for i, f in enumerate(files):
    im = Image.open(f).resize((tw, th))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(OUT / f"sheet_{PAGE}_{W}.jpg", quality=80)
print("sheet:", OUT / f"sheet_{PAGE}_{W}.jpg")
