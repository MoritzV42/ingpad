/* ingpad — in-app AI tutor chat.
 *
 * Self-injecting panel next to the canvas. Two providers:
 *   - "claude" (DEFAULT): talks to /api/ai/ask — the server runs the Claude
 *     Code CLI as a subprocess, auth comes from the user's Claude subscription
 *     login (no API key needed). One Claude session per project.
 *   - "api": talks to /api/chat — server-side proxy to any OpenAI-compatible
 *     endpoint (Anthropic, OpenRouter, OpenAI, Mistral, Gemini, DeepSeek,
 *     Groq, xAI, ...). Endpoint/model/key live in localStorage only.
 *
 * Include with:  <script src="/app/chat.js"></script>
 */
(function () {
  "use strict";

  // ---- Project key (separate history per exercise) --------------------------
  var PROJEKT = (location.pathname.replace(/\/index\.html?$/i, "")
    .split("/").filter(Boolean).pop()) || "ingpad";
  var LS_HIST = "ingpad-chat-" + PROJEKT;
  var LS_CFG = "ingpad-llm";
  var LS_SEEN = "ingpad-chat-onboarded";

  var REPO_ISSUES = "https://github.com/MoritzV42/ingpad/issues/new";

  // ---- Config: Claude subscription is the default ---------------------------
  var DEFAULT_CFG = { provider: "claude", endpoint: "", model: "", key: "" };

  function cfg() {
    var c;
    try { c = JSON.parse(localStorage.getItem(LS_CFG) || "{}"); }
    catch (e) { c = {}; }
    // Migration from pre-provider configs: drop the old Ollama/LM-Studio
    // localhost defaults entirely; keep a real remote API config as "api".
    if (!c.provider) {
      var ep = c.endpoint || "";
      if (/localhost:11434|localhost:1234/.test(ep)) { c.endpoint = ""; c.model = ""; }
      c.provider = (c.endpoint && c.model) ? "api" : "claude";
    }
    return Object.assign({}, DEFAULT_CFG, c);
  }
  function saveCfg(c) { localStorage.setItem(LS_CFG, JSON.stringify(c)); }

  function hist() {
    try { return JSON.parse(localStorage.getItem(LS_HIST) || "[]"); }
    catch (e) { return []; }
  }
  function saveHist(h) { localStorage.setItem(LS_HIST, JSON.stringify(h.slice(-60))); }

  // ---- Server-side AI status (is the claude CLI available?) ------------------
  var aiStatus = { known: false, claude: false, version: "", app: "" };
  function fetchStatus(done) {
    fetch("/api/ai/status").then(function (r) { return r.json(); }).then(function (s) {
      aiStatus = { known: true, claude: !!s.claude, version: s.version || "", app: s.app || "" };
      updatePill(); renderClaudeTab();
      if (done) done();
    }).catch(function () {
      aiStatus.known = true;
      if (done) done();
    });
  }

  // ---- Styles (uses the canvas theme variables, with fallbacks) --------------
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
  #igc-cfg{border-bottom:1px solid var(--line,#2c3a4a);background:var(--card2,#1e2935);display:none;flex-direction:column}
  #igc-cfg.open{display:flex}
  #igc-tabs{display:flex;border-bottom:1px solid var(--line,#2c3a4a)}
  #igc-tabs button{flex:1;background:none;border:none;border-bottom:2px solid transparent;color:var(--mut,#8aa0b4);
    font-size:12px;padding:9px 6px;cursor:pointer}
  #igc-tabs button.on{color:var(--tx,#e6edf3);border-bottom-color:var(--acc,#3b9dff);font-weight:600}
  .igc-tabbody{display:none;flex-direction:column;gap:9px;padding:14px}
  .igc-tabbody.on{display:flex}
  #igc-cfg label{font-size:11.5px;color:var(--mut,#8aa0b4);display:flex;flex-direction:column;gap:3px}
  #igc-cfg input,#igc-cfg select{padding:7px 9px;border-radius:8px;border:1px solid var(--line,#2c3a4a);
    background:var(--bg,#0f141a);color:var(--tx,#e6edf3);font-size:12.5px}
  #igc-cfg .hint{font-size:11px;color:var(--mut,#8aa0b4);line-height:1.45}
  #igc-cfg .steps{font-size:12px;line-height:1.55;color:var(--tx,#e6edf3);margin:0;padding-left:18px}
  #igc-cfg .steps code{background:rgba(127,127,127,.18);padding:1px 5px;border-radius:4px;font-size:11.5px}
  #igc-cfg .ok{font-size:12px;color:#5dd28a}
  #igc-cfg a{color:var(--acc,#3b9dff)}
  `;
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---- DOM ------------------------------------------------------------------
  var fab = el("button", { id: "igc-fab", title: "AI chat (learning assistant)", html: "💬" });
  var panel = el("div", { id: "igc-panel" });
  panel.innerHTML = `
    <div id="igc-head">
      <b>AI Tutor</b>
      <span class="pill" id="igc-pill"></span>
      <button id="igc-bug" title="Report a problem">🐞</button>
      <button id="igc-gear" title="AI settings">⚙</button>
      <button id="igc-clear" title="Clear history">🗑</button>
      <button id="igc-x" title="Close">✕</button>
    </div>
    <div id="igc-cfg">
      <div id="igc-tabs">
        <button data-t="claude">Claude subscription <span style="opacity:.7">(recommended)</span></button>
        <button data-t="api">API key</button>
      </div>
      <div class="igc-tabbody" id="igc-tab-claude"></div>
      <div class="igc-tabbody" id="igc-tab-api">
        <label>Provider examples
          <select id="cfg-preset">
            <option value="">— pick a provider to prefill —</option>
            <option value="anthropic">Anthropic</option>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="mistral">Mistral</option>
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="groq">Groq</option>
            <option value="xai">xAI</option>
          </select>
        </label>
        <label>Endpoint (OpenAI-compatible)<input id="cfg-ep" placeholder="https://api.example.com/v1"></label>
        <label>Model<input id="cfg-mo" placeholder="model id"></label>
        <label>API key<input id="cfg-key" type="password" placeholder="sk-…"></label>
        <div class="hint" id="igc-api-hint">The key never leaves your machine: it is stored in this
          browser only and sent through the local ingpad server straight to the provider.</div>
      </div>
    </div>
    <div id="igc-msgs"></div>
    <div id="igc-foot">
      <textarea id="igc-in" placeholder="Ask the AI tutor about this exercise…"></textarea>
      <button id="igc-send" title="Send (Enter)">➤</button>
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
  var presetEl = panel.querySelector("#cfg-preset");
  var tabClaude = panel.querySelector("#igc-tab-claude");
  var apiHint = panel.querySelector("#igc-api-hint");

  // ---- Provider presets (prefill endpoint + example model) -------------------
  var PRESETS = {
    anthropic: {
      endpoint: "https://api.anthropic.com/v1", model: "claude-opus-4-8",
      hint: "Anthropic supports the OpenAI-compatible /v1/chat/completions endpoint — this works as-is with an Anthropic API key.",
    },
    openrouter: { endpoint: "https://openrouter.ai/api/v1", model: "openrouter/auto" },
    openai: { endpoint: "https://api.openai.com/v1", model: "gpt-4o-mini" },
    mistral: { endpoint: "https://api.mistral.ai/v1", model: "mistral-large-latest" },
    gemini: { endpoint: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
    deepseek: { endpoint: "https://api.deepseek.com/v1", model: "deepseek-chat" },
    groq: { endpoint: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
    xai: { endpoint: "https://api.x.ai/v1", model: "grok-3" },
  };
  var API_HINT_DEFAULT = apiHint.textContent;

  // ---- Onboarding / settings tabs --------------------------------------------
  function renderClaudeTab() {
    if (!aiStatus.known) {
      tabClaude.innerHTML = '<div class="hint">Checking for the Claude Code CLI…</div>';
      return;
    }
    if (aiStatus.claude) {
      tabClaude.innerHTML =
        '<div class="ok">✓ Claude Code detected' +
        (aiStatus.version ? " (" + esc(aiStatus.version) + ")" : "") + ".</div>" +
        '<div class="hint">The tutor runs over your Claude subscription — no API key needed. ' +
        "One conversation per exercise, remembered across reloads.</div>";
    } else {
      tabClaude.innerHTML =
        '<div class="hint"><b>Use your Claude subscription</b> — no API key needed:</div>' +
        '<ol class="steps">' +
        "<li>Install Claude Code: <code>npm install -g @anthropic-ai/claude-code</code><br>" +
        '(or use the native installer: <a href="https://docs.anthropic.com/claude-code" target="_blank" rel="noopener">docs.anthropic.com/claude-code</a>)</li>' +
        "<li>Run <code>claude</code> once in a terminal and log in with your Claude account.</li>" +
        "<li>Restart ingpad — done.</li>" +
        "</ol>" +
        '<div class="hint">No Claude subscription? Switch to the <b>API key</b> tab and use any provider.</div>';
    }
  }

  function setTab(which, persist) {
    panel.querySelectorAll("#igc-tabs button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.t === which);
    });
    panel.querySelector("#igc-tab-claude").classList.toggle("on", which === "claude");
    panel.querySelector("#igc-tab-api").classList.toggle("on", which === "api");
    if (persist) {
      var c = cfg(); c.provider = which; saveCfg(c); updatePill();
    }
  }

  function openSettings() {
    cfgBox.classList.add("open");
    loadCfgInputs();
    renderClaudeTab();
    setTab(cfg().provider, false);
  }

  // ---- Events ---------------------------------------------------------------
  fab.onclick = function () {
    panel.classList.add("open");
    var c = cfg();
    var firstOpen = !localStorage.getItem(LS_SEEN);
    var claudeMissing = c.provider === "claude" && aiStatus.known && !aiStatus.claude;
    var noApi = !(c.endpoint && c.model);
    if (firstOpen || (claudeMissing && noApi)) {
      localStorage.setItem(LS_SEEN, "1");
      openSettings();
    }
    inEl.focus();
  };
  panel.querySelector("#igc-x").onclick = function () { panel.classList.remove("open"); };
  panel.querySelector("#igc-gear").onclick = function () {
    if (cfgBox.classList.contains("open")) cfgBox.classList.remove("open");
    else openSettings();
  };
  panel.querySelector("#igc-clear").onclick = function () {
    if (confirm("Clear the chat history for this exercise?")) { saveHist([]); render([]); }
  };
  panel.querySelector("#igc-bug").onclick = reportProblem;
  panel.querySelectorAll("#igc-tabs button").forEach(function (b) {
    b.onclick = function () { setTab(b.dataset.t, true); };
  });
  [epEl, moEl, keyEl].forEach(function (i) {
    i.addEventListener("change", function () {
      var c = cfg();
      c.endpoint = epEl.value.trim(); c.model = moEl.value.trim(); c.key = keyEl.value;
      saveCfg(c); updatePill();
    });
  });
  presetEl.onchange = function () {
    var p = PRESETS[presetEl.value];
    if (!p) return;
    epEl.value = p.endpoint; moEl.value = p.model;
    apiHint.textContent = p.hint || API_HINT_DEFAULT;
    var c = cfg(); c.endpoint = p.endpoint; c.model = p.model; saveCfg(c); updatePill();
  };
  inEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  inEl.addEventListener("input", function () { inEl.style.height = "auto"; inEl.style.height = Math.min(inEl.scrollHeight, 140) + "px"; });
  sendBtn.onclick = send;

  function loadCfgInputs() { var c = cfg(); epEl.value = c.endpoint; moEl.value = c.model; keyEl.value = c.key; }
  function updatePill() {
    var c = cfg();
    if (c.provider === "claude") {
      pill.textContent = (aiStatus.known && !aiStatus.claude) ? "Claude — not set up" : "Claude (subscription)";
      pill.title = "Runs over the Claude Code CLI on this machine";
    } else {
      pill.textContent = c.model || "API — not set up";
      pill.title = c.endpoint || "";
    }
  }
  updatePill();
  fetchStatus();

  // ---- Report a problem -------------------------------------------------------
  function reportProblem() {
    var c = cfg();
    var body = [
      "**What happened?**",
      "(describe the problem here)",
      "",
      "---",
      "ingpad version: " + (aiStatus.app || "unknown"),
      "Project: " + PROJEKT,
      "AI provider: " + (c.provider === "claude"
        ? "Claude CLI " + (aiStatus.version || "(not detected)")
        : "API (" + (c.model || "?") + " @ " + (c.endpoint || "?") + ")"),
      "Browser: " + navigator.userAgent,
    ].join("\n");
    var url = REPO_ISSUES
      + "?title=" + encodeURIComponent("[chat] ")
      + "&body=" + encodeURIComponent(body);
    window.open(url, "_blank", "noopener");
  }

  // ---- Rendering ------------------------------------------------------------
  function render(h) {
    msgsEl.innerHTML = "";
    if (!h.length) {
      add("sys", "I can see the current state of your canvas. Ask me about this exercise — I explain, recalculate, or check your approach. Configure the AI via ⚙.");
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

  // Tiny markdown: ```code```, `inline`, **bold**; line breaks preserved.
  function mdLite(t) {
    t = esc(t);
    t = t.replace(/```([\s\S]*?)```/g, function (_, c) { return "<pre><code>" + c.replace(/^\n/, "") + "</code></pre>"; });
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
    t = t.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    return t;
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  render(hist());

  // ---- Canvas context for the model ------------------------------------------
  function canvasContext() {
    var src = document.querySelector(".layout") || document.body;
    var txt = (src.innerText || "").replace(/\s+\n/g, "\n").trim();
    if (txt.length > 8000) txt = txt.slice(0, 8000) + "\n…(truncated)";
    return txt;
  }
  // System prompt for the API-key path. (The Claude path gets its tutor prompt
  // server-side, once per session.)
  function systemPrompt() {
    return "You are the AI tutor in ingpad, a learning workbench where engineering students "
      + "solve technical exercises step by step. Current exercise: \"" + (document.title || PROJEKT) + "\". "
      + "Act as a socratic tutor: help the student understand, recalculate steps, verify approaches, "
      + "point to standards/formulas — do not hand out complete solutions to unsolved steps. "
      + "Answer in the language the user writes in (German with proper umlauts if they write German), "
      + "compact and precise. Formulas in LaTeX with \\( … \\) or $$ … $$.\n\n"
      + "CURRENT STATE OF THE WORK CANVAS:\n" + canvasContext();
  }

  // ---- Send -------------------------------------------------------------------
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

    var req;
    if (c.provider === "claude") {
      // Conversation memory lives in the per-project Claude session on the
      // server; we only ship the new message plus the current canvas state.
      req = fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context: canvasContext() }),
      });
    } else {
      var messages = [{ role: "system", content: systemPrompt() }].concat(
        h.slice(-16).map(function (m) { return { role: m.role, content: m.content }; })
      );
      req = fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: c.endpoint, model: c.model, key: c.key, messages: messages }),
      });
    }

    req.then(function (r) { return r.json(); }).then(function (res) {
      thinking.remove();
      if (!res.ok) {
        add("sys", "⚠ " + (res.fehler || "Error") + (res.hinweis ? "\n" + res.hinweis : ""));
        if (res.fehler === "claude-not-found") { fetchStatus(); openSettings(); }
        busy = false; sendBtn.disabled = false; return;
      }
      var reply = res.text || "(empty reply)";
      add("a", reply);
      var h2 = hist(); h2.push({ role: "assistant", content: reply }); saveHist(h2);
      busy = false; sendBtn.disabled = false; inEl.focus();
    }).catch(function (e) {
      thinking.remove();
      add("sys", "⚠ Could not reach the ingpad server: " + e.message);
      busy = false; sendBtn.disabled = false;
    });
  }

  // ---- Helpers ----------------------------------------------------------------
  function el(tag, o) {
    var n = document.createElement(tag); o = o || {};
    if (o.id) n.id = o.id; if (o.cls) n.className = o.cls;
    if (o.title) n.title = o.title; if (o.html) n.innerHTML = o.html;
    return n;
  }
})();
