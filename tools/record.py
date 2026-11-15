"""Preview video of the home page scroll (for review, not part of the site).
Deterministic: sets the scroll position per frame, screenshots it, ffmpeg joins the frames.
Usage: python tools/record.py [width=1280] [height=720] [fps=15]   -> out/preview_<w>.mp4
"""
import functools, http.server, pathlib, shutil, socketserver, subprocess, sys, threading
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out"; OUT.mkdir(exist_ok=True)
W = int(sys.argv[1]) if len(sys.argv) > 1 else 1280
H = int(sys.argv[2]) if len(sys.argv) > 2 else 720
FPS = int(sys.argv[3]) if len(sys.argv) > 3 else 15
tmp = OUT / f"_rec_{W}"; shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
handler.log_message = lambda *a: None
socketserver.ThreadingTCPServer.daemon_threads = True
socketserver.ThreadingTCPServer.request_queue_size = 128
srv = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

ease = lambda t: 2 * t * t if t < .5 else 1 - (-2 * t + 2) ** 2 / 2
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    page = b.new_page(viewport={"width": W, "height": H})
    page.goto(f"http://127.0.0.1:{port}/index.html", wait_until="networkidle")
    page.wait_for_timeout(2500)
    mx, hero = page.evaluate("() => [document.documentElement.scrollHeight - innerHeight, document.querySelector('.scrub').offsetHeight - innerHeight]")
    segs = [(0, hero, 12), (hero, mx, 48)]          # (from, to, seconds)
    n = 0
    for a, z, sec in segs:
        frames = int(sec * FPS)
        for i in range(frames + 1):
            k = i / frames
            y = a + (z - a) * (k if a == 0 else ease(k))
            page.evaluate("y => { if (window.__lenis) window.__lenis.scrollTo(y, {immediate: true}); window.scrollTo(0, y); }", y)
            page.wait_for_timeout(70)
            page.screenshot(path=str(tmp / f"{n:05d}.jpg"), type="jpeg", quality=80)
            n += 1
    b.close()
srv.shutdown()
mp4 = OUT / f"preview_{W}.mp4"
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-i", str(tmp / "%05d.jpg"), "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)], check=True)
shutil.rmtree(tmp, ignore_errors=True)
print(mp4, mp4.stat().st_size // 1024, "KB,", n, "frames")
