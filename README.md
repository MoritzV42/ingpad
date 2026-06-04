# ingpad

> The engineer's scratch pad — solve a technical exercise on one canvas: pen, math, sketches and an AI tutor, side by side.

`ingpad` turns a technical exercise (the kind you get in engineering / technician school) into a single interactive canvas. Framework data on the left, the task split into steps, each step with its own **Given / Sought / Approach** boxes. You solve a step by **handwriting** into a drawing field, the AI checks your work, records the result, and opens the next step.

It's deliberately **socratic**: you think, the AI asks and verifies — it doesn't just hand you the answer.

> _Demo project: a bucket-elevator drivetrain (motor, gearbox, chain, bearings, coupling)._
> _Add a GIF/screenshot here._

## Why

Solving an engineering exercise today means juggling a PDF, a calculator, a sheet of paper and PowerPoint. `ingpad` puts all of it on one surface:

- **Framework data** always visible (left rail)
- **Per-step** Given / Sought / Approach
- **Drawing field per step** — stylus draws, finger pans, two fingers zoom; height-adjustable; zoom & pan; **"send to AI"** ships the field as an image for grading
- **Reference linking** — jump straight to the right page of your formula sheet, per topic
- **Source documents** linked per step
- **Crisp formulas** (MathJax) and a unit-aware calculator under the hood

## Quick start

```bash
git clone https://github.com/MoritzV42/ingpad
cd ingpad
python server.py            # serves projekte/becherwerk on http://localhost:8042/index.html
```

Open the URL, pick a step, handwrite your calculation, hit **An Claude senden** ("send to AI"). Then tell your AI agent it was sent — it reads the image, grades it, and fills in the result.

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

The AI side currently runs through **Claude Code** (the agent reads `submit_<step>.png`). A built-in chat (DeepSeek et al.) and a hosted, multi-user version are on the [roadmap](ROADMAP.md).

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

[ROADMAP.md](ROADMAP.md) — from this local tool to a hosted platform: drag&drop PDF input → auto-built canvas, PowerPoint + calc-document export, built-in AI chat, per-step file attachments, login-gated sharing of solutions mapped to modules & exercises.

## License

[MIT](LICENSE) © Moritz Voigt · part of [Moritz Voigt — Open Source](https://moritzvoigt.infinityspace42.de)
