// src/pyramid.js
import { RAMP, lerpColor } from './theme.js';

// Tyrell-style pyramid: tall square base, apex up (y+ is up before projection).
const APEX = [0, 2.0, 0];
const BASE = [
  [-0.9, -1.0, -0.9], [0.9, -1.0, -0.9],
  [0.9, -1.0, 0.9], [-0.9, -1.0, 0.9],
];
const TILT = 0.35; // fixed pitch so the 3D form reads
const MAX_LAT = Math.hypot(BASE[0][0], BASE[0][2]); // widest lateral reach (base diagonal)

export class GlyphPyramid {
  constructor() {
    this.yaw = 0.7; // rotation around the vertical axis
    this.kickTime = 0;
    this.zbuf = null;
    this._bass = 0;
    this._t = 0;
  }

  kick() {
    this.kickTime = 0.5;
  }

  update(dt, { bass, mids, drop }) {
    if (drop) this.kick();
    this.kickTime = Math.max(0, this.kickTime - dt);
    const boost = 1 + (this.kickTime > 0 ? 2.2 * (this.kickTime / 0.5) : 0);
    this.yaw += (0.25 + mids * 1.6) * boost * dt;
    this._bass = bass;
    this._t += dt;
  }

  paint(grid, a, theme) {
    const { cols, rows } = grid;
    const bass = a.bass !== undefined ? a.bass : this._bass;
    const treble = a.treble || 0;
    const size = 1 + bass * 0.25; // bass swell
    const K2 = 5, dist = 5;
    // fit by height (rows), like the torus/cube heroes, so the footprint tracks
    // them across every aspect ratio. coefficient calibrated so a 160x45 grid
    // paints a ~50-58 col x ~26-32 row bbox (see tests/pyramid.test.mjs).
    let K1 = rows * 1.9 * 0.213 * K2;
    // portrait guard: keep the projected width off the screen edges on tall grids
    const halfW = (K1 * MAX_LAT * size) / (dist - 1);
    if (halfW > cols * 0.42) K1 *= (cols * 0.42) / halfW;
    const cx = cols / 2, cy = rows * 0.44;
    const cT = Math.cos(TILT), sT = Math.sin(TILT);
    const cY = Math.cos(this.yaw), sY = Math.sin(this.yaw);
    if (!this.zbuf || this.zbuf.length !== cols * rows) this.zbuf = new Float32Array(cols * rows);
    this.zbuf.fill(0);
    const OOZ_MIN = 1 / 6.3, OOZ_MAX = 1 / 4.3; // depth range for shading

    const project = (x, y, z) => {
      const x1 = x * cY + z * sY, z1 = -x * sY + z * cY; // yaw (vertical axis)
      const y2 = y * cT - z1 * sT, z2 = y * sT + z1 * cT; // fixed tilt
      const ooz = 1 / (dist + z2 * size);
      return {
        xp: Math.round(cx + K1 * ooz * x1 * size),
        yp: Math.round(cy - K1 * 0.53 * ooz * y2 * size),
        ooz,
      };
    };

    const shade = (p, y, edge) => {
      if (p.xp < 0 || p.xp >= cols || p.yp < 0 || p.yp >= rows) return;
      const idx = p.yp * cols + p.xp;
      // edges get a slight bias so the front silhouette wins over its own face
      if (p.ooz + (edge ? 0.01 : 0) <= this.zbuf[idx]) return;
      this.zbuf[idx] = Math.max(this.zbuf[idx], p.ooz);
      let depth = (p.ooz - OOZ_MIN) / (OOZ_MAX - OOZ_MIN);
      depth = Math.max(0, Math.min(1, depth));
      const bright = edge ? 1 : Math.min(1, 0.18 + depth * 0.68 + bass * 0.12);
      let ri = edge ? RAMP.length - 2 : Math.floor(bright * (RAMP.length - 1));
      if (treble > 0.25 && depth > 0.4 && Math.random() < treble * 0.07) ri = RAMP.length - 1; // sparkle
      const h = (APEX[1] - y) / (APEX[1] - BASE[0][1]); // 0 at apex .. 1 at base
      grid.set(p.xp, p.yp, RAMP[ri], lerpColor(theme.heroA, theme.heroB, h));
    };

    // 4 slant faces: sample in 3D across each triangle, z-buffer for occlusion
    for (let fi = 0; fi < 4; fi++) {
      const B = BASE[fi], C = BASE[(fi + 1) % 4];
      for (let u = 0; u <= 1.0001; u += 0.02) {
        for (let v = 0; v <= 1.0001 - u; v += 0.02) {
          const x = APEX[0] + u * (B[0] - APEX[0]) + v * (C[0] - APEX[0]);
          const y = APEX[1] + u * (B[1] - APEX[1]) + v * (C[1] - APEX[1]);
          const z = APEX[2] + u * (B[2] - APEX[2]) + v * (C[2] - APEX[2]);
          shade(project(x, y, z), y, false);
        }
      }
    }
    // base face (mostly hidden, but shows when tilted toward camera)
    const [b0, b1, b2, b3] = BASE;
    for (let u = 0; u <= 1.0001; u += 0.03) {
      for (let w = 0; w <= 1.0001; w += 0.03) {
        const x = (b0[0] * (1 - u) + b1[0] * u) * (1 - w) + (b3[0] * (1 - u) + b2[0] * u) * w;
        const z = (b0[2] * (1 - u) + b1[2] * u) * (1 - w) + (b3[2] * (1 - u) + b2[2] * u) * w;
        shade(project(x, b0[1], z), b0[1], false);
      }
    }
    // edges brightest: 4 slant + 4 base, sampled in 3D so hidden ones stay hidden
    for (let i = 0; i < 4; i++) {
      const edges = [[APEX, BASE[i]], [BASE[i], BASE[(i + 1) % 4]]];
      for (const [P, Q] of edges) {
        for (let t = 0; t <= 1.0001; t += 0.02) {
          const x = P[0] + (Q[0] - P[0]) * t;
          const y = P[1] + (Q[1] - P[1]) * t;
          const z = P[2] + (Q[2] - P[2]) * t;
          shade(project(x, y, z), y, true);
        }
      }
    }
  }
}
