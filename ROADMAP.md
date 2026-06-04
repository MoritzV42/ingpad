# ingpad — Roadmap & Vision

> Two stages: first a **local OSS tool** (this repo), then a **hosted learning platform**.

## Stage 1 — OSS tool (local, AI via Claude Code)

Status: MVP shipping.

- [x] Canvas: framework-data rail, steps A–N, progress, Given/Sought/Approach
- [x] Per-step drawing field: pen/marker/eraser, zoom/pan, height-adjustable,
      stylus-only drawing (finger pans, two fingers zoom), undo, "send to AI" (PNG)
- [x] Local server (`server.py`, POST /api/submit receives PNG)
- [x] Source-document links + formula-sheet page references per step (`kurzref_index.json`)
- [x] MIT license, README, MARKETING, CI, copyright guard (no PDFs committed)
- [ ] **Per-step file attachments** — attach your own constructions, tables, documents
      (CAD exports, spreadsheets, PDFs) to a step
- [ ] Generic, non-copyrighted demo project (replace becherwerk for the public repo)
- [ ] Loom video + Techniker-Forum post (see MARKETING.md)
- [ ] Backlink network: README ↔ landing page ("Moritz Voigt — Open Source")

## Stage 2 — Hosted platform (own AI, community)

Status: vision. Turns the tool into a web app on is42 (Hetzner).

- [ ] **Input automation:** drag&drop exercise PDFs → AI extracts framework data +
      steps → builds the canvas automatically
- [ ] **Output:** PowerPoint (`python-pptx`) + calc document (PDF/Docx) from canvas state
- [ ] **Built-in AI chat** (right rail) with DeepSeek et al. — app brings its own AI,
      not only Claude Code externally
- [ ] **Hosting on is42**, multi-user
- [ ] **Exercise mapping:** exercise ↔ module ↔ learning situation (technician-school structure)
- [ ] **Sharing/community:** view other students' solutions
- [ ] **Login gating (license guard):** only enrolled students who already legally own the
      exercises → reduces copyright risk for solution sharing
- [ ] **Multi-tenancy:** user tenants, per-user project data
- [ ] **Project database:** exercises, solutions, mapping, persistent
- [ ] **Credits system:** meter/bill AI usage (DeepSeek)
- [ ] **PayPal donations:** monetization (free + donations, OSS model)

## Cross-cutting constraints

- Exercise materials (learning-situation scripts, datasheets, reference sheets) are
  copyrighted → never in a public repo. The app is generic; users bring their own.
- Landing page: OSS / personal-brand only, no consulting/implementation cross-links
  (§264 StGB); the agent prepares changes, Moritz reviews + deploys.
- Login gate on enrolled students reduces but does not replace a licensing clarification
  with the school if original exercise material is ever shared. User-generated solutions
  are fine; the original PDF would be the sensitive part.
