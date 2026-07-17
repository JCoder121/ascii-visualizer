// src/layers/stars.js
import { dim } from '../theme.js';

export class Stars {
  constructor() {
    this.stars = null;
    this.t = 0;
    this.treble = 0;
  }

  _init(grid) {
    this.cols = grid.cols;
    this.rows = grid.rows;
    const n = Math.floor(grid.cols * grid.rows * 0.014);
    this.stars = Array.from({ length: n }, () => ({
      x: Math.floor(Math.random() * grid.cols),
      y: Math.floor(Math.random() * grid.rows * 0.62),
      ch: '.·*'[Math.floor(Math.random() * 3)],
      ph: Math.random() * 6.28,
      f: 0.5 + Math.random() * 2,
    }));
  }

  update(audio, dt) {
    this.t += dt;
    this.treble = audio.treble;
  }

  paint(grid, theme) {
    if (!this.stars || this.cols !== grid.cols || this.rows !== grid.rows) this._init(grid);
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.t * s.f * (1 + this.treble * 3) + s.ph);
      const b = 0.25 + tw * (0.3 + this.treble * 0.9);
      grid.set(s.x, s.y, s.ch, dim(theme.stars, Math.min(1, b)));
    }
  }
}
