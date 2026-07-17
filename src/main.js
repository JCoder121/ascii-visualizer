import { MATRIX } from './theme.js';
import { Renderer } from './renderer.js';
import { AudioEngine } from './audio.js';
import { VaporwaveScene } from './scenes/vaporwave.js';
import { MatrixScene } from './scenes/matrix.js';
import { Transition } from './transition.js';
import { UI } from './ui.js';

const renderer = new Renderer(document.getElementById('view'));
const audio = new AudioEngine();
const scenes = [new VaporwaveScene(), new MatrixScene()];
const transition = new Transition();
let active = 0;

const ui = new UI({
  onFile: (f) => audio.useFile(f).catch(console.error),
  onMic: () => (audio.mode === 'mic' ? audio.stopMic() : audio.useMic().catch(console.error)),
  onToggle: () => audio.togglePlay(),
  onCycleTheme: () => {
    if (transition.active) return;
    const next = (active + 1) % scenes.length;
    transition.start(() => { active = next; });
  },
});

let last = performance.now();

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  const a = audio.frame(dt);
  const scene = scenes[active];
  scene.update(dt, a);
  transition.update(dt);

  const g = renderer.grid;
  g.clear();
  scene.paint(g);
  transition.paint(g, MATRIX);
  renderer.draw(scene.flash, scene.bg, scene.accent);

  ui.update({
    trackName: audio.trackName,
    playing: audio.playing,
    time: audio.time,
    duration: audio.duration,
    mode: audio.mode,
    themeName: scenes[active].name,
  });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
