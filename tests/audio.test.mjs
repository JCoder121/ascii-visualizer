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

// --- AGC ---
import { Agc, DropDetector } from '../src/audio.js';

function runSteady(agc, v, seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) agc.step(v, dt);
}

test('Agc: quiet steady signal normalizes to ~full range (85% gain)', () => {
  const agc = new Agc();
  runSteady(agc, 0.15, 3);
  assert.ok(agc.norm(0.15) > 0.75 && agc.norm(0.15) <= 0.86, `norm ${agc.norm(0.15)}`);
});

test('Agc: silence is not amplified to full range', () => {
  const agc = new Agc();
  runSteady(agc, 0.02, 5);
  assert.ok(agc.norm(0.02) <= 0.3, `norm ${agc.norm(0.02)}`);
});

test('Agc: loud signal is not boosted, mid-level maps to ~half', () => {
  const agc = new Agc();
  runSteady(agc, 0.9, 3);
  assert.ok(agc.norm(0.9) > 0.8 && agc.norm(0.9) <= 0.9);
  const half = agc.norm(0.45);
  assert.ok(half > 0.35 && half < 0.65, `half ${half}`);
});

test('Agc: attack tracks a loud burst within ~0.5s', () => {
  const agc = new Agc();
  runSteady(agc, 0.1, 3);      // calibrated quiet
  runSteady(agc, 0.9, 0.5);    // sudden loud
  assert.ok(agc.peak > 0.6, `peak ${agc.peak}`);
});

// --- DropDetector ---
test('DropDetector: bass spike over baseline fires a drop', () => {
  const d = new DropDetector();
  const dt = 1 / 60;
  for (let t = 0; t < 2; t += dt) d.step(0.35, dt);   // steady baseline
  let fired = false;
  for (let t = 0; t < 0.3; t += dt) if (d.step(0.9, dt)) fired = true;
  assert.ok(fired, 'expected drop on spike');
});

test('DropDetector: near-silence spike does not fire', () => {
  const d = new DropDetector();
  const dt = 1 / 60;
  for (let t = 0; t < 2; t += dt) d.step(0.03, dt);
  let fired = false;
  for (let t = 0; t < 0.3; t += dt) if (d.step(0.1, dt)) fired = true;
  assert.ok(!fired, 'no drop expected at near-silence');
});

test('DropDetector: cooldown blocks immediate re-fire', () => {
  const d = new DropDetector();
  const dt = 1 / 60;
  for (let t = 0; t < 2; t += dt) d.step(0.35, dt);
  let count = 0;
  for (let t = 0; t < 0.2; t += dt) if (d.step(0.95, dt)) count++;
  assert.strictEqual(count, 1);
});

// --- pickMicDevice ---
import { pickMicDevice } from '../src/audio.js';

const dev = (deviceId, label) => ({ kind: 'audioinput', deviceId, label });

test('pickMicDevice: prefers built-in over virtual devices', () => {
  const d = pickMicDevice([
    dev('bgm1', 'Background Music (Virtual)'),
    dev('teams', 'Microsoft Teams Audio Device (Virtual)'),
    dev('mic1', 'MacBook Air Microphone (Built-in)'),
    dev('default', 'Default - MacBook Air Microphone (Built-in)'),
  ]);
  assert.strictEqual(d.deviceId, 'mic1');
});

test('pickMicDevice: falls back to first real device without Built-in label', () => {
  const d = pickMicDevice([
    dev('bgm1', 'Background Music (Virtual)'),
    dev('usb1', 'USB Audio Device'),
  ]);
  assert.strictEqual(d.deviceId, 'usb1');
});

test('pickMicDevice: returns null when only virtual devices exist', () => {
  const d = pickMicDevice([dev('bgm1', 'Background Music (Virtual)')]);
  assert.strictEqual(d, null);
});

test('pickMicDevice: ignores non-audioinput and pseudo-default ids', () => {
  const d = pickMicDevice([
    { kind: 'audiooutput', deviceId: 'spk', label: 'Speakers (Built-in)' },
    dev('default', 'Default - MacBook Air Microphone (Built-in)'),
    dev('mic1', 'MacBook Air Microphone (Built-in)'),
  ]);
  assert.strictEqual(d.deviceId, 'mic1');
});
