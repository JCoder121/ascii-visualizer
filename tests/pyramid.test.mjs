// tests/pyramid.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { GlyphPyramid } from '../src/pyramid.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) { calls.push({ x, y, ch, color }); } };
}

const THEME = {
  bg: '#0d0602', heroA: '#ffb000', heroB: '#ff6a00', city: '#3a1f0a',
  window: '#ffd27a', rainA: '#6b7f8f', rainB: '#274050',
  beam: '#fff3c4', skyline: '#ff8c00', accent: '#54e8ff',
};
const FRAME = { bass: 0.3, mids: 0.4, treble: 0, level: 0.4, spectrum: new Float32Array(64), drop: false };
const RAMP = '.:-=+*#%@';

// paint over several full rotations, return the max per-frame bbox seen
function maxBBox(cols, rows, frame = FRAME) {
  const p = new GlyphPyramid();
  let maxW = 0, maxH = 0, minCells = Infinity;
  for (let f = 0; f < 120; f++) {
    p.update(0.05, frame); // 6s of sim at mids 0.4 ≈ 1.4+ revolutions
    const g = mockGrid(cols, rows);
    p.paint(g, frame, THEME);
    const xs = g.calls.map(c => c.x), ys = g.calls.map(c => c.y);
    maxW = Math.max(maxW, Math.max(...xs) - Math.min(...xs) + 1);
    maxH = Math.max(maxH, Math.max(...ys) - Math.min(...ys) + 1);
    minCells = Math.min(minCells, g.calls.length);
  }
  return { maxW, maxH, minCells };
}

test('bbox calibration: hero footprint on a 160x45 grid', () => {
  const { maxW, maxH, minCells } = maxBBox(160, 45);
  assert.ok(maxW >= 50 && maxW <= 58, `width ${maxW} not in 50-58`);
  assert.ok(maxH >= 26 && maxH <= 32, `height ${maxH} not in 26-32`);
  assert.ok(minCells > 500, `expected >500 cells per frame, got ${minCells}`);
});

test('bbox calibration: portrait 157x170 stays within 60-90% of cols', () => {
  const { maxW } = maxBBox(157, 170);
  assert.ok(maxW >= 157 * 0.6 && maxW <= 157 * 0.9, `width ${maxW} not in ${157 * 0.6}-${157 * 0.9}`);
});

test('pyramid paints centered ramp glyphs with varied brightness', () => {
  const g = mockGrid(160, 45);
  const p = new GlyphPyramid();
  p.update(0.016, FRAME);
  p.paint(g, FRAME, THEME);
  assert.ok(g.calls.length > 500, `expected >500 cells, got ${g.calls.length}`);
  const xs = g.calls.map(c => c.x), ys = g.calls.map(c => c.y);
  const cx = xs.reduce((a, b) => a + b) / xs.length;
  const cy = ys.reduce((a, b) => a + b) / ys.length;
  assert.ok(Math.abs(cx - 80) < 12, `centroid x ${cx} not near 80`);
  assert.ok(Math.abs(cy - 45 * 0.44) < 8, `centroid y ${cy} not near ${45 * 0.44}`);
  for (const c of g.calls) assert.ok(RAMP.includes(c.ch), `unexpected glyph ${c.ch}`);
  const glyphs = new Set(g.calls.map(c => c.ch));
  assert.ok(glyphs.size >= 3, `expected >=3 distinct brightness glyphs, got ${glyphs.size}`);
});

test('z-buffer ordering: repaints of a cell only ever get nearer/brighter', () => {
  const g = mockGrid(160, 45);
  const p = new GlyphPyramid();
  p.update(0.016, FRAME);
  p.paint(g, FRAME, THEME);
  // face brightness is monotone in ooz and edges (drawn last) are brightest,
  // so with the z-buffer active a cell's RAMP index must never decrease.
  const last = new Map();
  let repaints = 0;
  for (const c of g.calls) {
    const k = `${c.x},${c.y}`;
    const ri = RAMP.indexOf(c.ch);
    if (last.has(k)) {
      repaints++;
      assert.ok(ri >= last.get(k), `cell ${k} repainted dimmer (${last.get(k)} -> ${ri})`);
    }
    last.set(k, ri);
  }
  assert.ok(repaints > 0, 'expected overlapping faces to exercise the z-buffer');
});

test('rotation changes painted cells over time', () => {
  const p = new GlyphPyramid();
  p.update(0.016, FRAME);
  const g1 = mockGrid(160, 45);
  p.paint(g1, FRAME, THEME);
  for (let i = 0; i < 30; i++) p.update(0.033, FRAME); // ~1s of rotation
  const g2 = mockGrid(160, 45);
  p.paint(g2, FRAME, THEME);
  // last-write-wins per cell, then count cells that appeared, vanished, or changed glyph
  const render = (g) => {
    const m = new Map();
    for (const c of g.calls) m.set(`${c.x},${c.y}`, c.ch);
    return m;
  };
  const r1 = render(g1), r2 = render(g2);
  let diff = 0;
  for (const [k, ch] of r2) if (r1.get(k) !== ch) diff++;
  for (const k of r1.keys()) if (!r2.has(k)) diff++;
  assert.ok(diff > 50, `expected rotation to change the render, only ${diff} cells differ`);
});

test('bass swell grows the footprint', () => {
  const paint = (bass) => {
    const g = mockGrid(160, 45);
    const p = new GlyphPyramid();
    p.paint(g, { ...FRAME, bass }, THEME);
    const xs = g.calls.map(c => c.x);
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(paint(1) > paint(0), 'bass=1 should span wider than bass=0');
});

test('drop gives a brief spin boost', () => {
  const a = new GlyphPyramid(), b = new GlyphPyramid();
  a.update(0.016, { ...FRAME, drop: true });
  b.update(0.016, FRAME);
  assert.ok(a.kickTime > 0, 'drop should set kickTime');
  for (let i = 0; i < 10; i++) {
    a.update(0.033, FRAME);
    b.update(0.033, FRAME);
  }
  assert.ok(a.yaw > b.yaw, `boosted yaw ${a.yaw} should lead unboosted ${b.yaw}`);
});

test('treble sparkle emits brightest ramp glyph', () => {
  const p = new GlyphPyramid();
  p.update(0.016, FRAME);
  let sparkles = 0;
  for (let i = 0; i < 5; i++) {
    const g = mockGrid(160, 45);
    p.paint(g, { ...FRAME, treble: 0.8 }, THEME);
    sparkles += g.calls.filter(c => c.ch === '@').length;
  }
  assert.ok(sparkles > 0, 'expected some @ sparkles at treble 0.8');
  const calm = mockGrid(160, 45);
  p.paint(calm, FRAME, THEME);
  assert.equal(calm.calls.filter(c => c.ch === '@').length, 0, 'no sparkles at treble 0');
});
