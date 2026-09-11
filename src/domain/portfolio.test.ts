import { describe, expect, it } from 'vitest';
import { planPurchases, validatePositions } from './allocation';
import {
  DEFAULT_CURRENCY,
  applyPurchases,
  deleteRoundById,
  emptyPortfolio,
  normalizeTargets,
  replacePositions,
} from './portfolio';
import type { Portfolio, Position } from './types';

const MIN_ORDER = 5_000;

const TWO_WAY_PORTFOLIO: readonly Position[] = [
  { name: 'A', ticker: 'AAA', targetPct: 90.0, holding: 10_000 },
  { name: 'B', ticker: 'BBB', targetPct: 10.0, holding: 0 },
];

function portfolioWith(positions: readonly Position[]): Portfolio {
  return { positions, currency: 'CZK', minOrder: MIN_ORDER, rounds: [] };
}

describe('emptyPortfolio', () => {
  it('starts blank, so nothing assumes a particular market', () => {
    const portfolio = emptyPortfolio();

    expect(portfolio.positions).toEqual([]);
    expect(portfolio.rounds).toEqual([]);
    expect(portfolio.currency).toBe(DEFAULT_CURRENCY);
  });
});

describe('applyPurchases', () => {
  it('grows the holdings it bought', () => {
    const portfolio = portfolioWith(TWO_WAY_PORTFOLIO);
    const plan = planPurchases(portfolio.positions, 50_000, MIN_ORDER);

    const updated = applyPurchases(portfolio, plan, '2026-08-31');

    const bought = new Map(plan.positions.map((p) => [p.ticker, p.buy]));
    expect(updated.positions.map((p) => p.holding)).toEqual([
      10_000 + bought.get('AAA')!,
      0 + bought.get('BBB')!,
    ]);
  });

  it('logs what was ordered, by ticker', () => {
    const portfolio = portfolioWith(TWO_WAY_PORTFOLIO);
    const plan = planPurchases(portfolio.positions, 50_000, MIN_ORDER);

    const updated = applyPurchases(portfolio, plan, '2026-08-31');

    const logged = updated.rounds[0]!;
    expect(logged.on).toBe('2026-08-31');
    expect(Object.keys(logged.buys).every((key) => ['AAA', 'BBB'].includes(key))).toBe(
      true,
    );
    expect(Object.values(logged.buys).every((amount) => amount > 0)).toBe(true);
    expect(logged.id).toBeTruthy();
  });

  it('matches positions by ticker, so a renamed position keeps its holding', () => {
    const portfolio = portfolioWith([
      { name: 'Same', ticker: 'AAA', targetPct: 50.0, holding: 0 },
      { name: 'Same', ticker: 'BBB', targetPct: 50.0, holding: 0 },
    ]);
    const plan = planPurchases(portfolio.positions, 10_000, MIN_ORDER);

    const updated = applyPurchases(portfolio, plan, '2026-08-31');

    expect(updated.positions.map((p) => p.holding)).toEqual([5_000, 5_000]);
  });
});

describe('replacePositions', () => {
  it('keeps the round log and stores the new minimum', () => {
    const round = {
      id: 'r1',
      on: '2026-08-31',
      buys: { AAA: 10_000 },
    };
    const portfolio: Portfolio = {
      positions: TWO_WAY_PORTFOLIO,
      currency: 'CZK',
      minOrder: 5_000,
      rounds: [round],
    };

    const updated = replacePositions(portfolio, TWO_WAY_PORTFOLIO, 3_000, 'EUR');

    expect(updated.rounds).toEqual([round]);
    expect(updated.minOrder).toBe(3_000);
    expect(updated.currency).toBe('EUR');
  });
});

describe('deleteRoundById', () => {
  it('reverts the holdings it bought and removes the log entry', () => {
    const portfolio = portfolioWith(TWO_WAY_PORTFOLIO);
    const plan = planPurchases(portfolio.positions, 50_000, MIN_ORDER);
    const afterRound = applyPurchases(portfolio, plan, '2026-08-31');

    const reverted = deleteRoundById(afterRound, afterRound.rounds[0]!.id);

    expect(reverted.positions).toEqual(portfolio.positions);
    expect(reverted.rounds).toEqual([]);
  });

  it('reverts only the targeted round when several exist', () => {
    const portfolio = portfolioWith(TWO_WAY_PORTFOLIO);
    const firstPlan = planPurchases(portfolio.positions, 50_000, MIN_ORDER);
    const afterFirst = applyPurchases(portfolio, firstPlan, '2026-08-31');
    const secondPlan = planPurchases(afterFirst.positions, 30_000, MIN_ORDER);
    const afterSecond = applyPurchases(afterFirst, secondPlan, '2026-09-01');

    const reverted = deleteRoundById(afterSecond, afterFirst.rounds[0]!.id);

    // Only the second round's buys should remain, applied to the original holdings.
    const expected = applyPurchases(portfolio, secondPlan, '2026-09-01');

    expect(reverted.rounds).toEqual(afterSecond.rounds.slice(1));
    expect(reverted.positions).toEqual(expected.positions);
  });

  it('stops at zero when the holding was revalued below what the round bought', () => {
    const portfolio: Portfolio = {
      ...portfolioWith([{ name: 'A', ticker: 'AAA', targetPct: 100, holding: 8_000 }]),
      rounds: [{ id: 'r1', on: '2026-08-31', buys: { AAA: 10_000 } }],
    };

    const reverted = deleteRoundById(portfolio, 'r1');

    expect(reverted.positions[0]!.holding).toBe(0);
    expect(() => validatePositions(reverted.positions)).not.toThrow();
  });

  it('leaves the portfolio unchanged when the id is unknown', () => {
    const portfolio = portfolioWith(TWO_WAY_PORTFOLIO);

    expect(deleteRoundById(portfolio, 'missing')).toEqual(portfolio);
  });
});

describe('normalizeTargets', () => {
  it('rescales targets so they sum to 100', () => {
    const positions: Position[] = [
      { name: 'A', ticker: 'AAA', targetPct: 40.0, holding: 0 },
      { name: 'B', ticker: 'BBB', targetPct: 40.0, holding: 0 },
    ];

    const normalized = normalizeTargets(positions);

    expect(normalized.map((p) => p.targetPct)).toEqual([50, 50]);
  });

  it('lands on exactly 100 when the shares do not divide evenly', () => {
    const positions: Position[] = ['AAA', 'BBB', 'CCC'].map((ticker) => ({
      name: '',
      ticker,
      targetPct: 1,
      holding: 0,
    }));

    const normalized = normalizeTargets(positions);

    expect(normalized.map((p) => p.targetPct)).toEqual([33.34, 33.33, 33.33]);
    expect(() => validatePositions(normalized)).not.toThrow();
  });

  it('leaves positions unchanged when targets sum to zero', () => {
    const positions: Position[] = [
      { name: 'A', ticker: 'AAA', targetPct: 0, holding: 0 },
    ];

    expect(normalizeTargets(positions)).toEqual(positions);
  });
});
