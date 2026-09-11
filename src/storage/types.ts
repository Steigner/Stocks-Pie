import type { Portfolio } from '../domain/types';

/**
 * A backing store for the portfolio file, entirely local to the user's
 * machine. Implementations never make a network request.
 */
export interface PortfolioStore {
  /** Human-readable description of where data is stored, or null if unset. */
  describeLocation(): string | null;

  /**
   * Prompts the user to pick a location (a folder, or nothing to pick).
   * Resolves false when they cancel, which keeps the location already in use.
   */
  connect(): Promise<boolean>;

  /** Silently reconnects to a location picked on an earlier visit. */
  restoreFromPreviousVisit(): Promise<boolean>;

  /** Reads the portfolio from the connected location, or null if no file exists yet. */
  load(): Promise<Portfolio | null>;

  /** Writes the portfolio to the connected location. */
  save(portfolio: Portfolio): Promise<void>;
}
