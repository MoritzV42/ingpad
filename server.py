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
import shutil
import subprocess
import sys
import re
import email
import email.policy
import urllib.parse
import urllib.request
import urllib.error
import uuid

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJEKT = sys.argv[1] if len(sys.argv) > 1 else "becherwerk"
BASE = os.path.join(ROOT, "projekte", PROJEKT)
PORT = int(os.environ.get("INGPAD_PORT", "8042"))
SCRATCH = os.path.join(BASE, "scratchpad.json")
ATTACH_DIR = os.path.join(BASE, "attachments")
AI_SESSION_FILE = os.path.join(BASE, ".ai-session")
AI_TIMEOUT = int(os.environ.get("INGPAD_AI_TIMEOUT", "120"))

# Short tutor persona, prepended once per Claude session (first prompt only).
TUTOR_SYSTEM_PROMPT = (
    "You are the AI tutor inside ingpad, a learning workbench where engineering "
    "students solve technical exercises step by step on a canvas. Act as a "
    "socratic tutor: guide the student's own thinking, verify their approach, "
    "recalculate steps, point to relevant formulas and standards — but never "
    "hand out the complete solution to an unsolved step. Answer in the language "
    "the user writes in (German with proper umlauts if they write German). "
    "Keep answers compact and precise. Format formulas in LaTeX with \\( ... \\) "
    "or $$ ... $$."
)


def _app_version():
    """Best-effort app version from the first '## [x.y.z]' heading in CHANGELOG.md."""
    try:
        with open(os.path.join(ROOT, "CHANGELOG.md"), "r", encoding="utf-8") as f:
            for line in f:
                m = re.match(r"##\s*\[([^\]]+)\]", line)
                if m:
                    return m.group(1)
    except Exception:
        pass
    return ""


# Claude-CLI discovery is cached after the first successful probe; a negative
# result is re-probed on every /api/ai/status call so a fresh install is picked
# up without restarting the server.
_claude_cache = {"path": None, "version": None}


def _claude_cmd(path, args):
    """Build an argv list for the claude CLI, Windows-shim aware.

    shutil.which() on Windows may resolve to claude.exe / claude.cmd (both run
    fine via CreateProcess without shell=True) or — worst case — claude.ps1,
    which needs an explicit powershell wrapper.
    """
    if path.lower().endswith(".ps1"):
        return ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                "-File", path] + args
    return [path] + args


def _find_claude():
    """Locate the claude CLI and verify it actually runs. Returns (path, version)."""
    if _claude_cache["path"]:
        return _claude_cache["path"], _claude_cache["version"]
    candidates = []
    for name in ("claude", "claude.exe", "claude.cmd"):
        p = shutil.which(name)
        if p and p not in candidates:
            candidates.append(p)
    # Prefer real executables over PowerShell shims.
    candidates.sort(key=lambda p: p.lower().endswith(".ps1"))
    for p in candidates:
        try:
            r = subprocess.run(_claude_cmd(p, ["--version"]),
                               capture_output=True, text=True, timeout=10,
                               encoding="utf-8", errors="replace")
            if r.returncode == 0:
                _claude_cache["path"] = p
                _claude_cache["version"] = (r.stdout or r.stderr or "").strip()
                return p, _claude_cache["version"]
        except Exception:
            continue
    return None, None


def _load_ai_session():
    """Return the stored Claude session id for this project, or None."""
    try:
        with open(AI_SESSION_FILE, "r", encoding="utf-8") as f:
            sid = f.read().strip()
        uuid.UUID(sid)  # validate format
        return sid
    except Exception:
        return None


def _save_ai_session(sid):
    try:
        with open(AI_SESSION_FILE, "w", encoding="utf-8") as f:
            f.write(sid)
    except Exception:
        pass


def _run_claude(path, prompt, session_args):
    """One claude -p invocation; prompt goes via stdin (avoids Windows arg-length
    and quoting issues with .cmd shims). Returns the CompletedProcess."""
    cmd = _claude_cmd(path, ["-p", "--output-format", "json"] + session_args)
    return subprocess.run(cmd, input=prompt, capture_output=True, text=True,
                          timeout=AI_TIMEOUT, cwd=BASE,
                          encoding="utf-8", errors="replace")


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
        if parsed.path == "/api/ai/status":
            # Is the claude CLI installed and runnable? (--version success is
            # our "installed" proxy — no login probe, that would burn tokens.)
            path, version = _find_claude()
            self._json(200, {"claude": bool(path), "version": version or "",
                             "app": _app_version(), "project": PROJEKT})
            return
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
        if self.path == "/api/chat":
            self._do_chat()
            return
        if self.path == "/api/ai/ask":
            self._do_ai_ask()
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

    def _do_ai_ask(self):
        """POST /api/ai/ask — default AI backend: the Claude Code CLI.

        Body: {message, context?}. Runs `claude -p --output-format json` as a
        local subprocess; auth comes from the user's Claude subscription login
        (~/.claude), no API key involved. Session persistence: one Claude
        session per project — first call uses --session-id <uuid4> (stored in
        projekte/<name>/.ai-session), later calls --resume <id>. The first
        prompt of a session is prefixed with a short tutor system prompt.
        Errors come back as JSON ({ok:false, fehler, hinweis}).
        """
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n).decode("utf-8"))
            message = (req.get("message") or "").strip()
            context = (req.get("context") or "").strip()
            if not message:
                self._json(400, {"ok": False, "fehler": "message fehlt"})
                return

            path, _version = _find_claude()
            if not path:
                self._json(200, {"ok": False, "fehler": "claude-not-found",
                                 "hinweis": "Claude Code CLI not found. Install it "
                                            "(npm install -g @anthropic-ai/claude-code), "
                                            "run `claude` once to log in, then restart ingpad."})
                return

            def build_prompt(new_session):
                parts = []
                if new_session:
                    parts.append(TUTOR_SYSTEM_PROMPT)
                if context:
                    parts.append("Current state of the student's work canvas:\n" + context)
                parts.append(message)
                return "\n\n".join(parts)

            session_id = _load_ai_session()
            if session_id:
                r = _run_claude(path, build_prompt(False), ["--resume", session_id])
                if r.returncode != 0:
                    # Stale/expired session — fall back to a fresh one.
                    session_id = None
            if not session_id:
                session_id = str(uuid.uuid4())
                r = _run_claude(path, build_prompt(True), ["--session-id", session_id])

            if r.returncode != 0:
                err = (r.stderr or r.stdout or "").strip()[:500]
                self._json(200, {"ok": False, "fehler": "claude exited with %d" % r.returncode,
                                 "hinweis": err or "Is the CLI logged in? Run `claude` once."})
                return

            # claude -p --output-format json prints one JSON object with the
            # reply in "result".
            text = ""
            try:
                out = json.loads(r.stdout)
                text = out.get("result", "") or ""
            except Exception:
                text = (r.stdout or "").strip()

            _save_ai_session(session_id)
            self._json(200, {"ok": True, "text": text})
        except subprocess.TimeoutExpired:
            self._json(200, {"ok": False, "fehler": "timeout",
                             "hinweis": "Claude did not answer within %ds "
                                        "(INGPAD_AI_TIMEOUT to change)." % AI_TIMEOUT})
        except Exception as e:
            self._json(200, {"ok": False, "fehler": str(e)})

    def _do_chat(self):
        """POST /api/chat — fallback proxy to an OpenAI-compatible chat backend.

        Body: {endpoint, model, key, messages}. Der Server ruft
        <endpoint>/chat/completions auf (Anthropic, OpenRouter, OpenAI,
        Mistral, DeepSeek, Groq, …) und gibt {ok, text} zurueck. Proxy noetig,
        weil der Browser sonst an CORS scheitert; der API-Key bleibt im
        lokalen Datenfluss (kein Logging). Default-Backend ist inzwischen die
        Claude-CLI (/api/ai/ask) — dieser Proxy bleibt als API-Key-Fallback.

        Sicherheit: Dev-Server, an 127.0.0.1 gebunden — die Ziel-URL kommt vom
        Frontend (SSRF-unkritisch lokal). Beim spaeteren Hosting einschraenken.
        """
        try:
            n = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(n).decode("utf-8"))
            endpoint = (req.get("endpoint") or "").rstrip("/")
            model = req.get("model") or ""
            key = req.get("key") or ""
            messages = req.get("messages") or []
            if not endpoint or not model:
                self._json(200, {"ok": False, "fehler": "endpoint/model missing",
                                 "hinweis": "Configure an API endpoint and model "
                                            "in the chat settings (gear icon)."})
                return

            url = endpoint if endpoint.endswith("/chat/completions") else endpoint + "/chat/completions"
            payload = json.dumps({"model": model, "messages": messages, "stream": False}).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if key:
                headers["Authorization"] = "Bearer " + key

            r = urllib.request.Request(url, data=payload, headers=headers, method="POST")
            with urllib.request.urlopen(r, timeout=120) as resp:
                out = json.loads(resp.read().decode("utf-8"))
            text = (out.get("choices", [{}])[0].get("message", {}) or {}).get("content", "")
            self._json(200, {"ok": True, "text": text})
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")[:500]
            except Exception:
                pass
            self._json(200, {"ok": False, "fehler": "Backend %s" % e.code,
                             "hinweis": body or "Endpoint/Modell/Key pruefen."})
        except urllib.error.URLError as e:
            self._json(200, {"ok": False, "fehler": "Backend nicht erreichbar",
                             "hinweis": "Endpoint not reachable — check the URL. (%s)" % e.reason})
        except Exception as e:
            self._json(200, {"ok": False, "fehler": str(e)})

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
