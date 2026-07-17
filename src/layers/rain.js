// src/layers/rain.js
import { dim, lerpColor } from '../theme.js';

const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';
const g = (seed) => GLYPHS[Math.abs(Math.floor(seed * 131)) % GLYPHS.length];

export class DigitalRain {
  constructor() {
    this.cols = null;
    this.w = 0;
    this.h = 0;
  }

  _init(cols, rows) {
    this.w = cols;
    this.h = rows;
    this.cols = Array.from({ length: cols }, () => ({
      y: Math.random() * rows,
      speed: 8 + Math.random() * 22,   // cells/sec baseline
      len: 6 + Math.floor(Math.random() * 14),
      seed: Math.random() * 1000,
    }));
  }

  update(audio, dt) {
    if (!this.cols || this.w === 0) this._init(this.w || 1, this.h || 1);
    const mult = 0.6 + (audio.mids + audio.level) * 2.2;
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      c.y += c.speed * mult * dt;
      if (c.y - c.len > this.h) {
        c.y = -Math.random() * 10;
        c.len = 6 + Math.floor(Math.random() * 14);
        c.speed = 8 + Math.random() * 22;
      }
    }
    this.bass = audio.bass;
    this.treble = audio.treble;
    this.spectrum = audio.spectrum;
  }

  paint(grid, palette) {
    if (!this.cols || this.w !== grid.cols || this.h !== grid.rows) this._init(grid.cols, grid.rows);
    const surge = 0.75 + (this.bass || 0) * 0.35;
    for (let x = 0; x < grid.cols; x++) {
      const c = this.cols[x];
      const active = this.spectrum ? this.spectrum[Math.floor((x / grid.cols) * this.spectrum.length)] : 0.5;
      const len = Math.max(3, Math.floor(c.len * (0.4 + active)));
      const headY = Math.floor(c.y);
      for (let k = 0; k < len; k++) {
        const y = headY - k;
        if (y < 0 || y >= grid.rows) continue;
        const f = 1 - k / len; // 1 at head → 0 at tail
        let color;
        if (k === 0) color = dim(palette.highlight, 1);
        else color = lerpColor(palette.trail, palette.head, Math.min(1, f * surge));
        const sparkle = this.treble > 0.3 && k > 0 && Math.random() < this.treble * 0.05;
        grid.set(x, y, g(c.seed + y * 0.7 + k), sparkle ? dim(palette.highlight, 1) : color);
      }
    }
  }
}
