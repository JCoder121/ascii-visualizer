# ascii-visualizer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browser music visualizer rendered entirely with colored ASCII glyphs: spinning 3D torus hero + starfield + perspective grid floor + EQ skyline, driven by file/mic audio.

**Architecture:** Vanilla JS ES modules, no build step, no dependencies. All layers write `(char, color)` into a shared `CellGrid`; a Canvas-2D `Renderer` draws the grid via a lazy glyph atlas plus a bloom pass; CSS supplies scanlines/vignette. `audio.js` knows nothing about drawing; `renderer.js` knows nothing about audio; torus math is renderer-agnostic for a future TUI port.

**Tech Stack:** HTML/CSS/vanilla JS, Web Audio API, Canvas 2D, node built-in test runner (`node --test`) for pure-math tests.

**Spec:** `docs/superpowers/specs/2026-07-17-ascii-visualizer-v1-design.md`

## Global Constraints

- Palette (exact): bg `#0a0118`, hero `#ff2d95`→`#00e5ff`, grid `#b64fff`, skyline `#00b3a4`, stars `#8a7aa8`, accent `#ffd319`.
- Char ramp (exact): `.:-=+*#%@`
- Target grid density: ~160 columns; rows derived from cell aspect 1.9 (height/width).
- No external dependencies, no build step. Node used only for tests.
- Layer paint order (back→front): stars, torus, grid floor, EQ skyline.
- Audio mapping: bass→torus swell + grid flare; mids→rotation + grid scroll speed; treble→star twinkle + torus sparkle; full spectrum→skyline. Drop → gold flash + torus kick-spin + grid shockwave.
- v1 excludes: TUI port, theme switcher, tab-audio capture, playlists, glitch CRT, shape morphing.
- All color-producing helpers quantize internally (atlas key cardinality stays bounded).

## Shared Interfaces (all tasks)

```js
// theme.js
export const THEME = { bg, heroA, heroB, grid, skyline, stars, accent }  // hex strings
export const RAMP = '.:-=+*#%@'
export function lerpColor(aHex, bHex, t)  // -> 'rgb(r,g,b)', t quantized to 1/24
export function dim(hex, k)               // -> 'rgb(r,g,b)', k quantized to 1/16

// renderer.js
class CellGrid { cols; rows; clear(); set(x, y, ch, color) /* silently ignores out-of-bounds */ }
class Renderer { constructor(canvas); grid /* CellGrid */; resize(); draw(flash, bgHex, accentHex) }

// audio.js
class AudioEngine {
  async useFile(file); async useMic(); stopMic(); togglePlay();
  mode /* 'idle'|'file'|'mic' */; playing; trackName; time; duration;
  frame(dt) // -> { bass, mids, treble, level, spectrum: Float32Array(64), drop: bool }, all 0..1
}
export function computeBands(freqUint8, sampleRate) // -> {bass, mids, treble} 0..1 (pure)
export function fillSpectrum(freqUint8, outFloat32)  // fills 64 log-ish bins 0..1 (pure)

// torus.js
class Torus { update(dt, audioFrame); paint(grid, audioFrame, THEME); kick() }

// layers/*.js
class Stars    { update(audioFrame, dt); paint(grid, THEME) }
class GridFloor{ update(audioFrame, dt); paint(grid, THEME) }
class Skyline  { update(audioFrame, dt); paint(grid, THEME) }

// ui.js
class UI { constructor({ onFile(file), onMic(), onToggle() }); update({ trackName, playing, time, duration, mode }) }
```

An `audioFrame` is always the object returned by `AudioEngine.frame(dt)`.

Task dependency graph: Task 1 (shell/theme/renderer) has no deps. Tasks 2 (torus), 3 (audio), 4 (layers) depend only on the interfaces above — they can run **in parallel** and don't import renderer.js (they receive a grid). Task 5 (ui/main) integrates everything. Task 6 verifies/deploys.

---

### Task 1: Shell, theme, renderer

**Files:**
- Create: `index.html`, `style.css`, `src/theme.js`, `src/renderer.js`
- Test: `tests/theme.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `THEME`, `RAMP`, `lerpColor`, `dim`, `CellGrid`, `Renderer` exactly as in Shared Interfaces.

- [ ] **Step 1: Write failing theme test**

```js
// tests/theme.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { THEME, RAMP, lerpColor, dim } from '../src/theme.js';

test('palette matches spec', () => {
  assert.equal(THEME.bg, '#0a0118');
  assert.equal(THEME.heroA, '#ff2d95');
  assert.equal(THEME.heroB, '#00e5ff');
  assert.equal(THEME.grid, '#b64fff');
  assert.equal(THEME.skyline, '#00b3a4');
  assert.equal(THEME.stars, '#8a7aa8');
  assert.equal(THEME.accent, '#ffd319');
  assert.equal(RAMP, '.:-=+*#%@');
});

test('lerpColor endpoints and quantization', () => {
  assert.equal(lerpColor('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(lerpColor('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  // quantized: two nearby t values collapse to the same output
  assert.equal(lerpColor('#000000', '#ffffff', 0.50), lerpColor('#000000', '#ffffff', 0.51));
});

test('dim scales and quantizes', () => {
  assert.equal(dim('#ff0000', 0), 'rgb(0,0,0)');
  assert.equal(dim('#ff0000', 1), 'rgb(255,0,0)');
  assert.equal(dim('#808080', 0.5), dim('#808080', 0.51));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/theme.test.mjs`
Expected: FAIL (cannot find module `../src/theme.js`)

- [ ] **Step 3: Implement theme.js**

```js
// src/theme.js
export const THEME = {
  bg: '#0a0118',
  heroA: '#ff2d95',
  heroB: '#00e5ff',
  grid: '#b64fff',
  skyline: '#00b3a4',
  stars: '#8a7aa8',
  accent: '#ffd319',
};

export const RAMP = '.:-=+*#%@';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (t) => Math.min(1, Math.max(0, t));

// t quantized to 1/24 steps so the renderer's glyph atlas stays small
export function lerpColor(aHex, bHex, t) {
  t = Math.round(clamp01(t) * 24) / 24;
  const [ar, ag, ab] = hexToRgb(aHex);
  const [br, bg, bb] = hexToRgb(bHex);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

// k quantized to 1/16 steps
export function dim(hex, k) {
  k = Math.round(clamp01(k) * 16) / 16;
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/theme.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement renderer.js**

```js
// src/renderer.js
const TARGET_COLS = 160;
const CELL_ASPECT = 1.9; // cell height / cell width

export class CellGrid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.ch = new Array(cols * rows).fill(' ');
    this.color = new Array(cols * rows).fill('');
  }
  clear() {
    this.ch.fill(' ');
    this.color.fill('');
  }
  set(x, y, ch, color) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = ch;
    this.color[i] = color;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.atlas = new Map();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.cellW = Math.max(5, Math.floor(this.canvas.width / TARGET_COLS));
    this.cellH = Math.round(this.cellW * CELL_ASPECT);
    const cols = Math.floor(this.canvas.width / this.cellW);
    const rows = Math.floor(this.canvas.height / this.cellH);
    this.grid = new CellGrid(cols, rows);
    this.font = `${Math.round(this.cellW * 1.6)}px Menlo, "SF Mono", monospace`;
    this.atlas.clear();
    this.scene = document.createElement('canvas');
    this.scene.width = this.canvas.width;
    this.scene.height = this.canvas.height;
    this.sctx = this.scene.getContext('2d');
  }

  _glyph(ch, color) {
    const key = ch + color;
    let g = this.atlas.get(key);
    if (!g) {
      if (this.atlas.size > 5000) this.atlas.clear(); // safety valve
      g = document.createElement('canvas');
      g.width = this.cellW;
      g.height = this.cellH;
      const c = g.getContext('2d');
      c.font = this.font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = color;
      c.fillText(ch, this.cellW / 2, this.cellH / 2);
      this.atlas.set(key, g);
    }
    return g;
  }

  draw(flash, bgHex, accentHex) {
    const { sctx, ctx, grid } = this;
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.fillStyle = bgHex;
    sctx.fillRect(0, 0, this.scene.width, this.scene.height);
    for (let y = 0; y < grid.rows; y++) {
      const py = y * this.cellH;
      const row = y * grid.cols;
      for (let x = 0; x < grid.cols; x++) {
        const ch = grid.ch[row + x];
        if (ch === ' ') continue;
        sctx.drawImage(this._glyph(ch, grid.color[row + x]), x * this.cellW, py);
      }
    }
    if (flash > 0) {
      sctx.globalCompositeOperation = 'lighter';
      sctx.globalAlpha = flash * 0.28;
      sctx.fillStyle = accentHex;
      sctx.fillRect(0, 0, this.scene.width, this.scene.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
    }
    // present + cheap bloom
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.drawImage(this.scene, 0, 0);
    ctx.filter = 'blur(6px)';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(this.scene, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
```

- [ ] **Step 6: Implement index.html and style.css**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ascii-visualizer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <canvas id="view"></canvas>
  <div id="crt"></div>
  <div id="idle-prompt">drop a track or tap MIC</div>
  <div id="controls">
    <button id="play-btn" title="play/pause">▸</button>
    <button id="mic-btn" title="microphone">MIC</button>
    <span id="track-name">—</span>
    <span id="track-time"></span>
  </div>
  <script type="module" src="src/main.js"></script>
</body>
</html>
```

```css
/* style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; background: #0a0118; }
#view { position: fixed; inset: 0; width: 100vw; height: 100vh; display: block; }

/* CRT: scanlines + vignette (pointer-events pass through) */
#crt { position: fixed; inset: 0; pointer-events: none; }
#crt::before {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(to bottom,
    rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.18) 4px);
}
#crt::after {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(ellipse at center,
    rgba(0,0,0,0) 55%, rgba(0,0,0,0.45) 100%);
}

#idle-prompt {
  position: fixed; left: 50%; bottom: 18vh; transform: translateX(-50%);
  font: 14px Menlo, monospace; letter-spacing: 0.3em;
  color: #8a7aa8; text-shadow: 0 0 8px #b64fff;
  animation: pulse 2.4s ease-in-out infinite;
}
@keyframes pulse { 50% { opacity: 0.35; } }

#controls {
  position: fixed; left: 0; right: 0; bottom: 0;
  display: flex; gap: 14px; align-items: center;
  padding: 10px 16px; font: 13px Menlo, monospace; color: #00e5ff;
  background: linear-gradient(to top, rgba(10,1,24,0.85), rgba(10,1,24,0));
  transition: opacity 0.5s; opacity: 1;
}
#controls.hidden { opacity: 0; pointer-events: none; }
#controls button {
  background: none; border: 1px solid #ff2d95; color: #ff2d95;
  font: inherit; padding: 2px 10px; cursor: pointer;
}
#controls button.active { background: #ff2d95; color: #0a0118; }
#track-name { color: #8a7aa8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw; }
#track-time { color: #00b3a4; margin-left: auto; }
body.dragging::after {
  content: 'DROP TO PLAY'; position: fixed; inset: 0; display: grid; place-items: center;
  font: 24px Menlo, monospace; letter-spacing: 0.4em; color: #ffd319;
  background: rgba(10,1,24,0.7); border: 2px dashed #ffd319; pointer-events: none;
}
```

- [ ] **Step 7: Browser smoke check**

Temporarily append to `index.html` before `</body>` (remove after checking — `src/main.js` doesn't exist yet, its 404 in console is expected and fine):

```html
<script type="module">
  import { Renderer } from './src/renderer.js';
  import { THEME, RAMP, lerpColor } from './src/theme.js';
  const r = new Renderer(document.getElementById('view'));
  for (let y = 0; y < r.grid.rows; y++)
    for (let x = 0; x < r.grid.cols; x += 2)
      r.grid.set(x, y, RAMP[(x + y) % RAMP.length], lerpColor(THEME.heroA, THEME.heroB, y / r.grid.rows));
  r.draw(0, THEME.bg, THEME.accent);
</script>
```

Run: `cd ~/Documents/claude_playground/ascii-visualizer && python3 -m http.server 8642` then open `http://localhost:8642`.
Expected: full-screen pink→cyan gradient of ASCII chars with faint scanlines, glow, vignette; control strip at bottom. Remove the temp script after verifying.

- [ ] **Step 8: Commit**

```bash
git add index.html style.css src/theme.js src/renderer.js tests/theme.test.mjs
git commit -m "feat: page shell, theme palette, ASCII cell renderer with bloom + CRT"
```

---

### Task 2: Torus hero

**Files:**
- Create: `src/torus.js`
- Test: `tests/torus.test.mjs`

**Interfaces:**
- Consumes: `RAMP`, `lerpColor` from `src/theme.js`; a `grid` with `{cols, rows, set(x,y,ch,color)}`; `audioFrame` `{bass, mids, treble, drop}`.
- Produces: `export class Torus { constructor(); update(dt, audioFrame); paint(grid, audioFrame, theme); kick() }` where `theme` has `heroA`, `heroB`.

- [ ] **Step 1: Write failing test**

```js
// tests/torus.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { Torus } from '../src/torus.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) { calls.push({ x, y, ch, color }); } };
}

const THEME = { heroA: '#ff2d95', heroB: '#00e5ff' };
const FRAME = { bass: 0.3, mids: 0.4, treble: 0.2, drop: false };

test('torus paints a centered blob of ramp chars', () => {
  const g = mockGrid(160, 50);
  const t = new Torus();
  t.update(0.016, FRAME);
  t.paint(g, FRAME, THEME);
  assert.ok(g.calls.length > 500, `expected >500 cells, got ${g.calls.length}`);
  const xs = g.calls.map(c => c.x), ys = g.calls.map(c => c.y);
  const cx = xs.reduce((a, b) => a + b) / xs.length;
  const cy = ys.reduce((a, b) => a + b) / ys.length;
  assert.ok(Math.abs(cx - 80) < 12, `centroid x ${cx} not near 80`);
  assert.ok(Math.abs(cy - 50 * 0.42) < 8, `centroid y ${cy} not near ${50 * 0.42}`);
  for (const c of g.calls) assert.ok('.:-=+*#%@'.includes(c.ch));
});

test('bass swell grows the torus footprint', () => {
  const paint = (bass) => {
    const g = mockGrid(160, 50);
    new Torus().paint(g, { bass, mids: 0, treble: 0, drop: false }, THEME);
    const xs = g.calls.map(c => c.x);
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(paint(1) > paint(0), 'bass=1 should span wider than bass=0');
});

test('kick changes rotation state', () => {
  const t = new Torus();
  const before = [t.A, t.B, t.dA, t.dB].join(',');
  t.kick();
  assert.notEqual([t.A, t.B, t.dA, t.dB].join(','), before);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/torus.test.mjs`
Expected: FAIL (cannot find module `../src/torus.js`)

- [ ] **Step 3: Implement torus.js**

donut.c-style: sample the torus surface, rotate by angles A/B, perspective-project, z-buffer, map surface luminance to `RAMP`. Vertical pink→cyan gradient across the torus extent. `K1` is scaled for cell aspect 1.9 (y axis multiplied by 1/1.9≈0.53).

```js
// src/torus.js
import { RAMP, lerpColor } from './theme.js';

export class Torus {
  constructor() {
    this.A = 1.0;
    this.B = 0.4;
    this.dA = 0.9;
    this.dB = 0.55;
    this.kickTime = 0;
    this.zbuf = null;
  }

  kick() {
    this.A += (Math.random() - 0.5) * 2.5;
    this.B += (Math.random() - 0.5) * 2.5;
    this.dA = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9);
    this.dB = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.7);
    this.kickTime = 0.5;
  }

  update(dt, { mids, drop }) {
    if (drop) this.kick();
    this.kickTime = Math.max(0, this.kickTime - dt);
    const boost = 1 + (this.kickTime > 0 ? 2.2 * (this.kickTime / 0.5) : 0);
    const speed = (0.35 + mids * 2.2) * boost;
    this.A += this.dA * speed * dt;
    this.B += this.dB * speed * dt;
  }

  paint(grid, { bass, treble }, theme) {
    const R1 = 1 + bass * 0.5;
    const R2 = 2;
    const K2 = 5;
    const { cols, rows } = grid;
    const cx = cols / 2;
    const cy = rows * 0.42;
    // fit by height; 1.9 = cell aspect, 0.53 ≈ 1/1.9 corrects y
    const K1 = (rows * 1.9 * 0.5 * K2 * 3) / (8 * (R1 + R2));
    const halfH = (K1 * 0.53 * (R1 + R2)) / (K2 - R1 - R2) ;
    if (!this.zbuf || this.zbuf.length !== cols * rows) this.zbuf = new Float32Array(cols * rows);
    this.zbuf.fill(0);
    const cA = Math.cos(this.A), sA = Math.sin(this.A);
    const cB = Math.cos(this.B), sB = Math.sin(this.B);
    for (let tj = 0; tj < 6.28; tj += 0.07) {
      const ct = Math.cos(tj), st = Math.sin(tj);
      for (let p = 0; p < 6.28; p += 0.02) {
        const cp = Math.cos(p), sp = Math.sin(p);
        const h = R2 + R1 * ct;
        const t = R1 * st;
        const x = h * (cB * cp + sA * sB * sp) - t * cA * sB;
        const y = h * (sB * cp - sA * cB * sp) + t * cA * cB;
        const z = K2 + cA * h * sp + t * sA;
        const ooz = 1 / z;
        const xp = Math.round(cx + K1 * ooz * x);
        const yp = Math.round(cy - K1 * 0.53 * ooz * y);
        if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
        const idx = yp * cols + xp;
        if (ooz <= this.zbuf[idx]) continue;
        this.zbuf[idx] = ooz;
        let L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
        L = Math.max(0, L) / 1.414; // 0..1 toward light
        let ri = Math.floor(L * (RAMP.length - 1));
        if (treble > 0.25 && L > 0.4 && Math.random() < treble * 0.06) ri = RAMP.length - 1; // sparkle
        const gt = 0.5 + (yp - cy) / (2 * Math.max(1, halfH)); // vertical gradient
        grid.set(xp, yp, RAMP[ri], lerpColor(theme.heroA, theme.heroB, gt));
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/torus.test.mjs`
Expected: PASS (3 tests). If the centroid assertion fails, the projection signs are wrong — recheck the `xp`/`yp` formulas, don't loosen the test.

- [ ] **Step 5: Commit**

```bash
git add src/torus.js tests/torus.test.mjs
git commit -m "feat: 3D ASCII torus with z-buffer shading, swell, sparkle, kick-spin"
```

---

### Task 3: Audio engine

**Files:**
- Create: `src/audio.js`
- Test: `tests/audio.test.mjs`

**Interfaces:**
- Consumes: nothing (browser Web Audio API at runtime; pure functions testable in node).
- Produces: `AudioEngine` class and pure helpers `computeBands(freqUint8, sampleRate)`, `fillSpectrum(freqUint8, out)` exactly as in Shared Interfaces. `frame(dt)` MUST always return `{bass, mids, treble, level, spectrum, drop}` (synthesized ambient values when `mode==='idle'` or file paused).

- [ ] **Step 1: Write failing test (pure helpers)**

```js
// tests/audio.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { computeBands, fillSpectrum } from '../src/audio.js';

// 1024 bins at 44100Hz → binHz ≈ 21.5
function freqWithPeak(loHz, hiHz, sampleRate = 44100, bins = 1024) {
  const f = new Uint8Array(bins);
  const binHz = sampleRate / 2 / bins;
  for (let i = 0; i < bins; i++) {
    const hz = i * binHz;
    if (hz >= loHz && hz <= hiHz) f[i] = 255;
  }
  return f;
}

test('computeBands isolates bass', () => {
  const b = computeBands(freqWithPeak(20, 250), 44100);
  assert.ok(b.bass > 0.8, `bass ${b.bass}`);
  assert.ok(b.treble < 0.1, `treble ${b.treble}`);
});

test('computeBands isolates treble', () => {
  const b = computeBands(freqWithPeak(2000, 8000), 44100);
  assert.ok(b.treble > 0.8, `treble ${b.treble}`);
  assert.ok(b.bass < 0.15, `bass ${b.bass}`);
});

test('fillSpectrum fills 64 bins in 0..1', () => {
  const out = new Float32Array(64);
  fillSpectrum(freqWithPeak(0, 22050), out);
  assert.ok(out.every(v => v >= 0 && v <= 1));
  assert.ok(out[10] > 0.9);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/audio.test.mjs`
Expected: FAIL (cannot find module `../src/audio.js`)

- [ ] **Step 3: Implement audio.js**

Routing: file element source connects to BOTH analyser and destination; mic connects to analyser ONLY (no feedback). Analyser is never connected to destination.

```js
// src/audio.js
export function computeBands(freq, sampleRate) {
  const binHz = sampleRate / 2 / freq.length;
  const avg = (lo, hi) => {
    const a = Math.max(0, Math.floor(lo / binHz));
    const b = Math.min(freq.length - 1, Math.ceil(hi / binHz));
    let s = 0;
    for (let i = a; i <= b; i++) s += freq[i];
    return s / ((b - a + 1) * 255);
  };
  return { bass: avg(20, 250), mids: avg(250, 2000), treble: avg(2000, 8000) };
}

export function fillSpectrum(freq, out) {
  const n = out.length;
  const half = freq.length; // getByteFrequencyData already covers 0..nyquist
  for (let i = 0; i < n; i++) {
    const a = Math.floor(Math.pow(i / n, 1.7) * half * 0.5);
    const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.7) * half * 0.5));
    let s = 0;
    for (let j = a; j < b; j++) s += freq[j];
    out[i] = s / ((b - a) * 255);
  }
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.mode = 'idle';
    this.audioEl = null;
    this.fileSrc = null;
    this.micStream = null;
    this.micSrc = null;
    this.trackName = '';
    this.sBass = 0; this.sMids = 0; this.sTreble = 0;
    this.emaFast = 0; this.emaSlow = 0; this.cooldown = 0;
    this.spectrum = new Float32Array(64);
    this._t = 0;
  }

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async useFile(file) {
    this._ensureCtx();
    this.stopMic();
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.fileSrc = this.ctx.createMediaElementSource(this.audioEl);
      this.fileSrc.connect(this.analyser);
      this.fileSrc.connect(this.ctx.destination);
    }
    if (this.audioEl.src) URL.revokeObjectURL(this.audioEl.src);
    this.audioEl.src = URL.createObjectURL(file);
    this.trackName = file.name;
    this.mode = 'file';
    await this.audioEl.play();
  }

  async useMic() {
    this._ensureCtx();
    if (this.audioEl) this.audioEl.pause();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micSrc = this.ctx.createMediaStreamSource(this.micStream);
    this.micSrc.connect(this.analyser);
    this.mode = 'mic';
    this.trackName = 'microphone';
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micSrc.disconnect();
      this.micStream = null;
      this.micSrc = null;
    }
    if (this.mode === 'mic') this.mode = 'idle';
  }

  get playing() {
    if (this.mode === 'mic') return true;
    return this.mode === 'file' && this.audioEl && !this.audioEl.paused;
  }
  get time() { return this.audioEl ? this.audioEl.currentTime : 0; }
  get duration() { return (this.audioEl && this.audioEl.duration) || 0; }

  togglePlay() {
    if (this.mode !== 'file' || !this.audioEl) return;
    if (this.audioEl.paused) this.audioEl.play();
    else this.audioEl.pause();
  }

  frame(dt) {
    this._t += dt;
    if (!this.playing) return this._idleFrame();
    this.analyser.getByteFrequencyData(this.freq);
    const raw = computeBands(this.freq, this.ctx.sampleRate);
    const k = 1 - Math.exp(-dt * 12);
    this.sBass += (raw.bass - this.sBass) * k;
    this.sMids += (raw.mids - this.sMids) * k;
    this.sTreble += (raw.treble - this.sTreble) * k;
    fillSpectrum(this.freq, this.spectrum);
    // drop detection: fast bass EMA punching through slow EMA
    this.emaFast += (raw.bass - this.emaFast) * (1 - Math.exp(-dt * 25));
    this.emaSlow += (raw.bass - this.emaSlow) * (1 - Math.exp(-dt * 2.5));
    this.cooldown = Math.max(0, this.cooldown - dt);
    let drop = false;
    if (this.cooldown === 0 && this.emaFast > 0.28 && this.emaFast > this.emaSlow * 1.45) {
      drop = true;
      this.cooldown = 0.4;
    }
    return {
      bass: this.sBass, mids: this.sMids, treble: this.sTreble,
      level: (this.sBass + this.sMids + this.sTreble) / 3,
      spectrum: this.spectrum, drop,
    };
  }

  _idleFrame() {
    const t = this._t;
    const w = (f, p = 0) => 0.5 + 0.5 * Math.sin(t * f + p);
    for (let i = 0; i < 64; i++) {
      this.spectrum[i] = 0.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.35));
    }
    return {
      bass: 0.12 + 0.1 * w(0.7),
      mids: 0.15 + 0.08 * w(0.43, 1),
      treble: 0.1 + 0.08 * w(1.1, 2),
      level: 0.12,
      spectrum: this.spectrum,
      drop: false,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/audio.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/audio.js tests/audio.test.mjs
git commit -m "feat: audio engine — file/mic sources, band analysis, drop detection, idle signal"
```

---

### Task 4: Background layers (stars, grid floor, EQ skyline)

**Files:**
- Create: `src/layers/stars.js`, `src/layers/grid.js`, `src/layers/skyline.js`
- Test: `tests/layers.test.mjs`

**Interfaces:**
- Consumes: `dim` from `../theme.js` (note: layers live in `src/layers/`, so theme import path is `../theme.js`); grid `{cols, rows, set()}`; `audioFrame`.
- Produces: `Stars`, `GridFloor`, `Skyline` classes, each `update(audioFrame, dt)` + `paint(grid, theme)`. `GridFloor` horizon row = `floor(rows * 0.63)`; shockwaves spawn on `audioFrame.drop`.

- [ ] **Step 1: Write failing test**

```js
// tests/layers.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { Stars } from '../src/layers/stars.js';
import { GridFloor } from '../src/layers/grid.js';
import { Skyline } from '../src/layers/skyline.js';
import { THEME } from '../src/theme.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) {
    if (x >= 0 && y >= 0 && x < cols && y < rows) calls.push({ x, y, ch, color });
  } };
}

const FRAME = {
  bass: 0.5, mids: 0.5, treble: 0.5, level: 0.5,
  spectrum: new Float32Array(64).fill(0.6), drop: false,
};

test('stars paint above the horizon only', () => {
  const g = mockGrid(160, 50);
  const s = new Stars();
  s.update(FRAME, 0.016);
  s.paint(g, THEME);
  assert.ok(g.calls.length > 30);
  assert.ok(g.calls.every(c => c.y < 50 * 0.63));
});

test('grid floor paints below horizon, shockwave on drop', () => {
  const g = mockGrid(160, 50);
  const f = new GridFloor();
  f.update(FRAME, 0.016);
  f.paint(g, THEME);
  const hy = Math.floor(50 * 0.63);
  assert.ok(g.calls.length > 100);
  assert.ok(g.calls.every(c => c.y >= hy));
  // drop spawns a wave
  f.update({ ...FRAME, drop: true }, 0.016);
  assert.equal(f.waves.length, 1);
});

test('skyline bars hug the bottom, scale with spectrum', () => {
  const g = mockGrid(160, 50);
  const s = new Skyline();
  s.update(FRAME, 0.016);
  s.paint(g, THEME);
  assert.ok(g.calls.length > 100);
  assert.ok(g.calls.every(c => c.y >= 50 - 8));
  const quiet = mockGrid(160, 50);
  s.update({ ...FRAME, spectrum: new Float32Array(64).fill(0.1) }, 0.016);
  s.paint(quiet, THEME);
  assert.ok(quiet.calls.length < g.calls.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/layers.test.mjs`
Expected: FAIL (cannot find module `../src/layers/stars.js`)

- [ ] **Step 3: Implement stars.js**

```js
// src/layers/stars.js
import { dim } from '../theme.js';

export class Stars {
  constructor() {
    this.stars = null;
    this.t = 0;
    this.treble = 0;
  }

  _init(grid) {
    this.cols = grid.cols;
    this.rows = grid.rows;
    const n = Math.floor(grid.cols * grid.rows * 0.014);
    this.stars = Array.from({ length: n }, () => ({
      x: Math.floor(Math.random() * grid.cols),
      y: Math.floor(Math.random() * grid.rows * 0.62),
      ch: '.·*'[Math.floor(Math.random() * 3)],
      ph: Math.random() * 6.28,
      f: 0.5 + Math.random() * 2,
    }));
  }

  update(audio, dt) {
    this.t += dt;
    this.treble = audio.treble;
  }

  paint(grid, theme) {
    if (!this.stars || this.cols !== grid.cols || this.rows !== grid.rows) this._init(grid);
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.t * s.f * (1 + this.treble * 3) + s.ph);
      const b = 0.25 + tw * (0.3 + this.treble * 0.9);
      grid.set(s.x, s.y, s.ch, dim(theme.stars, Math.min(1, b)));
    }
  }
}
```

- [ ] **Step 4: Implement grid.js**

Radial verticals from the vanishing point; horizontal lines at world depths `z`, projected as `y = hy + D / z`, scrolling toward the viewer. Shockwave = full-width bright accent row racing down.

```js
// src/layers/grid.js
import { dim } from '../theme.js';

export class GridFloor {
  constructor() {
    this.offset = 0;
    this.waves = [];
    this.bass = 0;
  }

  update(audio, dt) {
    this.bass = audio.bass;
    this.offset = (this.offset + dt * (0.8 + audio.mids * 5)) % 1;
    if (audio.drop) this.waves.push({ z: 10 });
    for (const w of this.waves) w.z -= dt * 14;
    this.waves = this.waves.filter((w) => w.z > 0.55);
  }

  paint(grid, theme) {
    const hy = Math.floor(grid.rows * 0.63);
    const cx = grid.cols / 2;
    const depth = grid.rows - 1 - hy;
    const D = depth * 0.55; // z=0.55 lands on the bottom row
    const base = 0.3 + this.bass * 0.6;

    // horizon line
    for (let x = 0; x < grid.cols; x++) grid.set(x, hy, '_', dim(theme.grid, 0.25));

    // horizontal lines scrolling toward viewer
    for (let k = 0; k < 12; k++) {
      const z = 0.55 + (k + (1 - this.offset)) * 0.85;
      const y = hy + Math.round(D / z);
      if (y <= hy || y >= grid.rows) continue;
      const b = Math.min(1, base * (2.0 / z));
      for (let x = 0; x < grid.cols; x++) grid.set(x, y, '_', dim(theme.grid, b));
    }

    // radial verticals from vanishing point
    const spread = grid.cols / (2 * 8 * depth) * 1.7;
    for (let m = -8; m <= 8; m++) {
      if (m === 0) {
        for (let y = hy + 1; y < grid.rows; y++) grid.set(Math.round(cx), y, '|', dim(theme.grid, base * 0.8));
        continue;
      }
      const slope = m * spread;
      const ch = Math.abs(slope) < 0.45 ? '|' : m > 0 ? '\\' : '/';
      for (let y = hy + 1; y < grid.rows; y++) {
        const x = Math.round(cx + slope * (y - hy));
        grid.set(x, y, ch, dim(theme.grid, base * 0.8));
      }
    }

    // shockwaves (drawn last, brightest)
    for (const w of this.waves) {
      const y = hy + Math.round(D / w.z);
      if (y <= hy || y >= grid.rows) continue;
      for (let x = 0; x < grid.cols; x++) grid.set(x, y, '=', dim(theme.accent, 1));
    }
  }
}
```

- [ ] **Step 5: Implement skyline.js**

```js
// src/layers/skyline.js
import { dim } from '../theme.js';

const BLOCKS = '▁▂▃▄▅▆▇';
const MAX_H = 7; // rows

export class Skyline {
  constructor() {
    this.spec = null;
  }

  update(audio) {
    this.spec = audio.spectrum;
  }

  paint(grid, theme) {
    if (!this.spec) return;
    for (let x = 0; x < grid.cols; x++) {
      const v = this.spec[Math.floor((x / grid.cols) * this.spec.length)];
      const h = Math.min(MAX_H, v * MAX_H);
      const full = Math.floor(h);
      for (let k = 0; k < full; k++) {
        grid.set(x, grid.rows - 1 - k, '█', dim(theme.skyline, 0.3 + 0.4 * (1 - k / MAX_H)));
      }
      const frac = Math.floor((h - full) * (BLOCKS.length + 1));
      if (frac > 0) grid.set(x, grid.rows - 1 - full, BLOCKS[frac - 1], dim(theme.skyline, 0.6));
    }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test tests/layers.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/layers tests/layers.test.mjs
git commit -m "feat: starfield, perspective grid floor with shockwaves, EQ skyline layers"
```

---

### Task 5: UI + main loop integration

**Files:**
- Create: `src/ui.js`, `src/main.js`

**Interfaces:**
- Consumes: everything produced by Tasks 1-4 (exact names in Shared Interfaces); DOM ids from Task 1's `index.html`: `view`, `idle-prompt`, `controls`, `play-btn`, `mic-btn`, `track-name`, `track-time`.
- Produces: the running app.

- [ ] **Step 1: Implement ui.js**

```js
// src/ui.js
export class UI {
  constructor({ onFile, onMic, onToggle }) {
    this.controls = document.getElementById('controls');
    this.playBtn = document.getElementById('play-btn');
    this.micBtn = document.getElementById('mic-btn');
    this.nameEl = document.getElementById('track-name');
    this.timeEl = document.getElementById('track-time');
    this.idleEl = document.getElementById('idle-prompt');
    this.hideTimer = null;

    this.playBtn.addEventListener('click', onToggle);
    this.micBtn.addEventListener('click', onMic);
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); onToggle(); }
    });

    addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
    addEventListener('dragleave', () => document.body.classList.remove('dragging'));
    addEventListener('drop', (e) => {
      e.preventDefault();
      document.body.classList.remove('dragging');
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    });

    const poke = () => this._show();
    addEventListener('mousemove', poke);
    addEventListener('touchstart', poke);
    this._show();
  }

  _show() {
    this.controls.classList.remove('hidden');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.controls.classList.add('hidden'), 3000);
  }

  update({ trackName, playing, time, duration, mode }) {
    this.playBtn.textContent = playing ? '❚❚' : '▸';
    this.micBtn.classList.toggle('active', mode === 'mic');
    this.nameEl.textContent = trackName || '—';
    this.idleEl.style.display = mode === 'idle' ? '' : 'none';
    const fmt = (s) => {
      if (!isFinite(s) || s <= 0) return '';
      const m = Math.floor(s / 60);
      return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    };
    this.timeEl.textContent =
      mode === 'file' && duration ? `${fmt(time)} / ${fmt(duration)}` : '';
  }
}
```

- [ ] **Step 2: Implement main.js**

```js
// src/main.js
import { THEME } from './theme.js';
import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { Torus } from './torus.js';
import { Stars } from './layers/stars.js';
import { GridFloor } from './layers/grid.js';
import { Skyline } from './layers/skyline.js';
import { UI } from './ui.js';

const renderer = new Renderer(document.getElementById('view'));
const audio = new AudioEngine();
const torus = new Torus();
const stars = new Stars();
const floor = new GridFloor();
const skyline = new Skyline();

const ui = new UI({
  onFile: (f) => audio.useFile(f).catch(console.error),
  onMic: () => (audio.mode === 'mic' ? audio.stopMic() : audio.useMic().catch(console.error)),
  onToggle: () => audio.togglePlay(),
});

let flash = 0;
let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const a = audio.frame(dt);
  if (a.drop) flash = 1;
  flash = Math.max(0, flash - dt * 3.5);

  torus.update(dt, a);
  stars.update(a, dt);
  floor.update(a, dt);
  skyline.update(a, dt);

  const g = renderer.grid;
  g.clear();
  stars.paint(g, THEME);   // back
  torus.paint(g, a, THEME);
  floor.paint(g, THEME);
  skyline.paint(g, THEME); // front

  renderer.draw(flash, THEME.bg, THEME.accent);
  ui.update({
    trackName: audio.trackName,
    playing: audio.playing,
    time: audio.time,
    duration: audio.duration,
    mode: audio.mode,
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

Note: `GridFloor.paint` uses `theme.accent` for shockwaves — `THEME` is passed whole, so it's available.

- [ ] **Step 3: Run all node tests**

Run: `node --test tests/`
Expected: PASS (all tests from Tasks 1-4)

- [ ] **Step 4: Browser verification (idle state)**

Run: `python3 -m http.server 8642` (from repo root), open `http://localhost:8642`.
Expected: torus spinning slowly with gentle ambient motion, dim stars, grid drifting toward viewer, low skyline ripple, "drop a track or tap MIC" pulsing, control strip fades after 3s and returns on mouse move.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js src/main.js
git commit -m "feat: auto-hide UI and main loop wiring all layers to audio"
```

---

### Task 6: End-to-end verification, README, deploy

**Files:**
- Create: `README.md`
- Modify: anything that fails verification (tuning constants only — mapping gains, drop threshold, densities)

**Interfaces:**
- Consumes: the complete app.
- Produces: verified v1 live on GitHub Pages.

- [ ] **Step 1: Manual verification checklist (spec §Testing)**

With the local server running:
1. Drop a bass-heavy track (any EDM mp3): torus visibly swells on kicks, grid lines flare, drop effects (gold flash + kick-spin + shockwave) fire on big hits — not continuously. If firing continuously, raise `0.28`/`1.45` thresholds in `src/audio.js`; if never, lower them.
2. Drop a quiet acoustic track: motion is visibly calmer; skyline follows the spectrum.
3. Tap MIC, play music on speakers: visualizer reacts; no feedback squeal (mic must not route to output).
4. Pause (spacebar): scene falls back to ambient idle motion; ▸/❚❚ toggles correctly.
5. Resize window: grid rebuilds, no distortion or crash.

- [ ] **Step 2: FPS sanity**

In the browser console while a track plays:

```js
let n = 0, t0 = performance.now();
const raf = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(raf); else console.log('fps', n / 5); };
requestAnimationFrame(raf);
```

Expected: ≥50 fps. If lower: reduce `TARGET_COLS` to 140 in `src/renderer.js`, or drop bloom `blur(6px)` to `blur(4px)`.

- [ ] **Step 3: Write README.md**

```markdown
# ascii-visualizer

Music visualizer in pure colored ASCII — spinning 3D torus, vaporwave grid
floor, starfield, EQ skyline. Sunset-neon palette, subtle CRT.

**Use:** open the page, drop an audio file anywhere (or tap MIC and play music
out loud). Space = pause.

**Stack:** vanilla JS ES modules, Canvas 2D, Web Audio API. No deps, no build.
Run locally: `python3 -m http.server 8642` → http://localhost:8642

Tests: `node --test tests/`

v1 design spec: `docs/superpowers/specs/2026-07-17-ascii-visualizer-v1-design.md`
```

- [ ] **Step 4: Commit and deploy to GitHub Pages**

```bash
git add README.md
git commit -m "docs: README"
gh repo create ascii-visualizer --public --source=. --push
gh api repos/{owner}/ascii-visualizer/pages -X POST -f 'source[branch]=main' -f 'source[path]=/'
```

Expected: repo created under jcoder121, Pages build starts. Verify live URL after ~2 min: `https://jcoder121.github.io/ascii-visualizer/`.

- [ ] **Step 5: Verify live site**

Open the Pages URL, repeat checklist item 1 (file drop) once.
Expected: identical behavior to local.
