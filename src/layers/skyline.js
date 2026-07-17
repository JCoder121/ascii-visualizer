// src/layers/skyline.js
import { dim } from '../theme.js';

const BLOCKS = '▁▂▃▄▅▆▇';
const MAX_H = 7; // rows

export class Skyline {
  constructor() {
    this.spec = null;
  }

  update(audio) {
    this.spec = audio.spectrum;
  }

  paint(grid, theme) {
    if (!this.spec) return;
    for (let x = 0; x < grid.cols; x++) {
      const v = this.spec[Math.floor((x / grid.cols) * this.spec.length)];
      const h = Math.min(MAX_H, v * MAX_H);
      const full = Math.floor(h);
      for (let k = 0; k < full; k++) {
        grid.set(x, grid.rows - 1 - k, '█', dim(theme.skyline, 0.3 + 0.4 * (1 - k / MAX_H)));
      }
      const frac = Math.floor((h - full) * (BLOCKS.length + 1));
      if (frac > 0) grid.set(x, grid.rows - 1 - full, BLOCKS[frac - 1], dim(theme.skyline, 0.6));
    }
  }
}
