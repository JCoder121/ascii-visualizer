// src/simaudio.js
// Procedural "music" driver producing the same frame shape as AudioEngine —
// lets the visualizer run without any audio input (terminal UI, web demo).
export class SimAudio {
  constructor(bpm = 112) {
    this.beat = 60 / bpm;
    this.t = 0;
    this.sinceBeat = 0;
    this.beatCount = 0;
    this.spectrum = new Float32Array(64);
  }

  frame(dt) {
    this.t += dt;
    this.sinceBeat += dt;
    let kick = false;
    if (this.sinceBeat >= this.beat) {
      this.sinceBeat -= this.beat;
      this.beatCount++;
      kick = true;
    }
    const t = this.t;
    // kick: sharp bass envelope on each beat, extra weight on bar starts
    const barBoost = this.beatCount % 4 === 0 ? 1 : 0.72;
    const bass = Math.min(1, 0.92 * barBoost * Math.exp(-this.sinceBeat * 5.5) + 0.12 + 0.06 * Math.sin(t * 0.7));
    const mids = 0.38 + 0.22 * Math.sin(t * 0.9) + 0.14 * Math.sin(t * 2.3 + 1.2);
    // hats: 16th-note ticks
    const hat = Math.exp(-((this.sinceBeat * 4) % 1) * 6) * 0.3;
    const treble = 0.28 + 0.16 * Math.sin(t * 3.1 + 0.5) + hat;
    // a "drop" every 8 bars, landing on the bar's first beat
    const drop = kick && this.beatCount % 32 === 0 && this.beatCount > 0;
    for (let i = 0; i < 64; i++) {
      const f = i / 64;
      const band = f < 0.25 ? bass : f < 0.6 ? mids : treble;
      this.spectrum[i] = Math.max(0, Math.min(1,
        band * (0.55 + 0.45 * Math.sin(t * (1.1 + f * 3.7) + i * 1.7))));
    }
    return {
      bass: Math.max(0, Math.min(1, bass)),
      mids: Math.max(0, Math.min(1, mids)),
      treble: Math.max(0, Math.min(1, treble)),
      level: Math.max(0, Math.min(1, (bass + mids + treble) / 3)),
      spectrum: this.spectrum,
      drop,
    };
  }
}
