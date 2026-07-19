// tests/transition.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { Transition } from '../src/transition.js';

const FROM = { head: '#ff2d95', highlight: '#ffd319' };
const TO = { head: '#00ff41', highlight: '#c8ffd0' };

function mockGrid(cols, rows) {
  const calls = [];
  return { cols, rows, calls, set(x, y, ch, color) { calls.push({ x, y, ch, color }); } };
}

test('glitch wears outgoing palette first, incoming after the midpoint swap', () => {
  const t = new Transition();
  let swapped = false;
  t.start(() => { swapped = true; }, FROM, TO);

  t.update(0.3); // 0.3 / 1.5 — first half
  const g1 = mockGrid(80, 30);
  t.paint(g1);
  assert.ok(g1.calls.length > 0);
  assert.ok(g1.calls.every((c) => c.color === FROM.head || c.color === FROM.highlight));
  assert.ok(!swapped);

  t.update(0.6); // t = 0.9 — past midpoint
  assert.ok(swapped, 'scene swap at midpoint');
  const g2 = mockGrid(80, 30);
  t.paint(g2);
  assert.ok(g2.calls.every((c) => c.color === TO.head || c.color === TO.highlight));

  t.update(0.7); // past DUR
  assert.ok(!t.active);
});
