// tests/drizzle.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { Drizzle } from '../src/layers/drizzle.js';

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

test('drizzle spans the width with slanted streaks', () => {
  const g = mockGrid(240, 100); // half-cell subgrid = 2x main grid
  const d = new Drizzle();
  d.update(frame(), 0.05);
  d.paint(g, PAL);
  assert.ok(g.calls.length > 240 / 3 * 0.6, `only ${g.calls.length} cells painted`);
  const xs = new Set(g.calls.map(v => v.x));
  assert.ok(xs.size > 240 * 0.15, `only ${xs.size} distinct columns`);
  assert.ok(g.calls.every(c => c.ch === '/'), 'streak glyph should be /');
});

test('streaks move down (and drift with the wind) over time', () => {
  const d = new Drizzle();
  d._init(120, 80);
  const beforeY = d.drops.map(s => s.y);
  const beforeX = d.drops.map(s => s.x);
  d.update(frame(), 0.05);
  // respawned streaks jump to a fresh random x/y — only survivors show the wind
  const alive = d.drops.map((v, i) => [v, i]).filter(([v, i]) => v.y > beforeY[i]);
  assert.ok(alive.length > 0, 'expected surviving streaks');
  const dx = alive.reduce((s, [v, i]) => s + (v.x - beforeX[i]), 0);
  assert.ok(dx < 0, 'wind should slant streaks leftward');
});

test('louder audio falls faster; head is brighter than tail', () => {
  // same streak state for both levels — independent random speeds made this flaky
  const base = new Drizzle();
  base._init(120, 80);
  const snapshot = base.drops.map(s => ({ ...s, y: 20 }));
  const fallen = (lvl) => {
    const d = new Drizzle();
    d._init(120, 80);
    d.drops = snapshot.map(s => ({ ...s }));
    const before = d.drops.map(s => s.y);
    d.update(frame({ level: lvl }), 0.05);
    return d.drops.reduce((s, v, i) => s + (v.y - before[i]), 0);
  };
  assert.ok(fallen(1) > fallen(0), 'loud should advance more than quiet');

  const g = mockGrid(240, 100);
  const d = new Drizzle();
  d.update(frame(), 0.05);
  d.paint(g, PAL);
  const byX = new Map();
  for (const c of g.calls) (byX.get(c.x) || byX.set(c.x, []).get(c.x)).push(c);
  let checked = 0;
  for (const cells of byX.values()) {
    if (cells.length < 3) continue;
    cells.sort((a, b) => a.y - b.y);
    const head = cells[cells.length - 1]; // lowest = leading edge
    const tail = cells[0];
    assert.ok(bright(head.color) >= bright(tail.color), 'head should be >= tail brightness');
    if (++checked >= 3) break;
  }
  assert.ok(checked > 0, 'no multi-cell streaks to check');
});
