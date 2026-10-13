"""python3 -m tools.gate.selftest_threshold : threshold views exist in views.json and render (618x~1372) from zd-play-1012."""
import json, os, socket, subprocess, sys, tempfile, time
from PIL import Image
HERE = os.path.dirname(__file__); PLAY = "/workspace/zd-play-1012"
def main():
    v = json.load(open(os.path.join(HERE, "views.json"))); ok = True
    for n in ("threshold-3m-30d", "threshold-8m-30d"):
        c = n in v and v[n]["pitch_deg"] == -30 and v[n]["vfov_deg"] == 48 and v[n]["up_m"] == 2.6; print(("PASS" if c else "FAIL"), "view", n); ok &= c
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "-d", PLAY], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1); d = tempfile.mkdtemp(prefix="thr-selftest-")
        r = subprocess.run(["node", os.path.join(HERE, "threshold_view.mjs"), f"http://127.0.0.1:{port}", d, "threshold-3m-30d"], capture_output=True, text=True, timeout=600)
        p = os.path.join(d, "threshold-3m-30d.png"); c = r.returncode == 0 and os.path.exists(p)
        if c:
            W, H = Image.open(p).size; ext = Image.open(p).convert("L").getextrema(); c = W == 618 and abs(H - 1372) <= 1 and ext[1] > ext[0]
        print(("PASS" if c else "FAIL"), "render", p, r.stderr[-300:] if not c else ""); ok &= c
    finally:
        srv.terminate()
    print("ALL PASS" if ok else "SELFTEST FAIL"); return 0 if ok else 1
if __name__ == "__main__": sys.exit(main())
