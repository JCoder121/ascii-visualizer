# ascii-visualizer

Music visualizer in pure colored ASCII. Two visualizers:
- **Vaporwave** (default) — spinning 3D torus, perspective grid floor, starfield, EQ skyline; sunset-neon palette.
- **Matrix** — rotating green glyph cube over full-field digital rain; classic phosphor palette.

Subtle CRT on both.

**Use:** open the page, drop an audio file anywhere (or tap MIC and play music
out loud). Space = pause. Switch visualizers with the ◈ button (bottom-right):
Vaporwave ⇆ Matrix.

**Stack:** vanilla JS ES modules, Canvas 2D, Web Audio API. No deps, no build.
Run locally: `python3 -m http.server 8642` → http://localhost:8642

Tests: `node --test 'tests/*.test.mjs'`

Design specs: `docs/superpowers/specs/` (v1 base + v2 matrix/switcher).
