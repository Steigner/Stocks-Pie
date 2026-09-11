/**
 * Buy-only rebalancing of a deposit toward target weights, under a minimum order.
 *
 * The continuous part of the problem has a closed form: given the set of
 * positions being bought, the best buy-only allocation raises them all to a
 * shared funding level `level * targetPct` (water filling), which minimises
 * the chi-square distance between the resulting weights and the target ones.
 *
 * The discrete part - each position is either skipped or bought for at least
 * `minOrder` - makes the feasible set disconnected, so the funded set is
 * searched exactly, by branch and bound over the fund-or-skip decision tree.
 * Realistic portfolios settle in a few dozen nodes; a node budget stops the
 * search on degenerate ones, where it falls back on the best set found.
 */
import type { Position, PositionPlan, PurchasePlan } from './types';
import { PortfolioValidationError } from './types';

const TARGET_SUM_TOLERANCE = 0.01;
const NODE_BUDGET = 20_000;

/** Precomputed inputs shared by every candidate funded set. Exported for tests only. */
export interface Problem {
  readonly weights: readonly number[];
  readonly holdings: readonly number[];
  readonly budget: number;
  readonly minOrder: number;
  readonly pool: readonly number[];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Checks that positions form a valid target allocation.
 *
 * @throws PortfolioValidationError if the portfolio is empty, has a blank or
 * duplicate ticker, a non-positive target, a negative holding, or targets that
 * do not sum to 100 percent.
 */
export function validatePositions(positions: readonly Position[]): void {
  if (positions.length === 0) {
    throw new PortfolioValidationError('Add at least one position.');
  }

  const tickers = positions.map((position) => position.ticker);
  if (tickers.some((ticker) => ticker.trim() === '')) {
    throw new PortfolioValidationError('Every position needs a ticker.');
  }
  if (new Set(tickers).size !== tickers.length) {
    throw new PortfolioValidationError('Each ticker can only be used once.');
  }
  if (positions.some((position) => position.targetPct <= 0)) {
    throw new PortfolioValidationError('Every target needs to be more than 0%.');
  }
  if (positions.some((position) => position.holding < 0)) {
    throw new PortfolioValidationError("A holding can't be negative.");
  }

  const totalPct = sum(positions.map((position) => position.targetPct));
  if (Math.abs(totalPct - 100) > TARGET_SUM_TOLERANCE) {
    throw new PortfolioValidationError(
      `Targets add up to ${totalPct.toFixed(2)}%, not 100%.`,
    );
  }
}

/**
 * Raises every position to a shared funding level without going below its floor.
 *
 * Finds the level for which `sum(max(floor_i, level * weight_i))` equals
 * `total`, which spreads `total` so that the funded positions end up in
 * proportion to their weights while the ones already above that level keep
 * what they have.
 *
 * @param weights - Relative target weight per position; must all be positive.
 * @param floors - Lowest value each position may end up at.
 * @param total - Value to distribute across all positions.
 * @returns The resulting value per position, summing to `total` unless
 * `total` is below the sum of the floors, in which case the floors are
 * returned unchanged.
 */
export function waterFill(
  weights: readonly number[],
  floors: readonly number[],
  total: number,
): number[] {
  if (total <= sum(floors)) {
    return [...floors];
  }

  const byReleaseLevel = weights
    .map((_, index) => index)
    .sort((a, b) => floors[a]! / weights[a]! - floors[b]! / weights[b]!);

  let remainingFloor = sum(floors);
  let filledWeight = 0;
  let level = 0;
  for (let rank = 0; rank < byReleaseLevel.length; rank += 1) {
    const index = byReleaseLevel[rank]!;
    filledWeight += weights[index]!;
    remainingFloor -= floors[index]!;
    level = (total - remainingFloor) / filledWeight;
    if (rank + 1 === byReleaseLevel.length) {
      break;
    }
    const following = byReleaseLevel[rank + 1]!;
    if (level <= floors[following]! / weights[following]!) {
      break;
    }
  }
  return floors.map((floor, index) => Math.max(floor, level * weights[index]!));
}

/**
 * Splits whole units proportionally to weights, losing nothing.
 *
 * Uses the largest-remainder method, so the result sums back to `amount`
 * exactly and leftover units land on the positions with the largest
 * truncated fractions.
 *
 * @param amount - Whole units to split; 0 or less yields all zeros.
 * @param weights - Relative weight per position; need not sum to 100.
 * @returns One whole-unit amount per weight, in the same order.
 */
export function splitAmount(amount: number, weights: readonly number[]): number[] {
  const totalWeight = sum(weights);
  if (amount <= 0 || totalWeight <= 0) {
    return weights.map(() => 0);
  }

  const exact = weights.map((weight) => (amount * weight) / totalWeight);
  const shares = exact.map((value) => Math.floor(value));
  const byLargestRemainder = weights
    .map((_, index) => index)
    .sort((a, b) => {
      const remainderA = shares[a]! - exact[a]!;
      const remainderB = shares[b]! - exact[b]!;
      if (remainderA !== remainderB) {
        return remainderA - remainderB;
      }
      if (weights[a] !== weights[b]) {
        return weights[b]! - weights[a]!;
      }
      return a - b;
    });

  const remaining = amount - sum(shares);
  for (const index of byLargestRemainder.slice(0, remaining)) {
    shares[index] = shares[index]! + 1;
  }
  return shares;
}

/**
 * Measures how much of the portfolio sits in the wrong position.
 *
 * @param targets - Target share per position, in percent.
 * @param values - Current value per position.
 * @returns Half the total absolute deviation in percentage points, i.e. the
 * share of the portfolio that would have to move to hit the targets exactly.
 * 0 for an empty portfolio.
 */
export function driftPct(
  targets: readonly number[],
  values: readonly number[],
): number {
  const total = sum(values);
  if (total <= 0) {
    return 0;
  }
  const totalAbsDeviation = sum(
    values.map((value, index) => Math.abs((value / total) * 100 - targets[index]!)),
  );
  return totalAbsDeviation / 2;
}

/**
 * Spreads a deposit so the portfolio ends up as close to target as possible.
 *
 * Never sells, always spends the whole budget once it clears `minOrder`,
 * and only ever places orders of at least that size. Only positions still
 * below target once the deposit is counted are candidates, even where
 * topping up one already on target would score better. Positions left out of
 * this round simply stay underweight, which makes them first in line next
 * time.
 *
 * @param positions - The portfolio, already checked by `validatePositions`.
 * @param budget - Whole units being invested this round.
 * @param minOrder - Smallest amount worth sending as a single order.
 * @returns The per-position orders plus the resulting drift.
 */
export function planPurchases(
  positions: readonly Position[],
  budget: number,
  minOrder: number,
): PurchasePlan {
  const weights = positions.map((position) => position.targetPct);
  const holdings = positions.map((position) => position.holding);

  if (budget < minOrder) {
    return buildPlan(
      positions,
      weights.map(() => 0),
      budget,
    );
  }

  const totalValue = sum(holdings) + budget;
  const underweight = weights
    .map((_, index) => index)
    .filter((index) => holdings[index]! < (weights[index]! / 100) * totalValue);

  const problem: Problem = {
    weights,
    holdings,
    budget,
    minOrder,
    pool: underweight.length > 0 ? underweight : weights.map((_, index) => index),
  };
  return buildPlan(positions, search(problem, totalValue), 0);
}

/**
 * Finds the funded set that fits the target best, by branch and bound.
 *
 * Walks the fund-or-skip decision tree depth first, most underweight
 * position first. At every node the minimum-order rule is dropped for the
 * positions not yet decided and the resulting water fill is scored; because
 * that is a relaxation, no solution below the node can beat it, so a node
 * scoring worse than the best solution so far is cut away.
 */
function search(problem: Problem, totalValue: number): number[] {
  const gap = (index: number): number =>
    (problem.weights[index]! / 100) * totalValue - problem.holdings[index]!;
  const order = [...problem.pool].sort((a, b) => gap(b) - gap(a));
  const affordable = Math.floor(problem.budget / problem.minOrder);

  let bestBuys: number[] = problem.weights.map(() => 0);
  let bestScore = Infinity;

  for (let size = 1; size <= Math.min(order.length, affordable); size += 1) {
    const { buys, score } = evaluate(problem, order.slice(0, size));
    if (buys !== null && score < bestScore) {
      bestBuys = buys;
      bestScore = score;
    }
  }

  let nodeBudget = NODE_BUDGET;

  function explore(depth: number, funded: readonly number[]): void {
    nodeBudget -= 1;
    if (nodeBudget < 0) {
      return;
    }
    const relaxed = fill(problem, funded, order.slice(depth));
    if (relaxed === null || trackingError(problem.weights, relaxed) >= bestScore) {
      return;
    }
    if (depth === order.length) {
      const { buys, score } = evaluate(problem, funded);
      if (buys !== null && score < bestScore) {
        bestBuys = buys;
        bestScore = score;
      }
      return;
    }
    if (funded.length < affordable) {
      explore(depth + 1, [...funded, order[depth]!]);
    }
    explore(depth + 1, funded);
  }

  explore(0, []);
  return bestBuys;
}

/**
 * Water-fills the budget, holding undecided positions to no minimum.
 *
 * @returns The resulting value per position, or null when the funded
 * positions cannot all clear the minimum within the budget.
 */
function fill(
  problem: Problem,
  funded: readonly number[],
  undecided: readonly number[],
): number[] | null {
  const participants = [...funded, ...undecided];
  if (participants.length === 0) {
    return null;
  }

  const fundedSet = new Set(funded);
  const floors = participants.map(
    (index) => problem.holdings[index]! + (fundedSet.has(index) ? problem.minOrder : 0),
  );
  const total =
    sum(participants.map((index) => problem.holdings[index]!)) + problem.budget;
  if (sum(floors) > total) {
    return null;
  }

  const filled = waterFill(
    participants.map((index) => problem.weights[index]!),
    floors,
    total,
  );
  const values = [...problem.holdings];
  participants.forEach((index, position) => {
    values[index] = filled[position]!;
  });
  return values;
}

/**
 * Scores a fully decided funded set, or reports it as infeasible.
 *
 * Exported (with {@link Problem} and {@link trackingError}) for the
 * exhaustive-search parity test.
 *
 * @returns The whole-unit purchase per position and its chi-square distance
 * to the target weights, or `{buys: null, score: Infinity}` when the set
 * cannot be funded with every order clearing the minimum.
 */
export function evaluate(
  problem: Problem,
  funded: readonly number[],
): { buys: number[] | null; score: number } {
  const values = fill(problem, funded, []);
  if (values === null) {
    return { buys: null, score: Infinity };
  }

  const buys = splitAmount(
    problem.budget,
    values.map((value, index) => value - problem.holdings[index]!),
  );
  if (buys.some((buy) => buy > 0 && buy < problem.minOrder)) {
    return { buys: null, score: Infinity };
  }
  const score = trackingError(
    problem.weights,
    problem.holdings.map((holding, index) => holding + buys[index]!),
  );
  return { buys, score };
}

/** Chi-square distance between the resulting weights and the targets. */
export function trackingError(
  weights: readonly number[],
  values: readonly number[],
): number {
  const total = sum(values);
  if (total <= 0) {
    return 0;
  }
  return sum(
    values.map(
      (value, index) =>
        ((value / total) * 100 - weights[index]!) ** 2 / weights[index]!,
    ),
  );
}

/** Assembles the reportable plan from the chosen purchases. */
function buildPlan(
  positions: readonly Position[],
  buys: readonly number[],
  leftover: number,
): PurchasePlan {
  const targets = positions.map((position) => position.targetPct);
  const holdings = positions.map((position) => position.holding);
  const projected = holdings.map((holding, index) => holding + buys[index]!);
  const totalBefore = sum(holdings);
  const totalAfter = sum(projected);

  const positionPlans: PositionPlan[] = positions.map((position, index) => ({
    ticker: position.ticker,
    name: position.name,
    targetPct: position.targetPct,
    holding: position.holding,
    buy: buys[index]!,
    currentPct: totalBefore ? (position.holding / totalBefore) * 100 : 0,
    projectedPct: totalAfter ? (projected[index]! / totalAfter) * 100 : 0,
  }));

  return {
    positions: positionPlans,
    invested: sum(buys),
    leftover,
    driftBeforePct: driftPct(targets, holdings),
    driftAfterPct: driftPct(targets, projected),
  };
}
