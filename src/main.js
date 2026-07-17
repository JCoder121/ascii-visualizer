import { THEME } from './theme.js';
import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { Torus } from './torus.js';
import { Stars } from './layers/stars.js';
import { GridFloor } from './layers/grid.js';
import { Skyline } from './layers/skyline.js';
import { UI } from './ui.js';

const renderer = new Renderer(document.getElementById('view'));
const audio = new AudioEngine();
const torus = new Torus();
const stars = new Stars();
const floor = new GridFloor();
const skyline = new Skyline();

const ui = new UI({
  onFile: (f) => audio.useFile(f).catch(console.error),
  onMic: () => (audio.mode === 'mic' ? audio.stopMic() : audio.useMic().catch(console.error)),
  onToggle: () => audio.togglePlay(),
});

let flash = 0;
let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const a = audio.frame(dt);
  if (a.drop) flash = 1;
  flash = Math.max(0, flash - dt * 3.5);

  torus.update(dt, a);
  stars.update(a, dt);
  floor.update(a, dt);
  skyline.update(a, dt);

  const g = renderer.grid;
  g.clear();
  stars.paint(g, THEME);   // back
  torus.paint(g, a, THEME);
  floor.paint(g, THEME);
  skyline.paint(g, THEME); // front

  renderer.draw(flash, THEME.bg, THEME.accent);
  ui.update({
    trackName: audio.trackName,
    playing: audio.playing,
    time: audio.time,
    duration: audio.duration,
    mode: audio.mode,
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
