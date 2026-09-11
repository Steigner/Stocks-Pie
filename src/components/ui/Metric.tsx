import styles from './Metric.module.css';

interface MetricProps {
  label: string;
  value: string;
  /** Positive is shown as a worsening (red), negative as an improvement (green). */
  delta?: string;
  deltaDirection?: 'up' | 'down';
}

export function Metric({ label, value, delta, deltaDirection }: MetricProps) {
  return (
    <div className={styles.metric}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta && (
        <span
          className={`${styles.delta} ${deltaDirection === 'up' ? styles.deltaUp : styles.deltaDown}`}
        >
          {delta}
        </span>
      )}
    </div>
  );
}
