import { describe, expect, it } from 'vitest';
import { planPurchases } from '../domain/allocation';
import type { Portfolio } from '../domain/types';
import { portfolioReducer } from './portfolioReducer';

const PORTFOLIO: Portfolio = {
  positions: [
    { name: 'A', ticker: 'AAA', targetPct: 90.0, holding: 10_000 },
    { name: 'B', ticker: 'BBB', targetPct: 10.0, holding: 0 },
  ],
  currency: 'CZK',
  minOrder: 5_000,
  rounds: [],
};

describe('portfolioReducer', () => {
  it('ignores actions before a portfolio has loaded', () => {
    expect(portfolioReducer(null, { type: 'roundDeleted', id: 'x' })).toBeNull();
  });

  it('replaces state on load', () => {
    expect(portfolioReducer(null, { type: 'loaded', portfolio: PORTFOLIO })).toEqual(
      PORTFOLIO,
    );
  });

  it('applies a confirmed round and can undo it via deletion', () => {
    const plan = planPurchases(PORTFOLIO.positions, 50_000, PORTFOLIO.minOrder);
    const afterRound = portfolioReducer(PORTFOLIO, {
      type: 'roundConfirmed',
      plan,
      on: '2026-08-31',
    })!;

    expect(afterRound.rounds).toHaveLength(1);

    const reverted = portfolioReducer(afterRound, {
      type: 'roundDeleted',
      id: afterRound.rounds[0]!.id,
    })!;

    expect(reverted).toEqual(PORTFOLIO);
  });

  it('saves edited positions while keeping the round log', () => {
    const updated = portfolioReducer(PORTFOLIO, {
      type: 'positionsSaved',
      positions: [{ name: 'A', ticker: 'AAA', targetPct: 100, holding: 10_000 }],
      minOrder: 3_000,
      currency: 'EUR',
    })!;

    expect(updated.positions).toHaveLength(1);
    expect(updated.minOrder).toBe(3_000);
    expect(updated.currency).toBe('EUR');
  });
});
