import { describe, expect, it } from 'vitest';
import { letterFor, newGame, oddsFor, placeBet, RETURN_TO_PLAYER, type GameState, type Rng } from './game';

const all = () => Array.from({ length: 75 }, (_, i) => i + 1);

/** Rng that draws `target` from the given pool. */
function pick(pool: readonly number[], target: number): Rng {
  const i = pool.indexOf(target);
  if (i < 0) throw new Error(`ball ${target} not in pool`);
  return () => (i + 0.5) / pool.length;
}

function at(current: number, balance = 100): GameState {
  return { balance, current, remaining: all().filter((b) => b !== current), last: null };
}

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
  it('pays fair odds less the house edge at the middle ball', () => {
    const o = oddsFor(38, all().filter((b) => b !== 38), 'higher');
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
    expect(oddsFor(74, all().filter((b) => b !== 74), 'higher').multiplier).toBe(71.78);
  });
});

describe('placeBet', () => {
  it('starts with a ball showing and 74 in the drum', () => {
    const g = newGame(1000);
    expect(g.remaining).toHaveLength(74);
    expect(g.remaining).not.toContain(g.current);
  });

  it('adds a win straight to the balance', () => {
    const s = at(20);
    const step = oddsFor(20, s.remaining, 'higher').multiplier!;
    const next = placeBet(s, 'higher', 10, pick(s.remaining, 50));
    expect(next.current).toBe(50);
    expect(next.last).toMatchObject({ won: true, stake: 10, payout: Math.round(10 * step * 100) / 100 });
    expect(next.balance).toBeCloseTo(100 - 10 + 10 * step, 2);
    expect(next.remaining).not.toContain(50);
  });

  it('takes the stake on a loss and keeps playing from the new ball', () => {
    const s = at(40);
    const next = placeBet(s, 'higher', 25, pick(s.remaining, 3));
    expect(next.balance).toBe(75);
    expect(next.current).toBe(3);
    expect(next.last).toMatchObject({ won: false, payout: 0 });
  });

  it('never repeats a ball until the drum is refilled', () => {
    let s = newGame(1e9);
    const seen = new Set([s.current]);
    for (let i = 0; i < 74; i++) {
      const dir = oddsFor(s.current, s.remaining, 'higher').chance >= 0.5 ? 'higher' : 'lower';
      s = placeBet(s, dir, 1);
      expect(seen.has(s.current)).toBe(false);
      seen.add(s.current);
    }
    // Drum emptied on the last draw, so it refills with everything but the ball showing.
    expect(s.remaining).toHaveLength(74);
    expect(s.remaining).not.toContain(s.current);
  });

  it('refuses a stake larger than the balance', () => {
    expect(() => placeBet(at(30, 5), 'higher', 10)).toThrow();
  });
});
