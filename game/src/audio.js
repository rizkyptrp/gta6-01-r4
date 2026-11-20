// NEON DUSK — Sable City. All sound is synthesised with WebAudio: no audio
// files, no network. Engine hum, sirens, gunshots, punches, cash, horns and
// a little mission jingle, built from oscillators and filtered noise.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine loop: a low sawtooth whose pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  blip(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  shoot() { this.noise(0.14, 0.3, 900); this.blip(180, 0.08, 'square', 0.1, 60); }
  punch() { this.noise(0.1, 0.25, 300); }
  honk() { this.blip(370, 0.28, 'square', 0.12); this.blip(466, 0.28, 'square', 0.1); }
  cash() {
    this.blip(880, 0.09, 'sine', 0.14);
    setTimeout(() => this.blip(1318, 0.16, 'sine', 0.14), 90);
    setTimeout(() => this.blip(1760, 0.22, 'sine', 0.12), 180);
  }
  siren() { this.blip(720, 0.5, 'sine', 0.05, 980); }
  busted() { this.blip(220, 0.5, 'sawtooth', 0.12, 110); }
  mission() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.13), i * 110));
  }
  hit() { this.blip(140, 0.12, 'sawtooth', 0.14, 70); }
}
