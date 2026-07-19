// tests/bladerunner.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { BladeRunnerScene } from '../src/scenes/bladerunner.js';
import { BLADERUNNER } from '../src/theme.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) {
    if (x >= 0 && y >= 0 && x < cols && y < rows) calls.push({ x, y, ch, color });
  } };
}
function frame(over) {
  return { bass: 0.3, mids: 0.3, treble: 0.3, level: 0.3,
    spectrum: new Float32Array(64).fill(0.5), drop: false, ...over };
}

test('scene constructs with the right identity', () => {
  const s = new BladeRunnerScene();
  assert.equal(s.name, 'BLADE RUNNER');
  assert.equal(s.bg, BLADERUNNER.bg);
  assert.equal(s.accent, BLADERUNNER.accent);
  assert.equal(s.flash, 0);
});

test('update + paint fills both main grid and subgrid', () => {
  const s = new BladeRunnerScene();
  const g = mockGrid(160, 45);
  const sub = mockGrid(320, 90);
  s.update(0.016, frame());
  s.paint(g, sub);
  assert.ok(g.calls.length > 100, 'main grid should get many cells');
  assert.ok(sub.calls.length > 0, 'subgrid should get drizzle cells');
});

test('paint falls back to the main grid when no subgrid given', () => {
  const s = new BladeRunnerScene();
  const g = mockGrid(160, 45);
  s.update(0.016, frame());
  s.paint(g);
  assert.ok(g.calls.length > 100);
  assert.ok(g.calls.some((c) => c.ch === '/'), 'drizzle should land on the main grid');
});

test('drop sets flash to ~1 and it decays with dt*3.5', () => {
  const s = new BladeRunnerScene();
  s.update(0.016, frame({ drop: true }));
  assert.ok(s.flash > 0.9, 'flash should jump on drop');
  const before = s.flash;
  s.update(0.1, frame());
  assert.ok(Math.abs(s.flash - (before - 0.1 * 3.5)) < 1e-9, 'flash decays at dt*3.5');
  for (let i = 0; i < 60; i++) s.update(0.05, frame());
  assert.equal(s.flash, 0, 'flash bottoms out at 0');
});
