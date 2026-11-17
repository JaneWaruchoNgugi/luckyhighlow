/** Luckyhighlow core rules. Pure functions, no React, so they can be unit tested. */

export const TOTAL_BALLS = 75;
/** Share of fair odds paid back. 0.97 means a 3% house edge on every step. */
export const RETURN_TO_PLAYER = 0.97;

export type Letter = 'B' | 'I' | 'N' | 'G' | 'O';
export type Direction = 'higher' | 'lower';
export type Phase = 'idle' | 'playing' | 'lost' | 'cashed';

export const LETTERS: Letter[] = ['B', 'I', 'N', 'G', 'O'];

export function letterFor(ball: number): Letter {
  if (!Number.isInteger(ball) || ball < 1 || ball > TOTAL_BALLS) {
    throw new RangeError(`Ball must be 1-${TOTAL_BALLS}, got ${ball}`);
  }
  return LETTERS[Math.floor((ball - 1) / 15)];
}

export interface Odds {
  /** Balls left in the drum that would win this guess. */
  winning: number;
  /** Balls left in the drum. */
  total: number;
  /** Chance of winning, 0-1. */
  chance: number;
  /** Payout multiplier for this one step, or null when the guess cannot win. */
  multiplier: number | null;
}

/** Floor to 2 decimals so displayed multipliers never overpay. */
export function floor2(n: number): number {
  return Math.floor(n * 100 + 1e-9) / 100;
}

export function oddsFor(current: number, remaining: readonly number[], dir: Direction): Odds {
  const total = remaining.length;
  const winning = remaining.filter((b) => (dir === 'higher' ? b > current : b < current)).length;
  const chance = total === 0 ? 0 : winning / total;
  const multiplier = winning === 0 ? null : Math.max(1.01, floor2((RETURN_TO_PLAYER * total) / winning));
  return { winning, total, chance, multiplier };
}

export interface GameState {
  phase: Phase;
  balance: number;
  stake: number;
  /** Total multiplier built up this round. */
  multiplier: number;
  current: number | null;
  /** Balls still in the drum (excludes current). */
  remaining: number[];
  /** Balls drawn this round, in order, including current. */
  drawn: number[];
  /** Result of the last guess, for feedback. */
  last: { dir: Direction; ball: number; won: boolean; step: number } | null;
  /** Amount paid out when the round ended by cashing out. */
  payout: number;
}

export type Rng = () => number;

export const defaultRng: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

export function newGame(balance: number): GameState {
  return {
    phase: 'idle',
    balance,
    stake: 0,
    multiplier: 1,
    current: null,
    remaining: [],
    drawn: [],
    last: null,
    payout: 0,
  };
}

function takeRandom(pool: readonly number[], rng: Rng): [number, number[]] {
  const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const rest = pool.slice();
  const [ball] = rest.splice(i, 1);
  return [ball, rest];
}

export function startRound(state: GameState, stake: number, rng: Rng = defaultRng): GameState {
  if (state.phase === 'playing') throw new Error('Round already in progress');
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('Stake must be positive');
  if (stake > state.balance) throw new Error('Stake is more than your balance');
  const drum = Array.from({ length: TOTAL_BALLS }, (_, i) => i + 1);
  const [first, remaining] = takeRandom(drum, rng);
  return {
    phase: 'playing',
    balance: round2(state.balance - stake),
    stake,
    multiplier: 1,
    current: first,
    remaining,
    drawn: [first],
    last: null,
    payout: 0,
  };
}

export function guess(state: GameState, dir: Direction, rng: Rng = defaultRng): GameState {
  if (state.phase !== 'playing' || state.current === null) throw new Error('No round in progress');
  const odds = oddsFor(state.current, state.remaining, dir);
  if (odds.multiplier === null) throw new Error(`No ${dir} balls left`);
  const [ball, remaining] = takeRandom(state.remaining, rng);
  const won = dir === 'higher' ? ball > state.current : ball < state.current;
  const next: GameState = {
    ...state,
    current: ball,
    remaining,
    drawn: [...state.drawn, ball],
    last: { dir, ball, won, step: odds.multiplier },
  };
  if (!won) return { ...next, phase: 'lost', multiplier: 0, payout: 0 };
  const multiplier = round2(state.multiplier * odds.multiplier);
  const withWin = { ...next, multiplier };
  // Drum empty: nothing left to guess, so bank the win.
  return remaining.length === 0 ? cashOut(withWin) : withWin;
}

export function potentialWin(state: GameState): number {
  return round2(state.stake * state.multiplier);
}

export function cashOut(state: GameState): GameState {
  if (state.phase !== 'playing') throw new Error('No round in progress');
  const payout = potentialWin(state);
  return { ...state, phase: 'cashed', payout, balance: round2(state.balance + payout) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
