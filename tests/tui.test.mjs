// tests/tui.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { CellGrid } from '../src/renderer.js';
import { SimAudio } from '../src/simaudio.js';
import { gridToAnsi, fgCode } from '../tui/ansi.mjs';
import { VaporwaveScene } from '../src/scenes/vaporwave.js';
import { MatrixScene } from '../src/scenes/matrix.js';
import { BladeRunnerScene } from '../src/scenes/bladerunner.js';

test('SimAudio frames stay in range and drops eventually fire', () => {
  const sim = new SimAudio(120);
  let drops = 0;
  for (let i = 0; i < 60 * 40; i++) { // 40 simulated seconds
    const f = sim.frame(1 / 60);
    for (const k of ['bass', 'mids', 'treble', 'level']) {
      assert.ok(f[k] >= 0 && f[k] <= 1, `${k}=${f[k]}`);
    }
    if (f.drop) drops++;
  }
  assert.ok(drops >= 1, `expected at least one drop, got ${drops}`);
});

test('fgCode handles hex and rgb() colors', () => {
  assert.strictEqual(fgCode('#ff8000'), '\x1b[38;2;255;128;0m');
  assert.strictEqual(fgCode('rgb(1,2,3)'), '\x1b[38;2;1;2;3m');
});

test('gridToAnsi renders frame with colors and newlines', () => {
  const g = new CellGrid(4, 2);
  g.set(0, 0, 'A', '#ff0000');
  g.set(1, 0, 'B', '#ff0000'); // same color: escape emitted once
  g.set(0, 1, 'C', '#00ff00');
  const s = gridToAnsi(g);
  assert.ok(s.startsWith('\x1b[H'));
  assert.ok(s.endsWith('\x1b[0m'));
  assert.strictEqual(s.split('\n').length, 2);
  assert.strictEqual(s.split('\x1b[38;2;255;0;0m').length, 2, 'red escape once');
  assert.ok(s.includes('AB'));
});

test('all three scenes render to a terminal-shaped grid via SimAudio', () => {
  const sim = new SimAudio();
  for (const scene of [new VaporwaveScene(), new MatrixScene(), new BladeRunnerScene()]) {
    const g = new CellGrid(100, 30);
    for (let i = 0; i < 30; i++) scene.update(1 / 30, sim.frame(1 / 30));
    g.clear();
    scene.paint(g); // no subgrid, like the TUI
    const painted = g.ch.filter((c) => c !== ' ').length;
    assert.ok(painted > 100, `${scene.name} painted ${painted}`);
    const frame = gridToAnsi(g);
    assert.ok(frame.length > 500);
  }
});
