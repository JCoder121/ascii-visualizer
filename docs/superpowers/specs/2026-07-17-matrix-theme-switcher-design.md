# ascii-visualizer v2 — Matrix theme + theme switcher — Design

2026-07-17. Approved by Jeffrey via interview. Builds on v1 (`2026-07-17-ascii-visualizer-v1-design.md`).

## Concept

Add a second self-contained **scene** (Matrix) alongside the existing Vaporwave scene, selectable via a bottom-right cycle button. The audio engine and input controls (file drop / mic / play-pause) are shared and unchanged — only the visual scene swaps. Vaporwave remains the default on load.

## Scene abstraction

Refactor so each visualizer is a **Scene** — a bundle of hero + background layers + palette + audio mapping + optional drop handling. Uniform interface:

```js
class Scene {
  name;                     // 'VAPORWAVE' | 'MATRIX' (uppercase, shown on button)
  bg;                       // hex bg color for renderer.draw
  accent;                   // hex accent color for renderer.draw flash
  get flash();              // current flash intensity 0..1 (0 if scene has no drops)
  update(dt, audioFrame);   // advance hero + layers
  paint(grid);              // clear-free paint of all layers back→front into grid
}
```

`main.js` owns a scene registry `[vaporwave, matrix]`, an active index, and the transition. Each frame: `scene.update(dt, a)`, `grid.clear()`, `scene.paint(grid)`, `renderer.draw(scene.flash, scene.bg, scene.accent)`, then the transition overlay paints on top if active.

## Palettes (`theme.js`)

Refactor `theme.js` to export two palette objects plus the existing shared helpers (`RAMP`, `lerpColor`, `dim` — unchanged). Existing torus/stars/grid/skyline already receive a palette as a paint parameter, so they are unaffected; the Vaporwave scene passes `VAPORWAVE`.

```js
export const VAPORWAVE = {
  bg: '#0a0118', heroA: '#ff2d95', heroB: '#00e5ff',
  grid: '#b64fff', skyline: '#00b3a4', stars: '#8a7aa8', accent: '#ffd319',
};
export const MATRIX = {
  bg: '#020806', head: '#00ff41', trail: '#008f11',
  highlight: '#c8ffd0', accent: '#eaffea',
};
```

(v1 code imported `THEME`; that becomes `VAPORWAVE`. No other file imports the palette by name except `main.js`/scenes.)

## Matrix scene

### Hero — GlyphCube (`src/cube.js`)

Rotating 3D wireframe cube. 8 unit-cube vertices, 12 edges. Rotate by angles A/B (same scheme as the torus), perspective-project to grid cells (reusing the torus's `K1`/`K2`/cell-aspect approach), draw each edge as a line of glyphs via grid-space line interpolation. Visible cube interior sprinkled with a sparse field of streaming katakana/code glyphs that scroll downward each frame (the "cascade").

- **Katakana/code set:** `ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>` (glyphs chosen per-cell, refreshed occasionally so it shimmers).
- **Audio mapping:** bass → cube scale (pulse); mids → rotation speed; treble → random bright (`highlight`) glyphs scattered on edges/faces.
- **Color:** edges in `head` green, interior cascade glyphs graded `trail`→`head` by vertical position, treble sparkles in `highlight`.
- **kick():** randomize rotation orientation + brief speed spike (kept for parity/testability; Matrix scene does NOT call it on drops, but the method exists).

### Background — DigitalRain (`src/layers/rain.js`)

Full-field falling-glyph columns (one per grid column, or every column). Each column: a head y-position, fall speed, trail length, and a set of glyphs. Head glyph bright (`head`/`highlight`), trail fades toward `trail` then dark. Columns wrap to the top after falling off the bottom.

- **Audio mapping:** mids → global fall-speed multiplier; bass → brightness surge (all glyphs brighter); per-column activity/length scaled by `spectrum[col]` so louder bands spawn taller/denser streams; treble → occasional bright glyph flips (sparkle).
- Renders back-to-front behind the cube.

### Drops

Nothing special — smooth, no discrete drop events. The shared audio engine still detects drops; the Matrix scene ignores `audioFrame.drop`. `matrix.flash` is always 0.

## Vaporwave scene (`src/scenes/vaporwave.js`)

Move the v1 `main.js` loop body into a Scene class: owns `Torus`, `Stars`, `GridFloor`, `Skyline`, and the flash-on-drop logic (`if (a.drop) flash = 1; flash = max(0, flash - dt*3.5)`). `bg = VAPORWAVE.bg`, `accent = VAPORWAVE.accent`, `flash` getter returns the current value. Behavior identical to v1.

## Switcher & transition

### Button (`ui.js`, `index.html`, `style.css`)

Small button `#theme-btn` inside `#controls`, pushed to the far right. Label `◈ VAPORWAVE` / `◈ MATRIX` (current scene). Click cycles to the next scene (wraps). Fades with the control strip. `ui.js` takes an `onCycleTheme` callback and `update({ ..., themeName })` sets the label.

### Transition (`src/transition.js`)

On switch, start a ~0.4s glitch: a green digital-static overlay whose coverage rises then falls (peaks at midpoint); the active scene index swaps at the midpoint (~0.2s) so the static masks the cut. Overlay = random katakana glyphs in `MATRIX.head`/`highlight` sprinkled over a fraction of cells (fraction follows a raised-sine over the 0.4s). Cheap, purely additive on top of the painted scene.

```js
class Transition {
  active;                         // bool
  start(onMidpointSwap);          // begins 0.4s glitch, calls onMidpointSwap once at ~0.2s
  update(dt);                     // advances timer, fires midpoint callback
  paint(grid, palette);           // sprinkles static glyphs; no-op when inactive
}
```

Audio keeps playing uninterrupted across a switch (only the render path changes; audio engine untouched).

### Load default

Page load always starts on Vaporwave (index 0). No persistence in v2.

## Architecture / files

```
index.html                 MODIFY  add #theme-btn to #controls
style.css                  MODIFY  #theme-btn styling (green-on-hover accent)
src/theme.js               MODIFY  export VAPORWAVE + MATRIX; keep RAMP/lerpColor/dim
src/cube.js                NEW     GlyphCube hero
src/layers/rain.js         NEW     DigitalRain background
src/scenes/vaporwave.js    NEW     bundles torus+stars+floor+skyline+flash
src/scenes/matrix.js       NEW     bundles cube+rain
src/transition.js          NEW     glitch overlay
src/ui.js                  MODIFY  theme cycle button + label
src/main.js                MODIFY  scene registry, switch, transition wiring
```

Unchanged: `src/audio.js`, `src/renderer.js`, `src/torus.js`, `src/layers/{stars,grid,skyline}.js`.

## Testing / verification

- `tests/cube.test.mjs` — cube paints a bounded centered footprint of set cells using only known glyphs; bass=1 footprint wider than bass=0; `kick()` changes rotation state.
- `tests/rain.test.mjs` — rain paints cells spanning the full width; a column's head cell is brighter (higher `dim` factor / brighter color) than its trail cells; higher energy advances heads further per `update` than low energy.
- Existing 12 v1 tests stay green (scene refactor must not change layer/torus/audio signatures).
- Browser verification: load defaults to Vaporwave; click switcher → glitch transition → Matrix (cube spinning, rain falling, phosphor green); audio (a playing file) continues across the switch; switch back works; ≥50fps on Matrix; resize rebuilds cleanly.
- Deploy to the existing GitHub Pages site; verify both scenes live.

## Out of scope for v2

Theme persistence/localStorage, a third theme (blade-runner amber), per-scene audio-mapping UI, morphing between hero shapes, the terminal/TUI port (still v-next).
