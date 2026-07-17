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
