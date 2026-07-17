import { dim, lerpColor } from './theme.js';

export const MATRIX_GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';

// unit cube corners
const V = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];
// 6 faces as [v0,v1,v2,v3] for interior glyph sampling
const FACES = [
  [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
  [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4],
];

function glyphAt(seed) {
  // deterministic-ish glyph pick from a float seed
  const i = Math.abs(Math.floor(seed * 97)) % MATRIX_GLYPHS.length;
  return MATRIX_GLYPHS[i];
}

export class GlyphCube {
  constructor() {
    this.A = 0.6;
    this.B = 0.9;
    this.dA = 0.5;
    this.dB = 0.7;
    this.kickTime = 0;
    this.cascade = 0; // downward scroll phase
  }

  kick() {
    this.A += (Math.random() - 0.5) * 2.5;
    this.B += (Math.random() - 0.5) * 2.5;
    this.dA = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8);
    this.dB = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.8);
    this.kickTime = 0.5;
  }

  update(dt, { bass, mids, treble }) {
    this.kickTime = Math.max(0, this.kickTime - dt);
    const boost = 1 + (this.kickTime > 0 ? 2 * (this.kickTime / 0.5) : 0);
    const speed = (0.4 + mids * 2.0) * boost;
    this.A += this.dA * speed * dt;
    this.B += this.dB * speed * dt;
    this.cascade = (this.cascade + dt * (1 + mids * 3)) % 1;
    this._bass = bass;
    this._treble = treble;
    this._t = (this._t || 0) + dt;
  }

  // project a 3D point (rotated by A/B) to a grid cell + inverse depth (ooz)
  _project3(x, y, z, cols, rows) {
    const cA = Math.cos(this.A), sA = Math.sin(this.A);
    const cB = Math.cos(this.B), sB = Math.sin(this.B);
    const y1 = y * cA - z * sA, z1 = y * sA + z * cA; // rotate X
    const x2 = x * cB + z1 * sB, z2 = -x * sB + z1 * cB; // rotate Y
    const size = 1 + (this._bass || 0) * 0.4;
    const K2 = 5, dist = 5;
    const ooz = 1 / (dist + z2 * size);
    // fit to the SMALLER screen axis so portrait (mobile) never overflows width.
    // cols * 0.26 caps horizontal span; on wide desktops rows is the limit as before.
    const fit = Math.min(rows, cols * 0.26);
    const K1 = fit * 1.9 * 0.32 * K2;
    const cx = cols / 2, cy = rows * 0.42;
    return {
      x: Math.round(cx + K1 * ooz * x2 * size),
      y: Math.round(cy - K1 * 0.53 * ooz * y1 * size),
      ooz,
    };
  }

  paint(grid, palette) {
    const { cols, rows } = grid;
    if (!this.zbuf || this.zbuf.length !== cols * rows) this.zbuf = new Float32Array(cols * rows);
    this.zbuf.fill(0);
    const OOZ_MIN = 1 / 6.5, OOZ_MAX = 1 / 3.5; // depth range for shading

    // solid faces: sample each face in 3D, project with real depth, z-buffer so
    // nearer glyphs occlude farther ones — gives the cube volume like the torus.
    for (let fi = 0; fi < FACES.length; fi++) {
      const [a, b, c, d] = FACES[fi];
      const Va = V[a], Vb = V[b], Vc = V[c], Vd = V[d];
      for (let u = 0; u <= 1.0001; u += 0.07) {
        for (let w = 0; w <= 1.0001; w += 0.07) {
          // bilinear interpolation in 3D across the face
          const x = (Va[0] * (1 - u) + Vb[0] * u) * (1 - w) + (Vd[0] * (1 - u) + Vc[0] * u) * w;
          const y = (Va[1] * (1 - u) + Vb[1] * u) * (1 - w) + (Vd[1] * (1 - u) + Vc[1] * u) * w;
          const z = (Va[2] * (1 - u) + Vb[2] * u) * (1 - w) + (Vd[2] * (1 - u) + Vc[2] * u) * w;
          const p = this._project3(x, y, z, cols, rows);
          if (p.x < 0 || p.x >= cols || p.y < 0 || p.y >= rows) continue;
          const idx = p.y * cols + p.x;
          if (p.ooz <= this.zbuf[idx]) continue; // occluded by a nearer point
          this.zbuf[idx] = p.ooz;
          let depth = (p.ooz - OOZ_MIN) / (OOZ_MAX - OOZ_MIN);
          depth = Math.max(0, Math.min(1, depth));
          const casc = (w + this.cascade) % 1;
          const bright = Math.min(1, 0.22 + depth * 0.6 + (this._bass || 0) * 0.15 + casc * 0.08);
          let color = lerpColor(palette.trail, palette.head, bright);
          if (this._treble > 0.3 && depth > 0.7 && Math.random() < this._treble * 0.1) color = palette.highlight;
          grid.set(p.x, p.y, glyphAt(x * 3 + y * 5 + z * 7 + this.cascade * 4), color);
        }
      }
    }

    // edges brightest, drawn on top
    const pts = V.map((v) => this._project3(v[0], v[1], v[2], cols, rows));
    for (const [i, j] of EDGES) {
      const p0 = pts[i], p1 = pts[j];
      const steps = Math.max(Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y), 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = Math.round(p0.x + (p1.x - p0.x) * t);
        const y = Math.round(p0.y + (p1.y - p0.y) * t);
        const sparkle = this._treble > 0.25 && Math.random() < this._treble * 0.08;
        grid.set(x, y, glyphAt(t * 11 + i + this._t), sparkle ? palette.highlight : palette.head);
      }
    }
  }
}
