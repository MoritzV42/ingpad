/* ingpad — In-App-KI-Chat (modell-agnostisch).
 *
 * Selbst-injizierendes Panel rechts neben dem Canvas. Spricht ein beliebiges
 * OpenAI-kompatibles Backend an (lokales Ollama / LM Studio / DeepSeek / OpenAI
 * …) — der Server-Proxy /api/chat leitet weiter (umgeht CORS, kein Terminal
 * noetig). Endpoint/Modell/Key werden lokal im Browser (localStorage)
 * gespeichert, der Verlauf pro Projekt.
 *
 * Einbinden:  <script src="/app/chat.js"></script>
 */
(function () {
  "use strict";

  // ---- Projekt-Kennung (fuer getrennten Verlauf je Lernsituation) ----------
  var PROJEKT = (location.pathname.replace(/\/index\.html?$/i, "")
    .split("/").filter(Boolean).pop()) || "ingpad";
  var LS_HIST = "ingpad-chat-" + PROJEKT;
  var LS_CFG = "ingpad-llm";

  // ---- Voreinstellungen: lokales Ollama, kein Key ---------------------------
  var DEFAULT_CFG = {
    endpoint: "http://localhost:11434/v1",
    model: "llama3.1",
    key: "",
  };

  function cfg() {
    try { return Object.assign({}, DEFAULT_CFG, JSON.parse(localStorage.getItem(LS_CFG) || "{}")); }
    catch (e) { return Object.assign({}, DEFAULT_CFG); }
  }
  function saveCfg(c) { localStorage.setItem(LS_CFG, JSON.stringify(c)); }

  function hist() {
    try { return JSON.parse(localStorage.getItem(LS_HIST) || "[]"); }
    catch (e) { return []; }
  }
  function saveHist(h) { localStorage.setItem(LS_HIST, JSON.stringify(h.slice(-60))); }

  // ---- Styles (nutzt die Theme-Variablen des Canvas, mit Fallbacks) ---------
  var css = `
  #igc-fab{position:fixed;right:18px;bottom:18px;z-index:60;width:52px;height:52px;border-radius:50%;
    border:1px solid var(--line,#2c3a4a);background:var(--acc,#3b9dff);color:#fff;font-size:22px;cursor:pointer;
    box-shadow:0 4px 16px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;transition:transform .15s}
  #igc-fab:hover{transform:scale(1.07)}
  #igc-panel{position:fixed;top:0;right:0;z-index:61;height:100vh;width:390px;max-width:94vw;
    background:var(--bg,#0f141a);border-left:1px solid var(--line,#2c3a4a);
    display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;
    box-shadow:-8px 0 28px rgba(0,0,0,.32);color:var(--tx,#e6edf3);font-family:"Segoe UI",system-ui,sans-serif}
  #igc-panel.open{transform:none}
  #igc-head{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--line,#2c3a4a);
    background:var(--card,#18212c)}
  #igc-head b{font-size:14px;font-weight:600;flex:1}
  #igc-head .pill{font-size:11px;color:var(--mut,#8aa0b4);background:var(--card2,#1e2935);
    padding:2px 8px;border-radius:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #igc-head button{background:none;border:none;color:var(--mut,#8aa0b4);font-size:18px;cursor:pointer;padding:2px 6px;border-radius:6px}
  #igc-head button:hover{color:var(--tx,#e6edf3);background:var(--card2,#1e2935)}
  #igc-msgs{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px}
  .igc-m{max-width:100%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}
  .igc-m.u{align-self:flex-end;background:var(--acc,#3b9dff);color:#fff;border-bottom-right-radius:3px}
  .igc-m.a{align-self:flex-start;background:var(--card,#18212c);border:1px solid var(--line,#2c3a4a);border-bottom-left-radius:3px}
  .igc-m.sys{align-self:center;color:var(--mut,#8aa0b4);font-size:12px;background:none;text-align:center;max-width:90%}
  .igc-m code{background:rgba(127,127,127,.18);padding:1px 5px;border-radius:4px;font-size:12.5px}
  .igc-m pre{background:var(--paper,#0e1620);border:1px solid var(--line,#2c3a4a);padding:8px 10px;border-radius:8px;overflow:auto}
  .igc-m pre code{background:none;padding:0}
  #igc-foot{border-top:1px solid var(--line,#2c3a4a);padding:10px;display:flex;gap:8px;align-items:flex-end;background:var(--card,#18212c)}
  #igc-in{flex:1;resize:none;max-height:140px;min-height:40px;padding:9px 11px;border-radius:10px;
    border:1px solid var(--line,#2c3a4a);background:var(--bg,#0f141a);color:var(--tx,#e6edf3);font-family:inherit;font-size:13.5px;line-height:1.45}
  #igc-in:focus{outline:none;border-color:var(--acc,#3b9dff)}
  #igc-send{background:var(--acc,#3b9dff);color:#fff;border:none;border-radius:10px;width:42px;height:40px;font-size:17px;cursor:pointer}
  #igc-send:disabled{opacity:.5;cursor:default}
  #igc-cfg{padding:14px;border-bottom:1px solid var(--line,#2c3a4a);background:var(--card2,#1e2935);display:none;flex-direction:column;gap:9px}
  #igc-cfg.open{display:flex}
  #igc-cfg label{font-size:11.5px;color:var(--mut,#8aa0b4);display:flex;flex-direction:column;gap:3px}
  #igc-cfg input{padding:7px 9px;border-radius:8px;border:1px solid var(--line,#2c3a4a);background:var(--bg,#0f141a);color:var(--tx,#e6edf3);font-size:12.5px}
  #igc-cfg .presets{display:flex;flex-wrap:wrap;gap:6px}
  #igc-cfg .presets button{font-size:11px;padding:4px 8px;border-radius:8px;border:1px solid var(--line,#2c3a4a);
    background:var(--bg,#0f141a);color:var(--mut,#8aa0b4);cursor:pointer}
  #igc-cfg .presets button:hover{color:var(--tx,#e6edf3);border-color:var(--acc,#3b9dff)}
  #igc-cfg .hint{font-size:11px;color:var(--mut,#8aa0b4);line-height:1.4}
  `;
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---- DOM ------------------------------------------------------------------
  var fab = el("button", { id: "igc-fab", title: "KI-Chat (Lern-Assistent)", html: "💬" });
  var panel = el("div", { id: "igc-panel" });
  panel.innerHTML = `
    <div id="igc-head">
      <b>KI-Tutor</b>
      <span class="pill" id="igc-pill"></span>
      <button id="igc-gear" title="Modell einstellen">⚙</button>
      <button id="igc-clear" title="Verlauf leeren">🗑</button>
      <button id="igc-x" title="Schliessen">✕</button>
    </div>
    <div id="igc-cfg">
      <div class="presets">
        <button data-p="ollama">Ollama (lokal)</button>
        <button data-p="lmstudio">LM Studio</button>
        <button data-p="deepseek">DeepSeek</button>
        <button data-p="openai">OpenAI</button>
      </div>
      <label>Endpoint (OpenAI-kompatibel)<input id="cfg-ep" placeholder="http://localhost:11434/v1"></label>
      <label>Modell<input id="cfg-mo" placeholder="llama3.1"></label>
      <label>API-Key (leer fuer lokal)<input id="cfg-key" type="password" placeholder="sk-… / leer"></label>
      <div class="hint">Lokale Modelle (Ollama, LM Studio) brauchen keinen Key. Der Key bleibt nur in deinem Browser.</div>
    </div>
    <div id="igc-msgs"></div>
    <div id="igc-foot">
      <textarea id="igc-in" placeholder="Frag den KI-Tutor zur Aufgabe…"></textarea>
      <button id="igc-send" title="Senden (Enter)">➤</button>
    </div>`;
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var msgsEl = panel.querySelector("#igc-msgs");
  var inEl = panel.querySelector("#igc-in");
  var sendBtn = panel.querySelector("#igc-send");
  var cfgBox = panel.querySelector("#igc-cfg");
  var pill = panel.querySelector("#igc-pill");
  var epEl = panel.querySelector("#cfg-ep");
  var moEl = panel.querySelector("#cfg-mo");
  var keyEl = panel.querySelector("#cfg-key");

  // ---- Events ---------------------------------------------------------------
  fab.onclick = function () { panel.classList.add("open"); inEl.focus(); };
  panel.querySelector("#igc-x").onclick = function () { panel.classList.remove("open"); };
  panel.querySelector("#igc-gear").onclick = function () { cfgBox.classList.toggle("open"); loadCfgInputs(); };
  panel.querySelector("#igc-clear").onclick = function () {
    if (confirm("Chat-Verlauf dieser Lernsituation leeren?")) { saveHist([]); render([]); }
  };
  [epEl, moEl, keyEl].forEach(function (i) {
    i.addEventListener("change", function () {
      saveCfg({ endpoint: epEl.value.trim(), model: moEl.value.trim(), key: keyEl.value });
      updatePill();
    });
  });
  var PRESETS = {
    ollama: { endpoint: "http://localhost:11434/v1", model: "llama3.1", key: "" },
    lmstudio: { endpoint: "http://localhost:1234/v1", model: "local-model", key: "" },
    deepseek: { endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat", key: "" },
    openai: { endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini", key: "" },
  };
  cfgBox.querySelectorAll(".presets button").forEach(function (b) {
    b.onclick = function () {
      var p = PRESETS[b.dataset.p]; var cur = cfg();
      saveCfg({ endpoint: p.endpoint, model: p.model, key: cur.key || p.key });
      loadCfgInputs(); updatePill();
    };
  });
  inEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  inEl.addEventListener("input", function () { inEl.style.height = "auto"; inEl.style.height = Math.min(inEl.scrollHeight, 140) + "px"; });
  sendBtn.onclick = send;

  function loadCfgInputs() { var c = cfg(); epEl.value = c.endpoint; moEl.value = c.model; keyEl.value = c.key; }
  function updatePill() { var c = cfg(); pill.textContent = c.model || "—"; pill.title = c.endpoint; }
  updatePill();

  // ---- Rendering ------------------------------------------------------------
  function render(h) {
    msgsEl.innerHTML = "";
    if (!h.length) {
      add("sys", "Ich kenne den aktuellen Stand deines Canvas. Frag mich zur Lernsituation — ich erkläre, rechne nach oder prüfe deinen Ansatz. Modell stellst du über ⚙ ein.");
      return;
    }
    h.forEach(function (m) { add(m.role === "user" ? "u" : "a", m.content); });
    scroll();
  }
  function add(kind, text) {
    var d = el("div", { cls: "igc-m " + kind });
    if (kind === "a") d.innerHTML = mdLite(text); else d.textContent = text;
    msgsEl.appendChild(d);
    if (window.MathJax && MathJax.typesetPromise && kind === "a") MathJax.typesetPromise([d]).catch(function () {});
    scroll(); return d;
  }
  function scroll() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  // Leichtgewichtiges Markdown: ```code```, `inline`, **bold**, Zeilen bleiben.
  function mdLite(t) {
    t = esc(t);
    t = t.replace(/```([\s\S]*?)```/g, function (_, c) { return "<pre><code>" + c.replace(/^\n/, "") + "</code></pre>"; });
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    return t;
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  render(hist());

  // ---- Canvas-Kontext fuer das Modell --------------------------------------
  function canvasContext() {
    var src = document.querySelector(".layout") || document.body;
    var txt = (src.innerText || "").replace(/\s+\n/g, "\n").trim();
    if (txt.length > 8000) txt = txt.slice(0, 8000) + "\n…(gekürzt)";
    return txt;
  }
  function systemPrompt() {
    return "Du bist der KI-Tutor in ingpad, einer Lern-Workbench für angehende staatlich geprüfte Techniker "
      + "(Maschinentechnik/Konstruktion, DAA-Technikum). Aktuelle Lernsituation: \"" + (document.title || PROJEKT) + "\". "
      + "Arbeite sokratisch: hilf beim Verstehen, rechne Schritte sauber nach, prüfe Ansätze, verweise auf Normen/Formeln. "
      + "Antworte auf Deutsch mit echten Umlauten, kompakt und präzise. Formeln in LaTeX mit \\( … \\) bzw. $$ … $$.\n\n"
      + "AKTUELLER STAND DES ARBEITS-CANVAS:\n" + canvasContext();
  }

  // ---- Senden ---------------------------------------------------------------
  var busy = false;
  function send() {
    var text = inEl.value.trim();
    if (!text || busy) return;
    var c = cfg();
    inEl.value = ""; inEl.style.height = "auto";
    var h = hist(); h.push({ role: "user", content: text }); saveHist(h);
    add("u", text);

    busy = true; sendBtn.disabled = true;
    var thinking = add("a", "…");
    var messages = [{ role: "system", content: systemPrompt() }].concat(
      h.slice(-16).map(function (m) { return { role: m.role, content: m.content }; })
    );

    fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: c.endpoint, model: c.model, key: c.key, messages: messages }),
    }).then(function (r) { return r.json(); }).then(function (res) {
      thinking.remove();
      if (!res.ok) { add("sys", "⚠ " + (res.fehler || "Fehler") + (res.hinweis ? "\n" + res.hinweis : "")); busy = false; sendBtn.disabled = false; return; }
      var reply = res.text || "(leere Antwort)";
      add("a", reply);
      var h2 = hist(); h2.push({ role: "assistant", content: reply }); saveHist(h2);
      busy = false; sendBtn.disabled = false; inEl.focus();
    }).catch(function (e) {
      thinking.remove();
      add("sys", "⚠ Verbindung zum Server fehlgeschlagen: " + e.message);
      busy = false; sendBtn.disabled = false;
    });
  }

  // ---- Helfer ---------------------------------------------------------------
  function el(tag, o) {
    var n = document.createElement(tag); o = o || {};
    if (o.id) n.id = o.id; if (o.cls) n.className = o.cls;
    if (o.title) n.title = o.title; if (o.html) n.innerHTML = o.html;
    return n;
  }
})();
