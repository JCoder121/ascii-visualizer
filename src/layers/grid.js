// src/layers/grid.js
import { dim } from '../theme.js';

export class GridFloor {
  constructor() {
    this.offset = 0;
    this.waves = [];
    this.bass = 0;
  }

  update(audio, dt) {
    this.bass = audio.bass;
    this.offset = (this.offset + dt * (0.8 + audio.mids * 5)) % 1;
    if (audio.drop) this.waves.push({ z: 10 });
    for (const w of this.waves) w.z -= dt * 14;
    this.waves = this.waves.filter((w) => w.z > 0.55);
  }

  paint(grid, theme) {
    const hy = Math.floor(grid.rows * 0.63);
    const cx = grid.cols / 2;
    const depth = grid.rows - 1 - hy;
    const D = depth * 0.55; // z=0.55 lands on the bottom row
    const base = 0.3 + this.bass * 0.6;

    // horizon line
    for (let x = 0; x < grid.cols; x++) grid.set(x, hy, '_', dim(theme.grid, 0.25));

    // horizontal lines scrolling toward viewer
    for (let k = 0; k < 12; k++) {
      const z = 0.55 + (k + (1 - this.offset)) * 0.85;
      const y = hy + Math.round(D / z);
      if (y <= hy || y >= grid.rows) continue;
      const b = Math.min(1, base * (2.0 / z));
      for (let x = 0; x < grid.cols; x++) grid.set(x, y, '_', dim(theme.grid, b));
    }

    // radial verticals from vanishing point
    const spread = grid.cols / (2 * 8 * depth) * 1.7;
    for (let m = -8; m <= 8; m++) {
      if (m === 0) {
        for (let y = hy + 1; y < grid.rows; y++) grid.set(Math.round(cx), y, '|', dim(theme.grid, base * 0.8));
        continue;
      }
      const slope = m * spread;
      const ch = Math.abs(slope) < 0.45 ? '|' : m > 0 ? '\\' : '/';
      for (let y = hy + 1; y < grid.rows; y++) {
        const x = Math.round(cx + slope * (y - hy));
        grid.set(x, y, ch, dim(theme.grid, base * 0.8));
      }
    }

    // shockwaves (drawn last, brightest)
    for (const w of this.waves) {
      const y = hy + Math.round(D / w.z);
      if (y <= hy || y >= grid.rows) continue;
      for (let x = 0; x < grid.cols; x++) grid.set(x, y, '=', dim(theme.accent, 1));
    }
  }
}
