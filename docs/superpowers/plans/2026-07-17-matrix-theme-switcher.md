# Matrix Theme + Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Matrix scene (rotating glyph cube + digital rain, phosphor-green) and a bottom-right cycle button that swaps between it and the existing Vaporwave scene, with a brief glitch transition. Vaporwave stays the default.

**Architecture:** Introduce a uniform `Scene` interface (`update(dt,a)`, `paint(grid)`, `bg`, `accent`, `flash`). Two scenes bundle their own hero + layers + palette. `main.js` becomes a thin registry + switch + transition. Audio engine, renderer, and all v1 layer/torus modules are unchanged.

**Tech Stack:** vanilla JS ES modules, Canvas 2D, Web Audio API, `node --test`.

**Spec:** `docs/superpowers/specs/2026-07-17-matrix-theme-switcher-design.md`

## Global Constraints

- Vaporwave palette (exact, renamed from v1 `THEME`): bg `#0a0118`, heroA `#ff2d95`, heroB `#00e5ff`, grid `#b64fff`, skyline `#00b3a4`, stars `#8a7aa8`, accent `#ffd319`.
- Matrix palette (exact): bg `#020806`, head `#00ff41`, trail `#008f11`, highlight `#c8ffd0`, accent `#eaffea`.
- Matrix glyph set (exact): `ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>`
- Load default = Vaporwave (index 0). No persistence in v2.
- Matrix scene ignores `audioFrame.drop`; its `flash` is always 0. Vaporwave keeps v1 drop→flash.
- Transition ≈ 0.4s, scene swap at midpoint (~0.2s).
- `node --test 'tests/*.test.mjs'` must stay fully green (existing 12 + new tests).
- No new dependencies, no build step.

## Shared Interfaces

```js
// theme.js  (RAMP, lerpColor, dim unchanged from v1)
export const VAPORWAVE = { bg, heroA, heroB, grid, skyline, stars, accent }
export const MATRIX    = { bg, head, trail, highlight, accent }
export const RAMP = '.:-=+*#%@'
export function lerpColor(aHex, bHex, t)  // quantized rgb() string
export function dim(hex, k)               // quantized rgb() string

// cube.js
export const MATRIX_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>'
export class GlyphCube { constructor(); update(dt, audioFrame); paint(grid, palette); kick() }
// paint reads palette.head/.trail/.highlight; uses this.A/.B/.dA/.dB rotation state

// layers/rain.js
export class DigitalRain { update(audioFrame, dt); paint(grid, palette) }
// paint reads palette.head/.trail/.highlight/.bg

// scenes/vaporwave.js
export class VaporwaveScene { name; bg; accent; get flash(); update(dt, audioFrame); paint(grid) }
// scenes/matrix.js
export class MatrixScene   { name; bg; accent; get flash(); update(dt, audioFrame); paint(grid) }

// transition.js
export class Transition { active; start(onMidpointSwap); update(dt); paint(grid, palette) }

// ui.js  (extended)
// constructor cb gains onCycleTheme(); update() payload gains themeName
```

Scenes/cube/rain receive a `grid` object `{cols, rows, set(x,y,ch,color)}` and never import the renderer. Cube and rain (Tasks 1 & 2) are independent → **parallel subagents**. Task 3 (theme refactor + transition) is small/inline. Task 4 integrates scenes + ui + main. Task 5 verifies + deploys.

---

### Task 1: GlyphCube hero

**Files:**
- Create: `src/cube.js`, `tests/cube.test.mjs`

**Interfaces:**
- Consumes: `dim`, `lerpColor` from `./theme.js`; a `grid` `{cols, rows, set()}`; `audioFrame` `{bass, mids, treble}`; a `palette` with `head`, `trail`, `highlight`.
- Produces: `MATRIX_GLYPHS` string and `GlyphCube` class exactly as in Shared Interfaces.

- [ ] **Step 1: Write failing test**

```js
// tests/cube.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { GlyphCube, MATRIX_GLYPHS } from '../src/cube.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) {
    if (x >= 0 && y >= 0 && x < cols && y < rows) calls.push({ x, y, ch, color });
  } };
}
const PAL = { head: '#00ff41', trail: '#008f11', highlight: '#c8ffd0' };
const FRAME = { bass: 0.3, mids: 0.4, treble: 0.2 };

test('cube paints a bounded centered footprint of known glyphs', () => {
  const g = mockGrid(160, 50);
  const c = new GlyphCube();
  c.update(0.016, FRAME);
  c.paint(g, PAL);
  assert.ok(g.calls.length > 100, `expected >100 cells, got ${g.calls.length}`);
  const xs = g.calls.map(v => v.x), ys = g.calls.map(v => v.y);
  const cx = xs.reduce((a, b) => a + b) / xs.length;
  assert.ok(Math.abs(cx - 80) < 18, `centroid x ${cx} not near 80`);
  const cyExpect = 50 * 0.42;
  const cy = ys.reduce((a, b) => a + b) / ys.length;
  assert.ok(Math.abs(cy - cyExpect) < 12, `centroid y ${cy} not near ${cyExpect}`);
  for (const v of g.calls) assert.ok(MATRIX_GLYPHS.includes(v.ch) || '.:-=+*#%@|/\\'.includes(v.ch));
});

test('bass swell grows the cube footprint', () => {
  const span = (bass) => {
    const g = mockGrid(160, 50);
    const c = new GlyphCube();
    c.update(0.016, { bass, mids: 0, treble: 0 });
    c.paint(g, PAL);
    const xs = g.calls.map(v => v.x);
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(span(1) > span(0), 'bass=1 should span wider than bass=0');
});

test('kick changes rotation state', () => {
  const c = new GlyphCube();
  const before = [c.A, c.B, c.dA, c.dB].join(',');
  c.kick();
  assert.notEqual([c.A, c.B, c.dA, c.dB].join(','), before);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cube.test.mjs`
Expected: FAIL (cannot find module `../src/cube.js`)

- [ ] **Step 3: Implement cube.js**

Wireframe cube: 8 vertices, 12 edges. Rotate by A (around X) and B (around Y), perspective-project with the torus's constants (cell aspect 1.9 → y ×0.53). Draw each edge by interpolating grid cells between its projected endpoints; place a glyph per cell. Fill: also scatter interior cascade glyphs by sampling points on cube faces. Vertical brightness gradient trail→head; treble scatters `highlight` glyphs. Bass scales the cube (`size`).

```js
// src/cube.js
import { dim, lerpColor } from './theme.js';

export const MATRIX_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';

// unit cube corners
const V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];
// 6 faces as [v0,v1,v2,v3] for interior glyph sampling
const FACES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
  [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4],
];

function glyphAt(seed) {
  // deterministic-ish glyph pick from a float seed
  const i = Math.abs(Math.floor(seed * 97)) % MATRIX_GLYPHS.length;
  return MATRIX_GLYPHS[i];
}

export class GlyphCube {
  constructor() {
    this.A = 0.6;
    this.B = 0.9;
    this.dA = 0.5;
    this.dB = 0.7;
    this.kickTime = 0;
    this.cascade = 0; // downward scroll phase
  }

  kick() {
    this.A += (Math.random() - 0.5) * 2.5;
    this.B += (Math.random() - 0.5) * 2.5;
    this.dA = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8);
    this.dB = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8);
    this.kickTime = 0.5;
  }

  update(dt, { bass, mids, treble }) {
    this.kickTime = Math.max(0, this.kickTime - dt);
    const boost = 1 + (this.kickTime > 0 ? 2 * (this.kickTime / 0.5) : 0);
    const speed = (0.4 + mids * 2.0) * boost;
    this.A += this.dA * speed * dt;
    this.B += this.dB * speed * dt;
    this.cascade = (this.cascade + dt * (1 + mids * 3)) % 1;
    this._bass = bass;
    this._treble = treble;
    this._t = (this._t || 0) + dt;
  }

  _project(v, cols, rows) {
    const cA = Math.cos(this.A), sA = Math.sin(this.A);
    const cB = Math.cos(this.B), sB = Math.sin(this.B);
    let [x, y, z] = v;
    // rotate X
    let y1 = y * cA - z * sA, z1 = y * sA + z * cA;
    // rotate Y
    let x2 = x * cB + z1 * sB, z2 = -x * sB + z1 * cB;
    const size = 1 + (this._bass || 0) * 0.5;
    const K2 = 5, dist = 5;
    const zc = dist + z2 * size;
    const ooz = 1 / zc;
    const K1 = rows * 1.9 * 0.32 * K2;
    const cx = cols / 2, cy = rows * 0.42;
    return {
      x: Math.round(cx + K1 * ooz * x2 * size),
      y: Math.round(cy - K1 * 0.53 * ooz * y1 * size),
      ooz,
    };
  }

  paint(grid, palette) {
    const { cols, rows } = grid;
    const pts = V.map((v) => this._project(v, cols, rows));

    // interior cascade glyphs sampled across each face
    for (let fi = 0; fi < FACES.length; fi++) {
      const [a, b, c, d] = FACES[fi];
      for (let u = 0.1; u < 0.95; u += 0.16) {
        for (let w = 0.1; w < 0.95; w += 0.12) {
          // bilinear on projected face corners
          const top = { x: pts[a].x + (pts[b].x - pts[a].x) * u, y: pts[a].y + (pts[b].y - pts[a].y) * u };
          const bot = { x: pts[d].x + (pts[c].x - pts[d].x) * u, y: pts[d].y + (pts[c].y - pts[d].y) * u };
          const wc = (w + this.cascade) % 1;
          const px = Math.round(top.x + (bot.x - top.x) * wc);
          const py = Math.round(top.y + (bot.y - top.y) * wc);
          const bright = 0.3 + wc * 0.5 + (this._bass || 0) * 0.2;
          const col = lerpColor(palette.trail, palette.head, Math.min(1, bright));
          grid.set(px, py, glyphAt(u * 7 + w * 13 + fi + this.cascade), col);
        }
      }
    }

    // edges (brightest, drawn last)
    for (const [i, j] of EDGES) {
      const p0 = pts[i], p1 = pts[j];
      const steps = Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y), 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = Math.round(p0.x + (p1.x - p0.x) * t);
        const y = Math.round(p0.y + (p1.y - p0.y) * t);
        const sparkle = this._treble > 0.25 && Math.random() < this._treble * 0.08;
        grid.set(x, y, glyphAt(t * 11 + i + this._t), sparkle ? palette.highlight : palette.head);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cube.test.mjs`
Expected: PASS (3 tests). If the centroid assertion fails, recheck projection signs — do not loosen the test.

- [ ] **Step 5: Commit**

```bash
git add src/cube.js tests/cube.test.mjs
git commit -m "feat: matrix glyph cube hero — wireframe edges + cascading face glyphs"
```

---

### Task 2: DigitalRain background

**Files:**
- Create: `src/layers/rain.js`, `tests/rain.test.mjs`

**Interfaces:**
- Consumes: `dim`, `lerpColor` from `../theme.js` (rain lives in `src/layers/`); grid `{cols, rows, set()}`; `audioFrame` `{bass, mids, treble, level, spectrum}`; palette `{head, trail, highlight, bg}`.
- Produces: `DigitalRain` class. `paint` must render a column's head cell brighter than its trail cells, and heads must advance further per `update` when `level`/`mids` is high.

- [ ] **Step 1: Write failing test**

```js
// tests/rain.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { DigitalRain } from '../src/layers/rain.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) {
    if (x >= 0 && y >= 0 && x < cols && y < rows) calls.push({ x, y, ch, color });
  } };
}
const PAL = { head: '#00ff41', trail: '#008f11', highlight: '#c8ffd0', bg: '#020806' };
function frame(over) {
  return { bass: 0.3, mids: 0.3, treble: 0.3, level: 0.3,
    spectrum: new Float32Array(64).fill(0.7), ...over };
}
// parse 'rgb(r,g,b)' -> brightness sum
function bright(c) { const m = c.match(/\d+/g).map(Number); return m[0] + m[1] + m[2]; }

test('rain spans the full width', () => {
  const g = mockGrid(120, 50);
  const r = new DigitalRain();
  r.update(frame(), 0.05);
  r.paint(g, PAL);
  const xs = new Set(g.calls.map(v => v.x));
  assert.ok(xs.size > 120 * 0.5, `only ${xs.size} columns active`);
});

test('column head is brighter than its trail', () => {
  const g = mockGrid(60, 40);
  const r = new DigitalRain();
  // advance a few frames so trails exist
  for (let i = 0; i < 5; i++) r.update(frame(), 0.05);
  r.paint(g, PAL);
  // pick a column that has >=3 cells; compare topmost-drawn head vs a lower trail cell
  const byCol = new Map();
  for (const c of g.calls) { (byCol.get(c.x) || byCol.set(c.x, []).get(c.x)).push(c); }
  let checked = 0;
  for (const cells of byCol.values()) {
    if (cells.length < 3) continue;
    cells.sort((a, b) => a.y - b.y);
    const head = cells[cells.length - 1]; // lowest = leading edge
    const trail = cells[0];
    assert.ok(bright(head.color) >= bright(trail.color), 'head should be >= trail brightness');
    if (++checked >= 3) break;
  }
  assert.ok(checked > 0, 'no multi-cell columns to check');
});

test('higher energy advances heads further per update', () => {
  const headPositions = (lvl) => {
    const r = new DigitalRain();
    r._init(80, 50);
    const before = r.cols.map(c => c.y);
    r.update(frame({ level: lvl, mids: lvl }), 0.05);
    const after = r.cols.map(c => c.y);
    return after.reduce((s, y, i) => s + (y - before[i]), 0);
  };
  assert.ok(headPositions(0.9) > headPositions(0.1), 'loud advances more than quiet');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/rain.test.mjs`
Expected: FAIL (cannot find module `../src/layers/rain.js`)

- [ ] **Step 3: Implement rain.js**

```js
// src/layers/rain.js
import { dim, lerpColor } from '../theme.js';

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';
const g = (seed) => GLYPHS[Math.abs(Math.floor(seed * 131)) % GLYPHS.length];

export class DigitalRain {
  constructor() {
    this.cols = null;
    this.w = 0;
    this.h = 0;
  }

  _init(cols, rows) {
    this.w = cols;
    this.h = rows;
    this.cols = Array.from({ length: cols }, () => ({
      y: Math.random() * rows,
      speed: 8 + Math.random() * 22,   // cells/sec baseline
      len: 6 + Math.floor(Math.random() * 14),
      seed: Math.random() * 1000,
    }));
  }

  update(audio, dt) {
    if (!this.cols || this.w === 0) this._init(this.w || 1, this.h || 1);
    const mult = 0.6 + (audio.mids + audio.level) * 2.2;
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      c.y += c.speed * mult * dt;
      if (c.y - c.len > this.h) {
        c.y = -Math.random() * 10;
        c.len = 6 + Math.floor(Math.random() * 14);
        c.speed = 8 + Math.random() * 22;
      }
    }
    this.bass = audio.bass;
    this.treble = audio.treble;
    this.spectrum = audio.spectrum;
  }

  paint(grid, palette) {
    if (!this.cols || this.w !== grid.cols || this.h !== grid.rows) this._init(grid.cols, grid.rows);
    const surge = 0.75 + (this.bass || 0) * 0.35;
    for (let x = 0; x < grid.cols; x++) {
      const c = this.cols[x];
      const active = this.spectrum ? this.spectrum[Math.floor((x / grid.cols) * this.spectrum.length)] : 0.5;
      const len = Math.max(3, Math.floor(c.len * (0.4 + active)));
      const headY = Math.floor(c.y);
      for (let k = 0; k < len; k++) {
        const y = headY - k;
        if (y < 0 || y >= grid.rows) continue;
        const f = 1 - k / len; // 1 at head → 0 at tail
        let color;
        if (k === 0) color = palette.highlight;
        else color = lerpColor(palette.trail, palette.head, Math.min(1, f * surge));
        const sparkle = this.treble > 0.3 && k > 0 && Math.random() < this.treble * 0.05;
        grid.set(x, y, g(c.seed + y * 0.7 + k), sparkle ? palette.highlight : color);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/rain.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/layers/rain.js tests/rain.test.mjs
git commit -m "feat: digital rain background — falling glyph columns, energy-driven fall + density"
```

---

### Task 3: Theme palette refactor + Transition

**Files:**
- Modify: `src/theme.js`
- Create: `src/transition.js`
- Test: extend `tests/theme.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `VAPORWAVE`, `MATRIX` palette exports (spec values); `RAMP`/`lerpColor`/`dim` unchanged; `Transition` class per Shared Interfaces.

- [ ] **Step 1: Update theme test for both palettes**

Replace the `'palette matches spec'` test in `tests/theme.test.mjs` and update the import line to `import { VAPORWAVE, MATRIX, RAMP, lerpColor, dim } from '../src/theme.js';`:

```js
test('vaporwave palette matches spec', () => {
  assert.equal(VAPORWAVE.bg, '#0a0118');
  assert.equal(VAPORWAVE.heroA, '#ff2d95');
  assert.equal(VAPORWAVE.heroB, '#00e5ff');
  assert.equal(VAPORWAVE.grid, '#b64fff');
  assert.equal(VAPORWAVE.skyline, '#00b3a4');
  assert.equal(VAPORWAVE.stars, '#8a7aa8');
  assert.equal(VAPORWAVE.accent, '#ffd319');
  assert.equal(RAMP, '.:-=+*#%@');
});

test('matrix palette matches spec', () => {
  assert.equal(MATRIX.bg, '#020806');
  assert.equal(MATRIX.head, '#00ff41');
  assert.equal(MATRIX.trail, '#008f11');
  assert.equal(MATRIX.highlight, '#c8ffd0');
  assert.equal(MATRIX.accent, '#eaffea');
});
```

(Keep the existing `lerpColor` and `dim` tests unchanged.)

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/theme.test.mjs`
Expected: FAIL (VAPORWAVE/MATRIX undefined)

- [ ] **Step 3: Refactor theme.js**

Rename the exported `THEME` object to `VAPORWAVE` and add `MATRIX`; keep `RAMP`, `hexToRgb`, `clamp01`, `lerpColor`, `dim` exactly as they are.

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

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/theme.test.mjs`
Expected: PASS

- [ ] **Step 5: Implement transition.js**

```js
// src/transition.js
const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';
const DUR = 0.4;

export class Transition {
  constructor() {
    this.active = false;
    this.t = 0;
    this._swapped = false;
    this._onSwap = null;
  }

  start(onMidpointSwap) {
    this.active = true;
    this.t = 0;
    this._swapped = false;
    this._onSwap = onMidpointSwap;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (!this._swapped && this.t >= DUR / 2) {
      this._swapped = true;
      if (this._onSwap) this._onSwap();
    }
    if (this.t >= DUR) this.active = false;
  }

  paint(grid, palette) {
    if (!this.active) return;
    const p = this.t / DUR;            // 0..1
    const coverage = Math.sin(p * Math.PI) * 0.5; // peaks 0.5 at midpoint
    const n = Math.floor(grid.cols * grid.rows * coverage);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(Math.random() * grid.cols);
      const y = Math.floor(Math.random() * grid.rows);
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      grid.set(x, y, ch, Math.random() < 0.3 ? palette.highlight : palette.head);
    }
  }
}
```

- [ ] **Step 6: Run full suite**

Run: `node --test 'tests/*.test.mjs'`
Expected: PASS (theme updated; cube/rain if already merged; existing torus/audio/layers green)

- [ ] **Step 7: Commit**

```bash
git add src/theme.js src/transition.js tests/theme.test.mjs
git commit -m "feat: split palettes into VAPORWAVE + MATRIX, add glitch Transition"
```

---

### Task 4: Scenes + UI switcher + main integration

**Files:**
- Create: `src/scenes/vaporwave.js`, `src/scenes/matrix.js`
- Modify: `src/ui.js`, `src/main.js`, `index.html`, `style.css`

**Interfaces:**
- Consumes: everything from Tasks 1-3 plus v1 modules (`Torus`, `Stars`, `GridFloor`, `Skyline`).
- Produces: running two-scene app with switcher.

- [ ] **Step 1: Implement scenes/vaporwave.js**

```js
// src/scenes/vaporwave.js
import { VAPORWAVE } from '../theme.js';
import { Torus } from '../torus.js';
import { Stars } from '../layers/stars.js';
import { GridFloor } from '../layers/grid.js';
import { Skyline } from '../layers/skyline.js';

export class VaporwaveScene {
  constructor() {
    this.name = 'VAPORWAVE';
    this.bg = VAPORWAVE.bg;
    this.accent = VAPORWAVE.accent;
    this.torus = new Torus();
    this.stars = new Stars();
    this.floor = new GridFloor();
    this.skyline = new Skyline();
    this._flash = 0;
  }
  get flash() { return this._flash; }
  update(dt, a) {
    if (a.drop) this._flash = 1;
    this._flash = Math.max(0, this._flash - dt * 3.5);
    this.torus.update(dt, a);
    this.stars.update(a, dt);
    this.floor.update(a, dt);
    this.skyline.update(a, dt);
  }
  paint(grid) {
    this.stars.paint(grid, VAPORWAVE);
    this.torus.paint(grid, this._lastA || { bass: 0, treble: 0 }, VAPORWAVE);
    this.floor.paint(grid, VAPORWAVE);
    this.skyline.paint(grid, VAPORWAVE);
  }
}
```

Note: `Torus.paint(grid, audioFrame, theme)` needs the audio frame. Capture it in `update` and reuse in `paint`:

Replace the class body's `update`/`paint` to stash the frame:

```js
  update(dt, a) {
    this._a = a;
    if (a.drop) this._flash = 1;
    this._flash = Math.max(0, this._flash - dt * 3.5);
    this.torus.update(dt, a);
    this.stars.update(a, dt);
    this.floor.update(a, dt);
    this.skyline.update(a, dt);
  }
  paint(grid) {
    const a = this._a || { bass: 0, treble: 0 };
    this.stars.paint(grid, VAPORWAVE);
    this.torus.paint(grid, a, VAPORWAVE);
    this.floor.paint(grid, VAPORWAVE);
    this.skyline.paint(grid, VAPORWAVE);
  }
```

(Use this second version; delete the `_lastA` placeholder above.)

- [ ] **Step 2: Implement scenes/matrix.js**

```js
// src/scenes/matrix.js
import { MATRIX } from '../theme.js';
import { GlyphCube } from '../cube.js';
import { DigitalRain } from '../layers/rain.js';

export class MatrixScene {
  constructor() {
    this.name = 'MATRIX';
    this.bg = MATRIX.bg;
    this.accent = MATRIX.accent;
    this.cube = new GlyphCube();
    this.rain = new DigitalRain();
  }
  get flash() { return 0; } // no discrete drop events
  update(dt, a) {
    this.cube.update(dt, a);
    this.rain.update(a, dt);
  }
  paint(grid) {
    this.rain.paint(grid, MATRIX); // back
    this.cube.paint(grid, MATRIX); // front
  }
}
```

- [ ] **Step 3: Update index.html — add theme button**

Add inside `#controls`, after `#track-time`:

```html
    <button id="theme-btn" title="switch visualizer">◈ VAPORWAVE</button>
```

- [ ] **Step 4: Update style.css — theme button**

Append:

```css
#theme-btn {
  background: none; border: 1px solid #00b3a4; color: #00b3a4;
  font: inherit; padding: 2px 10px; cursor: pointer; letter-spacing: 0.15em;
}
#theme-btn:hover { border-color: #00ff41; color: #00ff41; }
```

- [ ] **Step 5: Update ui.js — cycle callback + label**

In the `UI` constructor destructure add `onCycleTheme`; grab the button and wire it:

```js
    this.themeBtn = document.getElementById('theme-btn');
    this.themeBtn.addEventListener('click', (e) => { e.stopPropagation(); onCycleTheme(); });
```

In `update(...)` add a `themeName` param and set the label:

```js
  update({ trackName, playing, time, duration, mode, themeName }) {
    // ...existing lines...
    if (themeName) this.themeBtn.textContent = `◈ ${themeName}`;
  }
```

- [ ] **Step 6: Rewrite main.js — scene registry + switch + transition**

```js
// src/main.js
import { MATRIX } from './theme.js';
import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { VaporwaveScene } from './scenes/vaporwave.js';
import { MatrixScene } from './scenes/matrix.js';
import { Transition } from './transition.js';
import { UI } from './ui.js';

const renderer = new Renderer(document.getElementById('view'));
const audio = new AudioEngine();
const scenes = [new VaporwaveScene(), new MatrixScene()];
const transition = new Transition();
let active = 0;

const ui = new UI({
  onFile: (f) => audio.useFile(f).catch(console.error),
  onMic: () => (audio.mode === 'mic' ? audio.stopMic() : audio.useMic().catch(console.error)),
  onToggle: () => audio.togglePlay(),
  onCycleTheme: () => {
    if (transition.active) return;
    const next = (active + 1) % scenes.length;
    transition.start(() => { active = next; });
  },
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const a = audio.frame(dt);
  const scene = scenes[active];
  scene.update(dt, a);
  transition.update(dt);

  const g = renderer.grid;
  g.clear();
  scene.paint(g);
  transition.paint(g, MATRIX);
  renderer.draw(scene.flash, scene.bg, scene.accent);

  ui.update({
    trackName: audio.trackName,
    playing: audio.playing,
    time: audio.time,
    duration: audio.duration,
    mode: audio.mode,
    themeName: scenes[active].name,
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 7: Run full test suite**

Run: `node --test 'tests/*.test.mjs'`
Expected: PASS (all: theme, torus, audio, layers, cube, rain)

- [ ] **Step 8: Commit**

```bash
git add src/scenes src/ui.js src/main.js index.html style.css
git commit -m "feat: scene registry, matrix/vaporwave scenes, theme switcher + glitch transition"
```

---

### Task 5: Browser verification + deploy

**Files:**
- Modify: only tuning constants if verification requires it.

- [ ] **Step 1: Serve and verify Vaporwave default**

Run: `python3 -m http.server 8642` (repo root), open `http://localhost:8642`.
Expected: loads on Vaporwave exactly as v1 (torus, grid, stars, skyline). Button reads `◈ VAPORWAVE`.

- [ ] **Step 2: Verify switch + Matrix scene**

Click the theme button.
Expected: ~0.4s green glitch static, then Matrix scene — rotating green glyph cube center, digital rain falling full-width, phosphor-green palette, dark bg. Button reads `◈ MATRIX`. Click again → glitch → back to Vaporwave.

- [ ] **Step 3: Verify audio continuity + reactivity**

Drop an audio file, let it play, then switch themes.
Expected: audio keeps playing across the switch; in Matrix, cube pulses/spins and rain speeds/brightens with the music. Mic path still works in both.

- [ ] **Step 4: FPS + resize**

Console FPS probe (from v1) while Matrix plays: expect ≥50fps. If lower, reduce cube face-sample density (`u`/`w` steps in `cube.js`) or rain trail length. Resize the window: both scenes rebuild cleanly (cube recenters, rain refills width).

- [ ] **Step 5: Update README**

Add a line under **Use:**

```markdown
Switch visualizers with the ◈ button (bottom-right): Vaporwave (default) ⇆ Matrix.
```

- [ ] **Step 6: Commit + deploy**

```bash
git add README.md
git commit -m "docs: note theme switcher in README"
git push
```

Expected: existing GitHub Pages site (`https://jcoder121.github.io/ascii-visualizer/`) rebuilds. Wait ~1-2 min.

- [ ] **Step 7: Verify live**

Open the Pages URL; confirm default Vaporwave, switch to Matrix works, audio file drop reacts.
Expected: identical to local.
