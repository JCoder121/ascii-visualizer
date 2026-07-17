const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';
const DUR = 1.5;

export class Transition {
  constructor() {
    this.active = false;
    this.t = 0;
    this._swapped = false;
    this._onSwap = null;
  }

  start(onMidpointSwap) {
    this.active = true;
    this.t = 0;
    this._swapped = false;
    this._onSwap = onMidpointSwap;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    if (!this._swapped && this.t >= DUR / 2) {
      this._swapped = true;
      if (this._onSwap) this._onSwap();
    }
    if (this.t >= DUR) this.active = false;
  }

  paint(grid, palette) {
    if (!this.active) return;
    const p = this.t / DUR; // 0..1
    // smooth raised-sine: eases in from 0, peaks ~0.72 at midpoint, eases back out
    const coverage = Math.pow(Math.sin(p * Math.PI), 1.4) * 0.72;
    const n = Math.floor(grid.cols * grid.rows * coverage);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(Math.random() * grid.cols);
      const y = Math.floor(Math.random() * grid.rows);
      const ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      grid.set(x, y, ch, Math.random() < 0.3 ? palette.highlight : palette.head);
    }
  }
}
