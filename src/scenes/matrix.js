import { MATRIX } from '../theme.js';
import { GlyphCube } from '../cube.js';
import { DigitalRain } from '../layers/rain.js';
import { Skyline } from '../layers/skyline.js';

export class MatrixScene {
  constructor() {
    this.name = 'MATRIX';
    this.bg = MATRIX.bg;
    this.accent = MATRIX.accent;
    this.glitch = { head: MATRIX.head, highlight: MATRIX.highlight };
    this.cube = new GlyphCube();
    this.rain = new DigitalRain();
    this.skyline = new Skyline();
  }

  get flash() { return 0; } // no discrete drop events

  update(dt, a) {
    this.cube.update(dt, a);
    this.rain.update(a, dt);
    this.skyline.update(a, dt);
  }

  paint(grid, sub) {
    this.rain.paint(sub || grid, MATRIX); // back, half-size glyphs
    this.skyline.paint(grid, MATRIX);
    this.cube.paint(grid, MATRIX); // front
  }
}
