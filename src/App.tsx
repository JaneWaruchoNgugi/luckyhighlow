import { useCallback, useEffect, useState } from 'react';
import { letterFor, newGame, oddsFor, placeBet, type Direction, type GameState } from './game';
import { Reel } from './Reel';
import { RangeBar } from './RangeBar';
import './App.css';

const START_BALANCE = 1000;
const STORAGE_KEY = 'luckyhighlow.balance';
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

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function App() {
  const [game, setGame] = useState<GameState>(() => newGame(loadBalance()));
  const [stake, setStake] = useState(10);
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);
  /** While the reel spins, the screen keeps showing the state from before the draw. */
  const [before, setBefore] = useState<GameState | null>(null);
  const [spinKey, setSpinKey] = useState(0);
  const spinning = before !== null;
  const view = before ?? game;

  useEffect(() => saveBalance(game.balance), [game.balance]);

  const higher = oddsFor(view.current, view.remaining, 'higher');
  const lower = oddsFor(view.current, view.remaining, 'lower');
  const stakeOk = stake > 0 && stake <= game.balance;
  const broke = !spinning && game.balance < Math.min(...CHIPS);

  const onBet = useCallback(
    (dir: Direction) => {
      if (spinning || !stakeOk) return;
      if (oddsFor(game.current, game.remaining, dir).multiplier === null) return;
      setFlash(null);
      setBefore({ ...game, balance: game.balance - stake });
      setGame(placeBet(game, dir, stake));
      setSpinKey((k) => k + 1);
    },
    [game, spinning, stake, stakeOk],
  );

  const onSpinDone = useCallback(() => {
    setBefore(null);
    setFlash(game.last ? (game.last.won ? 'win' : 'lose') : null);
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === 'h' || e.key === 'ArrowUp') onBet('higher');
      else if (k === 'l' || e.key === 'ArrowDown') onBet('lower');
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBet]);

  const last = view.last;
  let status: string;
  if (spinning) status = 'Drawing…';
  else if (!last) status = 'Pick your bet, then guess: will the next ball be higher or lower?';
  else if (last.won) status = `${letterFor(last.ball)} ${last.ball}! Paid ${fmt(last.payout)} on your ${fmt(last.stake)} bet.`;
  else status = `${letterFor(last.ball)} ${last.ball} was ${last.dir === 'higher' ? 'lower' : 'higher'}. You lost ${fmt(last.stake)}.`;

  const oddsText = (o: typeof higher) =>
    spinning ? '…' : o.multiplier ? `×${o.multiplier.toFixed(2)} · ${pct(o.chance)}` : 'none left';
  const winText = (o: typeof higher) => (o.multiplier && stakeOk ? `Pays ${fmt(stake * o.multiplier)}` : ' ');

  return (
    <div className="app">
      <header className="top">
        <h1 className="logo">
          <span className="logo-lucky">Lucky</span>
          <span className="logo-hl">
            high<span className="logo-arrow up">▲</span>low<span className="logo-arrow down">▼</span>
          </span>
        </h1>
        <div className={`balance ${flash ?? ''}`} aria-live="polite">
          <span className="balance-coin" aria-hidden="true">L</span>
          <span>
            <span className="label">Balance</span>
            <span className="amount">{fmt(view.balance)}</span>
          </span>
          {!spinning && last?.won && <span className="balance-delta">+{fmt(last.payout)}</span>}
        </div>
      </header>

      <main className={`stage ${flash ?? ''}`}>
        <div className="ball-wrap">
          <div className={`marquee ${spinning ? 'on' : ''}`}>
            <Reel target={game.current} spinKey={spinKey} onDone={onSpinDone} />
          </div>
          <div className="drum-count">{view.remaining.length} balls left in the drum</div>
        </div>

        <RangeBar current={view.current} remaining={view.remaining} />

        <p className="status" role="status">
          {status}
        </p>

        <div className="bet-panel">
          <div className="bet-row">
            <div className="chips" role="group" aria-label="Bet amount">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  className={`chip ${stake === c ? 'on' : ''}`}
                  onClick={() => setStake(c)}
                  disabled={spinning || c > game.balance}
                  aria-pressed={stake === c}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="stake-input" htmlFor="stake">
              <span className="label">Bet</span>
              <input
                id="stake"
                type="number"
                min={1}
                step={1}
                value={stake}
                disabled={spinning}
                onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
            </label>
          </div>

          {broke ? (
            <button className="btn refill" onClick={() => setGame((g) => ({ ...g, balance: START_BALANCE, last: null }))}>
              Out of play money. Refill to {fmt(START_BALANCE)}
            </button>
          ) : (
            <div className="actions">
              <button
                className="btn guess higher"
                onClick={() => onBet('higher')}
                disabled={spinning || !stakeOk || higher.multiplier === null}
              >
                <span className="g-title">▲ Higher</span>
                <span className="g-odds">{oddsText(higher)}</span>
                <span className="g-win">{spinning ? ' ' : winText(higher)}</span>
              </button>
              <button
                className="btn guess lower"
                onClick={() => onBet('lower')}
                disabled={spinning || !stakeOk || lower.multiplier === null}
              >
                <span className="g-title">▼ Lower</span>
                <span className="g-odds">{oddsText(lower)}</span>
                <span className="g-win">{spinning ? ' ' : winText(lower)}</span>
              </button>
            </div>
          )}
          {!stakeOk && !broke && <p className="bet-error">Bet must be between 1 and your balance.</p>}
        </div>

        <p className="keys">Keys: H or ↑ for higher, L or ↓ for lower</p>
      </main>
    </div>
  );
}
