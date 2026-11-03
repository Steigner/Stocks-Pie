import { afterEach, describe, expect, it, vi } from 'vitest';
import { readLanguage, saveLanguage } from './language';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem('stocks-pie:language');
});

describe('language preference', () => {
  it.each([null, 'en', 'de', 'CS', ''])('defaults to English for %s', (stored) => {
    if (stored !== null) {
      localStorage.setItem('stocks-pie:language', stored);
    }

    expect(readLanguage()).toBe('en');
  });

  it('remembers a Czech choice', () => {
    saveLanguage('cs');

    expect(readLanguage()).toBe('cs');
  });

  it('logs unavailable storage and falls back to English', () => {
    const error = new DOMException('Storage blocked', 'SecurityError');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw error;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(readLanguage()).toBe('en');
    expect(log).toHaveBeenCalledWith('Could not read the language preference.', error);
  });

  it('logs a failed save without preventing a language change', () => {
    const error = new DOMException('Storage full', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw error;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => saveLanguage('cs')).not.toThrow();
    expect(log).toHaveBeenCalledWith('Could not save the language preference.', error);
  });
});
