/* Static-Demo-Shim: faengt Server-Endpoints ab (kein Backend auf Pages). */
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
