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
