/*
 * ingpad — Dark/Light-Mode-Umschalter
 * ---------------------------------------------------------------------------
 * Haengt einen Toggle-Button (Mond/Sonne) in den <header> ein, schaltet
 * zwischen Dark- und Light-Theme um und persistiert die Wahl in localStorage.
 *
 * Mechanik:
 *   - Light-Mode setzt die Klasse "light" am <body> (zusaetzlich data-theme).
 *   - Die Light-Palette muss im <style> des jeweiligen index.html als
 *       body.light{ --bg:…; --card:…; … }
 *     definiert sein (ueberschreibt die :root-Dark-Variablen).
 *   - Damit auch das Zeichenfeld-Canvas (setupDraw) im Light-Mode hell wird,
 *     definiert die App eine CSS-Variable --paper. Der Canvas-Code liest sie
 *     per getComputedStyle. theme.js loest nach jedem Wechsel ein
 *     'ingpad-theme'-Event aus, damit offene Zeichenfelder neu zeichnen.
 *
 * EINBINDEN (im index.html eines Projekts, am Ende des <body>):
 *     <script src="/app/theme.js"></script>
 *   Kein Init-Aufruf noetig — laeuft selbststaendig bei DOMContentLoaded.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  var KEY = "ingpad-theme";

  function current() {
    try {
      return localStorage.getItem(KEY) === "light" ? "light" : "dark";
    } catch (e) {
      return "dark";
    }
  }

  function apply(theme) {
    var light = theme === "light";
    document.body.classList.toggle("light", light);
    if (light) {
      document.body.setAttribute("data-theme", "light");
    } else {
      document.body.removeAttribute("data-theme");
    }
    // Offene Zeichenfelder informieren, damit sie den Papier-Hintergrund
    // (CSS-Variable --paper) neu auslesen und neu zeichnen.
    try {
      window.dispatchEvent(new CustomEvent("ingpad-theme", { detail: { theme: theme } }));
    } catch (e) { /* aelterer Browser ohne CustomEvent-Konstruktor */ }
  }

  function updateBtn(btn, theme) {
    var light = theme === "light";
    // Icon zeigt, wohin der Klick fuehrt.
    btn.textContent = light ? "🌙" : "☀️";
    btn.title = light ? "Zu Dark-Mode wechseln" : "Zu Light-Mode wechseln";
    btn.setAttribute("aria-label", btn.title);
  }

  function ensureStyles() {
    if (document.getElementById("ingpad-theme-css")) return;
    var s = document.createElement("style");
    s.id = "ingpad-theme-css";
    s.textContent = [
      ".theme-toggle{margin-left:12px;height:30px;min-width:34px;padding:0 9px;",
      "  border-radius:8px;border:1px solid var(--line);background:var(--card2);",
      "  color:var(--tx);cursor:pointer;font-size:15px;line-height:1;display:inline-flex;",
      "  align-items:center;justify-content:center;transition:border-color .15s,background .15s}",
      ".theme-toggle:hover{border-color:var(--acc)}",
      // Wenn die .live-Anzeige existiert, schiebt sie sich per margin-left:auto
      // nach rechts; der Toggle soll daneben sitzen, nicht erneut auto-pushen.
      "header .live + .theme-toggle{margin-left:12px}",
    ].join("");
    document.head.appendChild(s);
  }

  function mount() {
    var header = document.querySelector("header");
    if (!header || header.querySelector(".theme-toggle")) return;
    ensureStyles();

    var theme = current();
    apply(theme);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    updateBtn(btn, theme);

    btn.addEventListener("click", function () {
      theme = current() === "light" ? "dark" : "light";
      try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode */ }
      apply(theme);
      updateBtn(btn, theme);
    });

    header.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
