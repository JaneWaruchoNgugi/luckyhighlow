export interface Settings {
  sound: boolean;
  /** 0–1 */
  volume: number;
  /** Seconds in the betting window. */
  roundSeconds: number;
  /** Amount the − and + buttons change the bet by. */
  betStep: number;
  reduceMotion: boolean;
}

export const ROUND_CHOICES = [5, 8, 10, 15];
export const STEP_CHOICES = [1, 5, 10, 50];

const KEY = 'luckyhighlow.settings';

function systemReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.7,
  roundSeconds: 8,
  betStep: 5,
  reduceMotion: false,
};

export function loadSettings(): Settings {
  const base = { ...DEFAULT_SETTINGS, reduceMotion: systemReducedMotion() };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof s.sound === 'boolean' ? s.sound : base.sound,
      volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : base.volume,
      roundSeconds: ROUND_CHOICES.includes(s.roundSeconds as number) ? (s.roundSeconds as number) : base.roundSeconds,
      betStep: STEP_CHOICES.includes(s.betStep as number) ? (s.betStep as number) : base.betStep,
      reduceMotion: typeof s.reduceMotion === 'boolean' ? s.reduceMotion : base.reduceMotion,
    };
  } catch {
    return base;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* settings last for this visit only */
  }
}
