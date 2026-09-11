import type { Portfolio } from './types';

/**
 * What the web preview opens with. Holdings are deliberately off target, so the
 * first deposit shows the rebalancing at work. Illustrative, not a recommendation.
 */
export function samplePortfolio(): Portfolio {
  return {
    currency: 'CZK',
    minOrder: 5_000,
    positions: [
      { ticker: 'NVDA', name: 'NVIDIA', targetPct: 25, holding: 64_000 },
      { ticker: 'AMD', name: 'AMD', targetPct: 25, holding: 41_000 },
      { ticker: 'SIE', name: 'Siemens', targetPct: 20, holding: 37_000 },
      { ticker: 'ABBN', name: 'ABB', targetPct: 15, holding: 24_000 },
      { ticker: 'CZG', name: 'Colt CZ Group', targetPct: 10, holding: 11_000 },
      {
        ticker: 'KOFOL',
        name: 'Kofola ČeskoSlovensko',
        targetPct: 5,
        holding: 6_000,
      },
    ],
    rounds: [
      {
        id: 'sample-round',
        on: '2026-08-03',
        buys: { AMD: 10_000, ABBN: 5_000, CZG: 5_000 },
      },
    ],
  };
}
