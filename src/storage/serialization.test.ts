import { describe, expect, it } from 'vitest';
import type { Portfolio } from '../domain/types';
import {
  StoreError,
  loadPortfolioFromText,
  savePortfolioToText,
} from './serialization';

const PORTFOLIO: Portfolio = {
  positions: [
    { name: 'A', ticker: 'AAA', targetPct: 90.0, holding: 10_000 },
    { name: 'B', ticker: 'BBB', targetPct: 10.0, holding: 0 },
  ],
  currency: 'CZK',
  minOrder: 5_000,
  rounds: [{ id: 'r1', on: '2026-08-31', buys: { AAA: 10_000 } }],
};

/** The current file for PORTFOLIO, with some top-level fields swapped out. */
function fileWith(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    ...JSON.parse(savePortfolioToText(PORTFOLIO)),
    ...overrides,
  });
}

describe('save then load', () => {
  it('round-trips a portfolio through text', () => {
    const text = savePortfolioToText(PORTFOLIO);

    expect(loadPortfolioFromText(text)).toEqual(PORTFOLIO);
  });
});

describe('loadPortfolioFromText', () => {
  it('migrates a first-format file, which keyed buys by position name', () => {
    const text = JSON.stringify({
      minOrderCzk: 5000,
      positions: [
        { name: 'A', ticker: 'AAA', targetPct: 90.0, holdingCzk: 10000 },
        { name: 'B', ticker: 'BBB', targetPct: 10.0, holdingCzk: 0 },
      ],
      rounds: [{ on: '2026-08-31', budgetCzk: 10000, buys: { A: 10000 } }],
    });

    const portfolio = loadPortfolioFromText(text);

    expect(portfolio.positions).toEqual(PORTFOLIO.positions);
    expect(portfolio.rounds[0]!.buys).toEqual({ AAA: 10_000 });
    expect(portfolio.rounds[0]!.id).toBeTruthy();
  });

  it('migrates a second-format file, which suffixed amounts with Czk', () => {
    const text = JSON.stringify({
      version: 2,
      currency: 'CZK',
      minOrderCzk: 5000,
      positions: [
        { name: 'A', ticker: 'AAA', targetPct: 90.0, holdingCzk: 10000 },
        { name: 'B', ticker: 'BBB', targetPct: 10.0, holdingCzk: 0 },
      ],
      rounds: [{ id: 'r1', on: '2026-08-31', budgetCzk: 10000, buys: { AAA: 10000 } }],
    });

    expect(loadPortfolioFromText(text)).toEqual(PORTFOLIO);
  });

  it('keeps the old key for a bought position that has no ticker to map to', () => {
    const text = JSON.stringify({
      minOrderCzk: 5000,
      positions: [{ name: 'A', ticker: '', targetPct: 100.0, holdingCzk: 10000 }],
      rounds: [{ on: '2026-08-31', budgetCzk: 10000, buys: { A: 10000 } }],
    });

    expect(loadPortfolioFromText(text).rounds[0]!.buys).toEqual({ A: 10_000 });
  });

  it('rejects a file written by a newer version of the app', () => {
    expect(() => loadPortfolioFromText(fileWith({ version: 99 }))).toThrow(StoreError);
  });

  it('accepts a zero minimum, which brokers without one need', () => {
    expect(loadPortfolioFromText(fileWith({ minOrder: 0 })).minOrder).toBe(0);
  });

  it('rejects a negative minimum, which would silently allocate nothing', () => {
    expect(() => loadPortfolioFromText(fileWith({ minOrder: -1 }))).toThrow(StoreError);
  });

  it('defaults the currency for files written before it existed', () => {
    // JSON.stringify drops an undefined property, so this is a file with no code.
    const text = fileWith({ currency: undefined });

    expect(loadPortfolioFromText(text).currency).toBe('CZK');
  });

  it('rejects a currency that is not an ISO 4217 code', () => {
    expect(() => loadPortfolioFromText(fileWith({ currency: 'korun' }))).toThrow(
      StoreError,
    );
  });

  it('reports a corrupt file instead of silently reseeding', () => {
    expect(() => loadPortfolioFromText('{not json')).toThrow(StoreError);
  });

  it('reports a file missing expected fields', () => {
    expect(() => loadPortfolioFromText('{"positions": []}')).toThrow(StoreError);
  });
});
