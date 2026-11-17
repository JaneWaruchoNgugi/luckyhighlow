import { describe, expect, it } from 'vitest';
import {
  cancelBet,
  drawRound,
  letterFor,
  newGame,
  oddsFor,
  placeBet,
  RETURN_TO_PLAYER,
  type GameState,
  type Rng,
} from './game';

const all = () => Array.from({ length: 75 }, (_, i) => i + 1);

/** Rng that draws `target` from the given pool. */
function pick(pool: readonly number[], target: number): Rng {
  const i = pool.indexOf(target);
  if (i < 0) throw new Error(`ball ${target} not in pool`);
  return () => (i + 0.5) / pool.length;
}

function at(current: number, balance = 100): GameState {
  return { balance, round: 1, current, remaining: all().filter((b) => b !== current), bet: null, last: null };
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
    const o = oddsFor(
      38,
      all().filter((b) => b !== 38),
      'higher',
    );
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
    expect(
      oddsFor(
        74,
        all().filter((b) => b !== 74),
        'higher',
      ).multiplier,
    ).toBe(71.78);
  });
});

describe('live rounds', () => {
  it('starts with a ball showing and 74 in the drum', () => {
    const g = newGame(1000);
    expect(g.remaining).toHaveLength(74);
    expect(g.remaining).not.toContain(g.current);
    expect(g.round).toBe(1);
  });

  it('takes the stake when the bet is placed and pays a win on the draw', () => {
    const s = placeBet(at(20), 'higher', 10);
    const step = s.bet!.step;
    expect(s.balance).toBe(90);
    const next = drawRound(s, pick(s.remaining, 50));
    expect(next.current).toBe(50);
    expect(next.bet).toBeNull();
    expect(next.round).toBe(2);
    expect(next.last).toMatchObject({ from: 20, ball: 50, won: true, payout: Math.round(10 * step * 100) / 100 });
    expect(next.balance).toBeCloseTo(90 + 10 * step, 2);
    expect(next.remaining).not.toContain(50);
  });

  it('keeps the stake on a loss', () => {
    const s = placeBet(at(40), 'higher', 25);
    const next = drawRound(s, pick(s.remaining, 3));
    expect(next.balance).toBe(75);
    expect(next.last).toMatchObject({ won: false, payout: 0 });
  });

  it('draws with no bet and leaves the balance alone', () => {
    const s = at(40);
    const next = drawRound(s, pick(s.remaining, 60));
    expect(next.balance).toBe(100);
    expect(next.last).toMatchObject({ bet: null, won: false, ball: 60 });
  });

  it('replacing or cancelling a bet refunds the first stake', () => {
    let s = placeBet(at(40), 'higher', 30);
    s = placeBet(s, 'lower', 50);
    expect(s.balance).toBe(50);
    expect(s.bet?.dir).toBe('lower');
    s = cancelBet(s);
    expect(s.balance).toBe(100);
    expect(s.bet).toBeNull();
  });

  it('never repeats a ball until the drum is refilled', () => {
    let s = newGame(0);
    const seen = new Set([s.current]);
    for (let i = 0; i < 74; i++) {
      s = drawRound(s);
      expect(seen.has(s.current)).toBe(false);
      seen.add(s.current);
    }
    expect(s.remaining).toHaveLength(74);
    expect(s.remaining).not.toContain(s.current);
  });

  it('refuses a stake larger than the balance', () => {
    expect(() => placeBet(at(30, 5), 'higher', 10)).toThrow();
  });
});
