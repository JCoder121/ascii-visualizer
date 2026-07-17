import test from 'node:test';
import assert from 'node:assert';
import { VAPORWAVE, MATRIX, RAMP, lerpColor, dim } from '../src/theme.js';

test('vaporwave palette matches spec', () => {
  assert.equal(VAPORWAVE.bg, '#0a0118');
  assert.equal(VAPORWAVE.heroA, '#ff2d95');
  assert.equal(VAPORWAVE.heroB, '#00e5ff');
  assert.equal(VAPORWAVE.grid, '#b64fff');
  assert.equal(VAPORWAVE.skyline, '#00b3a4');
  assert.equal(VAPORWAVE.stars, '#8a7aa8');
  assert.equal(VAPORWAVE.accent, '#ffd319');
  assert.equal(RAMP, '.:-=+*#%@');
});

test('matrix palette matches spec', () => {
  assert.equal(MATRIX.bg, '#020806');
  assert.equal(MATRIX.head, '#00ff41');
  assert.equal(MATRIX.trail, '#008f11');
  assert.equal(MATRIX.highlight, '#c8ffd0');
  assert.equal(MATRIX.accent, '#eaffea');
});

test('lerpColor endpoints and quantization', () => {
  assert.equal(lerpColor('#000000', '#ffffff', 0), 'rgb(0,0,0)');
  assert.equal(lerpColor('#000000', '#ffffff', 1), 'rgb(255,255,255)');
  assert.equal(lerpColor('#000000', '#ffffff', 0.50), lerpColor('#000000', '#ffffff', 0.51));
});

test('dim scales and quantizes', () => {
  assert.equal(dim('#ff0000', 0), 'rgb(0,0,0)');
  assert.equal(dim('#ff0000', 1), 'rgb(255,0,0)');
  assert.equal(dim('#808080', 0.5), dim('#808080', 0.51));
});
