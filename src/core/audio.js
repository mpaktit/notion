/**
 * Procedural audio: synthesized SFX + an adaptive, per-sector ambient soundtrack.
 * No audio files to download — everything is generated with WebAudio.
 */
const SCALES = [
  { root: 220.0, chords: [[0, 3, 7, 10], [5, 8, 12, 15], [3, 7, 10, 14], [-2, 2, 5, 9]] },   // orbit: A minor-ish
  { root: 196.0, chords: [[0, 3, 7, 10], [1, 5, 8, 12], [0, 3, 7, 10], [-2, 1, 5, 8]] },    // dunes: phrygian
  { root: 174.6, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12]] },   // belt
  { root: 233.1, chords: [[0, 3, 7, 14], [8, 12, 15, 19], [5, 8, 12, 15], [3, 7, 10, 14]] }, // nebula
  { root: 164.8, chords: [[0, 3, 6, 10], [1, 4, 8, 11], [0, 3, 6, 9], [-1, 3, 6, 10]] }     // horizon: diminished
];
const hz = (root, semi) => root * Math.pow(2, semi / 12);

export class Audio {
  constructor() { this.ctx = null; this.sfxVol = 0.8; this.musicVol = 0.5; this.musicOn = false; this.scene = 0; this.intensity = 0; this.step = 0; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol * 0.5; this.musicBus.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor(); this.master.disconnect(); this.master.connect(comp); comp.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }
  setVolumes(sfx, music) {
    this.sfxVol = sfx; this.musicVol = music;
    if (this.ctx) { this.sfxBus.gain.value = sfx; this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1); }
  }
  tone(f, d = 0.08, type = 'sine', vol = 0.08, slide = 0, delay = 0, bus = this.sfxBus) {
    if (!this.ctx || !bus) return;
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
  }
  noise(d = 0.2, vol = 0.1, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay, len = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfxBus); src.start(t);
  }
  /* ---- SFX vocabulary ---- */
  play(name, arg) {
    if (!this.ctx) return;
    switch (name) {
      case 'eat': { const b = 523 * Math.pow(2, (Math.min(arg, 8) - 1) * 2 / 12); this.tone(b, 0.09, 'triangle', 0.09); this.tone(b * 1.5, 0.08, 'triangle', 0.05, 0, 0.045); break; }
      case 'gold': [660, 880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', 0.035, 0, i * 0.055)); break;
      case 'pickup': [988, 1318].forEach((f, i) => this.tone(f, 0.08, 'sine', 0.06, 0, i * 0.05)); break;
      case 'crystal': [784, 1046, 1318, 1568, 2093].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.06, 0, i * 0.07)); this.tone(392, 0.8, 'triangle', 0.05, 0, 0); break;
      case 'power': this.tone(260, 0.28, 'sawtooth', 0.04, 700); break;
      case 'ability': this.tone(180, 0.35, 'sawtooth', 0.05, 900); this.noise(0.25, 0.06, 3000); break;
      case 'shield': this.tone(1400, 0.3, 'square', 0.04, -900); this.noise(0.3, 0.1, 5000); break;
      case 'die': this.tone(300, 0.6, 'sawtooth', 0.08, -240); this.noise(0.5, 0.12, 900); break;
      case 'level': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.06, 0, i * 0.07)); break;
      case 'count': this.tone(740, 0.07, 'sine', 0.07); break;
      case 'go': this.tone(1046, 0.18, 'triangle', 0.08); break;
      case 'click': this.tone(1200, 0.03, 'sine', 0.03); break;
      case 'buy': [880, 1318].forEach((f, i) => this.tone(f, 0.1, 'triangle', 0.06, 0, i * 0.06)); break;
      case 'error': this.tone(220, 0.15, 'square', 0.04, -40); break;
      case 'claim': [659, 880, 1318].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.06, 0, i * 0.06)); break;
      case 'coreShake': this.noise(0.08, 0.05, 1500); this.tone(200 + Math.random() * 100, 0.06, 'square', 0.02); break;
      case 'reveal': { const top = { common: 0, rare: 2, epic: 4, legendary: 7, mythic: 9 }[arg] || 0; for (let i = 0; i <= top; i++) this.tone(523 * Math.pow(2, i * 2 / 12), 0.25, 'triangle', 0.05, 0, i * 0.05); if (top >= 7) this.noise(0.6, 0.06, 6000, 0.2); break; }
      case 'storm': this.noise(1.2, 0.07, 700); break;
      case 'pulse': this.tone(60, 0.8, 'sine', 0.12, -20); break;
      case 'cut': this.tone(180, 0.18, 'square', 0.05, -80); break;
      case 'timeUp': [784, 659, 523].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.07, 0, i * 0.12)); break;
    }
  }
  /* ---- music sequencer ---- */
  startMusic(scene = 0) {
    this.scene = scene; this.musicOn = true;
    if (!this.ctx || this.timer) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 30);
  }
  stopMusic() { this.musicOn = false; clearInterval(this.timer); this.timer = null; }
  setScene(scene, intensity = 0) { this.scene = scene; this.intensity = intensity; }
  schedule() {
    if (!this.ctx || !this.musicOn || this.musicVol <= 0) return;
    const spb = 60 / (96 + this.intensity * 24) / 2; // eighth notes
    while (this.nextNote < this.ctx.currentTime + 0.15) {
      const sc = SCALES[this.scene % SCALES.length], bar = Math.floor(this.step / 16) % 4, chord = sc.chords[bar], s = this.step % 16, t = this.nextNote - this.ctx.currentTime;
      if (s === 0) chord.forEach((n) => this.pad(hz(sc.root, n - 12), spb * 16, t));
      if (s % 4 === 0) this.tone(hz(sc.root, chord[0] - 24), spb * 3, 'sine', 0.09, 0, t, this.musicBus);
      const arp = [0, 1, 2, 3, 2, 1, 2, 3][s % 8];
      if (s % 2 === 0 || this.intensity > 0.5) this.tone(hz(sc.root, chord[arp] + 12), spb * 0.9, 'triangle', 0.025 + this.intensity * 0.015, 0, t, this.musicBus);
      if (this.intensity > 0.3 && s % 4 === 0) this.kick(t);
      this.step++; this.nextNote += spb;
    }
  }
  pad(f, d, delay) {
    const t = this.ctx.currentTime + delay, g = this.ctx.createGain(), filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.018, t + d * 0.3); g.gain.linearRampToValueAtTime(0.0001, t + d);
    for (const det of [-7, 7]) { const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(filt); o.start(t); o.stop(t + d + 0.05); }
    filt.connect(g).connect(this.musicBus);
  }
  kick(delay) {
    const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.2);
  }
}
export const audio = new Audio();
