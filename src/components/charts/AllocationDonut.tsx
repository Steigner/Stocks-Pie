import type { Position } from '../../domain/types';
import { formatPct } from '../../format';
import styles from './AllocationDonut.module.css';

const SLICE_COLORS = [
  '#0a84ff',
  '#34c759',
  '#ff9f0a',
  '#ff3b30',
  '#af52de',
  '#5ac8fa',
  '#ffd60a',
  '#ff2d55',
] as const;

/** A circle whose circumference is exactly 100, so dash lengths read as percentages. */
const RADIUS = 50 / Math.PI;

export function AllocationDonut({ positions }: { positions: readonly Position[] }) {
  const total = positions.reduce((sum, position) => sum + position.targetPct, 0);
  let start = 0;
  const slices = positions.map((position, index) => {
    const share = total > 0 ? (position.targetPct / total) * 100 : 0;
    const slice = {
      label: position.ticker || position.name,
      value: position.targetPct,
      share,
      start,
      color: SLICE_COLORS[index % SLICE_COLORS.length]!,
    };
    start += share;
    return slice;
  });

  // Keyed by index: this draws the unsaved draft, where a ticker can still be
  // blank or duplicated.
  return (
    <div className={styles.chart}>
      <svg
        className={styles.donut}
        viewBox="0 0 42 42"
        role="img"
        aria-label="Target allocation"
      >
        {slices.map((slice, index) => (
          <circle
            key={index}
            cx="21"
            cy="21"
            r={RADIUS}
            fill="none"
            stroke={slice.color}
            strokeWidth="8"
            strokeDasharray={`${slice.share} ${100 - slice.share}`}
            // A dash starts at three o'clock; the extra 25 moves the first to twelve.
            strokeDashoffset={25 - slice.start}
          >
            <title>{`${slice.label}: ${formatPct(slice.value)}`}</title>
          </circle>
        ))}
      </svg>
      <ul className={styles.legend}>
        {slices.map((slice, index) => (
          <li key={index} className={styles.legendItem}>
            <svg className={styles.swatch} viewBox="0 0 10 10" aria-hidden="true">
              <rect width="10" height="10" rx="3" fill={slice.color} />
            </svg>
            <span className={styles.legendName}>{slice.label}</span>
            <span className={styles.legendValue}>{formatPct(slice.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
