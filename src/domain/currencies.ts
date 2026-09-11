/**
 * Currencies offered in the settings dropdown. Not exhaustive - the stored file
 * accepts any ISO 4217 code, this is just what the broker of a European retail
 * investor is most likely to settle in.
 */
export const CURRENCY_CHOICES = [
  'CZK',
  'EUR',
  'USD',
  'GBP',
  'PLN',
  'HUF',
  'RON',
  'BGN',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
] as const;
