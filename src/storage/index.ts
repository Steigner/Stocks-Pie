import { samplePortfolio } from '../domain/samplePortfolio';
import { MemoryPortfolioStore } from './memoryStore';
import { TauriPortfolioStore, isTauriApp } from './tauriStore';
import type { PortfolioStore } from './types';

/** The app saves to a folder; the web build is a preview that saves nothing. */
export function createPortfolioStore(): PortfolioStore {
  return isTauriApp()
    ? new TauriPortfolioStore()
    : new MemoryPortfolioStore(samplePortfolio());
}

export { MemoryPortfolioStore } from './memoryStore';
export type { PortfolioStore } from './types';
