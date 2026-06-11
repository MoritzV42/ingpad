# ingpad

![ingpad](docs/banner.png)

**▶ [Live-Demo ausprobieren](https://moritzv42.github.io/ingpad/)** — läuft direkt im Browser, kein Setup.

> The engineer's scratch pad — solve a technical exercise on one canvas: framework data, step-by-step **Given / Sought / Approach**, stylus sketches and an AI tutor, side by side.

![ingpad overview](docs/hero.png)

`ingpad` turns a technical exercise (the kind you get in engineering / technician school) into a single interactive canvas. You solve each step by **handwriting** into a drawing field; the AI checks your work, records the result, and opens the next step.

It's deliberately **socratic**: you think, the AI asks and verifies — it doesn't just hand you the answer.

---

## What's on the canvas

### 📌 Framework data, always in view

The left rail pins every given value, limit and component for the whole exercise — and fills in with results as you go. No more scrolling back to the task sheet.

<img src="docs/legende.png" width="300" alt="Framework-data rail">

### 🧮 Each step: Given · Sought · Approach

Every step is laid out the way you'd write it on paper — knowns, unknowns, the formula to apply — and gets a green result box once it's solved.

![A worked step](docs/rechenbeispiel.png)

### 📈 Graphical work, rendered crisply

Diagrams are real SVG (not blurry images), so construction lines land exactly. Here: picking a bucket size from the volume-flow chart — horizontal at 60 m³/h to the 4.75 L line, then straight down to 1.75 m/s.

![SVG diagram](docs/diagram.png)

### ✍️ Handwrite each step, send it to the AI

The drawing field is **stylus-first**: the pen draws, one finger pans, two fingers zoom; it's height-adjustable with zoom & pan. Hit **send to AI** and the field ships as an image — the AI reads your handwriting, grades the step, and records the result.

![Drawing field with handwriting](docs/zeichenfeld.png)

### 🔗 Everything about the task, one click away

Per step, the source documents **and the exact page of your formula sheet** are linked — so everything you need is one click away, including the current quick-reference.

![Per-step document & reference links](docs/verlinkung.png)

---

## Quick start

```bash
git clone https://github.com/MoritzV42/ingpad
cd ingpad
python server.py            # serves projekte/demo on http://localhost:8042/index.html
```

> Or let your AI agent install it for you: paste [SETUP.md](SETUP.md) into your
> coding agent (Claude Code, Cursor, …) and it does the rest.

Open the URL, pick a step, handwrite your calculation, hit **send to AI**, then tell your AI agent it was sent — it reads the image, grades it, fills in the result.

> The screenshots above show the included **demo** (a fictional wall-bracket statics task — copyright-free) and a real worked example (bucket-elevator drivetrain).

## How it works

```
  step (Given / Sought / Approach)
        |
        v   you handwrite the calculation in the drawing field
   [ drawing field ] --send--> server  --> submit_<step>.png
        |                                        |
        |                                        v
        |                          AI reads the image, grades it,
        v                          writes the result back into the canvas
   next step opens                 and opens the next step
```

## Use with your AI agent

The in-app AI tutor (💬 button) works out of the box in one of two ways:

**Default — your Claude subscription, no API key:**

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
   (or the native installer from [docs.anthropic.com/claude-code](https://docs.anthropic.com/claude-code))
2. Run `claude` once in a terminal and log in with your Claude account.
3. Restart ingpad — done. The server runs the Claude CLI locally
   (one persistent tutoring session per exercise).

**Alternative — bring your own API key:** open the chat's ⚙ settings, switch to
the *API key* tab, and pick a provider — Anthropic, OpenRouter, OpenAI, Mistral,
Google Gemini, DeepSeek, Groq, or xAI (any OpenAI-compatible endpoint works).
The key stays in your browser and the local server; nothing is logged.

The chat shows this onboarding itself on first open, so you can also just
start the server and click 💬. A hosted, multi-user version is on the
[roadmap](ROADMAP.md).

## Add your own exercise

```
projekte/
└─ <your-exercise>/
   ├─ index.html         # copy an existing project as a template
   ├─ <your source PDFs> # gitignored — see below
   └─ ...
```

Then `python server.py <your-exercise>`.

> ⚖️ **Exercise PDFs are not included.** School materials (e.g. DAA-Technikum) are copyrighted by their authors. `*.pdf` is gitignored on purpose — bring your own; the app is generic.

## Roadmap

[ROADMAP.md](ROADMAP.md) — from this local tool to a hosted platform: drag&drop PDF input → auto-built canvas, automatic PowerPoint + calc-document export, a model-agnostic in-app AI chat (no terminal needed), per-step file attachments, dark/light mode, and login-gated sharing of solutions mapped to modules & exercises.


<!-- PORTFOLIO-LINKS:START -->
## More open-source tools by Moritz Voigt

- **[secret-paste](https://github.com/MoritzV42/secret-paste)** — Paste API keys & tokens to your AI coding agent without ever putting them in the chat transcript. Local-only, cross-platform.
- **[push-to-clip](https://github.com/MoritzV42/push-to-clip)** — Copy text, files, or piped output to your system clipboard, from one command, on any OS.
- **[memoryball-studio](https://github.com/MoritzV42/memoryball-studio)** — Batch-prep a whole photo folder for the Memory Orb display ball: auto-cropped, face-aware, the right format — locally.
- **[ingpad](https://github.com/MoritzV42/ingpad)** — The engineer's scratch pad: solve technical exercises on one canvas with per-step Given / Sought / Approach, stylus fields, and an AI tutor. *(this repo)*

All MIT-licensed, free, built in public → **[moritzvoigt.infinityspace42.de](https://moritzvoigt.infinityspace42.de)**
<!-- PORTFOLIO-LINKS:END -->

## License

[AGPL-3.0](LICENSE) © Moritz Voigt · part of [Moritz Voigt — Open Source](https://moritzvoigt.infinityspace42.de)

The code is free to use, study and modify. Under the AGPL, anyone who runs a
**modified** version as a network service must publish their source under the
same license. The copyright stays with the author.
