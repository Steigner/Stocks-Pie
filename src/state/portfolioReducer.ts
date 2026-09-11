import { applyPurchases, deleteRoundById, replacePositions } from '../domain/portfolio';
import type { Portfolio, Position, PurchasePlan } from '../domain/types';

type PortfolioAction =
  | { type: 'loaded'; portfolio: Portfolio }
  | {
      type: 'positionsSaved';
      positions: readonly Position[];
      minOrder: number;
      currency: string;
    }
  | { type: 'roundConfirmed'; plan: PurchasePlan; on: string }
  | { type: 'roundDeleted'; id: string };

export function portfolioReducer(
  state: Portfolio | null,
  action: PortfolioAction,
): Portfolio | null {
  switch (action.type) {
    case 'loaded':
      return action.portfolio;
    case 'positionsSaved':
      return (
        state &&
        replacePositions(state, action.positions, action.minOrder, action.currency)
      );
    case 'roundConfirmed':
      return state && applyPurchases(state, action.plan, action.on);
    case 'roundDeleted':
      return state && deleteRoundById(state, action.id);
  }
}
