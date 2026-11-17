import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelBet, drawRound, letterFor, newGame, oddsFor, placeBet, type Direction, type GameState } from './game';
import { RangeBar } from './RangeBar';
import { Tour } from './Tour';
import { GameCanvas, type LightShow } from './GameCanvas';
import { SettingsPanel } from './SettingsPanel';
import { loadSettings, saveSettings, type Settings } from './settings';
import { setSound, sfx, unlockAudio } from './sound';
import './App.css';

const START_BALANCE = 1000;
const STORAGE_KEY = 'luckyhighlow.balance';
const TOUR_KEY = 'luckyhighlow.tourSeen';
const RECENT_MAX = 6;

interface Recent {
  round: number;
  ball: number;
  up: boolean;
}

function loadBalance(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : START_BALANCE;
  } catch {
    return START_BALANCE;
  }
}

function saveBalance(n: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* storage unavailable: balance lives for this visit only */
  }
}

function tourSeen(): boolean {
  try {
    return localStorage.getItem(TOUR_KEY) === '1';
  } catch {
    return false;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(TOUR_KEY, '1');
  } catch {
    /* fine: the tour just shows again next visit */
  }
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${Math.round(n * 100)}%`;

const RESULT_MS = 3500;
const QUICK_BETS = [10, 50, 100, 500];

type Phase = 'betting' | 'drawing' | 'result';

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [game, setGame] = useState<GameState>(() => newGame(loadBalance()));
  const [stake, setStake] = useState(10);
  /** While the reel spins, the screen keeps showing the state from before the draw. */
  const [before, setBefore] = useState<GameState | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [phase, setPhase] = useState<Phase>('betting');
  const [phaseEnds, setPhaseEnds] = useState(() => Date.now() + settings.roundSeconds * 1000);
  /** Length of the current betting window; a new round length applies from the next round. */
  const [windowMs, setWindowMs] = useState(() => settings.roundSeconds * 1000);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [touring, setTouring] = useState(() => !tourSeen());
  /** When the tour opened; the round clock stands still while it is open. */
  const [pausedAt, setPausedAt] = useState<number | null>(() => (tourSeen() ? null : Date.now()));
  const view = before ?? game;
  const betting = phase === 'betting';
  const clock = pausedAt ?? now;

  const pause = useCallback(() => setPausedAt((p) => p ?? Date.now()), []);
  const resume = useCallback(() => {
    if (pausedAt !== null) {
      const paused = Date.now() - pausedAt;
      setPhaseEnds((e) => e + paused);
    }
    setPausedAt(null);
  }, [pausedAt]);
  const openTour = useCallback(() => {
    setSettingsOpen(false);
    setTouring(true);
    pause();
  }, [pause]);
  const closeTour = useCallback(() => {
    markTourSeen();
    setTouring(false);
    resume();
  }, [resume]);
  const openSettings = useCallback(() => {
    sfx.click();
    setSettingsOpen(true);
    pause();
  }, [pause]);
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    resume();
  }, [resume]);

  useEffect(() => {
    setSound(settings.sound, settings.volume);
    saveSettings(settings);
  }, [settings]);

  // Browsers only play sound after the first tap or key press.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => saveBalance(game.balance + (game.bet?.stake ?? 0)), [game.balance, game.bet]);

  // Live clock: ticks the countdown and moves the round along.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (pausedAt !== null || now < phaseEnds) return;
    if (phase === 'betting') {
      setPhase('drawing');
      setPhaseEnds(Number.POSITIVE_INFINITY);
      sfx.close();
      if (!settings.reduceMotion) sfx.spin(1500);
      setBefore(game);
      setGame(drawRound(game));
      setSpinKey((k) => k + 1);
    } else if (phase === 'result') {
      setPhase('betting');
      setPhaseEnds(Date.now() + settings.roundSeconds * 1000);
      setWindowMs(settings.roundSeconds * 1000);
    }
  }, [now, phase, phaseEnds, game, pausedAt, settings.roundSeconds, settings.reduceMotion]);

  const onSpinDone = useCallback(() => {
    const r = game.last;
    sfx.land();
    if (r?.bet) window.setTimeout(() => (r.won ? sfx.win() : sfx.lose()), 180);
    if (r) setRecent((list) => [{ round: r.round, ball: r.ball, up: r.ball > r.from }, ...list].slice(0, RECENT_MAX));
    setBefore(null);
    setPhase('result');
    setPhaseEnds(Date.now() + RESULT_MS);
  }, [game.last]);

  const secondsLeft = Math.max(0, Math.ceil((phaseEnds - clock) / 1000));

  // Countdown ticks in the last five seconds of betting.
  const lastTick = useRef(0);
  useEffect(() => {
    if (!betting || pausedAt !== null || secondsLeft > 5 || secondsLeft < 1) return;
    if (lastTick.current === secondsLeft) return;
    lastTick.current = secondsLeft;
    sfx.tick(secondsLeft <= 3);
  }, [betting, pausedAt, secondsLeft]);
  useEffect(() => {
    if (betting) lastTick.current = 0;
  }, [betting]);

  const higher = oddsFor(view.current, view.remaining, 'higher');
  const lower = oddsFor(view.current, view.remaining, 'lower');
  const available = game.balance + (game.bet?.stake ?? 0);
  const stakeOk = stake > 0 && stake <= available;
  const broke = betting && !game.bet && game.balance < 1;
  const myBet = game.bet;

  const onBet = useCallback(
    (dir: Direction) => {
      if (!betting || !stakeOk) return;
      if (oddsFor(game.current, game.remaining, dir).multiplier === null) return;
      setGame(placeBet(game, dir, stake));
      sfx.bet();
    },
    [game, betting, stake, stakeOk],
  );

  const onCancel = useCallback(() => {
    if (!betting || !game.bet) return;
    setGame((g) => cancelBet(g));
    sfx.cancel();
  }, [betting, game.bet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (touring || settingsOpen || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === 'h' || e.key === 'ArrowUp') onBet('higher');
      else if (k === 'l' || e.key === 'ArrowDown') onBet('lower');
      else if (k === 'escape' || k === 'backspace') onCancel();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBet, onCancel, touring, settingsOpen]);

  const last = view.last;
  const showResult = phase === 'result' && last !== null;
  let status: React.ReactNode;
  let resultClass: string;
  if (phase === 'drawing') {
    status = 'Bets closed. Drawing…';
    resultClass = 'drawing';
  } else if (showResult && last.bet) {
    const tag = `${letterFor(last.ball)}-${last.ball}`;
    status = last.won
      ? `${tag}! You won ${fmt(last.payout)}.`
      : `${tag} was ${last.bet.dir === 'higher' ? 'lower' : 'higher'}. You lost ${fmt(last.bet.stake)}.`;
    resultClass = last.won ? 'win' : 'lose';
  } else if (showResult) {
    status = `${letterFor(last.ball)}-${last.ball} drawn. No bet this round.`;
    resultClass = 'idle';
  } else if (myBet) {
    status = (
      <>
        Bet placed on <b>{myBet.dir === 'higher' ? 'Higher' : 'Lower'}</b>. Good luck!
      </>
    );
    resultClass = 'placed';
  } else {
    status = <>Place your bets!</>;
    resultClass = 'idle';
  }
  const lightShow: LightShow =
    phase === 'drawing'
      ? 'draw'
      : showResult && last.bet
        ? last.won
          ? 'win'
          : 'lose'
        : betting && secondsLeft <= 5 && !touring
          ? 'hurry'
          : 'idle';
  const flash = showResult && last.bet ? (last.won ? 'win' : 'lose') : null;

  const setBet = (n: number) => {
    sfx.click();
    setStake(Math.max(1, Math.min(Math.floor(available), Math.floor(n))));
  };
  const step = settings.betStep;

  const payFor = (dir: Direction, o: typeof higher) =>
    myBet?.dir === dir ? myBet.stake * myBet.step : o.multiplier !== null && stakeOk ? stake * o.multiplier : null;

  const guessButton = (dir: Direction, o: typeof higher) => {
    const mine = myBet?.dir === dir;
    const pays = payFor(dir, o);
    return (
      <button
        className={`guess ${dir} ${mine ? 'picked' : ''}`}
        onClick={() => onBet(dir)}
        disabled={!betting || !stakeOk || o.multiplier === null}
        aria-pressed={mine}
        aria-keyshortcuts={dir === 'higher' ? 'H ArrowUp' : 'L ArrowDown'}
      >
        {mine && <span className="g-ribbon">Your bet · {fmt(myBet.stake)}</span>}
        <span className="g-icon" aria-hidden="true">
          <Arrow up={dir === 'higher'} />
        </span>
        <span className="g-text">
          <span className="g-title">{dir === 'higher' ? 'Higher' : 'Lower'}</span>
          <span className="g-sub">
            {o.multiplier === null
              ? 'No balls left'
              : `×${(mine ? myBet.step : o.multiplier).toFixed(2)} · ${pct(o.chance)}`}
          </span>
        </span>
        <span className="g-pay">
          <span className="g-pay-label">Win</span>
          <span className="g-pay-amount">{pays === null ? '–' : fmt(pays)}</span>
        </span>
      </button>
    );
  };

  const oddsCard = (dir: Direction, o: typeof higher) => {
    const pays = payFor(dir, o);
    const mine = myBet?.dir === dir;
    return (
      <button
        className={`odds-card ${dir} ${mine ? 'picked' : ''}`}
        onClick={() => onBet(dir)}
        disabled={!betting || !stakeOk || o.multiplier === null}
        aria-pressed={mine}
        aria-label={`Bet ${dir}${o.multiplier ? ` at ×${o.multiplier.toFixed(2)}` : ''}`}
      >
        <span className="odds-dir">
          <Arrow up={dir === 'higher'} />
          {dir === 'higher' ? 'Higher' : 'Lower'}
        </span>
        <span className="odds-mult">{o.multiplier === null ? '—' : `×${o.multiplier.toFixed(2)}`}</span>
        <span className="odds-chance">
          ≈ {pct(o.chance)} · {pays === null ? '–' : fmt(pays)}
        </span>
      </button>
    );
  };

  return (
    <div className="app">
      <div className="bg-balls" aria-hidden="true">
        {[68, 75, 12, 47, 33, 59, 8, 21].map((n, i) => (
          <span key={i} className={`bg-ball b${i}`}>
            {n}
          </span>
        ))}
      </div>

      <header className="hdr">
        <button className="menu" onClick={openSettings} aria-label="Game settings">
          <span />
          <span />
          <span />
        </button>
        <div className="brand">
          <h1 className="logo">
            <Crown />
            <span className="l-lucky">Lucky</span>
            <span className="l-hl">highlow</span>
          </h1>
          <p className="tagline">Guess Higher or Lower and Multiply Your Win!</p>
        </div>
        <div className="hdr-right">
          <button className="pill help" onClick={openTour}>
            <span className="help-q" aria-hidden="true">
              ?
            </span>
            How to play
          </button>
          <button className="pill gear" onClick={openSettings} aria-label="Game settings">
            <Gear />
            <span className="gear-label">Settings</span>
          </button>
          <div className={`pill balance ${flash ?? ''}`} aria-live="polite" data-tour="balance">
            <span className="coin" aria-hidden="true" />
            <span className="amount">{fmt(view.balance)}</span>
            {showResult && last.won && <span className="balance-delta">+{fmt(last.payout)}</span>}
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="stage" aria-label="Game">
          <p className={`status ${resultClass}`} role="status">
            <span className="live-icon" aria-hidden="true">
              <i />
            </span>
            <span>{status}</span>
          </p>
          <div className="arena" data-tour="arena">
            {oddsCard('lower', lower)}
            <div className="canvas-wrap" data-tour="ball">
              <GameCanvas
                target={game.current}
                spinKey={spinKey}
                show={lightShow}
                countdown={
                  betting
                    ? {
                        endsAt: phaseEnds,
                        totalMs: windowMs,
                        frozenMs: pausedAt !== null ? phaseEnds - pausedAt : null,
                      }
                    : null
                }
                reduceMotion={settings.reduceMotion}
                onDone={onSpinDone}
              />
              <span className="round-tag">Round {view.round}</span>
            </div>
            {oddsCard('higher', higher)}
          </div>
        </section>

        <section className="bet-panel" aria-label="Your bet">
          <div className="panel-head">
            <span className="panel-title">
              <Coins />
              Your Bet
            </span>
            <span className={`panel-state ${betting ? 'open' : 'closed'}`}>
              <i aria-hidden="true" />
              {betting ? 'Bets open' : 'Bets closed'}
            </span>
          </div>

          <div className="bet-controls" data-tour="bet">
            <div className="stepper">
              <button
                className="round-btn"
                onClick={() => setBet(stake - step)}
                disabled={!betting || stake <= 1}
                aria-label={`Lower bet by ${step}`}
              >
                −
              </button>
              <label className="stake-box" htmlFor="stake">
                <span className="coin" aria-hidden="true" />
                <span className="sr-only">Bet amount</span>
                <input
                  id="stake"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={stake}
                  disabled={!betting}
                  onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
              </label>
              <button
                className="round-btn"
                onClick={() => setBet(stake + step)}
                disabled={!betting || stake >= available}
                aria-label={`Raise bet by ${step}`}
              >
                +
              </button>
            </div>
            <div className="quick" role="group" aria-label="Bet amount shortcuts">
              {QUICK_BETS.map((n) => (
                <button
                  key={n}
                  className={stake === n ? 'on' : ''}
                  aria-pressed={stake === n}
                  onClick={() => setBet(n)}
                  disabled={!betting || n > available}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {broke ? (
            <button className="refill" onClick={() => setGame((g) => ({ ...g, balance: START_BALANCE }))}>
              Refill to {fmt(START_BALANCE)}
            </button>
          ) : (
            <div className="actions" data-tour="guess">
              {guessButton('higher', higher)}
              {guessButton('lower', lower)}
            </div>
          )}

          {myBet && betting && (
            <button className="cancel" onClick={onCancel}>
              Cancel bet
            </button>
          )}
          {!stakeOk && !broke && <p className="bet-error">Bet must be between 1 and your balance.</p>}
        </section>

        <section className="panel progress" data-tour="range">
          <RangeBar current={view.current} remaining={view.remaining} />
        </section>

        <section className="panel recent" aria-label="Recent results">
          <span className="recent-title">
            <Clock />
            Recent Results:
          </span>
          <span className="recent-balls">
            {recent.length === 0 && <span className="muted">The first draw lands in a few seconds.</span>}
            {recent.map((r) => (
              <span
                key={r.round}
                className={`mini-ball ${r.up ? 'up' : 'down'}`}
                title={`Round ${r.round}: ${r.ball}, ${r.up ? 'higher' : 'lower'}`}
              >
                {r.ball}
              </span>
            ))}
          </span>
        </section>
      </main>

      <p className="footnote">
        Bets close {settings.roundSeconds} seconds into each round. Play money only; multipliers pay 97% of fair odds.{' '}
        <kbd>H</kbd> higher · <kbd>L</kbd> lower · <kbd>Esc</kbd> cancel
      </p>

      <button className="help-fab" onClick={openTour}>
        <span aria-hidden="true">?</span>
        How to play
      </button>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onChange={setSettings}
          onClose={closeSettings}
          onReplayTour={openTour}
          onResetBalance={() => {
            setGame((g) => ({ ...g, balance: START_BALANCE }));
            sfx.win();
          }}
          startBalance={fmt(START_BALANCE)}
        />
      )}
      {touring && <Tour onClose={closeTour} />}
    </div>
  );
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="arrow">
      {up ? <path d="M12 3 4 13h5v8h6v-8h5z" /> : <path d="M12 21 4 11h5V3h6v8h5z" />}
    </svg>
  );
}

function Crown() {
  return (
    <svg className="crown" viewBox="0 0 64 44" aria-hidden="true">
      <defs>
        <linearGradient id="crownGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a8" />
          <stop offset=".5" stopColor="#ffc928" />
          <stop offset="1" stopColor="#c47a00" />
        </linearGradient>
      </defs>
      <path
        d="M4 14 18 26 32 4l14 22 14-12-6 26H10z"
        fill="url(#crownGold)"
        stroke="#7a4500"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="13" r="4" fill="#ffe16b" stroke="#7a4500" strokeWidth="2" />
      <circle cx="32" cy="5" r="4" fill="#ffe16b" stroke="#7a4500" strokeWidth="2" />
      <circle cx="60" cy="13" r="4" fill="#ffe16b" stroke="#7a4500" strokeWidth="2" />
      <rect x="10" y="36" width="44" height="6" rx="2" fill="#e9a400" stroke="#7a4500" strokeWidth="2" />
    </svg>
  );
}

function Coins() {
  return (
    <svg className="icon coins" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="9" cy="17" rx="7" ry="3" fill="#e9a400" />
      <ellipse cx="9" cy="15" rx="7" ry="3" fill="#ffd34d" stroke="#b77800" />
      <ellipse cx="15" cy="10" rx="7" ry="3" fill="#e9a400" />
      <ellipse cx="15" cy="8" rx="7" ry="3" fill="#ffe27a" stroke="#b77800" />
    </svg>
  );
}

function Clock() {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.3-5.6" fill="none" stroke="#ffd34d" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M4 4v4h4M12 7v5l3 2" fill="none" stroke="#ffd34d" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.3 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
        transform="translate(-1 0)"
      />
    </svg>
  );
}
