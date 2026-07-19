// src/layers/searchlight.js
import { dim } from '../theme.js';

// Police-spinner searchlight: one narrow cone sweeping down over the city.
const Y_STRETCH = 1 / 0.53; // cells are ~1.9x taller than wide — rows count extra
const HALF_ANGLE = 0.05; // rad ≈ 5.7° full cone
const SWEEP_T = 0.9; // seconds of fast bright sweep after a drop

export class Searchlight {
  constructor() {
    this.t = 0;
    this.sweepTime = 0;
    this.angle = 0; // rad from straight down, +x = right
    this.oxN = 0.5; // origin x as a fraction of cols
  }

  update(audio, dt) {
    this.t += dt;
    if (audio.drop) this.sweepTime = SWEEP_T;
    else this.sweepTime = Math.max(0, this.sweepTime - dt);
    this.oxN = 0.5 + 0.3 * Math.sin(this.t * 0.06); // origin drifts slowly
    if (this.sweepTime > 0) {
      const p = 1 - this.sweepTime / SWEEP_T; // 0→1 across the sweep
      this.angle = -0.9 + 1.8 * p; // fast pass over a wide arc
    } else {
      this.angle = 0.55 * Math.sin(this.t * 0.35); // lazy idle oscillation
    }
  }

  paint(grid, theme) {
    const oy = Math.floor(grid.rows * 0.08);
    const ox = this.oxN * grid.cols;
    const sweeping = this.sweepTime > 0;
    // idle glow ~0.25, drop sweep ~0.7 decaying back down
    const bright = 0.25 + (sweeping ? 0.45 * (this.sweepTime / SWEEP_T) : 0);
    const half = sweeping ? HALF_ANGLE * 1.6 : HALF_ANGLE; // flare while sweeping
    const tanL = Math.tan(this.angle - half);
    const tanR = Math.tan(this.angle + half);
    for (let y = oy + 1; y < grid.rows; y++) {
      const dyv = (y - oy) * Y_STRETCH; // visual distance in cell widths
      const x0 = Math.round(ox + tanL * dyv);
      const x1 = Math.round(ox + tanR * dyv);
      const fall = Math.max(0.15, 1 - (y - oy) / grid.rows); // fade with distance
      for (let x = x0; x <= x1; x++) {
        const edge = x1 > x0 && (x === x0 || x === x1); // cone-edge falloff
        grid.set(x, y, edge ? '░' : '▒', dim(theme.beam, bright * fall * (edge ? 0.55 : 1)));
      }
    }
  }
}
