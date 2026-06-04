# Changelog

All notable changes to this project are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-06-04

Initial public release.

### Added
- Single-canvas solver: framework-data rail, steps with Given / Sought / Approach.
- Per-step drawing field: stylus draws, finger pans, two fingers zoom; height-adjustable;
  zoom & pan; undo; "send to AI" exports the field as a PNG.
- Local dev server (`server.py`) serving `projekte/<name>/`, receiving drawing PNGs.
- Reference linking: jump to the right formula-sheet page per topic (`kurzref_index.json`).
- Source-document links per step.
- MathJax formula rendering; flicker-free live reload.
- Demo project: bucket-elevator drivetrain (`projekte/becherwerk`).

### Notes
- Exercise PDFs are gitignored (copyright) — bring your own.
