/** Pure operations on a Portfolio: editing positions and folding in confirmed rounds. */
import { generateId } from '../id';
import { splitAmount } from './allocation';
import type { Portfolio, Position, PurchasePlan, Round } from './types';

/** Used until the user picks one; every amount is stored in this currency. */
export const DEFAULT_CURRENCY = 'CZK';
/** A fresh portfolio's minimum order, in DEFAULT_CURRENCY. */
const DEFAULT_MIN_ORDER = 5_000;

/** A fresh portfolio: no positions yet, so nothing assumes a particular market. */
export function emptyPortfolio(): Portfolio {
  return {
    positions: [],
    currency: DEFAULT_CURRENCY,
    minOrder: DEFAULT_MIN_ORDER,
    rounds: [],
  };
}

/** Swaps in edited positions and settings, keeping the round log. */
export function replacePositions(
  portfolio: Portfolio,
  positions: readonly Position[],
  minOrder: number,
  currency: string,
): Portfolio {
  return { positions, currency, minOrder, rounds: portfolio.rounds };
}

/** Rescales targets proportionally so they sum to exactly 100 percent. */
export function normalizeTargets(positions: readonly Position[]): Position[] {
  const totalPct = positions.reduce((total, position) => total + position.targetPct, 0);
  if (totalPct <= 0) {
    return [...positions];
  }
  // Rounding each target on its own can land on 99.99, which validation rejects;
  // splitting 10,000 hundredths of a percent always adds back up to 100.
  const hundredths = splitAmount(
    10_000,
    positions.map((position) => position.targetPct),
  );
  return positions.map((position, index) => ({
    ...position,
    targetPct: hundredths[index]! / 100,
  }));
}

/** Adds a confirmed round's orders to the holdings and logs the round. */
export function applyPurchases(
  portfolio: Portfolio,
  plan: PurchasePlan,
  on: string,
): Portfolio {
  const bought = new Map(
    plan.positions.map((position) => [position.ticker, position.buy]),
  );

  const positions = portfolio.positions.map((position) => ({
    ...position,
    holding: position.holding + (bought.get(position.ticker) ?? 0),
  }));

  const buys: Record<string, number> = {};
  for (const [ticker, amount] of bought) {
    if (amount) {
      buys[ticker] = amount;
    }
  }

  const round: Round = {
    id: generateId(),
    on,
    buys,
  };

  return { ...portfolio, positions, rounds: [...portfolio.rounds, round] };
}

/**
 * Fully undoes a confirmed round: subtracts what it bought back out of the
 * affected holdings and removes it from the log. Returns the portfolio
 * unchanged if no round with that id exists.
 *
 * A holding revalued below what the round bought stops at zero; a negative one
 * would fail validation and block every later round.
 */
export function deleteRoundById(portfolio: Portfolio, id: string): Portfolio {
  const round = portfolio.rounds.find((candidate) => candidate.id === id);
  if (!round) {
    return portfolio;
  }

  const positions = portfolio.positions.map((position) => ({
    ...position,
    holding: Math.max(0, position.holding - (round.buys[position.ticker] ?? 0)),
  }));
  const rounds = portfolio.rounds.filter((candidate) => candidate.id !== id);

  return { ...portfolio, positions, rounds };
}
