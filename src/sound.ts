/**
 * Luckyhighlow sound effects, synthesised with the Web Audio API so the game
 * ships no audio files. Browsers only allow sound after the player interacts,
 * so the context starts on the first tap or key press.
 */

type Wave = OscillatorType;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.7;

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      const AC =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  audio();
}

export function setSound(on: boolean, vol: number) {
  enabled = on;
  volume = vol;
  if (master) master.gain.value = on ? vol : 0;
}

function tone(freq: number, start: number, dur: number, opts: { type?: Wave; gain?: number; to?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const peak = opts.gain ?? 0.3;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(start: number, dur: number, opts: { gain?: number; freq?: number; q?: number } = {}) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + start;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = opts.freq ?? 2000;
  f.Q.value = opts.q ?? 1;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.3;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  /** UI tap. */
  click() {
    tone(1400, 0, 0.04, { type: 'triangle', gain: 0.12 });
  },
  /** Bet placed: two chips clacking. */
  bet() {
    noise(0, 0.05, { freq: 3500, q: 3, gain: 0.5 });
    noise(0.07, 0.05, { freq: 4200, q: 3, gain: 0.4 });
    tone(880, 0.02, 0.12, { type: 'triangle', gain: 0.15 });
  },
  /** Bet cancelled. */
  cancel() {
    tone(660, 0, 0.1, { type: 'triangle', gain: 0.15, to: 440 });
  },
  /** Countdown tick for the last seconds; urgent gets higher. */
  tick(urgent: boolean) {
    tone(urgent ? 1320 : 990, 0, 0.08, { type: 'square', gain: urgent ? 0.12 : 0.07 });
  },
  /** Bets closed: a bright gong. */
  close() {
    tone(392, 0, 0.9, { type: 'sine', gain: 0.25 });
    tone(587, 0, 0.7, { type: 'sine', gain: 0.12 });
    tone(784, 0, 0.5, { type: 'triangle', gain: 0.08 });
  },
  /** The reel: ratchet clicks that slow down, like a ball cage turning. */
  spin(ms: number) {
    let t = 0;
    let gap = 0.035;
    while (t < ms / 1000 - 0.1) {
      noise(t, 0.025, { freq: 2500 + Math.random() * 1500, q: 6, gain: 0.25 });
      t += gap;
      gap *= 1.11;
    }
  },
  /** Ball lands. */
  land() {
    tone(220, 0, 0.18, { type: 'sine', gain: 0.35, to: 120 });
    tone(1760, 0.02, 0.25, { type: 'triangle', gain: 0.12 });
  },
  /** Win: rising arpeggio and coin sparkle. */
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'triangle', gain: 0.18 }));
    for (let i = 0; i < 8; i++) tone(2600 + Math.random() * 1600, 0.4 + i * 0.05, 0.09, { type: 'sine', gain: 0.08 });
  },
  /** Loss: soft falling wah. */
  lose() {
    tone(392, 0, 0.25, { type: 'sawtooth', gain: 0.08, to: 330 });
    tone(330, 0.22, 0.45, { type: 'sawtooth', gain: 0.08, to: 196 });
  },
};
