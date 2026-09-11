import { samplePortfolio } from '../domain/samplePortfolio';
import { MemoryPortfolioStore } from './memoryStore';
import { TauriPortfolioStore, isDesktopApp } from './tauriStore';
import type { PortfolioStore } from './types';

/** The desktop app saves to a folder; the web build is a preview that saves nothing. */
export function createPortfolioStore(): PortfolioStore {
  return isDesktopApp()
    ? new TauriPortfolioStore()
    : new MemoryPortfolioStore(samplePortfolio());
}

export { MemoryPortfolioStore } from './memoryStore';
export type { PortfolioStore } from './types';
