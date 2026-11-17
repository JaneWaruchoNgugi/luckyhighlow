import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LETTERS,
  TOTAL_BALLS,
  cashOut,
  guess,
  letterFor,
  newGame,
  oddsFor,
  potentialWin,
  startRound,
  type Direction,
  type GameState,
} from './game';
import { Reel } from './Reel';
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

function Ball({ n, size = 'lg', animKey }: { n: number | null; size?: 'lg' | 'sm'; animKey?: number }) {
  if (n === null) {
    return (
      <div className={`ball ball-${size} ball-empty`} aria-label="No ball drawn yet">
        <span className="ball-face">?</span>
      </div>
    );
  }
  const l = letterFor(n);
  return (
    <div key={animKey} className={`ball ball-${size} col-${l}`} aria-label={`${l} ${n}`}>
      <span className="ball-face">
        <span className="ball-letter">{l}</span>
        <span className="ball-num">{n}</span>
      </span>
    </div>
  );
}

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

  const playing = game.phase === 'playing';
  const higher = playing && game.current !== null ? oddsFor(game.current, game.remaining, 'higher') : null;
  const lower = playing && game.current !== null ? oddsFor(game.current, game.remaining, 'lower') : null;
  const drawnSet = useMemo(() => new Set(view.drawn), [view.drawn]);
  const broke = !playing && !spinning && game.balance < 1;
  const stakeOk = stake > 0 && stake <= game.balance;

  const deal = useCallback(() => {
    if (!stakeOk || playing || spinning) return;
    setFlash(null);
    const next = startRound(game, stake);
    setBefore({ ...next, current: game.current, drawn: [], phase: 'playing' });
    setGame(next);
    setSpinKey((k) => k + 1);
  }, [stake, stakeOk, playing, spinning, game]);

  const onGuess = useCallback(
    (dir: Direction) => {
      const o = dir === 'higher' ? higher : lower;
      if (spinning || !o || o.multiplier === null) return;
      const next = guess(game, dir);
      setFlash(null);
      setBefore(game);
      setGame(next);
      setSpinKey((k) => k + 1);
    },
    [game, higher, lower, spinning],
  );

  const onCashOut = useCallback(() => {
    if (playing && !spinning) setGame((g) => cashOut(g));
  }, [playing, spinning]);

  const onSpinDone = useCallback(() => {
    setBefore(null);
    setFlash(game.last ? (game.last.won ? 'win' : 'lose') : null);
  }, [game]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (playing && (k === 'h' || e.key === 'ArrowUp')) onGuess('higher');
      else if (playing && (k === 'l' || e.key === 'ArrowDown')) onGuess('lower');
      else if (playing && k === 'c') onCashOut();
      else if (!playing && (k === 'enter' || k === ' ')) deal();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, onGuess, onCashOut, deal]);

  const streak = view.drawn.length - 1 - (view.phase === 'lost' ? 1 : 0);

  const viewPlaying = view.phase === 'playing';
  let status: string;
  if (spinning) status = 'Drawing…';
  else if (view.phase === 'idle') status = 'Pick a stake and draw the first ball.';
  else if (view.phase === 'lost')
    status = `${letterFor(view.last!.ball)} ${view.last!.ball} was ${view.last!.dir === 'higher' ? 'lower' : 'higher'}. Stake lost.`;
  else if (view.phase === 'cashed') status = `Cashed out ${fmt(view.payout)} at ×${view.multiplier.toFixed(2)}.`;
  else if (view.last) status = `Correct! ×${view.last.step.toFixed(2)} added. Keep going or cash out.`;
  else status = 'Will the next ball be higher or lower?';

  return (
    <div className="app">
      <header className="top">
        <h1 className="logo">
          <span className="logo-lucky">Lucky</span>
          <span className="logo-hl">highlow</span>
        </h1>
        <div className="balance" aria-live="polite">
          <span className="label">Play money</span>
          <span className="amount">{fmt(view.balance)}</span>
        </div>
      </header>

      <main className="table">
        <section className={`stage ${flash ?? ''}`}>
          <div className="stage-meta">
            <div>
              <span className="label">Stake</span>
              <span className="value">{view.phase !== 'idle' ? fmt(view.stake) : '—'}</span>
            </div>
            <div>
              <span className="label">Multiplier</span>
              <span className="value mult">×{view.multiplier.toFixed(2)}</span>
            </div>
            <div>
              <span className="label">{view.phase === 'cashed' ? 'Won' : 'Cash out'}</span>
              <span className="value win">
                {view.phase === 'cashed' ? fmt(view.payout) : playing ? fmt(potentialWin(game)) : '—'}
              </span>
            </div>
          </div>

          <div className="ball-wrap">
            <Reel target={game.current} spinKey={spinKey} onDone={onSpinDone} />
            <div className="drum-count">
              {viewPlaying ? `${view.remaining.length} balls left` : view.phase === 'idle' ? `${TOTAL_BALLS} balls` : ''}
            </div>
          </div>

          <p className="status" role="status">
            {status}
          </p>

          {viewPlaying ? (
            <div className="actions">
              <button
                className="btn guess higher"
                onClick={() => onGuess('higher')}
                disabled={spinning || !higher || higher.multiplier === null}
              >
                <span className="g-title">▲ Higher</span>
                <span className="g-odds">
                  {spinning ? '…' : higher?.multiplier ? `×${higher.multiplier.toFixed(2)} · ${pct(higher.chance)}` : 'none left'}
                </span>
              </button>
              <button className="btn cash" onClick={onCashOut} disabled={spinning || !view.last}>
                Cash out
                <span className="g-odds">{fmt(potentialWin(game))}</span>
              </button>
              <button
                className="btn guess lower"
                onClick={() => onGuess('lower')}
                disabled={spinning || !lower || lower.multiplier === null}
              >
                <span className="g-title">▼ Lower</span>
                <span className="g-odds">
                  {spinning ? '…' : lower?.multiplier ? `×${lower.multiplier.toFixed(2)} · ${pct(lower.chance)}` : 'none left'}
                </span>
              </button>
            </div>
          ) : (
            <div className="bet">
              <div className="chips">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    className={`chip ${stake === c ? 'on' : ''}`}
                    onClick={() => setStake(c)}
                    disabled={c > view.balance}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="stake-input">
                <span className="label">Stake</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={stake}
                  onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
              </label>
              {broke ? (
                <button className="btn deal" onClick={() => setGame(newGame(START_BALANCE))}>
                  Refill to {START_BALANCE}
                </button>
              ) : (
                <button className="btn deal" onClick={deal} disabled={!stakeOk || spinning}>
                  {view.phase === 'idle' ? 'Draw first ball' : 'Play again'}
                </button>
              )}
            </div>
          )}
          <p className="keys">Keys: H or ↑ higher · L or ↓ lower · C cash out · Enter to draw</p>
        </section>

        <aside className="side">
          <div className="history">
            <div className="side-head">
              <h2>This round</h2>
              {streak > 0 && <span className="streak">{streak} correct</span>}
            </div>
            <div className="history-row">
              {view.drawn.length === 0 && <span className="muted">No balls yet</span>}
              {view.drawn.map((b, i) => (
                <Ball key={b} n={b} size="sm" animKey={i} />
              ))}
            </div>
          </div>

          <div className="board" aria-label="Bingo 75 board">
            {LETTERS.map((l, row) => (
              <div className="board-row" key={l}>
                <span className={`board-letter col-${l}`}>{l}</span>
                {Array.from({ length: 15 }, (_, i) => row * 15 + i + 1).map((n) => (
                  <span
                    key={n}
                    className={`cell ${drawnSet.has(n) ? `hit col-${l}` : ''} ${n === view.current ? 'now' : ''}`}
                  >
                    {n}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <details className="rules">
            <summary>How it works</summary>
            <p>
              75 bingo balls, drawn without replacement. Guess whether the next ball is higher or lower than the one
              showing. Each correct guess multiplies your win by the odds of what is left in the drum: the fewer balls
              that can win, the bigger the multiplier. A wrong guess loses the stake. Cash out any time after your
              first correct guess.
            </p>
            <p>Multipliers pay 97% of fair odds. Play money only, no real value.</p>
          </details>
        </aside>
      </main>
    </div>
  );
}
