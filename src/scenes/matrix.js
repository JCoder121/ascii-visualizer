import { MATRIX } from '../theme.js';
import { GlyphCube } from '../cube.js';
import { DigitalRain } from '../layers/rain.js';

export class MatrixScene {
  constructor() {
    this.name = 'MATRIX';
    this.bg = MATRIX.bg;
    this.accent = MATRIX.accent;
    this.cube = new GlyphCube();
    this.rain = new DigitalRain();
  }

  get flash() { return 0; } // no discrete drop events

  update(dt, a) {
    this.cube.update(dt, a);
    this.rain.update(a, dt);
  }

  paint(grid) {
    this.rain.paint(grid, MATRIX); // back
    this.cube.paint(grid, MATRIX); // front
  }
}
