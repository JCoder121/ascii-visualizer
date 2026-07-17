import test from 'node:test';
import assert from 'node:assert';
import { THEME, RAMP, lerpColor, dim } from '../src/theme.js';

test('palette matches spec', () => {
  assert.equal(THEME.bg, '#0a0118');
  assert.equal(THEME.heroA, '#ff2d95');
  assert.equal(THEME.heroB, '#00e5ff');
  assert.equal(THEME.grid, '#b64fff');
  assert.equal(THEME.skyline, '#00b3a4');
  assert.equal(THEME.stars, '#8a7aa8');
  assert.equal(THEME.accent, '#ffd319');
  assert.equal(RAMP, '.:-=+*#%@');
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
