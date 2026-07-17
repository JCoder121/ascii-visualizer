export class UI {
  constructor({ onFile, onMic, onToggle }) {
    this.controls = document.getElementById('controls');
    this.playBtn = document.getElementById('play-btn');
    this.micBtn = document.getElementById('mic-btn');
    this.nameEl = document.getElementById('track-name');
    this.timeEl = document.getElementById('track-time');
    this.idleEl = document.getElementById('idle-prompt');
    this.hideTimer = null;

    this.playBtn.addEventListener('click', onToggle);
    this.micBtn.addEventListener('click', onMic);
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); onToggle(); }
    });

    addEventListener('dragover', (e) => { e.preventDefault(); document.body.classList.add('dragging'); });
    addEventListener('dragleave', () => document.body.classList.remove('dragging'));
    addEventListener('drop', (e) => {
      e.preventDefault();
      document.body.classList.remove('dragging');
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    });

    const poke = () => this._show();
    addEventListener('mousemove', poke);
    addEventListener('touchstart', poke);
    this._show();
  }

  _show() {
    this.controls.classList.remove('hidden');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.controls.classList.add('hidden'), 3000);
  }

  update({ trackName, playing, time, duration, mode }) {
    this.playBtn.textContent = playing ? '❚❚' : '▸';
    this.micBtn.classList.toggle('active', mode === 'mic');
    this.nameEl.textContent = trackName || '—';
    this.idleEl.style.display = mode === 'idle' ? '' : 'none';
    const fmt = (s) => {
      if (!isFinite(s) || s <= 0) return '';
      const m = Math.floor(s / 60);
      return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    };
    this.timeEl.textContent =
      mode === 'file' && duration ? `${fmt(time)} / ${fmt(duration)}` : '';
  }
}
