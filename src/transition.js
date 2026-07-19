const GLYPHS = 'ｱｲｳｴｵｶｷｸｹｺ0123456789ﾊﾋﾌﾍﾎﾘﾙﾚﾛﾝ:=+*<>';
const DUR = 1.5;
const DEFAULT_GLITCH = { head: '#00ff41', highlight: '#c8ffd0' };

export class Transition {
  constructor() {
    this.active = false;
    this.t = 0;
    this._swapped = false;
    this._onSwap = null;
    this._from = DEFAULT_GLITCH;
    this._to = DEFAULT_GLITCH;
  }

  // glitch wears the outgoing palette until the midpoint swap, then the
  // incoming one — the storm "blends" into the next scene
  start(onMidpointSwap, fromGlitch, toGlitch) {
    this.active = true;
    this.t = 0;
    this._swapped = false;
    this._onSwap = onMidpointSwap;
    this._from = fromGlitch || DEFAULT_GLITCH;
    this._to = toGlitch || DEFAULT_GLITCH;
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

  paint(grid) {
    if (!this.active) return;
    const palette = this.t < DUR / 2 ? this._from : this._to;
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
