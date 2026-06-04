# Contributing to ingpad

Thanks for your interest! ingpad is early — issues, ideas and PRs are all welcome.

## Dev setup

```bash
git clone https://github.com/MoritzV42/ingpad
cd ingpad
python server.py            # http://localhost:8042/index.html
```

No build step. The canvas is a single `projekte/<name>/index.html` (vanilla HTML/CSS/JS,
MathJax + math.js from CDN). The server is stdlib Python 3.10+, no dependencies.

The reference-rendering helper (`tools/render_kurzref.py`) uses PyMuPDF — only needed if
you want to index a scanned formula sheet.

## Project layout

```
server.py                 local dev server (serves a project, receives drawing PNGs)
projekte/<name>/index.html the canvas for one exercise
tools/render_kurzref.py   render a scanned reference to PNG pages + index
```

## Ground rules

- **Never commit exercise PDFs or scanned references.** They're copyrighted by their
  authors; `*.pdf` and `kurzref/` are gitignored. Keep it that way.
- Keep the canvas dependency-light (CDN MathJax/math.js is fine; no bundler).
- German is fine in commit messages / code comments; user-facing English in this repo.

## Ideas worth a PR

See [ROADMAP.md](ROADMAP.md) — drag&drop PDF input, PPTX export, per-step file
attachments, a generic (non-copyrighted) demo project to replace the becherwerk one.
