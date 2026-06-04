#!/usr/bin/env python3
"""
ingpad — local dev server for the solve-canvas projects.

Serves a project from projekte/<name>/ and receives the per-step drawing
fields as PNGs (POST /api/submit) so the AI can read and grade them.

    python server.py            # default project: becherwerk
    python server.py <name>     # serve projekte/<name>/
    -> http://localhost:8042/index.html
"""
import http.server
import json
import os
import base64
import datetime
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJEKT = sys.argv[1] if len(sys.argv) > 1 else "becherwerk"
BASE = os.path.join(ROOT, "projekte", PROJEKT)
PORT = 8042
SCRATCH = os.path.join(BASE, "scratchpad.json")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE, **kwargs)

    def do_POST(self):
        if self.path != "/api/submit":
            self.send_error(404)
            return
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n).decode("utf-8"))
            data["empfangen"] = datetime.datetime.now().isoformat(timespec="seconds")

            # drawing field PNG (base64 data-URL) -> file; drop the dataURL from json
            img = data.get("image", "")
            if isinstance(img, str) and img.startswith("data:image"):
                raw = base64.b64decode(img.split(",", 1)[1])
                fname = "submit_%s.png" % data.get("task", "x")
                with open(os.path.join(BASE, fname), "wb") as f:
                    f.write(raw)
                data["image"] = fname

            history = []
            if os.path.exists(SCRATCH):
                try:
                    with open(SCRATCH, "r", encoding="utf-8") as f:
                        prev = json.load(f)
                    history = prev.get("historie", [])
                    if prev.get("aktuell"):
                        history.append(prev["aktuell"])
                except Exception:
                    pass
            with open(SCRATCH, "w", encoding="utf-8") as f:
                json.dump({"aktuell": data, "historie": history[-50:]}, f, ensure_ascii=False, indent=2)

            self._json(200, {"ok": True})
        except Exception as e:
            self._json(500, {"ok": False, "fehler": str(e)})

    def _json(self, code, obj):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    if not os.path.isdir(BASE):
        sys.exit(f"Projekt '{PROJEKT}' nicht gefunden unter {BASE}")
    print(f"ingpad — Projekt '{PROJEKT}' auf http://localhost:{PORT}/index.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
