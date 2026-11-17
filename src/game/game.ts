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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
  /** True when this bet rides a winning streak instead of a fresh stake. */
  ride: boolean;
}

/** Winnings riding from round to round until cashed out or lost. */
export interface Streak {
  /** The original stake. */
  stake: number;
  /** Total multiplier built up so far (product of each winning step). */
  mult: number;
  /** Correct guesses in a row. */
  wins: number;
}

export const potOf = (s: Streak) => round2(s.stake * s.mult);

export interface RoundResult {
  round: number;
  /** Ball that was showing when bets were taken. */
  from: number;
  /** Ball drawn. */
  ball: number;
  bet: Bet | null;
  won: boolean;
  /** Streak after this round (null if the bet lost or there was none). */
  streak: Streak | null;
  /** Amount banked automatically because the streak sat out this round. */
  banked: number;
}

export interface GameState {
  balance: number;
  /** Round number now taking bets. */
  round: number;
  /** Ball showing now. */
  current: number;
  /** Balls still in the drum (excludes current). */
  remaining: number[];
  /** This round's bet. A fresh stake is already taken off the balance. */
  bet: Bet | null;
  /** Winnings riding on the next guess, if the last bet won. */
  streak: Streak | null;
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
  return { balance, round: 1, current, remaining, bet: null, streak: null, last: null };
}

/** Withdraws this round's pick. A fresh stake goes back to the balance; a streak stays. */
export function cancelBet(state: GameState): GameState {
  if (!state.bet) return state;
  const refund = state.bet.ride ? 0 : state.bet.stake;
  return { ...state, balance: round2(state.balance + refund), bet: null };
}

/**
 * Places (or replaces) this round's bet. With no streak, the stake comes off
 * the balance now. During a streak the whole pot rides and `stake` is ignored.
 * Either way the step multiplier is locked at the odds for the ball showing.
 */
export function placeBet(state: GameState, dir: Direction, stake: number): GameState {
  const base = cancelBet(state);
  if (base.streak) {
    const odds = oddsFor(base.current, base.remaining, dir);
    if (odds.multiplier === null) throw new Error(`No ${dir} balls left`);
    return { ...base, bet: { dir, stake: base.streak.stake, step: odds.multiplier, ride: true } };
  }
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('Stake must be positive');
  if (stake > base.balance) throw new Error('Stake is more than your balance');
  const odds = oddsFor(base.current, base.remaining, dir);
  if (odds.multiplier === null) throw new Error(`No ${dir} balls left`);
  return { ...base, balance: round2(base.balance - stake), bet: { dir, stake, step: odds.multiplier, ride: false } };
}

/** Banks the streak's pot into the balance. Only while no pick is riding on it. */
export function cashOut(state: GameState): GameState {
  if (!state.streak) return state;
  const base = cancelBet(state);
  return { ...base, balance: round2(base.balance + potOf(state.streak)), streak: null };
}

/**
 * Closes betting and draws the next ball. A win starts or grows the streak
 * (its multiplier is multiplied by the step); a loss ends it. A streak with no
 * pick this round is banked automatically. The drum refills when it runs out.
 */
export function drawRound(state: GameState, rng: Rng = defaultRng): GameState {
  const [ball, rest] = takeRandom(state.remaining, rng);
  const bet = state.bet;
  const won = bet !== null && (bet.dir === 'higher' ? ball > state.current : ball < state.current);
  let streak: Streak | null = null;
  let banked = 0;
  if (bet && won) {
    const prev = bet.ride ? state.streak : null;
    streak = prev
      ? { stake: prev.stake, mult: floor2(prev.mult * bet.step), wins: prev.wins + 1 }
      : { stake: bet.stake, mult: bet.step, wins: 1 };
  } else if (!bet && state.streak) {
    banked = potOf(state.streak);
  }
  return {
    balance: round2(state.balance + banked),
    round: state.round + 1,
    current: ball,
    remaining: rest.length > 0 ? rest : fullDrum().filter((b) => b !== ball),
    bet: null,
    streak,
    last: { round: state.round, from: state.current, ball, bet, won, streak, banked },
  };
}
