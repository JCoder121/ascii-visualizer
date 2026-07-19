// src/torus.js
import { RAMP, lerpColor } from './theme.js';

export class Torus {
  constructor() {
    this.A = 1.0;
    this.B = 0.4;
    this.dA = 0.9;
    this.dB = 0.55;
    this.kickTime = 0;
    this.zbuf = null;
  }

  kick() {
    this.A += (Math.random() - 0.5) * 2.5;
    this.B += (Math.random() - 0.5) * 2.5;
    this.dA = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9);
    this.dB = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.7);
    this.kickTime = 0.5;
  }

  update(dt, { mids, drop }) {
    if (drop) this.kick();
    this.kickTime = Math.max(0, this.kickTime - dt);
    const boost = 1 + (this.kickTime > 0 ? 2.2 * (this.kickTime / 0.5) : 0);
    const speed = (0.35 + mids * 2.2) * boost;
    this.A += this.dA * speed * dt;
    this.B += this.dB * speed * dt;
  }

  paint(grid, { bass, treble }, theme) {
    const R1 = 1 + bass * 0.5;
    const R2 = 2;
    const K2 = 5;
    const { cols, rows } = grid;
    const cx = cols / 2;
    const cy = rows * 0.42;
    // fit by height; 1.9 = cell aspect, 0.53 ≈ 1/1.9 corrects y
    // landscape screens get a 1.25x boost — fit-by-rows runs small there
    const wide = cols > rows * 1.9 ? 1.25 : 1;
    let K1 = (wide * rows * 1.9 * 0.5 * K2 * 3) / (8 * (R1 + R2));
    // portrait guard: bass swell may not push the torus past the screen edges
    // (mid-depth magnification approximates the real projected half-width)
    const halfW = (K1 * (R1 + R2)) / (K2 - (R1 + R2) / 2);
    if (halfW > cols * 0.48) K1 *= (cols * 0.48) / halfW;
    const halfH = (K1 * 0.53 * (R1 + R2)) / (K2 - R1 - R2) ;
    if (!this.zbuf || this.zbuf.length !== cols * rows) this.zbuf = new Float32Array(cols * rows);
    this.zbuf.fill(0);
    const cA = Math.cos(this.A), sA = Math.sin(this.A);
    const cB = Math.cos(this.B), sB = Math.sin(this.B);
    for (let tj = 0; tj < 6.28; tj += 0.07) {
      const ct = Math.cos(tj), st = Math.sin(tj);
      for (let p = 0; p < 6.28; p += 0.02) {
        const cp = Math.cos(p), sp = Math.sin(p);
        const h = R2 + R1 * ct;
        const t = R1 * st;
        const x = h * (cB * cp + sA * sB * sp) - t * cA * sB;
        const y = h * (sB * cp - sA * cB * sp) + t * cA * cB;
        const z = K2 + cA * h * sp + t * sA;
        const ooz = 1 / z;
        const xp = Math.round(cx + K1 * ooz * x);
        const yp = Math.round(cy - K1 * 0.53 * ooz * y);
        if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
        const idx = yp * cols + xp;
        if (ooz <= this.zbuf[idx]) continue;
        this.zbuf[idx] = ooz;
        let L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
        L = Math.max(0, L) / 1.414; // 0..1 toward light
        let ri = Math.floor(L * (RAMP.length - 1));
        if (treble > 0.25 && L > 0.4 && Math.random() < treble * 0.06) ri = RAMP.length - 1; // sparkle
        const gt = 0.5 + (yp - cy) / (2 * Math.max(1, halfH)); // vertical gradient
        grid.set(xp, yp, RAMP[ri], lerpColor(theme.heroA, theme.heroB, gt));
      }
    }
  }
}
