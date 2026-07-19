// src/termpage.js — the simulated terminal running the TUI in a web page.
// Demo audio by default (SimAudio); MIC or a dropped track upgrades to live.
import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { SimAudio } from './simaudio.js';
import { VaporwaveScene } from './scenes/vaporwave.js';
import { MatrixScene } from './scenes/matrix.js';
import { BladeRunnerScene } from './scenes/bladerunner.js';
import { Transition } from './transition.js';

const body = document.getElementById('term-body');
const boot = document.getElementById('boot');
const view = document.getElementById('tview');
const title = document.getElementById('term-title');

const scenes = [new VaporwaveScene(), new MatrixScene(), new BladeRunnerScene()];
const transition = new Transition();
let active = 0;

const sim = new SimAudio();
const engine = new AudioEngine();
let live = false; // false → demo audio

const renderer = new Renderer(view, () => [body.clientWidth, body.clientHeight]);

// --- boot sequence: type the command, then fade the visualizer in
const CMD = 'node tui/run.mjs';
const INFO =
  '\n▶ audio: <span class="act" id="a-demo">demo</span> · ' +
  '<span class="act" id="a-mic">mic</span> · drop a track anywhere\n' +
  '▶ <span class="act" id="a-scene">space / click: next scene</span>\n\n';
let typed = 0;
function type() {
  if (typed <= CMD.length) {
    boot.innerHTML = '<span class="cmd">$ ' + CMD.slice(0, typed) + '▊</span>';
    typed++;
    setTimeout(type, 28 + Math.random() * 55);
  } else {
    boot.innerHTML = '<span class="cmd">$ ' + CMD + '</span>' + INFO;
    view.style.opacity = 1;
    wireActions();
    setTimeout(() => { boot.style.opacity = 0.85; }, 400);
  }
}
type();

function nextScene() {
  if (transition.active) return;
  const next = (active + 1) % scenes.length;
  transition.start(() => { active = next; }, scenes[active].glitch, scenes[next].glitch);
}

function wireActions() {
  document.getElementById('a-demo').addEventListener('click', (e) => {
    e.stopPropagation();
    engine.stopMic();
    live = false;
  });
  document.getElementById('a-mic').addEventListener('click', (e) => {
    e.stopPropagation();
    engine.useMic().then(() => { live = true; }).catch(console.error);
  });
  document.getElementById('a-scene').addEventListener('click', (e) => {
    e.stopPropagation();
    nextScene();
  });
}

addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); nextScene(); }
});
document.getElementById('term').addEventListener('click', () => nextScene());

const term = document.getElementById('term');
addEventListener('dragover', (e) => { e.preventDefault(); term.classList.add('dragging'); });
addEventListener('dragleave', () => term.classList.remove('dragging'));
addEventListener('drop', (e) => {
  e.preventDefault();
  term.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) engine.useFile(f).then(() => { live = true; }).catch(console.error);
});

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const a = live && engine.playing ? engine.frame(dt) : sim.frame(dt);
  const scene = scenes[active];
  scene.update(dt, a);
  transition.update(dt);
  const g = renderer.grid;
  g.clear();
  renderer.sub.clear();
  scene.paint(g, renderer.sub);
  transition.paint(g);
  renderer.draw(scene.flash, scene.bg, scene.accent);
  const src = live && engine.playing
    ? (engine.mode === 'mic' ? 'mic' : engine.trackName) : 'demo';
  title.textContent =
    `jeffrey@lv-426 — node tui/run.mjs — ${g.cols}×${g.rows} — ${scene.name.toLowerCase()} · ${src}`;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
