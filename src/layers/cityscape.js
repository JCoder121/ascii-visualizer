// src/layers/cityscape.js
import { dim } from '../theme.js';

export class Cityscape {
  constructor() {
    this.buildings = null;
    this.w = 0;
    this.h = 0;
    this.t = 0;
    this.treble = 0;
    this.level = 0;
  }

  _init(cols, rows) {
    this.w = cols;
    this.h = rows;
    this.buildings = [];
    const tipMin = Math.ceil(rows * 0.5); // antennas never cross the midline
    let x = 0;
    while (x < cols) {
      const bw = 3 + Math.floor(Math.random() * 7); // 3..9 cols
      const top = Math.floor(rows * (0.55 + Math.random() * 0.35));
      const b = {
        x,
        w: Math.min(bw, cols - x),
        top,
        shade: 0.5 + Math.random() * 0.3,
        antenna: null,
        windows: [],
      };
      if (Math.random() < 0.35) {
        b.antenna = {
          x: x + Math.floor(Math.random() * b.w),
          tip: Math.max(tipMin, top - 2 - Math.floor(Math.random() * 3)),
        };
      }
      // a few lit windows per building, not a christmas tree
      const n = Math.min(5, 1 + Math.floor(b.w * (rows - top) * 0.04));
      for (let i = 0; i < n; i++) {
        b.windows.push({
          x: x + Math.floor(Math.random() * b.w),
          y: top + 1 + Math.floor(Math.random() * Math.max(1, rows - top - 2)),
          ph: Math.random() * 6.28,
          f: 0.4 + Math.random() * 1.6,
        });
      }
      this.buildings.push(b);
      x += bw;
    }
  }

  update(audio, dt) {
    this.t += dt;
    this.treble = audio.treble;
    this.level = audio.level;
  }

  paint(grid, theme) {
    if (!this.buildings || this.w !== grid.cols || this.h !== grid.rows) this._init(grid.cols, grid.rows);
    // city comes alive when loud
    const loud = this.level > 0.6 ? (this.level - 0.6) * 0.75 : 0;
    for (const b of this.buildings) {
      const color = dim(theme.city, b.shade);
      for (let x = b.x; x < b.x + b.w; x++) {
        for (let y = b.top; y < grid.rows; y++) grid.set(x, y, '█', color);
      }
      if (b.antenna) {
        const spire = dim(theme.city, b.shade * 0.8);
        for (let y = b.antenna.tip; y < b.top; y++) grid.set(b.antenna.x, y, '|', spire);
      }
      for (const w of b.windows) {
        const tw = 0.5 + 0.5 * Math.sin(this.t * w.f * (1 + this.treble * 2) + w.ph);
        const br = 0.3 + tw * (0.25 + this.treble * 0.35) + loud;
        grid.set(w.x, w.y, '▪', dim(theme.window, Math.min(1, br)));
      }
    }
  }
}
