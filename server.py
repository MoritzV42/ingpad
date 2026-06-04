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
import re
import email
import email.policy
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJEKT = sys.argv[1] if len(sys.argv) > 1 else "becherwerk"
BASE = os.path.join(ROOT, "projekte", PROJEKT)
PORT = int(os.environ.get("INGPAD_PORT", "8042"))
SCRATCH = os.path.join(BASE, "scratchpad.json")
ATTACH_DIR = os.path.join(BASE, "attachments")


def _safe_name(name):
    """Reduziert einen Wert auf einen einzelnen, sicheren Pfadbestandteil.

    Entfernt Verzeichnisanteile (Pfad-Traversal) und alle ausser
    Buchstaben/Ziffern/Punkt/Bindestrich/Unterstrich. Leerer Rest -> Default.
    """
    base = os.path.basename(str(name or "").replace("\\", "/"))
    base = re.sub(r"[^A-Za-z0-9._-]", "_", base).strip("._")
    return base or "datei"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE, **kwargs)

    def translate_path(self, path):
        """Static-Mapping. /app/... wird aus dem Repo-app/-Ordner geliefert
        (gemeinsame Frontend-Komponenten wie attachments.js), alles andere
        wie gehabt aus projekte/<projekt>/."""
        clean = urllib.parse.urlparse(path).path
        if clean == "/app" or clean.startswith("/app/"):
            rel = clean[len("/app"):].lstrip("/")
            rel = rel.replace("/", os.sep)
            # os.path.normpath + basename-Kette schuetzt vor Traversal
            full = os.path.normpath(os.path.join(ROOT, "app", rel))
            app_root = os.path.join(ROOT, "app")
            if full == app_root or full.startswith(app_root + os.sep):
                return full
        return super().translate_path(path)

    def do_GET(self):
        """GET /api/attach?task=<id> -> Liste der Anhaenge; sonst statisch."""
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/attach":
            try:
                q = urllib.parse.parse_qs(parsed.query)
                task = _safe_name(q.get("task", [""])[0])
                ordner = os.path.join(ATTACH_DIR, task)
                dateien = []
                if os.path.isdir(ordner):
                    for n in sorted(os.listdir(ordner)):
                        p = os.path.join(ordner, n)
                        if os.path.isfile(p):
                            dateien.append({
                                "name": n,
                                "groesse": os.path.getsize(p),
                                "url": "attachments/%s/%s" % (task, n),
                            })
                self._json(200, {"ok": True, "dateien": dateien})
            except Exception as e:
                self._json(500, {"ok": False, "fehler": str(e)})
            return
        super().do_GET()

    def do_POST(self):
        if self.path == "/api/attach":
            self._do_attach()
            return
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

    def _do_attach(self):
        """POST /api/attach — multipart/form-data: Datei + Feld 'task' (Step-ID).

        Speichert die hochgeladene Datei unter
        projekte/<projekt>/attachments/<task>/<originalname> und antwortet mit
        {ok, gespeichert: <relativer pfad>}. Dateinamen werden gegen
        Pfad-Traversal abgesichert.
        """
        try:
            ctype = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in ctype:
                self._json(400, {"ok": False, "fehler": "multipart/form-data erwartet"})
                return

            n = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(n)

            # Multipart via stdlib email-Parser zerlegen (cgi gibt es ab 3.13
            # nicht mehr). Header + roher Body zu einer MIME-Message bauen.
            raw = b"Content-Type: " + ctype.encode("latin-1") + b"\r\n\r\n" + body
            msg = email.message_from_bytes(raw, policy=email.policy.default)

            task = ""
            fname = ""
            inhalt = None
            for part in msg.iter_parts() if msg.is_multipart() else []:
                disp = part.get_content_disposition()
                if disp != "form-data":
                    continue
                name = part.get_param("name", header="content-disposition")
                if name == "task":
                    task = part.get_content().strip() if not part.get_filename() else ""
                    if not task:
                        task = part.get_payload(decode=True).decode("utf-8", "replace").strip()
                elif name in ("datei", "file") and inhalt is None:
                    fname = part.get_filename() or ""
                    inhalt = part.get_payload(decode=True)

            task = _safe_name(task)
            if inhalt is None or not fname:
                self._json(400, {"ok": False, "fehler": "keine Datei (Feld 'datei') uebergeben"})
                return

            fname = _safe_name(fname)
            zielordner = os.path.join(ATTACH_DIR, task)
            os.makedirs(zielordner, exist_ok=True)
            zielpfad = os.path.join(zielordner, fname)

            with open(zielpfad, "wb") as f:
                f.write(inhalt)

            rel = os.path.relpath(zielpfad, BASE).replace("\\", "/")
            self._json(200, {"ok": True, "gespeichert": rel})
        except Exception as e:
            self._json(500, {"ok": False, "fehler": str(e)})

    def do_DELETE(self):
        """DELETE /api/attach?task=<id>&name=<datei> — entfernt einen Anhang."""
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/api/attach":
            self.send_error(404)
            return
        try:
            q = urllib.parse.parse_qs(parsed.query)
            task = _safe_name(q.get("task", [""])[0])
            name = _safe_name(q.get("name", [""])[0])
            zielpfad = os.path.join(ATTACH_DIR, task, name)
            if os.path.isfile(zielpfad):
                os.remove(zielpfad)
                self._json(200, {"ok": True, "geloescht": name})
            else:
                self._json(404, {"ok": False, "fehler": "nicht gefunden"})
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
