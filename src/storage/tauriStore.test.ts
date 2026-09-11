import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Portfolio } from '../domain/types';
import { savePortfolioToText } from './serialization';
import { TauriPortfolioStore } from './tauriStore';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@tauri-apps/api/core', () => ({ invoke }));

const PORTFOLIO: Portfolio = {
  positions: [{ name: 'A', ticker: 'AAA', targetPct: 100.0, holding: 0 }],
  currency: 'CZK',
  minOrder: 5_000,
  rounds: [],
};

describe('TauriPortfolioStore', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('connects to the folder picked in the system dialog', async () => {
    invoke.mockResolvedValueOnce('Investing');
    const store = new TauriPortfolioStore();

    expect(await store.connect()).toBe(true);

    expect(invoke).toHaveBeenCalledWith('choose_folder');
    expect(store.describeLocation()).toBe('Investing');
  });

  it('reports a cancelled first pick instead of carrying on without a folder', async () => {
    invoke.mockResolvedValueOnce(null);
    const store = new TauriPortfolioStore();

    expect(await store.connect()).toBe(false);
    expect(store.describeLocation()).toBeNull();
  });

  it('keeps the current folder when changing it is cancelled', async () => {
    invoke.mockResolvedValueOnce('Investing').mockResolvedValueOnce(null);
    const store = new TauriPortfolioStore();
    await store.connect();

    expect(await store.connect()).toBe(false);

    expect(store.describeLocation()).toBe('Investing');
  });

  it('restores the folder remembered from the last launch', async () => {
    invoke.mockResolvedValueOnce('Investing');
    const store = new TauriPortfolioStore();

    expect(await store.restoreFromPreviousVisit()).toBe(true);
    expect(store.describeLocation()).toBe('Investing');
  });

  it('starts at the folder prompt when none is remembered', async () => {
    invoke.mockResolvedValueOnce(null);

    expect(await new TauriPortfolioStore().restoreFromPreviousVisit()).toBe(false);
  });

  it('saves and loads the portfolio as the same file text as the web app', async () => {
    const store = new TauriPortfolioStore();

    await store.save(PORTFOLIO);
    invoke.mockResolvedValueOnce(savePortfolioToText(PORTFOLIO));

    expect(invoke).toHaveBeenCalledWith('save_portfolio', {
      text: savePortfolioToText(PORTFOLIO),
    });
    expect(await store.load()).toEqual(PORTFOLIO);
  });

  it('loads nothing from a folder without a portfolio yet', async () => {
    invoke.mockResolvedValueOnce(null);

    expect(await new TauriPortfolioStore().load()).toBeNull();
  });
});
