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
