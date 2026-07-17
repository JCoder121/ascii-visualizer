# ascii-visualizer v1 — Design

2026-07-17. Approved by Jeffrey via interview.

## Concept

Full-bleed browser music visualizer rendered with **colors + ASCII glyphs only**. Aesthetic: vaporwave / blade-runner / 80s-retro blend ("sunset neon"). A large spinning 3D ASCII torus is the hero object (NCS / codex-donut energy); layered background reacts to the music. v1 is web-only; a terminal (TUI) port is planned later, so core simulation/projection logic stays renderer-agnostic.

## Scene composition (4 layers, back → front)

```
┌────────────────────────────────┐
│ . ·   *    .   ·  .    * .  ·  │  1 starfield
│   ·      .:=+**+=:.       .    │
│  .    =%@@#=:..:=#@@%=         │  2 torus (hero)
│      :%@%:  :#@@#:  :%@%:      │
│  ·    =%@@#=:..:=#@@%=    ·    │
│ .        ':=+**+=:'          . │
│ ____\___|___|___|___|___/_____ │  3 perspective grid floor
│   \   |    |   |    |   |   /  │
│▁▂▃▅▂▁▂▆▇▅▃▂▁▂▃▅▇▆▃▂▁▂▃▅▇▂▁▂▃▅▂│  4 EQ skyline
└────────────────────────────────┘
```

1. **Starfield / noise haze** — sparse `. · *` chars, dim lavender, twinkle keyed to treble.
2. **Torus (hero)** — real 3D math (donut.c style): rotate → perspective project → z-buffer → surface luminance mapped to char ramp `.:-=+*#%@`. Centered, ~50% of frame height. Bass swells tube radius; treble adds bright surface specks.
3. **Perspective grid floor** — lower third, magenta lines converging on a horizon, scrolling toward the viewer. Bass flares line brightness; mids drive scroll speed.
4. **EQ skyline** — full-spectrum ASCII bar graph hugging the bottom edge, teal, doubles as a city-skyline silhouette.

## Palette (single blended theme)

| Role     | Color                          |
|----------|--------------------------------|
| bg       | `#0a0118` near-black purple    |
| hero     | `#ff2d95` → `#00e5ff` gradient |
| grid     | `#b64fff` magenta-violet       |
| skyline  | `#00b3a4` teal                 |
| stars    | `#8a7aa8` dim lavender         |
| accent   | `#ffd319` gold (drops only)    |

## Audio pipeline

- **Sources (v1):** local file drag/drop (plays in page) and microphone toggle. No tab/system capture.
- Web Audio API `AnalyserNode` FFT → three smoothed bands: **bass**, **mids**, **treble**, plus full spectrum array for the skyline.
- **Mapping:** bass → torus swell + grid flare; mids → torus rotation speed + grid scroll speed; treble → star twinkle + torus sparkle; full spectrum → EQ skyline.
- **Drop detection:** transient detector on bass energy (rolling average + threshold). On a drop, all three fire:
  - **Gold flash** — whole scene tints `#ffd319` for a few frames.
  - **Kick-spin** — torus rotation axis snaps to a new random orientation with a brief speed spike.
  - **Grid shockwave** — a bright line races from horizon toward the viewer along the grid floor.
- **Idle state** (no audio yet): torus spins slowly to a synthetic ambient signal; prompt "drop a track or tap MIC".

## Rendering

- Single Canvas 2D element, cell grid ~**160×90** (~10px glyphs desktop, responsive to viewport).
- Prerendered **glyph atlas** (offscreen canvas per char × tinting at draw time) for 60fps at ~14k cells.
- **Subtle CRT overlay:** faint scanlines, soft bloom on bright glyphs, gentle vignette. No chromatic aberration/glitch in v1.
- Frame loop: `requestAnimationFrame`; each layer writes (char, color, intensity) into a shared cell buffer, back-to-front; renderer draws the buffer once.

## UI

Auto-hide minimal control strip at bottom: `[▸] [MIC] track.mp3 02:14`. Fades after 3s idle; reappears on mouse move / tap. Drag-drop accepted anywhere on the page. Spacebar toggles play/pause.

## Architecture

`~/Documents/claude_playground/ascii-visualizer/` — vanilla JS ES modules, no build step, no dependencies.

```
index.html
style.css            (page shell, CRT overlay bits doable in canvas or CSS)
src/
  main.js            (boot, RAF loop, layer orchestration)
  audio.js           (sources, analyser, bands, drop detector)
  renderer.js        (cell buffer, glyph atlas, canvas draw, CRT pass)
  theme.js           (palette + char ramps)
  torus.js           (3D torus: geometry, rotation, projection — renderer-agnostic)
  layers/
    stars.js  grid.js  skyline.js
  ui.js              (control strip, drag/drop, mic permission flow)
```

Each layer exposes `update(audioFrame, dt)` + `paint(cellBuffer)`; `renderer.js` knows nothing about audio; `audio.js` knows nothing about drawing. Torus math takes grid dimensions as parameters so the future TUI port can reuse it unchanged.

## Testing / verification

- Manual: load a bass-heavy track and a quiet acoustic track; verify mapping visibly differs and drop effects fire on kicks, not continuously.
- Mic path verified with music played on speakers.
- FPS sanity: ≥50fps on the MacBook at 160×90.
- No automated test suite for v1 (pure visual output); torus projection math gets a small standalone sanity check (points land within grid bounds).

## Deploy

GitHub repo under `jcoder121`, published to GitHub Pages when polished (same flow as twenty_four).

## Out of scope for v1

Terminal/TUI port (v2), theme switcher, tab/system audio capture, playlists, chromatic-aberration/glitch CRT, shape morphing.
