// tests/cityscape.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { Cityscape } from '../src/layers/cityscape.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) {
    if (x >= 0 && y >= 0 && x < cols && y < rows) calls.push({ x, y, ch, color });
  } };
}

const THEME = {
  bg: '#0d0602', heroA: '#ffb000', heroB: '#ff6a00', city: '#3a1f0a',
  window: '#ffd27a', rainA: '#6b7f8f', rainB: '#274050', beam: '#fff3c4',
  skyline: '#ff8c00', accent: '#54e8ff',
};

const FRAME = {
  bass: 0.5, mids: 0.5, treble: 0.5, level: 0.5,
  spectrum: new Float32Array(64).fill(0.6), drop: false,
};

const rgbSum = (c) => c.match(/\d+/g).reduce((a, n) => a + Number(n), 0);

test('buildings span the full grid width', () => {
  const g = mockGrid(160, 50);
  const c = new Cityscape();
  c.update(FRAME, 0.016);
  c.paint(g, THEME);
  const covered = new Set(g.calls.filter((k) => k.ch === '█').map((k) => k.x));
  assert.equal(covered.size, 160);
});

test('silhouette stays in the lower half', () => {
  const g = mockGrid(160, 50);
  const c = new Cityscape();
  c.update(FRAME, 0.016);
  c.paint(g, THEME);
  assert.ok(g.calls.length > 200);
  assert.ok(g.calls.every((k) => k.y >= Math.floor(50 * 0.5)));
});

test('windows exist and sit inside building columns', () => {
  const g = mockGrid(160, 50);
  const c = new Cityscape();
  c.update(FRAME, 0.016);
  c.paint(g, THEME);
  const windows = g.calls.filter((k) => k.ch === '▪');
  assert.ok(windows.length > 5);
  for (const w of windows) {
    const inside = c.buildings.some((b) => w.x >= b.x && w.x < b.x + b.w && w.y > b.top);
    assert.ok(inside, `window at ${w.x},${w.y} outside every building`);
  }
});

test('windows brighten when loud (level > 0.6)', () => {
  const c = new Cityscape();
  const quiet = mockGrid(160, 50);
  c.update(FRAME, 0.016);
  c.paint(quiet, THEME);
  const loud = mockGrid(160, 50);
  c.update({ ...FRAME, level: 0.95 }, 0); // dt=0 keeps flicker phase identical
  c.paint(loud, THEME);
  const sum = (g) => g.calls.filter((k) => k.ch === '▪').reduce((a, k) => a + rgbSum(k.color), 0);
  assert.ok(sum(loud) > sum(quiet));
});

test('re-inits building profile on grid resize', () => {
  const c = new Cityscape();
  const g1 = mockGrid(160, 50);
  c.update(FRAME, 0.016);
  c.paint(g1, THEME);
  const first = c.buildings;
  c.paint(mockGrid(160, 50), THEME);
  assert.equal(c.buildings, first); // same size → keep profile
  c.paint(mockGrid(80, 30), THEME);
  assert.notEqual(c.buildings, first);
  assert.equal(c.w, 80);
  assert.equal(c.h, 30);
});
