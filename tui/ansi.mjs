// tui/ansi.mjs
// CellGrid -> ANSI truecolor frame string. Pure string building, testable.
const colorCache = new Map();

export function fgCode(color) {
  let esc = colorCache.get(color);
  if (!esc) {
    let r = 255, g = 255, b = 255;
    if (color[0] === '#') {
      const n = parseInt(color.slice(1), 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      const m = color.match(/\d+/g);
      if (m) [r, g, b] = m.map(Number);
    }
    esc = `\x1b[38;2;${r};${g};${b}m`;
    colorCache.set(color, esc);
  }
  return esc;
}

// Renders the grid as one frame: home cursor, then rows. Spaces skip color
// changes entirely, consecutive same-color cells reuse the active color.
export function gridToAnsi(grid) {
  const out = ['\x1b[H'];
  let active = null;
  for (let y = 0; y < grid.rows; y++) {
    const row = y * grid.cols;
    for (let x = 0; x < grid.cols; x++) {
      const ch = grid.ch[row + x];
      if (ch === ' ') { out.push(' '); continue; }
      const color = grid.color[row + x];
      if (color !== active) { out.push(fgCode(color)); active = color; }
      out.push(ch);
    }
    if (y < grid.rows - 1) out.push('\n');
  }
  out.push('\x1b[0m');
  return out.join('');
}
