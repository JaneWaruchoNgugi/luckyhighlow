import { useEffect, useState } from 'react';
import { ROUND_CHOICES, STEP_CHOICES, type Settings } from './settings';
import { sfx } from './sound';

export function SettingsPanel({
  settings,
  onChange,
  onClose,
  onReplayTour,
  onResetBalance,
  startBalance,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onReplayTour: () => void;
  onResetBalance: () => void;
  startBalance: string;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2 id="settings-title">Game settings</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Close settings" autoFocus>
            ×
          </button>
        </div>

        <section className="set-group">
          <h3>Sound</h3>
          <label className="set-row" htmlFor="set-sound">
            <span>
              <span className="set-label">Sound effects</span>
              <span className="set-hint">Ticks, spins, wins and losses</span>
            </span>
            <input
              id="set-sound"
              type="checkbox"
              className="switch"
              checked={settings.sound}
              onChange={(e) => set('sound', e.target.checked)}
            />
          </label>
          <label className="set-row" htmlFor="set-volume">
            <span className="set-label">Volume</span>
            <input
              id="set-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              disabled={!settings.sound}
              onChange={(e) => set('volume', Number(e.target.value) / 100)}
              onPointerUp={() => sfx.bet()}
            />
          </label>
        </section>

        <section className="set-group">
          <h3>Gameplay</h3>
          <div className="set-row">
            <span>
              <span className="set-label">Round length</span>
              <span className="set-hint">Time to bet before each draw. Starts next round.</span>
            </span>
            <span className="seg" role="group" aria-label="Round length">
              {ROUND_CHOICES.map((n) => (
                <button
                  key={n}
                  className={settings.roundSeconds === n ? 'on' : ''}
                  aria-pressed={settings.roundSeconds === n}
                  onClick={() => set('roundSeconds', n)}
                >
                  {n}s
                </button>
              ))}
            </span>
          </div>
          <div className="set-row">
            <span>
              <span className="set-label">Bet step</span>
              <span className="set-hint">How much − and + change your bet</span>
            </span>
            <span className="seg" role="group" aria-label="Bet step">
              {STEP_CHOICES.map((n) => (
                <button
                  key={n}
                  className={settings.betStep === n ? 'on' : ''}
                  aria-pressed={settings.betStep === n}
                  onClick={() => set('betStep', n)}
                >
                  {n}
                </button>
              ))}
            </span>
          </div>
          <label className="set-row" htmlFor="set-motion">
            <span>
              <span className="set-label">Reduce motion</span>
              <span className="set-hint">Skips the reel spin and light effects</span>
            </span>
            <input
              id="set-motion"
              type="checkbox"
              className="switch"
              checked={settings.reduceMotion}
              onChange={(e) => set('reduceMotion', e.target.checked)}
            />
          </label>
        </section>

        <section className="set-group">
          <h3>Help and balance</h3>
          <div className="set-actions">
            <button className="set-btn" onClick={onReplayTour}>
              Replay How to play
            </button>
            {confirmReset ? (
              <span className="confirm">
                <span>Reset to {startBalance}?</span>
                <button
                  className="set-btn danger"
                  onClick={() => {
                    onResetBalance();
                    setConfirmReset(false);
                  }}
                >
                  Yes, reset
                </button>
                <button className="set-btn" onClick={() => setConfirmReset(false)}>
                  Keep
                </button>
              </span>
            ) : (
              <button className="set-btn" onClick={() => setConfirmReset(true)}>
                Reset balance
              </button>
            )}
          </div>
          <p className="set-note">Play money only. Multipliers pay 97% of fair odds.</p>
        </section>
      </div>
    </div>
  );
}
