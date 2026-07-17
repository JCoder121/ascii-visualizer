const TARGET_COLS = 160;
const CELL_ASPECT = 1.9; // cell height / cell width

export class CellGrid {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.ch = new Array(cols * rows).fill(' ');
    this.color = new Array(cols * rows).fill('');
  }
  clear() {
    this.ch.fill(' ');
    this.color.fill('');
  }
  set(x, y, ch, color) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    const i = y * this.cols + x;
    this.ch[i] = ch;
    this.color[i] = color;
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.atlas = new Map();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(innerWidth * dpr);
    this.canvas.height = Math.floor(innerHeight * dpr);
    this.cellW = Math.max(5, Math.floor(this.canvas.width / TARGET_COLS));
    this.cellH = Math.round(this.cellW * CELL_ASPECT);
    const cols = Math.floor(this.canvas.width / this.cellW);
    const rows = Math.floor(this.canvas.height / this.cellH);
    this.grid = new CellGrid(cols, rows);
    this.font = `${Math.round(this.cellW * 1.6)}px Menlo, "SF Mono", monospace`;
    this.atlas.clear();
    this.scene = document.createElement('canvas');
    this.scene.width = this.canvas.width;
    this.scene.height = this.canvas.height;
    this.sctx = this.scene.getContext('2d');
  }

  _glyph(ch, color) {
    const key = ch + color;
    let g = this.atlas.get(key);
    if (!g) {
      if (this.atlas.size > 5000) this.atlas.clear(); // safety valve
      g = document.createElement('canvas');
      g.width = this.cellW;
      g.height = this.cellH;
      const c = g.getContext('2d');
      c.font = this.font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = color;
      c.fillText(ch, this.cellW / 2, this.cellH / 2);
      this.atlas.set(key, g);
    }
    return g;
  }

  draw(flash, bgHex, accentHex) {
    const { sctx, ctx, grid } = this;
    sctx.globalCompositeOperation = 'source-over';
    sctx.globalAlpha = 1;
    sctx.fillStyle = bgHex;
    sctx.fillRect(0, 0, this.scene.width, this.scene.height);
    for (let y = 0; y < grid.rows; y++) {
      const py = y * this.cellH;
      const row = y * grid.cols;
      for (let x = 0; x < grid.cols; x++) {
        const ch = grid.ch[row + x];
        if (ch === ' ') continue;
        sctx.drawImage(this._glyph(ch, grid.color[row + x]), x * this.cellW, py);
      }
    }
    if (flash > 0) {
      sctx.globalCompositeOperation = 'lighter';
      sctx.globalAlpha = flash * 0.28;
      sctx.fillStyle = accentHex;
      sctx.fillRect(0, 0, this.scene.width, this.scene.height);
      sctx.globalAlpha = 1;
      sctx.globalCompositeOperation = 'source-over';
    }
    // present + cheap bloom
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    ctx.drawImage(this.scene, 0, 0);
    ctx.filter = 'blur(6px)';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(this.scene, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
