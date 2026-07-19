#!/usr/bin/env node
// tui/run.mjs — the visualizer in your actual terminal.
//   node tui/run.mjs [--scene vaporwave|matrix|bladerunner] [--fps 30]
// space = next scene · q / ctrl-c = quit
import { CellGrid } from '../src/renderer.js';
import { SimAudio } from '../src/simaudio.js';
import { VaporwaveScene } from '../src/scenes/vaporwave.js';
import { MatrixScene } from '../src/scenes/matrix.js';
import { BladeRunnerScene } from '../src/scenes/bladerunner.js';
import { gridToAnsi } from './ansi.mjs';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};

const scenes = [new VaporwaveScene(), new MatrixScene(), new BladeRunnerScene()];
let active = Math.max(0, scenes.findIndex(
  (s) => s.name.toLowerCase().replace(/\s/g, '') === opt('scene', 'vaporwave')));
const fps = Math.min(60, Math.max(5, Number(opt('fps', 30))));

const audio = new SimAudio();
let grid = null;

function fit() {
  const cols = process.stdout.columns || 100;
  const rows = (process.stdout.rows || 32) - 1; // spare the status line
  if (!grid || grid.cols !== cols || grid.rows !== rows) grid = new CellGrid(cols, rows);
}

const out = process.stdout;
out.write('\x1b[?1049h\x1b[?25l'); // alt screen, hide cursor
function cleanup() {
  out.write('\x1b[0m\x1b[?25h\x1b[?1049l');
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', (b) => {
    const k = b.toString();
    if (k === 'q' || k === '\x03') cleanup();
    if (k === ' ') active = (active + 1) % scenes.length;
  });
}
process.stdout.on('resize', fit);

let last = performance.now();
setInterval(() => {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  fit();
  const a = audio.frame(dt);
  const scene = scenes[active];
  scene.update(dt, a);
  grid.clear();
  scene.paint(grid); // no subgrid in a terminal: fine layers land on the main grid
  out.write(gridToAnsi(grid));
  out.write(`\n\x1b[0m\x1b[2m ${scene.name} · space: next scene · q: quit\x1b[0m\x1b[K`);
}, 1000 / fps);
