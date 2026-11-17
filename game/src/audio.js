// SOLMAR — sound, all synthesized with WebAudio, no audio files. Everything is
// guarded: if the context cannot start (headless screenshot runs), every call is a no-op.
export function createAudio() {
  const audio = {
    ctx: null, master: null, muted: false, engineOsc: null, engineGain: null,
    sirenTimer: null, sirenOsc: null, sirenGain: null, sirenHigh: false, musicTimer: null,
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        return true;
      } catch { return false; }
    },
    unlock() {
      if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    tone(freq, dur, type, vol, slideTo) {
      if (!this.ensure()) return;
      try {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        gain.gain.setValueAtTime(vol || 0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain); gain.connect(this.master);
        osc.start(t); osc.stop(t + dur + 0.02);
      } catch { /* ignore */ }
    },
    noise(dur, vol, lowpass) {
      if (!this.ensure()) return;
      try {
        const t = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = vol || 0.3;
        let node = src;
        if (lowpass) {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = lowpass;
          src.connect(filter); node = filter;
        }
        node.connect(gain); gain.connect(this.master);
        src.start(t);
      } catch { /* ignore */ }
    },
    shoot() { this.noise(0.12, 0.5, 3000); this.tone(180, 0.08, 'square', 0.15, 60); },
    enemyShoot() { this.noise(0.1, 0.2, 2500); },
    hit() { this.tone(520, 0.08, 'triangle', 0.2, 300); },
    hurt() { this.tone(140, 0.25, 'sawtooth', 0.25, 70); },
    thud() { this.noise(0.15, 0.4, 400); this.tone(70, 0.15, 'sine', 0.3, 40); },
    click() { this.tone(900, 0.05, 'square', 0.12); },
    reload() { this.tone(600, 0.06, 'square', 0.12); this.tone(800, 0.06, 'square', 0.12); },
    pickup() { this.tone(660, 0.1, 'sine', 0.2); this.tone(990, 0.15, 'sine', 0.2); },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'triangle', 0.22), i * 110));
    },
    busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.2), i * 160)); },
    engine(on, speed01) {
      if (!this.ensure()) return;
      try {
        if (on && !this.engineOsc) {
          this.engineOsc = this.ctx.createOscillator();
          this.engineGain = this.ctx.createGain();
          this.engineOsc.type = 'sawtooth';
          this.engineOsc.frequency.value = 60;
          this.engineGain.gain.value = 0.04;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = 500;
          this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
          this.engineOsc.start();
        }
        if (this.engineOsc) {
          this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, this.ctx.currentTime, 0.05);
          this.engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.04 : 0.0, this.ctx.currentTime, 0.1);
        }
      } catch { /* ignore */ }
    },
    siren(on) {
      if (!this.ensure()) return;
      try {
        if (on && !this.sirenOsc) {
          this.sirenOsc = this.ctx.createOscillator();
          this.sirenGain = this.ctx.createGain();
          this.sirenOsc.type = 'sine';
          this.sirenOsc.frequency.value = 750;
          this.sirenGain.gain.value = 0.05;
          this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
          this.sirenOsc.start();
          this.sirenTimer = setInterval(() => {
            if (!this.sirenOsc) return;
            this.sirenHigh = !this.sirenHigh;
            this.sirenOsc.frequency.setValueAtTime(this.sirenHigh ? 950 : 700, this.ctx.currentTime);
          }, 450);
        } else if (!on && this.sirenOsc) {
          clearInterval(this.sirenTimer);
          this.sirenTimer = null;
          const osc = this.sirenOsc;
          this.sirenOsc = null;
          osc.stop();
        }
      } catch { /* ignore */ }
    },
    music(on) {
      if (!on) {
        if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
        return;
      }
      if (!this.ensure() || this.musicTimer) return;
      // A lazy minor-key bass groove, one note per beat.
      const bass = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
      let i = 0;
      this.musicTimer = setInterval(() => {
        if (this.muted) return;
        this.tone(bass[i % bass.length], 0.42, 'triangle', 0.1);
        if (i % 2 === 0) this.tone(bass[i % bass.length] * 4, 0.1, 'sine', 0.04);
        i += 1;
      }, 430);
    },
    toggleMute() {
      this.muted = !this.muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
      return this.muted;
    },
  };
  return audio;
}
