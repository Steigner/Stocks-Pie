import { describe, expect, it } from 'vitest';
import {
  driftPct,
  evaluate,
  planPurchases,
  splitAmount,
  trackingError,
  validatePositions,
  waterFill,
  type Problem,
} from './allocation';
import { PortfolioValidationError, type Position, type PurchasePlan } from './types';

const MIN_ORDER = 5_000;

const EMPTY_PIE: readonly Position[] = [
  { name: 'A', ticker: 'AAA', targetPct: 80.0, holding: 0 },
  { name: 'B', ticker: 'BBB', targetPct: 10.0, holding: 0 },
  { name: 'C', ticker: 'CCC', targetPct: 10.0, holding: 0 },
];

function buys(plan: PurchasePlan): number[] {
  return plan.positions.map((position) => position.buy);
}

function scoreOf(plan: PurchasePlan): number {
  return trackingError(
    plan.positions.map((position) => position.targetPct),
    plan.positions.map((position) => position.holding + position.buy),
  );
}

/** Deterministic PRNG (mulberry32), seeded per case for reproducible coverage. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function choice<T>(random: () => number, options: readonly T[]): T {
  return options[randomInt(random, 0, options.length - 1)]!;
}

function* combinations(pool: readonly number[], size: number): Generator<number[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= pool.length - size; i += 1) {
    for (const rest of combinations(pool.slice(i + 1), size - 1)) {
      yield [pool[i]!, ...rest];
    }
  }
}

function bestByExhaustiveSearch(
  positions: readonly Position[],
  budget: number,
  minOrder: number,
): number {
  const totalValue =
    positions.reduce((total, position) => total + position.holding, 0) + budget;
  // planPurchases only ever buys positions still below target once the deposit
  // is counted, so every subset of those is the space it must be optimal over.
  const underweight = positions
    .map((_, index) => index)
    .filter(
      (index) =>
        positions[index]!.holding < (positions[index]!.targetPct / 100) * totalValue,
    );
  const problem: Problem = {
    weights: positions.map((position) => position.targetPct),
    holdings: positions.map((position) => position.holding),
    budget,
    minOrder,
    pool: underweight,
  };
  let best = Infinity;
  const maxSize = Math.min(positions.length, Math.floor(budget / minOrder));
  for (let size = 1; size <= maxSize; size += 1) {
    for (const subset of combinations(problem.pool, size)) {
      const { score } = evaluate(problem, subset);
      best = Math.min(best, score);
    }
  }
  return best;
}

describe('planPurchases', () => {
  it('splits an empty portfolio by plain percentages', () => {
    const plan = planPurchases(EMPTY_PIE, 100_000, MIN_ORDER);

    expect(buys(plan)).toEqual([80_000, 10_000, 10_000]);
    expect(plan.invested).toBe(100_000);
    expect(plan.leftover).toBe(0);
  });

  it('sends money to the underweight position first', () => {
    const positions: Position[] = [
      { name: 'Rich', ticker: 'AAA', targetPct: 50.0, holding: 200_000 },
      { name: 'Poor', ticker: 'BBB', targetPct: 50.0, holding: 100_000 },
    ];

    const plan = planPurchases(positions, 60_000, MIN_ORDER);

    expect(buys(plan)).toEqual([0, 60_000]);
    expect(plan.driftAfterPct).toBeLessThan(plan.driftBeforePct);
  });

  it('leaves a position already above target alone', () => {
    const positions: Position[] = [
      { name: 'Over', ticker: 'AAA', targetPct: 10.0, holding: 500_000 },
      { name: 'Under', ticker: 'BBB', targetPct: 90.0, holding: 100_000 },
    ];

    const plan = planPurchases(positions, 50_000, MIN_ORDER);

    expect(plan.positions[0]!.buy).toBe(0);
    expect(plan.positions[1]!.buy).toBe(50_000);
  });

  it('always invests the whole budget once it clears the minimum', () => {
    const positions: Position[] = [
      { name: 'A', ticker: 'AAA', targetPct: 40.0, holding: 33_333 },
      { name: 'B', ticker: 'BBB', targetPct: 35.0, holding: 12_000 },
      { name: 'C', ticker: 'CCC', targetPct: 25.0, holding: 0 },
    ];

    const plan = planPurchases(positions, 77_777, MIN_ORDER);

    expect(plan.invested).toBe(77_777);
    expect(plan.leftover).toBe(0);
  });

  it('never places an order smaller than the minimum', () => {
    const positions: Position[] = [
      { name: 'Big', ticker: 'AAA', targetPct: 96.0, holding: 0 },
      { name: 'Tiny', ticker: 'BBB', targetPct: 4.0, holding: 0 },
    ];

    const plan = planPurchases(positions, 20_000, MIN_ORDER);

    expect(plan.positions.every((p) => p.buy === 0 || p.buy >= MIN_ORDER)).toBe(true);
  });

  it('buys nothing for a deposit below the minimum', () => {
    const plan = planPurchases(EMPTY_PIE, 4_999, MIN_ORDER);

    expect(buys(plan)).toEqual([0, 0, 0]);
    expect(plan.invested).toBe(0);
    expect(plan.leftover).toBe(4_999);
  });

  it('skips a tiny target rather than wildly overshooting it', () => {
    const positions: Position[] = [
      { name: 'Tiny', ticker: 'AAA', targetPct: 2.0, holding: 0 },
      { name: 'Huge', ticker: 'BBB', targetPct: 98.0, holding: 500 },
    ];

    const plan = planPurchases(positions, 10_000, MIN_ORDER);

    expect(buys(plan)).toEqual([0, 10_000]);
  });

  it('buys a tiny target when that fits the pie better', () => {
    const positions: Position[] = [
      { name: 'A', ticker: 'AAA', targetPct: 66.67, holding: 0 },
      { name: 'B', ticker: 'BBB', targetPct: 25.0, holding: 0 },
      { name: 'C', ticker: 'CCC', targetPct: 4.17, holding: 0 },
      { name: 'D', ticker: 'DDD', targetPct: 4.16, holding: 0 },
    ];

    const plan = planPurchases(positions, 100_000, MIN_ORDER);

    expect(plan.positions[2]!.buy).toBeGreaterThanOrEqual(MIN_ORDER);
    expect(plan.positions[3]!.buy).toBeGreaterThanOrEqual(MIN_ORDER);
  });

  it('never tops up a position already on target, even where that would score better', () => {
    const positions: Position[] = [
      { name: 'Core', ticker: 'AAA', targetPct: 89.95, holding: 90_000 },
      ...['BBB', 'CCC', 'DDD', 'EEE', 'FFF'].map((ticker) => ({
        name: ticker,
        ticker,
        targetPct: 2.01,
        holding: 0,
      })),
    ];

    const plan = planPurchases(positions, 10_000, MIN_ORDER);

    expect(plan.positions[0]!.buy).toBe(0);
    expect(plan.invested).toBe(10_000);
  });

  it('puts skipped positions first in line next round', () => {
    const positions: Position[] = [
      { name: 'A', ticker: 'AAA', targetPct: 50.0, holding: 0 },
      { name: 'B', ticker: 'BBB', targetPct: 50.0, holding: 0 },
    ];

    const first = planPurchases(positions, 6_000, MIN_ORDER);
    const boughtFirst = first.positions.find((p) => p.buy)!.name;
    const grown = first.positions.map((position) => ({
      name: position.name,
      ticker: position.ticker,
      targetPct: position.targetPct,
      holding: position.holding + position.buy,
    }));

    const second = planPurchases(grown, 6_000, MIN_ORDER);
    const boughtSecond = second.positions.find((p) => p.buy)!.name;

    expect(boughtSecond).not.toBe(boughtFirst);
  });

  it.each(Array.from({ length: 120 }, (_, seed) => seed))(
    'matches exhaustive subset search (seed %i)',
    (seed) => {
      const random = mulberry32(seed);
      const size = randomInt(random, 2, 7);
      const rawWeights = Array.from({ length: size }, () =>
        choice(random, [1.0, 2.5, 5.0, 10.0, 20.0, 40.0]),
      );
      const scale = rawWeights.reduce((total, weight) => total + weight, 0);
      const positions: Position[] = rawWeights.map((weight, index) => ({
        name: `P${index}`,
        ticker: `T${index}`,
        targetPct: (weight / scale) * 100,
        holding: choice(random, [0, 0, randomInt(random, 0, 200_000)]),
      }));
      const budget = choice(random, [5_000, 8_000, 20_000, 50_000, 100_000, 300_000]);

      const plan = planPurchases(positions, budget, MIN_ORDER);
      const best = bestByExhaustiveSearch(positions, budget, MIN_ORDER);

      expect(scoreOf(plan)).toBeLessThanOrEqual(best + 1e-6);
    },
  );
});

describe('waterFill', () => {
  it('spreads the total and respects every floor', () => {
    const values = waterFill([50.0, 30.0, 20.0], [0.0, 40_000.0, 0.0], 100_000);

    expect(values.reduce((total, value) => total + value, 0)).toBeCloseTo(100_000);
    expect(values[1]!).toBeGreaterThanOrEqual(40_000);
    expect(values.every((value) => value >= 0)).toBe(true);
  });

  it('returns the floors when the total cannot cover them', () => {
    expect(waterFill([50.0, 50.0], [9_000.0, 9_000.0], 10_000)).toEqual([
      9_000.0, 9_000.0,
    ]);
  });
});

describe('splitAmount', () => {
  it('matches plain percentages', () => {
    expect(splitAmount(100_000, [80.0, 10.0, 10.0])).toEqual([80_000, 10_000, 10_000]);
  });

  it('never loses a unit', () => {
    const shares = splitAmount(100, [1.0, 1.0, 1.0]);

    expect(shares.reduce((total, value) => total + value, 0)).toBe(100);
    expect(shares).toEqual([34, 33, 33]);
  });

  it.each([0, -1])('splits nothing into all zeros for amount %i', (amount) => {
    expect(splitAmount(amount, [80.0, 20.0])).toEqual([0, 0]);
  });
});

describe('driftPct', () => {
  it('measures the share sitting in the wrong position', () => {
    expect(driftPct([50.0, 50.0], [7_000.0, 3_000.0])).toBeCloseTo(20.0);
    expect(driftPct([50.0, 50.0], [5_000.0, 5_000.0])).toBeCloseTo(0.0);
    expect(driftPct([50.0, 50.0], [0.0, 0.0])).toBe(0.0);
  });
});

describe('validatePositions', () => {
  it('accepts targets summing to 100', () => {
    expect(() => validatePositions(EMPTY_PIE)).not.toThrow();
  });

  it('accepts a position without a name, since the ticker identifies it', () => {
    expect(() =>
      validatePositions([{ name: '', ticker: 'AAA', targetPct: 100.0, holding: 0 }]),
    ).not.toThrow();
  });

  it.each<[string, readonly Position[]]>([
    ['empty', []],
    ['under 100', [{ name: 'A', ticker: 'AAA', targetPct: 90.0, holding: 0 }]],
    [
      'duplicate tickers',
      [
        { name: 'A', ticker: 'AAA', targetPct: 60.0, holding: 0 },
        { name: 'B', ticker: 'AAA', targetPct: 40.0, holding: 0 },
      ],
    ],
    ['blank ticker', [{ name: 'A', ticker: ' ', targetPct: 100.0, holding: 0 }]],
    [
      'zero target',
      [
        { name: 'A', ticker: 'AAA', targetPct: 100.0, holding: 0 },
        { name: 'B', ticker: 'BBB', targetPct: 0.0, holding: 0 },
      ],
    ],
    ['negative holding', [{ name: 'A', ticker: 'AAA', targetPct: 100.0, holding: -1 }]],
  ])('rejects a broken portfolio: %s', (_label, positions) => {
    expect(() => validatePositions(positions)).toThrow(PortfolioValidationError);
  });
});
