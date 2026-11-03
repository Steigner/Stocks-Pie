import type { Language } from './language';

export function createFormatters(language: Language) {
  const locale = language === 'cs' ? 'cs-CZ' : 'en-US';
  const amountFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const decimal = (value: number, fractionDigits: number | null): string =>
    value.toLocaleString(locale, {
      minimumFractionDigits: fractionDigits ?? 0,
      maximumFractionDigits: fractionDigits ?? 20,
      useGrouping: false,
    });

  return {
    // ISO codes stay unambiguous when several currencies share a symbol.
    formatMoney: (amount: number, currency: string): string =>
      `${amountFormatter.format(Math.round(amount))} ${currency}`,
    formatPct: (value: number, fractionDigits: number | null = 1): string =>
      `${decimal(value, fractionDigits)}${language === 'cs' ? '\u00a0%' : '%'}`,
    formatSignedPct: (value: number, fractionDigits = 1): string =>
      `${value > 0 ? '+' : ''}${decimal(value, fractionDigits)}${language === 'cs' ? '\u00a0p.\u00a0b.' : ' pp'}`,
    formatDate: (iso: string): string => {
      // Parsing calendar parts avoids shifting a date through UTC.
      const [year, month, day] = iso.split('-').map(Number);
      return new Date(year!, month! - 1, day!).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    },
  };
}
