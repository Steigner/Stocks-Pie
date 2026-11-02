import styles from './TargetBar.module.css';

function asWidth(pct: number): string {
  return `${Math.min(pct, 100)}%`;
}

/** How much of the portfolio a position is now, with a mark at its target. */
export function TargetBar({
  currentPct,
  targetPct,
}: {
  currentPct: number;
  targetPct: number;
}) {
  return (
    <svg className={styles.bar} aria-hidden="true">
      <rect className={styles.track} width="100%" height="100%" rx="3" />
      <rect className={styles.fill} width={asWidth(currentPct)} height="100%" rx="3" />
      <rect
        className={styles.mark}
        x={asWidth(targetPct)}
        y="-2"
        width="2"
        height="10"
      />
    </svg>
  );
}
