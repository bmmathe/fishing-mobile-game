/**
 * Procedural sound effects — everything is synthesized with the Web Audio API
 * (oscillators + filtered noise), so there are no audio assets to load and the
 * bundle stays lean. One shared AudioContext, created lazily on the first user
 * gesture (mobile WebViews refuse to start audio before one).
 *
 * Gameplay sounds are fired from the fishing store's phase transitions;
 * UI sounds from the components. Continuous sounds (reel ratchet, danger beep)
 * are driven by per-frame `*Step(dt)` calls from the store's advance() — an
 * accumulator emits ticks at the right rate with no timers.
 */

const STORAGE_KEY = "tidalties.muted";

type NoiseOpts = {
  dur: number;
  vol: number;
  /** Biquad filter sweep (Hz). */
  from: number;
  to?: number;
  type?: BiquadFilterType;
  at?: number;
};

type ToneOpts = {
  freq: number;
  /** Glide target (Hz). */
  end?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number;
};

class Sfx {
  muted = false;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  // Continuous-sound state
  private reelAcc = 0;
  private dangerAcc = 0;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // private mode — default unmuted
    }
    // Warm the context up on the first tap so later sounds are instant.
    const unlock = () => {
      this.ensure();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? "1" : "0");
    } catch {
      // ignore
    }
    if (this.muted) this.engineStop();
    return this.muted;
  }

  /* ---------------- plumbing ---------------- */

  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // 1s of reusable white noise
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private live(): AudioContext | null {
    return this.muted ? null : this.ensure();
  }

  private tone({ freq, end, dur, type = "sine", vol = 0.2, at = 0 }: ToneOpts) {
    const ctx = this.live();
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end && end !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise({ dur, vol, from, to, type = "lowpass", at = 0 }: NoiseOpts) {
    const ctx = this.live();
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t0 = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(from, t0);
    if (to && to !== from) filt.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---------------- UI ---------------- */

  /** Generic soft button tap. */
  uiTap() {
    this.tone({ freq: 660, end: 520, dur: 0.05, type: "square", vol: 0.06 });
  }

  /** Coins in hand (selling). */
  coin() {
    this.tone({ freq: 1320, dur: 0.06, type: "triangle", vol: 0.16 });
    this.tone({ freq: 1760, dur: 0.14, type: "triangle", vol: 0.16, at: 0.06 });
  }

  /** Purchase confirmed (gear/bait/hooks/travel). */
  buy() {
    this.tone({ freq: 520, dur: 0.05, type: "square", vol: 0.1 });
    this.tone({ freq: 880, dur: 0.1, type: "triangle", vol: 0.14, at: 0.05 });
    this.tone({ freq: 1174, dur: 0.14, type: "triangle", vol: 0.12, at: 0.11 });
  }

  /** Can't do that (unaffordable, full, locked). */
  denied() {
    this.tone({ freq: 220, dur: 0.09, type: "square", vol: 0.1 });
    this.tone({ freq: 170, dur: 0.16, type: "square", vol: 0.1, at: 0.09 });
  }

  /** Equip/select click. */
  equip() {
    this.tone({ freq: 480, end: 700, dur: 0.06, type: "triangle", vol: 0.12 });
  }

  /** Mounted on the Trophy Wall. */
  trophy() {
    const notes = [392, 523, 659, 784];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.14, type: "triangle", vol: 0.16, at: i * 0.09 }));
  }

  /* ---------------- fishing ---------------- */

  /** Cast: rod whoosh, then the bobber plops down. */
  cast() {
    this.noise({ dur: 0.28, vol: 0.14, from: 500, to: 3200, type: "bandpass" });
    this.tone({ freq: 320, end: 85, dur: 0.13, type: "sine", vol: 0.28, at: 0.32 });
    this.noise({ dur: 0.12, vol: 0.12, from: 1200, to: 500, at: 0.33 });
  }

  /** Soft double blip: something's sniffing the bait. */
  nibble() {
    this.tone({ freq: 500, dur: 0.05, type: "sine", vol: 0.12 });
    this.tone({ freq: 560, dur: 0.06, type: "sine", vol: 0.1, at: 0.09 });
  }

  /** Bite! urgent alert. */
  bite() {
    this.tone({ freq: 700, end: 950, dur: 0.09, type: "triangle", vol: 0.26 });
    this.tone({ freq: 700, end: 950, dur: 0.09, type: "triangle", vol: 0.26, at: 0.12 });
    this.noise({ dur: 0.14, vol: 0.14, from: 900, to: 400, at: 0.02 });
  }

  /** Hook set — the fight is on. */
  hookset() {
    this.tone({ freq: 900, end: 1400, dur: 0.06, type: "square", vol: 0.12 });
    this.noise({ dur: 0.16, vol: 0.16, from: 1400, to: 600 });
  }

  /** The fish tears off on a run (line zip + splash). */
  run() {
    this.noise({ dur: 0.3, vol: 0.12, from: 700, to: 3600, type: "bandpass" });
    this.noise({ dur: 0.18, vol: 0.12, from: 1000, to: 450, at: 0.05 });
  }

  /** SNAP — the line breaks. */
  snap() {
    this.noise({ dur: 0.07, vol: 0.4, from: 2600, type: "highpass" });
    this.tone({ freq: 160, end: 55, dur: 0.28, type: "sine", vol: 0.3, at: 0.03 });
  }

  /** Shake-off / got away: a sad little "wah" + splash. */
  lost() {
    this.tone({ freq: 420, end: 180, dur: 0.4, type: "sawtooth", vol: 0.12 });
    this.noise({ dur: 0.22, vol: 0.14, from: 900, to: 350, at: 0.05 });
  }

  /** Landed a fish — a jingle that grows with the tier. */
  landedFish(tier: number) {
    const notes = [523, 659, 784];
    if (tier >= 5) notes.push(1046);
    if (tier >= 7) notes.push(1318);
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.2, at: i * 0.09 }));
    this.noise({ dur: 0.25, vol: 0.1, from: 1100, to: 400 });
  }

  /** Hauled in junk: comic dud honk. */
  landedJunk() {
    this.tone({ freq: 180, end: 120, dur: 0.22, type: "square", vol: 0.14 });
    this.tone({ freq: 120, end: 95, dur: 0.3, type: "square", vol: 0.12, at: 0.2 });
  }

  /** Catch dropped into the cooler — icy clink. */
  keep() {
    this.tone({ freq: 900, dur: 0.05, type: "triangle", vol: 0.16 });
    this.tone({ freq: 1350, dur: 0.12, type: "triangle", vol: 0.14, at: 0.05 });
    this.noise({ dur: 0.1, vol: 0.08, from: 3000, type: "highpass", at: 0.02 });
  }

  /** Junk tossed in the trash — thud + rustle. */
  trash() {
    this.noise({ dur: 0.16, vol: 0.22, from: 500, to: 180 });
    this.tone({ freq: 120, end: 70, dur: 0.14, type: "sine", vol: 0.2 });
  }

  /* ------------- continuous (driven per-frame) ------------- */

  /** Reel ratchet: call every frame while fighting; rate follows reel input. */
  reelStep(reel: number, dt: number) {
    if (reel <= 0.02) {
      this.reelAcc = 0;
      return;
    }
    this.reelAcc += dt * (6 + reel * 16);
    while (this.reelAcc >= 1) {
      this.reelAcc -= 1;
      this.tone({ freq: 1500, dur: 0.018, type: "square", vol: 0.045 });
    }
  }

  /** Tension-danger beeper: call every frame; beeps while in the red zone. */
  dangerStep(active: boolean, dt: number) {
    if (!active) {
      this.dangerAcc = 1; // beep immediately when danger starts
      return;
    }
    this.dangerAcc += dt * 3;
    if (this.dangerAcc >= 1) {
      this.dangerAcc = 0;
      this.tone({ freq: 980, dur: 0.07, type: "square", vol: 0.09 });
    }
  }

  /** Boat engine hum: call every frame with throttle 0..1. */
  engineSet(mag: number) {
    const ctx = this.live();
    if (!ctx || !this.master) return;
    if (!this.engineOsc) {
      this.engineOsc = ctx.createOscillator();
      this.engineGain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 300;
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 45;
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const t = ctx.currentTime;
    this.engineGain!.gain.setTargetAtTime(0.02 + mag * 0.09, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(45 + mag * 55, t, 0.1);
  }

  engineStop() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch {
        // already stopped
      }
      this.engineOsc.disconnect();
      this.engineGain?.disconnect();
      this.engineOsc = null;
      this.engineGain = null;
    }
  }
}

export const sfx = new Sfx();
