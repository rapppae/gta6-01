// SOLMAR — audio.js
// Synthesised WebAudio sounds only: no audio files, no network. Everything
// is an oscillator or a noise buffer shaped by an envelope. The context is
// created lazily on the first user gesture, so the page never autoplays.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // Short burst of filtered noise — the raw material for shots and steps.
  noiseBurst(duration, filterFreq, gainValue, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.now();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainValue, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  // A plain tone with an attack/decay envelope.
  tone(freq, duration, gainValue, type = 'sine', slideTo = null) {
    if (!this.ctx) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(gainValue, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  click() {
    this.ensure();
    this.tone(880, 0.06, 0.15, 'square');
  }

  // M toggles all sound. Returns the new muted state for the HUD hint.
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.35;
    return this.muted;
  }

  shot() {
    this.noiseBurst(0.14, 1800, 0.7);
    this.tone(160, 0.1, 0.4, 'sine', 55);
  }

  enemyShot() {
    this.noiseBurst(0.1, 1200, 0.25);
  }

  reload() {
    this.tone(420, 0.07, 0.2, 'square');
    setTimeout(() => this.tone(620, 0.07, 0.2, 'square'), 160);
  }

  step() {
    this.noiseBurst(0.05, 500, 0.12);
  }

  thud() {
    this.noiseBurst(0.18, 300, 0.5);
    this.tone(90, 0.16, 0.35, 'sine', 45);
  }

  pickup() {
    this.tone(660, 0.09, 0.2, 'sine');
    setTimeout(() => this.tone(990, 0.12, 0.2, 'sine'), 90);
  }

  hurt() {
    this.tone(220, 0.18, 0.3, 'sawtooth', 110);
  }

  // Mission-complete jingle: a little rising arpeggio.
  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.25, 'triangle'), i * 110));
  }

  fail() {
    const notes = [392, 330, 262];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 0.25, 'triangle'), i * 160));
  }

  // Continuous engine hum; pitch follows the car's speed. Call every frame.
  engine(speedNorm) {
    if (!this.ctx) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 700;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = speedNorm > 0.02 ? 0.05 + speedNorm * 0.06 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.now(), 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, this.now(), 0.08);
  }

  // Two-tone police siren, on or off. Call when the wanted level changes.
  siren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (on) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 880;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this.sirenLfo = lfo;
    } else if (this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this.sirenLfo.stop();
      } catch {}
      this.sirenOsc = null;
      this.sirenLfo = null;
    }
  }
}
