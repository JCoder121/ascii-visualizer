// tests/searchlight.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { Searchlight } from '../src/layers/searchlight.js';

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) {
    if (x >= 0 && y >= 0 && x < cols && y < rows) calls.push({ x, y, ch, color });
  } };
}
const PAL = { bg: '#0d0602', heroA: '#ffb000', heroB: '#ff6a00', city: '#3a1f0a',
  window: '#ffd27a', rainA: '#6b7f8f', rainB: '#274050', beam: '#fff3c4',
  skyline: '#ff8c00', accent: '#54e8ff' };
function frame(over) {
  return { bass: 0.3, mids: 0.3, treble: 0.3, level: 0.3,
    spectrum: new Float32Array(64).fill(0.5), drop: false, ...over };
}
// parse 'rgb(r,g,b)' -> brightness sum
function bright(c) { const m = c.match(/\d+/g).map(Number); return m[0] + m[1] + m[2]; }
const maxBright = (g) => g.calls.reduce((m, c) => Math.max(m, bright(c.color)), 0);
const widthAt = (g, y) => new Set(g.calls.filter(c => c.y === y).map(c => c.x)).size;

test('beam paints a cone below the origin only', () => {
  const g = mockGrid(200, 60);
  const s = new Searchlight();
  s.update(frame(), 0.016);
  s.paint(g, PAL);
  const oy = Math.floor(60 * 0.08);
  assert.ok(g.calls.length > 20, 'beam should paint cells');
  assert.ok(g.calls.every(c => c.y > oy && c.y <= 59), 'all cells below origin, on screen');
  assert.ok(g.calls.every(c => c.ch === '░' || c.ch === '▒'), 'shade glyphs only');
  // cone: wider far from the origin than near it
  assert.ok(widthAt(g, 50) > widthAt(g, oy + 3), 'cone should widen with distance');
});

test('drop triggers a wider, brighter sweep that decays', () => {
  const s = new Searchlight();
  s.update(frame(), 0.016);
  const idle = mockGrid(200, 60);
  s.paint(idle, PAL);

  s.update(frame({ drop: true }), 0.016);
  const dropG = mockGrid(200, 60);
  s.paint(dropG, PAL);
  assert.ok(maxBright(dropG) > maxBright(idle) * 1.5, 'drop sweep should be much brighter');
  const y = Math.floor(60 * 0.08) + 16;
  assert.ok(widthAt(dropG, y) > widthAt(idle, y), 'drop sweep should be wider');

  // decays back to idle after the ~0.9s sweep window
  for (let i = 0; i < 80; i++) s.update(frame(), 0.016);
  assert.equal(s.sweepTime, 0);
  const after = mockGrid(200, 60);
  s.paint(after, PAL);
  assert.ok(maxBright(after) < maxBright(dropG), 'brightness should decay after the sweep');
});
