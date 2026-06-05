/*
 * ingpad — Datei-Anhaenge pro Aufgabenschritt
 * ---------------------------------------------------------------------------
 * Wiederverwendbare Anhang-UI: Datei-Auswahl + Drag&Drop-Zone, Upload an
 * /api/attach, Liste der angehaengten Dateien mit Loesch-Moeglichkeit.
 *
 * EINBINDEN (im index.html eines Projekts):
 *
 *   1. Script laden (am Ende des <body>, vor eigenem Init-Code):
 *        <script src="/app/attachments.js"></script>
 *
 *   2. Container pro Step platzieren (data-task = Step-ID, wie bei .draw):
 *        <div class="attach" data-task="D"></div>
 *
 *   3. Initialisieren — entweder einzeln ...
 *        setupAttachments(document.querySelector('.attach'));
 *      ... oder alle auf einmal:
 *        document.querySelectorAll('.attach').forEach(setupAttachments);
 *
 * Das Backend (server.py) speichert nach
 *   projekte/<projekt>/attachments/<task>/<originalname>
 * und liefert:
 *   GET    /api/attach?task=<id>            -> { ok, dateien:[{name,groesse,url}] }
 *   POST   /api/attach  (multipart: datei, task) -> { ok, gespeichert }
 *   DELETE /api/attach?task=<id>&name=<n>   -> { ok, geloescht }
 *
 * Styling nutzt die CSS-Variablen der App (--card2, --line, --acc, --mut, ...).
 * Faellt diese Datei in ein Projekt ohne diese Variablen, greifen Fallbacks.
 * ---------------------------------------------------------------------------
 */
(function () {
  "use strict";

  // Styles einmalig injizieren (passt sich an die App-Variablen an).
  function ensureStyles() {
    if (document.getElementById("ingpad-attach-css")) return;
    var s = document.createElement("style");
    s.id = "ingpad-attach-css";
    s.textContent = [
      ".attach{margin-top:12px}",
      ".attach .att-drop{border:1.5px dashed var(--line,#2c3a4a);border-radius:10px;",
      "  background:var(--card2,#1e2935);padding:14px 16px;text-align:center;color:var(--mut,#8aa0b4);",
      "  cursor:pointer;transition:border-color .15s,background .15s;font-size:13.5px}",
      ".attach .att-drop:hover{border-color:var(--acc,#3b9dff);color:var(--tx,#e6edf3)}",
      ".attach .att-drop.drag{border-color:var(--acc,#3b9dff);background:#172533;color:var(--tx,#e6edf3)}",
      ".attach .att-drop b{color:var(--acc,#3b9dff)}",
      ".attach .att-drop input[type=file]{display:none}",
      ".attach .att-list{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}",
      ".attach .att-item{display:flex;align-items:center;gap:10px;background:var(--card2,#1e2935);",
      "  border:1px solid var(--line,#2c3a4a);border-radius:8px;padding:7px 11px;font-size:13px}",
      ".attach .att-item a{color:var(--tx,#e6edf3);text-decoration:none;flex:1;min-width:0;",
      "  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".attach .att-item a:hover{color:var(--acc,#3b9dff)}",
      ".attach .att-item .sz{color:var(--mut,#8aa0b4);font-size:11.5px;flex-shrink:0}",
      ".attach .att-item .del{flex-shrink:0;border:1px solid var(--line,#2c3a4a);background:#1a2735;",
      "  color:var(--red,#ff5d5d);cursor:pointer;border-radius:6px;height:24px;width:24px;",
      "  line-height:1;font-size:14px;display:flex;align-items:center;justify-content:center}",
      ".attach .att-item .del:hover{border-color:var(--red,#ff5d5d);background:rgba(255,93,93,.14)}",
      ".attach .att-status{font-size:11.5px;color:var(--mut,#8aa0b4);margin-top:6px;min-height:14px}",
      ".attach .att-status.err{color:var(--red,#ff5d5d)}",
    ].join("");
    document.head.appendChild(s);
  }

  function fmtSize(n) {
    if (n == null) return "";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  /**
   * Baut die Anhang-UI in den uebergebenen Container.
   * @param {HTMLElement} el - Container mit data-task="<Step-ID>".
   */
  function setupAttachments(el) {
    if (!el || el.dataset.attachReady) return;
    ensureStyles();
    el.dataset.attachReady = "1";

    var task = el.getAttribute("data-task") || el.dataset.task || "x";

    var drop = document.createElement("label");
    drop.className = "att-drop";
    drop.innerHTML =
      "Datei hierher ziehen oder <b>auswaehlen</b>" +
      "<br><span style='font-size:11.5px'>Konstruktion, Tabelle, Dokument, CAD-Export …</span>";

    var input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    drop.appendChild(input);

    var list = document.createElement("ul");
    list.className = "att-list";

    var status = document.createElement("div");
    status.className = "att-status";

    el.appendChild(drop);
    el.appendChild(list);
    el.appendChild(status);

    function setStatus(msg, isErr) {
      status.textContent = msg || "";
      status.classList.toggle("err", !!isErr);
    }

    function render(dateien) {
      list.innerHTML = "";
      (dateien || []).forEach(function (d) {
        var li = document.createElement("li");
        li.className = "att-item";

        var a = document.createElement("a");
        a.href = d.url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = d.name;
        a.title = d.name;

        var sz = document.createElement("span");
        sz.className = "sz";
        sz.textContent = fmtSize(d.groesse);

        var del = document.createElement("button");
        del.className = "del";
        del.type = "button";
        del.title = "Loeschen";
        del.textContent = "×"; // ×
        del.onclick = function () {
          remove(d.name);
        };

        li.appendChild(a);
        li.appendChild(sz);
        li.appendChild(del);
        list.appendChild(li);
      });
    }

    function refresh() {
      fetch("/api/attach?task=" + encodeURIComponent(task), { cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.ok) render(j.dateien);
        })
        .catch(function () { /* still — Liste bleibt wie sie ist */ });
    }

    function upload(files) {
      if (!files || !files.length) return;
      var arr = Array.prototype.slice.call(files);
      setStatus("lade " + arr.length + " Datei(en) …");

      var chain = Promise.resolve();
      var fehler = 0;
      arr.forEach(function (file) {
        chain = chain.then(function () {
          var fd = new FormData();
          fd.append("task", task);
          fd.append("datei", file, file.name);
          return fetch("/api/attach", { method: "POST", body: fd })
            .then(function (r) { return r.json(); })
            .then(function (j) { if (!j || !j.ok) fehler++; })
            .catch(function () { fehler++; });
        });
      });

      chain.then(function () {
        setStatus(fehler ? (fehler + " Datei(en) fehlgeschlagen") : "", !!fehler);
        input.value = "";
        refresh();
      });
    }

    function remove(name) {
      setStatus("loesche …");
      fetch(
        "/api/attach?task=" + encodeURIComponent(task) + "&name=" + encodeURIComponent(name),
        { method: "DELETE" }
      )
        .then(function (r) { return r.json(); })
        .then(function (j) {
          setStatus(j && j.ok ? "" : "Loeschen fehlgeschlagen", !(j && j.ok));
          refresh();
        })
        .catch(function () {
          setStatus("Loeschen fehlgeschlagen", true);
        });
    }

    input.addEventListener("change", function () { upload(input.files); });

    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.add("drag");
      });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove("drag");
      });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) upload(e.dataTransfer.files);
    });

    refresh();
  }

  // Global verfuegbar machen.
  window.setupAttachments = setupAttachments;
})();
