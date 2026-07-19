# ascii-visualizer

Music visualizer in pure colored ASCII. Three visualizers:
- **Vaporwave** (default) — spinning 3D torus, perspective grid floor, starfield, EQ skyline; sunset-neon palette.
- **Matrix** — rotating green glyph cube over full-field digital rain; classic phosphor palette.
- **Blade Runner** — amber neon-noir: rotating Tyrell pyramid over a flickering cityscape, fine drizzle, drop-triggered searchlight sweeps.

Subtle CRT on all.

**Use:** open the page, drop an audio file anywhere (or tap MIC and play music
out loud). Space = pause. Switch visualizers with the ◈ button (bottom-right):
Vaporwave → Matrix → Blade Runner → …

## Terminal

The same scenes run in a real terminal (procedural demo audio, no deps):

    node tui/run.mjs [--scene vaporwave|matrix|bladerunner] [--fps 30]

space = next scene · q = quit. Or try the simulated terminal on the web:
[`terminal.html`](https://jcoder121.github.io/ascii-visualizer/terminal.html) —
demo audio by default, click **mic** or drop a track for the real thing,
space/click cycles scenes.

**Stack:** vanilla JS ES modules, Canvas 2D, Web Audio API. No deps, no build.
Run locally: `python3 -m http.server 8642` → http://localhost:8642

Tests: `node --test 'tests/*.test.mjs'`

Design specs: `docs/superpowers/specs/` (v1 base + v2 matrix/switcher).
