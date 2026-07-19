export const VAPORWAVE = {
  bg: '#0a0118',
  heroA: '#ff2d95',
  heroB: '#00e5ff',
  grid: '#b64fff',
  skyline: '#00b3a4',
  stars: '#8a7aa8',
  accent: '#ffd319',
};

export const MATRIX = {
  bg: '#020806',
  head: '#00ff41',
  trail: '#008f11',
  highlight: '#c8ffd0',
  accent: '#eaffea',
  skyline: '#00d838',
};

export const RAMP = '.:-=+*#%@';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp01 = (t) => Math.min(1, Math.max(0, t));

// t quantized to 1/24 steps so the renderer's glyph atlas stays small
export function lerpColor(aHex, bHex, t) {
  t = Math.round(clamp01(t) * 24) / 24;
  const [ar, ag, ab] = hexToRgb(aHex);
  const [br, bg, bb] = hexToRgb(bHex);
  return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
}

// k quantized to 1/16 steps
export function dim(hex, k) {
  k = Math.round(clamp01(k) * 16) / 16;
  const [r, g, b] = hexToRgb(hex);
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}
