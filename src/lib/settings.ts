export interface Settings {
  sound: boolean;
  /** 0–1 */
  volume: number;
}

const KEY = 'luckyhighlow.settings';

export function systemReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.7,
};

export function loadSettings(): Settings {
  const base = { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      sound: typeof s.sound === 'boolean' ? s.sound : base.sound,
      volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : base.volume,
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
