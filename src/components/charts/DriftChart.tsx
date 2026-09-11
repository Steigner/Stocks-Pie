import { gapPct, type PurchasePlan } from '../../domain/types';
import { formatSignedPct } from '../../format';
import styles from './DriftChart.module.css';

/** How far each position is off target now, and after this round's purchase. */
export function DriftChart({ plan }: { plan: PurchasePlan }) {
  const rows = plan.positions.map((position) => ({
    ticker: position.ticker,
    now: position.currentPct - position.targetPct,
    after: gapPct(position),
  }));
  // Every bar shares one scale, symmetric around zero.
  const extent = Math.max(
    1,
    ...rows.flatMap((row) => [Math.abs(row.now), Math.abs(row.after)]),
  );

  return (
    <div className={styles.chart}>
      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendNow}>Now</span>
        <span className={styles.legendAfter}>After purchase</span>
      </div>
      {rows.map((row) => (
        <div key={row.ticker} className={styles.row}>
          <span className={styles.ticker}>{row.ticker}</span>
          <svg
            className={styles.bars}
            viewBox={`${-extent} 0 ${2 * extent} 2`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              className={styles.now}
              x={Math.min(0, row.now)}
              y="0.1"
              width={Math.abs(row.now)}
              height="0.8"
            />
            <rect
              className={styles.after}
              x={Math.min(0, row.after)}
              y="1.1"
              width={Math.abs(row.after)}
              height="0.8"
            />
            <line className={styles.axis} x1="0" x2="0" y1="0" y2="2" />
          </svg>
          <span className={styles.value}>
            {formatSignedPct(row.now)} → {formatSignedPct(row.after)}
          </span>
        </div>
      ))}
    </div>
  );
}
