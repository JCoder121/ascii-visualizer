# ascii-visualizer

Music visualizer in pure colored ASCII — spinning 3D torus, vaporwave grid
floor, starfield, EQ skyline. Sunset-neon palette, subtle CRT.

**Use:** open the page, drop an audio file anywhere (or tap MIC and play music
out loud). Space = pause.

**Stack:** vanilla JS ES modules, Canvas 2D, Web Audio API. No deps, no build.
Run locally: `python3 -m http.server 8642` → http://localhost:8642

Tests: `node --test 'tests/*.test.mjs'`

v1 design spec: `docs/superpowers/specs/2026-07-17-ascii-visualizer-v1-design.md`
