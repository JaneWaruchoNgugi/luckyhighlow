import { useCallback, useEffect, useState } from 'react';
import { cancelBet, drawRound, letterFor, newGame, oddsFor, placeBet, type Direction, type GameState } from './game';
import { Reel } from './Reel';
import { RangeBar } from './RangeBar';
import { Tour } from './Tour';
import './App.css';

const START_BALANCE = 1000;
const STORAGE_KEY = 'luckyhighlow.balance';
const TOUR_KEY = 'luckyhighlow.tourSeen';
const CHIPS = [5, 10, 25, 50, 100];

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

const BET_SECONDS = 15;
const RESULT_MS = 3500;

type Phase = 'betting' | 'drawing' | 'result';

export default function App() {
  const [game, setGame] = useState<GameState>(() => newGame(loadBalance()));
  const [stake, setStake] = useState(10);
  /** While the reel spins, the screen keeps showing the state from before the draw. */
  const [before, setBefore] = useState<GameState | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const [phase, setPhase] = useState<Phase>('betting');
  const [phaseEnds, setPhaseEnds] = useState(() => Date.now() + BET_SECONDS * 1000);
  const [now, setNow] = useState(() => Date.now());
  const [touring, setTouring] = useState(() => !tourSeen());
  /** When the tour opened; the round clock stands still while it is open. */
  const [pausedAt, setPausedAt] = useState<number | null>(() => (tourSeen() ? null : Date.now()));
  const view = before ?? game;
  const betting = phase === 'betting';
  const clock = pausedAt ?? now;

  const openTour = useCallback(() => {
    setTouring(true);
    setPausedAt(Date.now());
  }, []);
  const closeTour = useCallback(() => {
    markTourSeen();
    setTouring(false);
    if (pausedAt !== null) {
      const paused = Date.now() - pausedAt;
      setPhaseEnds((e) => e + paused);
    }
    setPausedAt(null);
  }, [pausedAt]);

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
      setBefore(game);
      setGame(drawRound(game));
      setSpinKey((k) => k + 1);
    } else if (phase === 'result') {
      setPhase('betting');
      setPhaseEnds(Date.now() + BET_SECONDS * 1000);
    }
  }, [now, phase, phaseEnds, game, pausedAt]);

  const onSpinDone = useCallback(() => {
    setBefore(null);
    setPhase('result');
    setPhaseEnds(Date.now() + RESULT_MS);
  }, []);

  const secondsLeft = Math.max(0, Math.ceil((phaseEnds - clock) / 1000));
  const betProgress = betting ? Math.max(0, Math.min(1, (phaseEnds - clock) / (BET_SECONDS * 1000))) : 0;

  const higher = oddsFor(view.current, view.remaining, 'higher');
  const lower = oddsFor(view.current, view.remaining, 'lower');
  const available = game.balance + (game.bet?.stake ?? 0);
  const stakeOk = stake > 0 && stake <= available;
  const broke = betting && !game.bet && game.balance < Math.min(...CHIPS);
  const myBet = game.bet;

  const onBet = useCallback(
    (dir: Direction) => {
      if (!betting || !stakeOk) return;
      if (oddsFor(game.current, game.remaining, dir).multiplier === null) return;
      setGame(placeBet(game, dir, stake));
    },
    [game, betting, stake, stakeOk],
  );

  const onCancel = useCallback(() => {
    if (betting) setGame((g) => cancelBet(g));
  }, [betting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (touring || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === 'h' || e.key === 'ArrowUp') onBet('higher');
      else if (k === 'l' || e.key === 'ArrowDown') onBet('lower');
      else if (k === 'escape' || k === 'backspace') onCancel();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBet, onCancel, touring]);

  const last = view.last;
  const showResult = phase === 'result' && last !== null;
  let status: string;
  let resultClass: string;
  if (phase === 'drawing') {
    status = 'Bets closed. Drawing…';
    resultClass = 'drawing';
  } else if (showResult && last.bet) {
    const tag = `${letterFor(last.ball)} ${last.ball}`;
    status = last.won
      ? `${tag}! You won ${fmt(last.payout)}.`
      : `${tag} was ${last.bet.dir === 'higher' ? 'lower' : 'higher'}. You lost ${fmt(last.bet.stake)}.`;
    resultClass = last.won ? 'win' : 'lose';
  } else if (showResult) {
    status = `${letterFor(last.ball)} ${last.ball} drawn. No bet this round.`;
    resultClass = 'idle';
  } else if (myBet) {
    status = `Bet placed: ${fmt(myBet.stake)} on ${myBet.dir === 'higher' ? 'Higher' : 'Lower'}. Draw in ${secondsLeft}s.`;
    resultClass = 'placed';
  } else {
    status = `Place your bets. Draw in ${secondsLeft}s.`;
    resultClass = 'idle';
  }
  const flash = showResult && last.bet ? (last.won ? 'win' : 'lose') : null;

  const setBet = (n: number) => setStake(Math.max(1, Math.min(Math.floor(available), Math.floor(n))));

  const guessButton = (dir: Direction, o: typeof higher) => {
    const mine = myBet?.dir === dir;
    return (
      <button
        className={`btn guess ${dir} ${mine ? 'picked' : ''}`}
        onClick={() => onBet(dir)}
        disabled={!betting || !stakeOk || o.multiplier === null}
        aria-pressed={mine}
        aria-keyshortcuts={dir === 'higher' ? 'H ArrowUp' : 'L ArrowDown'}
      >
        <span className="g-title">{dir === 'higher' ? '▲ Higher' : '▼ Lower'}</span>
        <span className="g-meta">
          {mine
            ? `Your bet ${fmt(myBet.stake)} · pays ${fmt(myBet.stake * myBet.step)}`
            : o.multiplier === null
              ? 'No balls left'
              : `Pays ${stakeOk ? fmt(stake * o.multiplier) : '–'}`}
        </span>
      </button>
    );
  };

  const oddsCard = (dir: Direction, o: typeof higher) => (
    <div className={`odds-card ${dir}`}>
      <span className="odds-dir">{dir === 'higher' ? '▲ Higher' : '▼ Lower'}</span>
      <span className="odds-mult">{o.multiplier === null ? '—' : `×${o.multiplier.toFixed(2)}`}</span>
      <span className="odds-chance">
        {pct(o.chance)} · {o.winning} {o.winning === 1 ? 'ball' : 'balls'}
      </span>
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="logo">
          <span className="logo-lucky">Lucky</span>
          <span className="logo-hl">highlow</span>
        </h1>
        <div className="topbar-right">
          <button className="help" onClick={openTour}>
            <span aria-hidden="true">?</span> How to play
          </button>
          <div className={`balance ${flash ?? ''}`} aria-live="polite" data-tour="balance">
            <span className="balance-coin" aria-hidden="true" />
            <span className="amount">{fmt(view.balance)}</span>
            {showResult && last.won && <span className="balance-delta">+{fmt(last.payout)}</span>}
          </div>
        </div>
      </header>

      <main className="table">
        <section className="game" aria-label="Game">
          <div className="live-wrap" data-tour="timer">
            <div className="live-bar">
              <span className="live-badge">
                <span className="live-dot" aria-hidden="true" />
                Live
              </span>
              <span className="round-no">Round {view.round}</span>
              <span className={`countdown ${betting && secondsLeft <= 5 ? 'hurry' : ''}`} aria-hidden="true">
                {betting ? `${secondsLeft}s` : phase === 'drawing' ? 'Drawing' : 'Next round'}
              </span>
            </div>
            <div className="timer" aria-hidden="true">
              <span className="timer-fill" style={{ transform: `scaleX(${betProgress})` }} />
            </div>
          </div>

          <p className={`toast ${resultClass}`} role="status">
            {status}
          </p>

          <div className="arena" data-tour="arena">
            {oddsCard('lower', lower)}
            <div className={`marquee ${phase === 'drawing' ? 'on' : ''}`} data-tour="ball">
              <Reel target={game.current} spinKey={spinKey} onDone={onSpinDone} />
            </div>
            {oddsCard('higher', higher)}
          </div>

          <div className="range-wrap" data-tour="range">
            <RangeBar current={view.current} remaining={view.remaining} />
          </div>
          <p className="drum-count">{view.remaining.length} of 75 balls left in the drum</p>
        </section>

        <aside className="controls" aria-label="Bet">
          <div className="bet-group" data-tour="bet">
            <div className="field">
              <label className="label" htmlFor="stake">
                Bet amount
              </label>
              <div className="stake-box">
                <span className="stake-coin" aria-hidden="true" />
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
                <button className="mini" onClick={() => setBet(stake / 2)} disabled={!betting}>
                  ½
                </button>
                <button className="mini" onClick={() => setBet(stake * 2)} disabled={!betting}>
                  2×
                </button>
              </div>
            </div>

            <div className="chips" role="group" aria-label="Quick bets">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  className={`chip ${stake === c ? 'on' : ''}`}
                  onClick={() => setStake(c)}
                  disabled={!betting || c > available}
                  aria-pressed={stake === c}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {broke ? (
            <button className="btn refill" onClick={() => setGame((g) => ({ ...g, balance: START_BALANCE }))}>
              Refill to {fmt(START_BALANCE)}
            </button>
          ) : (
            <div className="actions" data-tour="guess">
              {guessButton('higher', higher)}
              {guessButton('lower', lower)}
            </div>
          )}
          {myBet && betting && (
            <button className="mini cancel" onClick={onCancel}>
              Cancel bet
            </button>
          )}
          {!betting && <p className="bets-closed">Bets are closed until the next round.</p>}
          {!stakeOk && !broke && <p className="bet-error">Bet must be between 1 and your balance.</p>}
          <p className="keys">
            <kbd>H</kbd> higher · <kbd>L</kbd> lower · <kbd>Esc</kbd> cancel
          </p>
        </aside>
      </main>
      <p className="footnote">
        A new ball is drawn every {BET_SECONDS} seconds. Your multiplier is locked when you bet. Play money only;
        multipliers pay 97% of fair odds.
      </p>
      {touring && <Tour onClose={closeTour} />}
    </div>
  );
}
