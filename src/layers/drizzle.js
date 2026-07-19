// src/layers/drizzle.js
import { dim, lerpColor } from '../theme.js';

// It always rains in Blade Runner. Fine diagonal drizzle painted on the
// half-cell subgrid (2x the main grid) so the streaks read thin.
const SLANT = 0.22; // wind pushes streaks left: cols drifted per row fallen
const CH = '/';

export class Drizzle {
  constructor() {
    this.drops = null;
    this.w = 0;
    this.h = 0;
    this.mult = 1;
  }

  // speed/len are tied to grid height so the look is resolution-independent
  _drop(cols, rows) {
    return {
      x: Math.random() * cols,
      y: -Math.random() * rows * 0.3,
      speed: rows * (0.5 + Math.random() * 0.4), // screen-heights/sec
      len: 2 + Math.floor(Math.random() * 4), // 2-5 cells
    };
  }

  _init(cols, rows) {
    this.w = cols;
    this.h = rows;
    const n = Math.max(1, Math.floor(cols / 3)); // ~1 streak per 3 columns
    this.drops = Array.from({ length: n }, () => ({ ...this._drop(cols, rows), y: Math.random() * rows }));
  }

  update(audio, dt) {
    this.mult = 0.8 + audio.level * 0.6; // mild energy scaling x0.8-1.4
    if (!this.drops) return; // sized lazily on first paint
    for (const d of this.drops) {
      const dy = d.speed * this.mult * dt;
      d.y += dy;
      d.x -= dy * SLANT;
      if (d.y - d.len > this.h) Object.assign(d, this._drop(this.w, this.h));
    }
  }

  paint(grid, theme) {
    if (!this.drops || this.w !== grid.cols || this.h !== grid.rows) this._init(grid.cols, grid.rows);
    for (const d of this.drops) {
      const hy = Math.floor(d.y);
      for (let k = 0; k < d.len; k++) {
        const y = hy - k;
        if (y < 0 || y >= grid.rows) continue;
        const headness = 1 - k / d.len; // 1 at head → 0 toward tail
        // atmosphere only: kept dim so it never competes with the hero
        const color = dim(lerpColor(theme.rainB, theme.rainA, headness), 0.4 + headness * 0.2);
        grid.set(Math.round(d.x + k * SLANT), y, CH, color);
      }
    }
  }
}
