import { BLADERUNNER } from '../theme.js';
import { GlyphPyramid } from '../pyramid.js';
import { Cityscape } from '../layers/cityscape.js';
import { Drizzle } from '../layers/drizzle.js';
import { Searchlight } from '../layers/searchlight.js';
import { Skyline } from '../layers/skyline.js';

export class BladeRunnerScene {
  constructor() {
    this.name = 'BLADE RUNNER';
    this.bg = BLADERUNNER.bg;
    this.accent = BLADERUNNER.accent;
    this.pyramid = new GlyphPyramid();
    this.city = new Cityscape();
    this.drizzle = new Drizzle();
    this.light = new Searchlight();
    this.skyline = new Skyline();
    this._flash = 0;
    this._a = { bass: 0, treble: 0 };
  }

  get flash() { return this._flash; } // cyan accent flash on drops

  update(dt, a) {
    this._a = a;
    if (a.drop) this._flash = 1;
    this._flash = Math.max(0, this._flash - dt * 3.5);
    this.pyramid.update(dt, a);
    this.city.update(a, dt);
    this.drizzle.update(a, dt);
    this.light.update(a, dt);
    this.skyline.update(a, dt);
  }

  paint(grid, sub) {
    this.drizzle.paint(sub || grid, BLADERUNNER); // back, half-cell streaks
    this.city.paint(grid, BLADERUNNER);
    this.skyline.paint(grid, BLADERUNNER);
    this.light.paint(grid, BLADERUNNER);
    // hero last — nothing may cut through the pyramid
    this.pyramid.paint(grid, this._a, BLADERUNNER);
  }
}
