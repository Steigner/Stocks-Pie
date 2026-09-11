/** JSON (de)serialization of a Portfolio, with descriptive errors on a bad file. */
import { DEFAULT_CURRENCY } from '../domain/portfolio';
import type { Portfolio } from '../domain/types';
import { generateId } from '../id';

const CURRENCY_CODE = /^[A-Z]{3}$/;

/**
 * Bumped whenever the file layout changes; older files are migrated on load.
 * Version 1 (no `version` field) keyed a round's buys by position name.
 * Versions 1 and 2 suffixed amount fields with `Czk`, whatever the currency,
 * and logged each round's budget.
 */
const FILE_VERSION = 3;

/** Raised when a saved portfolio file exists but cannot be read. */
export class StoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreError';
  }
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new StoreError(`Expected an object for ${context}.`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new StoreError(`Expected a string for ${context}.`);
  }
  return value;
}

function asNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new StoreError(`Expected a number for ${context}.`);
  }
  return value;
}

function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new StoreError(`Expected an array for ${context}.`);
  }
  return value;
}

/**
 * Parses a portfolio from already-decoded JSON.
 *
 * @throws StoreError if a required field is missing or of the wrong type.
 */
function parsePortfolio(raw: unknown): Portfolio {
  const root = asRecord(raw, 'portfolio');

  const version = root.version === undefined ? 1 : asNumber(root.version, 'version');
  if (version > FILE_VERSION) {
    throw new StoreError(
      `This file was written by a newer version of the app (format ${version}).`,
    );
  }

  const amountKey = (key: string): string => (version < 3 ? `${key}Czk` : key);
  const holdingKey = amountKey('holding');
  const minOrderKey = amountKey('minOrder');

  const positions = asArray(root.positions, 'positions').map((entry, index) => {
    const record = asRecord(entry, `positions[${index}]`);
    return {
      name: asString(record.name, `positions[${index}].name`),
      ticker: asString(record.ticker, `positions[${index}].ticker`),
      targetPct: asNumber(record.targetPct, `positions[${index}].targetPct`),
      holding: asNumber(record[holdingKey], `positions[${index}].${holdingKey}`),
    };
  });

  // Zero is legitimate - plenty of brokers charge a percentage with no floor.
  // A negative one makes the purchase search degenerate and silently allocate
  // nothing, so it is rejected here rather than at the screen.
  const minOrder = asNumber(root[minOrderKey], minOrderKey);
  if (minOrder < 0) {
    throw new StoreError('minOrder cannot be negative.');
  }

  // Files written before the app supported other currencies have no code.
  const currency =
    root.currency === undefined
      ? DEFAULT_CURRENCY
      : asString(root.currency, 'currency');
  if (!CURRENCY_CODE.test(currency)) {
    throw new StoreError(
      `Expected a three-letter ISO 4217 currency code, got "${currency}".`,
    );
  }

  // A name with no ticker, or one no longer in the portfolio, has nothing to map
  // to and keeps its old key.
  const tickerByName =
    version < 2
      ? new Map(
          positions
            .filter((position) => position.ticker !== '')
            .map((position) => [position.name, position.ticker]),
        )
      : new Map<string, string>();

  const rounds = asArray(root.rounds, 'rounds').map((entry, index) => {
    const record = asRecord(entry, `rounds[${index}]`);
    const buysRecord = asRecord(record.buys, `rounds[${index}].buys`);
    const buys: Record<string, number> = {};
    for (const [key, amount] of Object.entries(buysRecord)) {
      const ticker = tickerByName.get(key) ?? key;
      buys[ticker] =
        (buys[ticker] ?? 0) + asNumber(amount, `rounds[${index}].buys.${key}`);
    }
    return {
      id: typeof record.id === 'string' ? record.id : generateId(),
      on: asString(record.on, `rounds[${index}].on`),
      buys,
    };
  });

  return { positions, currency, minOrder, rounds };
}

/**
 * Parses a portfolio from raw JSON text.
 *
 * @throws StoreError if the text is not valid JSON or not a readable portfolio.
 */
export function loadPortfolioFromText(text: string): Portfolio {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new StoreError(`Saved portfolio is not valid JSON: ${String(error)}`);
  }

  try {
    return parsePortfolio(raw);
  } catch (error) {
    if (error instanceof StoreError) {
      throw error;
    }
    throw new StoreError(`Saved portfolio is not readable: ${String(error)}`);
  }
}

/** Serializes a portfolio to pretty-printed JSON text. */
export function savePortfolioToText(portfolio: Portfolio): string {
  return JSON.stringify({ version: FILE_VERSION, ...portfolio }, null, 2);
}
