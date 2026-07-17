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

  _project(v, cols, rows) {
    const cA = Math.cos(this.A), sA = Math.sin(this.A);
    const cB = Math.cos(this.B), sB = Math.sin(this.B);
    let [x, y, z] = v;
    // rotate X
    let y1 = y * cA - z * sA, z1 = y * sA + z * cA;
    // rotate Y
    let x2 = x * cB + z1 * sB, z2 = -x * sB + z1 * cB;
    const size = 1 + (this._bass || 0) * 0.5;
    const K2 = 5, dist = 5;
    const zc = dist + z2 * size;
    const ooz = 1 / zc;
    const K1 = rows * 1.9 * 0.32 * K2;
    const cx = cols / 2, cy = rows * 0.42;
    return {
      x: Math.round(cx + K1 * ooz * x2 * size),
      y: Math.round(cy - K1 * 0.53 * ooz * y1 * size),
      ooz,
    };
  }

  paint(grid, palette) {
    const { cols, rows } = grid;
    const pts = V.map((v) => this._project(v, cols, rows));

    // interior cascade glyphs sampled across each face
    for (let fi = 0; fi < FACES.length; fi++) {
      const [a, b, c, d] = FACES[fi];
      for (let u = 0.1; u < 0.95; u += 0.16) {
        for (let w = 0.1; w < 0.95; w += 0.12) {
          // bilinear on projected face corners
          const top = { x: pts[a].x + (pts[b].x - pts[a].x) * u, y: pts[a].y + (pts[b].y - pts[a].y) * u };
          const bot = { x: pts[d].x + (pts[c].x - pts[d].x) * u, y: pts[d].y + (pts[c].y - pts[d].y) * u };
          const wc = (w + this.cascade) % 1;
          const px = Math.round(top.x + (bot.x - top.x) * wc);
          const py = Math.round(top.y + (bot.y - top.y) * wc);
          const bright = 0.3 + wc * 0.5 + (this._bass || 0) * 0.2;
          const col = lerpColor(palette.trail, palette.head, Math.min(1, bright));
          grid.set(px, py, glyphAt(u * 7 + w * 13 + fi + this.cascade), col);
        }
      }
    }

    // edges (brightest, drawn last)
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
