import type { Portfolio } from '../domain/types';
import type { PortfolioStore } from './types';

/** Keeps the portfolio in memory only - the web preview, which saves nothing. */
export class MemoryPortfolioStore implements PortfolioStore {
  private readonly initial: Portfolio | null;

  constructor(initial: Portfolio | null) {
    this.initial = initial;
  }

  describeLocation(): string | null {
    return null;
  }

  async connect(): Promise<boolean> {
    return true;
  }

  async restoreFromPreviousVisit(): Promise<boolean> {
    return true;
  }

  async load(): Promise<Portfolio | null> {
    return this.initial;
  }

  async save(_portfolio: Portfolio): Promise<void> {}
}
