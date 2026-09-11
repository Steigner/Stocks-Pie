import { describe, expect, it } from 'vitest';
import { planPurchases, validatePositions } from './allocation';
import { deleteRoundById } from './portfolio';
import { samplePortfolio } from './samplePortfolio';

describe('samplePortfolio', () => {
  it('is valid, so the preview can invest straight away', () => {
    expect(() => validatePositions(samplePortfolio().positions)).not.toThrow();
  });

  it('starts off target, so the first deposit visibly rebalances', () => {
    const sample = samplePortfolio();
    const plan = planPurchases(sample.positions, 50_000, sample.minOrder);

    expect(plan.driftAfterPct).toBeLessThan(plan.driftBeforePct);
    expect(plan.positions.find((position) => position.ticker === 'NVDA')!.buy).toBe(0);
  });

  it('can undo its sample round without a holding going negative', () => {
    const sample = samplePortfolio();

    const reverted = deleteRoundById(sample, sample.rounds[0]!.id);

    expect(reverted.positions.every((position) => position.holding >= 0)).toBe(true);
  });
});
