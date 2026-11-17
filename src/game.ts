/** Luckyhighlow core rules. Pure functions, no React, so they can be unit tested. */

export const TOTAL_BALLS = 75;
/** Share of fair odds paid back. 0.97 means a 3% house edge on every step. */
export const RETURN_TO_PLAYER = 0.97;

export type Letter = 'B' | 'I' | 'N' | 'G' | 'O';
export type Direction = 'higher' | 'lower';

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

export type Rng = () => number;

export const defaultRng: Rng = () => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
};

export interface BetResult {
  dir: Direction;
  stake: number;
  ball: number;
  won: boolean;
  /** Multiplier the bet was placed at. */
  step: number;
  /** Amount credited to the balance (0 on a loss). */
  payout: number;
}

export interface GameState {
  balance: number;
  /** Ball showing now. */
  current: number;
  /** Balls still in the drum (excludes current). */
  remaining: number[];
  /** Result of the last bet, for feedback. */
  last: BetResult | null;
}

function takeRandom(pool: readonly number[], rng: Rng): [number, number[]] {
  const i = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  const rest = pool.slice();
  const [ball] = rest.splice(i, 1);
  return [ball, rest];
}

const fullDrum = () => Array.from({ length: TOTAL_BALLS }, (_, i) => i + 1);

/** Fresh drum with the first ball already showing. */
export function newGame(balance: number, rng: Rng = defaultRng): GameState {
  const [current, remaining] = takeRandom(fullDrum(), rng);
  return { balance, current, remaining, last: null };
}

/**
 * One bet: the stake comes off the balance, the next ball is drawn, and a win
 * pays stake x multiplier straight back into the balance. When the drum runs
 * out it is refilled with every ball except the one showing.
 */
export function placeBet(state: GameState, dir: Direction, stake: number, rng: Rng = defaultRng): GameState {
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('Stake must be positive');
  if (stake > state.balance) throw new Error('Stake is more than your balance');
  const odds = oddsFor(state.current, state.remaining, dir);
  if (odds.multiplier === null) throw new Error(`No ${dir} balls left`);
  const [ball, rest] = takeRandom(state.remaining, rng);
  const won = dir === 'higher' ? ball > state.current : ball < state.current;
  const payout = won ? round2(stake * odds.multiplier) : 0;
  const remaining = rest.length > 0 ? rest : fullDrum().filter((b) => b !== ball);
  return {
    balance: round2(state.balance - stake + payout),
    current: ball,
    remaining,
    last: { dir, stake, ball, won, step: odds.multiplier, payout },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
