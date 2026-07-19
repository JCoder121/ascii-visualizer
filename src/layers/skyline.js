// src/layers/skyline.js
import { dim } from '../theme.js';

const BLOCKS = '▁▂▃▄▅▆▇';
// bar height scales with the grid so phones (tall, many rows) get a visible
// meter, floored at the 7-row desktop look
const maxH = (rows) => Math.max(7, Math.round(rows * 0.1));

export class Skyline {
  constructor() {
    this.spec = null;
    this.disp = null;
    this._dt = 1 / 60;
  }

  update(audio, dt = 1 / 60) {
    this.spec = audio.spectrum;
    this._dt = dt;
  }

  paint(grid, theme) {
    if (!this.spec) return;
    // centered, 75% of the width
    const x0 = Math.floor(grid.cols * 0.125);
    const x1 = grid.cols - x0;
    const w = x1 - x0;
    if (!this.disp || this.disp.length !== w) this.disp = new Float32Array(w);
    const dt = this._dt;
    for (let x = x0; x < x1; x++) {
      const i = x - x0;
      const raw = this.spec[Math.floor((i / w) * this.spec.length)];
      // diorama scaling: crush the quiet bins, overshoot the loud ones —
      // dramatic over accurate
      const target = Math.min(1, Math.pow(raw, 2.25) * 1.6);
      // punchy dynamics: fast rise, slow fall
      const k = target > this.disp[i] ? 1 - Math.exp(-dt * 30) : 1 - Math.exp(-dt * 6);
      this.disp[i] += (target - this.disp[i]) * k;
      const M = maxH(grid.rows);
      const h = Math.min(M, this.disp[i] * M);
      const full = Math.floor(h);
      for (let k = 0; k < full; k++) {
        grid.set(x, grid.rows - 1 - k, '█', dim(theme.skyline, 0.16 + 0.22 * (1 - k / M)));
      }
      const frac = Math.floor((h - full) * (BLOCKS.length + 1));
      if (frac > 0) grid.set(x, grid.rows - 1 - full, BLOCKS[frac - 1], dim(theme.skyline, 0.34));
    }
  }
}
