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

/** A bet placed during the betting window, settled on the next draw. */
export interface Bet {
  dir: Direction;
  stake: number;
  /** Multiplier locked in when the bet was placed. */
  step: number;
}

export interface RoundResult {
  round: number;
  /** Ball that was showing when bets were taken. */
  from: number;
  /** Ball drawn. */
  ball: number;
  bet: Bet | null;
  won: boolean;
  /** Amount credited to the balance (0 on a loss or no bet). */
  payout: number;
}

export interface GameState {
  balance: number;
  /** Round number now taking bets. */
  round: number;
  /** Ball showing now. */
  current: number;
  /** Balls still in the drum (excludes current). */
  remaining: number[];
  /** This round's bet, already taken off the balance. */
  bet: Bet | null;
  last: RoundResult | null;
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
  return { balance, round: 1, current, remaining, bet: null, last: null };
}

/** Returns any bet already placed this round to the balance. */
export function cancelBet(state: GameState): GameState {
  if (!state.bet) return state;
  return { ...state, balance: round2(state.balance + state.bet.stake), bet: null };
}

/**
 * Places (or replaces) this round's bet. The stake comes off the balance now;
 * the multiplier is locked at the odds for the ball showing.
 */
export function placeBet(state: GameState, dir: Direction, stake: number): GameState {
  const base = cancelBet(state);
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('Stake must be positive');
  if (stake > base.balance) throw new Error('Stake is more than your balance');
  const odds = oddsFor(base.current, base.remaining, dir);
  if (odds.multiplier === null) throw new Error(`No ${dir} balls left`);
  return { ...base, balance: round2(base.balance - stake), bet: { dir, stake, step: odds.multiplier } };
}

/**
 * Closes betting and draws the next ball. A winning bet pays stake x locked
 * multiplier into the balance. The drum refills when it runs out.
 */
export function drawRound(state: GameState, rng: Rng = defaultRng): GameState {
  const [ball, rest] = takeRandom(state.remaining, rng);
  const bet = state.bet;
  const won = bet !== null && (bet.dir === 'higher' ? ball > state.current : ball < state.current);
  const payout = won ? round2(bet.stake * bet.step) : 0;
  return {
    balance: round2(state.balance + payout),
    round: state.round + 1,
    current: ball,
    remaining: rest.length > 0 ? rest : fullDrum().filter((b) => b !== ball),
    bet: null,
    last: { round: state.round, from: state.current, ball, bet, won, payout },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
