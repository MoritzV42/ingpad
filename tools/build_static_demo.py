#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Baut aus projekte/demo/ eine statische, server-freie Demo (fuer GitHub Pages
/ CF Pages). Absolute /app/-Pfade werden relativ, die Server-Endpoints
(/api/submit|attach|chat) werden per Shim abgefangen und zeigen einen
freundlichen „Demo-Modus"-Hinweis statt eines Netzwerkfehlers.

    python build_static_demo.py [ZIELORDNER]   # default: ../_site
"""
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "projekte", "demo")
APP = os.path.join(ROOT, "app")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "_site")

SHIM = """/* Static-Demo-Shim: faengt Server-Endpoints ab (kein Backend auf Pages). */
(function () {
  var orig = window.fetch;
  window.fetch = function (url, opts) {
    if (typeof url === "string" && url.indexOf("/api/") === 0) {
      toast();
      return Promise.resolve(new Response(JSON.stringify({
        ok: false, fehler: "Demo-Modus",
        hinweis: "Senden, Datei-Upload und KI-Tutor laufen in der gehosteten Vollversion."
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return orig.apply(this, arguments);
  };
  var shown = false;
  function toast() {
    if (shown) return; shown = true;
    var t = document.createElement("div");
    t.textContent = "🔬 Demo-Modus — diese Aktion ist in der gehosteten Vollversion aktiv";
    t.style.cssText = "position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999;" +
      "background:#1b6fc4;color:#fff;padding:10px 16px;border-radius:10px;font:14px Segoe UI,sans-serif;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.35)";
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = "opacity .5s"; t.style.opacity = "0";
      setTimeout(function () { t.remove(); shown = false; }, 600); }, 3200);
  }
  function banner() {
    var b = document.createElement("div");
    b.innerHTML = "Live-Demo von <b>ingpad</b> · zeichnen funktioniert direkt im Browser · " +
      "KI-Tutor, Senden &amp; Upload in der Vollversion · " +
      "<a href='https://github.com/MoritzV42/ingpad' style='color:inherit'>Quellcode &amp; selbst hosten →</a>";
    b.style.cssText = "position:sticky;top:0;z-index:30;background:linear-gradient(90deg,#1b6fc4,#7a5af0);" +
      "color:#fff;padding:7px 14px;font:13px Segoe UI,sans-serif;text-align:center";
    document.body.insertBefore(b, document.body.firstChild);
  }
  if (document.readyState !== "loading") banner();
  else window.addEventListener("DOMContentLoaded", banner);
})();
"""


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(os.path.join(OUT, "app"), exist_ok=True)

    with open(os.path.join(DEMO, "index.html"), "r", encoding="utf-8") as f:
        html = f.read()
    # absolute /app/-Pfade -> relativ
    html = html.replace('src="/app/', 'src="app/')
    # Shim direkt vor den App-Komponenten laden
    html = re.sub(r'(<script src="app/theme\.js">)',
                  '<script src="static-shim.js"></script>\n\\1', html, count=1)
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(html)

    with open(os.path.join(OUT, "static-shim.js"), "w", encoding="utf-8") as f:
        f.write(SHIM)

    for js in ("theme.js", "attachments.js", "chat.js"):
        shutil.copy(os.path.join(APP, js), os.path.join(OUT, "app", js))
    # Assets der Demo (Standard-Skizze)
    skizze = os.path.join(DEMO, "beispiel-skizze.png")
    if os.path.exists(skizze):
        shutil.copy(skizze, os.path.join(OUT, "beispiel-skizze.png"))
    # GitHub-Pages: Jekyll aus, .nojekyll
    open(os.path.join(OUT, ".nojekyll"), "w").close()

    print("statische Demo gebaut in:", OUT)
    print("Dateien:", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
