import type { Portfolio } from '../domain/types';
import { MemoryPortfolioStore } from '../storage/memoryStore';

interface Options {
  /** When set, every save rejects with this error. */
  saveError?: Error;
}

/** The preview store plus a record of every save, and an optional failure, for tests. */
export class InMemoryPortfolioStore extends MemoryPortfolioStore {
  /** Every portfolio handed to save(), in order. */
  readonly saved: Portfolio[] = [];
  private readonly saveError: Error | undefined;

  constructor(initial: Portfolio | null = null, options: Options = {}) {
    super(initial);
    this.saveError = options.saveError;
  }

  override async save(portfolio: Portfolio): Promise<void> {
    if (this.saveError) {
      throw this.saveError;
    }
    this.saved.push(portfolio);
  }
}
