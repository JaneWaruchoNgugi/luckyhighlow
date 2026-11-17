import { describe, expect, it } from 'vitest';
import { cashOut, guess, letterFor, newGame, oddsFor, startRound, RETURN_TO_PLAYER, type Rng } from './game';

/** Rng that picks a given ball from whatever pool it is handed. */
function pick(...balls: number[]): Rng {
  // Point the rng at the target ball's index in `currentPool`, which each test sets.
  let call = 0;
  return () => {
    const target = balls[call++];
    const pool = currentPool;
    const i = pool.indexOf(target);
    if (i < 0) throw new Error(`ball ${target} not in pool`);
    return (i + 0.5) / pool.length;
  };
}
let currentPool: number[] = [];
const all = () => Array.from({ length: 75 }, (_, i) => i + 1);

describe('letterFor', () => {
  it('maps the five 15-ball columns', () => {
    expect([1, 15, 16, 30, 31, 45, 46, 60, 61, 75].map(letterFor).join('')).toBe('BBIINNGGOO');
  });
  it('rejects out-of-range balls', () => {
    expect(() => letterFor(0)).toThrow();
    expect(() => letterFor(76)).toThrow();
  });
});

describe('oddsFor', () => {
  it('pays fair odds less the house edge', () => {
    const remaining = all().filter((b) => b !== 38); // 37 lower, 37 higher
    const o = oddsFor(38, remaining, 'higher');
    expect(o.winning).toBe(37);
    expect(o.chance).toBeCloseTo(0.5);
    expect(o.multiplier).toBe(Math.floor(RETURN_TO_PLAYER * 2 * 100) / 100);
  });
  it('gives no multiplier when the guess cannot win', () => {
    expect(oddsFor(75, all().slice(0, 74), 'higher').multiplier).toBeNull();
  });
  it('never pays below 1.01 on a near-certain guess', () => {
    expect(oddsFor(1, all().slice(1), 'higher').multiplier).toBe(1.01);
  });
  it('long shots pay big', () => {
    const o = oddsFor(74, all().filter((b) => b !== 74), 'higher');
    expect(o.winning).toBe(1);
    expect(o.multiplier).toBe(71.78); // 0.97 * 74
  });
});

describe('a round', () => {
  it('deducts the stake, grows on a win, pays on cash out', () => {
    currentPool = all();
    let s = startRound(newGame(1000), 10, pick(20));
    expect(s.balance).toBe(990);
    expect(s.current).toBe(20);
    expect(s.remaining).toHaveLength(74);

    const step = oddsFor(20, s.remaining, 'higher').multiplier!;
    currentPool = s.remaining;
    s = guess(s, 'higher', pick(50));
    expect(s.phase).toBe('playing');
    expect(s.multiplier).toBe(step);
    expect(s.drawn).toEqual([20, 50]);
    expect(s.remaining).not.toContain(50);

    s = cashOut(s);
    expect(s.phase).toBe('cashed');
    expect(s.balance).toBeCloseTo(990 + 10 * step, 2);
  });

  it('loses the stake on a wrong guess', () => {
    currentPool = all();
    let s = startRound(newGame(100), 25, pick(40));
    currentPool = s.remaining;
    s = guess(s, 'higher', pick(3));
    expect(s.phase).toBe('lost');
    expect(s.balance).toBe(75);
    expect(s.last?.won).toBe(false);
  });

  it('never draws a ball twice', () => {
    let s = startRound(newGame(1e9), 1);
    const seen = new Set([s.current]);
    while (s.phase === 'playing') {
      const dir = oddsFor(s.current!, s.remaining, 'higher').chance >= 0.5 ? 'higher' : 'lower';
      s = guess(s, dir);
      expect(seen.has(s.current)).toBe(false);
      seen.add(s.current);
    }
  });

  it('refuses a stake larger than the balance', () => {
    expect(() => startRound(newGame(5), 10)).toThrow();
  });
});
