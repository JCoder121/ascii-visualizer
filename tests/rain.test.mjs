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
