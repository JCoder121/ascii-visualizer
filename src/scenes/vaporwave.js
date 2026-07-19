import { VAPORWAVE } from '../theme.js';
import { Torus } from '../torus.js';
import { Stars } from '../layers/stars.js';
import { GridFloor } from '../layers/grid.js';
import { Skyline } from '../layers/skyline.js';

export class VaporwaveScene {
  constructor() {
    this.name = 'VAPORWAVE';
    this.bg = VAPORWAVE.bg;
    this.accent = VAPORWAVE.accent;
    this.glitch = { head: VAPORWAVE.heroA, highlight: VAPORWAVE.accent };
    this.torus = new Torus();
    this.stars = new Stars();
    this.floor = new GridFloor();
    this.skyline = new Skyline();
    this._flash = 0;
    this._a = { bass: 0, treble: 0 };
  }

  get flash() { return this._flash; }

  update(dt, a) {
    this._a = a;
    if (a.drop) this._flash = 1;
    this._flash = Math.max(0, this._flash - dt * 3.5);
    this.torus.update(dt, a);
    this.stars.update(a, dt);
    this.floor.update(a, dt);
    this.skyline.update(a, dt);
  }

  paint(grid) {
    this.stars.paint(grid, VAPORWAVE);
    this.floor.paint(grid, VAPORWAVE);
    this.skyline.paint(grid, VAPORWAVE);
    // hero last — nothing may cut through the torus
    this.torus.paint(grid, this._a, VAPORWAVE);
  }
}
