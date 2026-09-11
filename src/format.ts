/** Formatting helpers for the amounts and percentages shown throughout the app. */

const amountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Formats an amount with its ISO 4217 code rather than a localised symbol.
 * "kr" and "Kč" and "zł" are easy to confuse; "SEK" and "CZK" and "PLN" are not.
 */
export function formatMoney(amount: number, currency: string): string {
  return `${amountFormatter.format(Math.round(amount))} ${currency}`;
}

export function formatPct(value: number, fractionDigits = 1): string {
  return `${value.toFixed(fractionDigits)}%`;
}

export function formatSignedPct(value: number, fractionDigits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(fractionDigits)} pp`;
}

export function formatDate(iso: string): string {
  // Built from parts: engines have disagreed on whether a date-time string with
  // no offset is local time or UTC, and the wrong answer shifts the day.
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
