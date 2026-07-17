// tests/audio.test.mjs
import test from 'node:test';
import assert from 'node:assert';
import { computeBands, fillSpectrum } from '../src/audio.js';

// 1024 bins at 44100Hz → binHz ≈ 21.5
function freqWithPeak(loHz, hiHz, sampleRate = 44100, bins = 1024) {
  const f = new Uint8Array(bins);
  const binHz = sampleRate / 2 / bins;
  for (let i = 0; i < bins; i++) {
    const hz = i * binHz;
    if (hz >= loHz && hz <= hiHz) f[i] = 255;
  }
  return f;
}

test('computeBands isolates bass', () => {
  const b = computeBands(freqWithPeak(20, 250), 44100);
  assert.ok(b.bass > 0.8, `bass ${b.bass}`);
  assert.ok(b.treble < 0.1, `treble ${b.treble}`);
});

test('computeBands isolates treble', () => {
  const b = computeBands(freqWithPeak(2000, 8000), 44100);
  assert.ok(b.treble > 0.8, `treble ${b.treble}`);
  assert.ok(b.bass < 0.15, `bass ${b.bass}`);
});

test('fillSpectrum fills 64 bins in 0..1', () => {
  const out = new Float32Array(64);
  fillSpectrum(freqWithPeak(0, 22050), out);
  assert.ok(out.every(v => v >= 0 && v <= 1));
  assert.ok(out[10] > 0.9);
});
