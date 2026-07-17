// src/audio.js
export function computeBands(freq, sampleRate) {
  const binHz = sampleRate / 2 / freq.length;
  const avg = (lo, hi) => {
    const a = Math.max(0, Math.floor(lo / binHz));
    const b = Math.min(freq.length - 1, Math.ceil(hi / binHz));
    let s = 0;
    for (let i = a; i <= b; i++) s += freq[i];
    return s / ((b - a + 1) * 255);
  };
  return { bass: avg(20, 250), mids: avg(250, 2000), treble: avg(2000, 8000) };
}

export function fillSpectrum(freq, out) {
  const n = out.length;
  const half = freq.length; // getByteFrequencyData already covers 0..nyquist
  for (let i = 0; i < n; i++) {
    const a = Math.floor(Math.pow(i / n, 1.7) * half * 0.5);
    const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.7) * half * 0.5));
    let s = 0;
    for (let j = a; j < b; j++) s += freq[j];
    out[i] = s / ((b - a) * 255);
  }
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.mode = 'idle';
    this.audioEl = null;
    this.fileSrc = null;
    this.micStream = null;
    this.micSrc = null;
    this.trackName = '';
    this.sBass = 0; this.sMids = 0; this.sTreble = 0;
    this.emaFast = 0; this.emaSlow = 0; this.cooldown = 0;
    this.spectrum = new Float32Array(64);
    this._t = 0;
  }

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  async useFile(file) {
    this._ensureCtx();
    this.stopMic();
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.fileSrc = this.ctx.createMediaElementSource(this.audioEl);
      this.fileSrc.connect(this.analyser);
      this.fileSrc.connect(this.ctx.destination);
    }
    if (this.audioEl.src) URL.revokeObjectURL(this.audioEl.src);
    this.audioEl.src = URL.createObjectURL(file);
    this.trackName = file.name;
    this.mode = 'file';
    await this.audioEl.play();
  }

  async useMic() {
    this._ensureCtx();
    if (this.audioEl) this.audioEl.pause();
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micSrc = this.ctx.createMediaStreamSource(this.micStream);
    this.micSrc.connect(this.analyser);
    this.mode = 'mic';
    this.trackName = 'microphone';
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micSrc.disconnect();
      this.micStream = null;
      this.micSrc = null;
    }
    if (this.mode === 'mic') this.mode = 'idle';
  }

  get playing() {
    if (this.mode === 'mic') return true;
    return this.mode === 'file' && this.audioEl && !this.audioEl.paused;
  }
  get time() { return this.audioEl ? this.audioEl.currentTime : 0; }
  get duration() { return (this.audioEl && this.audioEl.duration) || 0; }

  togglePlay() {
    if (this.mode !== 'file' || !this.audioEl) return;
    if (this.audioEl.paused) this.audioEl.play();
    else this.audioEl.pause();
  }

  frame(dt) {
    this._t += dt;
    if (!this.playing) return this._idleFrame();
    this.analyser.getByteFrequencyData(this.freq);
    const raw = computeBands(this.freq, this.ctx.sampleRate);
    const k = 1 - Math.exp(-dt * 12);
    this.sBass += (raw.bass - this.sBass) * k;
    this.sMids += (raw.mids - this.sMids) * k;
    this.sTreble += (raw.treble - this.sTreble) * k;
    fillSpectrum(this.freq, this.spectrum);
    // drop detection: fast bass EMA punching through slow EMA
    this.emaFast += (raw.bass - this.emaFast) * (1 - Math.exp(-dt * 25));
    this.emaSlow += (raw.bass - this.emaSlow) * (1 - Math.exp(-dt * 2.5));
    this.cooldown = Math.max(0, this.cooldown - dt);
    let drop = false;
    if (this.cooldown === 0 && this.emaFast > 0.28 && this.emaFast > this.emaSlow * 1.45) {
      drop = true;
      this.cooldown = 0.4;
    }
    return {
      bass: this.sBass, mids: this.sMids, treble: this.sTreble,
      level: (this.sBass + this.sMids + this.sTreble) / 3,
      spectrum: this.spectrum, drop,
    };
  }

  _idleFrame() {
    const t = this._t;
    const w = (f, p = 0) => 0.5 + 0.5 * Math.sin(t * f + p);
    for (let i = 0; i < 64; i++) {
      this.spectrum[i] = 0.06 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.9 + i * 0.35));
    }
    return {
      bass: 0.12 + 0.1 * w(0.7),
      mids: 0.15 + 0.08 * w(0.43, 1),
      treble: 0.1 + 0.08 * w(1.1, 2),
      level: 0.12,
      spectrum: this.spectrum,
      drop: false,
    };
  }
}
