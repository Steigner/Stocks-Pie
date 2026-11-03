import { describe, expect, it } from 'vitest';
import { createFormatters } from './format';

describe('localized formatting', () => {
  it('keeps English formatting', () => {
    const format = createFormatters('en');

    expect(format.formatMoney(12345.6, 'EUR')).toBe('12,346 EUR');
    expect(format.formatPct(12.5)).toBe('12.5%');
    expect(format.formatPct(33.34, null)).toBe('33.34%');
    expect(format.formatSignedPct(1.5)).toBe('+1.5 pp');
    expect(format.formatSignedPct(-1.5)).toBe('-1.5 pp');
    expect(format.formatDate('2026-08-31')).toBe('Aug 31, 2026');
  });

  it('uses Czech separators and dates without changing currency codes', () => {
    const format = createFormatters('cs');

    expect(format.formatMoney(12345.6, 'EUR')).toBe('12\u00a0346 EUR');
    expect(format.formatPct(12.5)).toBe('12,5\u00a0%');
    expect(format.formatPct(33.34, null)).toBe('33,34\u00a0%');
    expect(format.formatSignedPct(1.5)).toBe('+1,5\u00a0p.\u00a0b.');
    expect(format.formatSignedPct(-1.5)).toBe('-1,5\u00a0p.\u00a0b.');
    expect(format.formatSignedPct(0)).toBe('0,0\u00a0p.\u00a0b.');
    expect(format.formatDate('2026-08-31')).toBe('31. 8. 2026');
  });
});
