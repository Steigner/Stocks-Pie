/** One holding and the share of the portfolio it should represent. */
export interface Position {
  /** Exchange symbol used when placing the order; unique within the portfolio. */
  readonly ticker: string;
  /** Optional display name. */
  readonly name: string;
  /** Share of the whole portfolio this should be, in percent. */
  readonly targetPct: number;
  /** Current market value of the holding, in whole units of the portfolio currency. */
  readonly holding: number;
}

/** What one position does with this round's money. */
export interface PositionPlan {
  readonly ticker: string;
  readonly name: string;
  readonly targetPct: number;
  readonly holding: number;
  /** Amount to send to the broker now; 0 when the position is skipped. */
  readonly buy: number;
  /** Share of the portfolio held before this round. */
  readonly currentPct: number;
  /** Share of the portfolio after the purchase. */
  readonly projectedPct: number;
}

/** Percentage points the position will still be off target by. */
export function gapPct(plan: PositionPlan): number {
  return plan.projectedPct - plan.targetPct;
}

/** The full set of orders for one deposit. */
export interface PurchasePlan {
  /** Per-position outcome, in portfolio order. */
  readonly positions: readonly PositionPlan[];
  /** Sum sent to the broker. */
  readonly invested: number;
  /** Budget that stays on the account; non-zero only below the minimum order. */
  readonly leftover: number;
  /** Share of the portfolio sitting in the wrong position before the purchase. */
  readonly driftBeforePct: number;
  /** The same measure after the purchase. */
  readonly driftAfterPct: number;
}

/** Positions this round buys nothing of. */
export function skippedPositions(plan: PurchasePlan): readonly PositionPlan[] {
  return plan.positions.filter((position) => position.buy === 0);
}

/** Positions this round buys something of. */
export function orderedPositions(plan: PurchasePlan): readonly PositionPlan[] {
  return plan.positions.filter((position) => position.buy > 0);
}

/** One confirmed deposit and the orders it produced. */
export interface Round {
  /** Stable identifier, used for deletion and React list keys. */
  readonly id: string;
  /** ISO date (yyyy-mm-dd) the round was confirmed. */
  readonly on: string;
  /** Whole units ordered per ticker; skipped positions are left out. */
  readonly buys: Readonly<Record<string, number>>;
}

/** Total sent to the broker in this round. */
export function roundTotal(round: Round): number {
  return Object.values(round.buys).reduce((total, amount) => total + amount, 0);
}

/** Everything the app remembers between sessions. */
export interface Portfolio {
  /** The holdings and their target weights, in display order. */
  readonly positions: readonly Position[];
  /** ISO 4217 code of the currency every amount is expressed in. */
  readonly currency: string;
  /** Smallest amount worth sending as a single order. */
  readonly minOrder: number;
  /** Confirmed deposits, oldest first. */
  readonly rounds: readonly Round[];
}

/** Raised when positions do not form a valid target allocation. */
export class PortfolioValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioValidationError';
  }
}
