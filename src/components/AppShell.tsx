import type { ReactNode } from 'react';
import { ThemeToggle } from './ui/ThemeToggle';
import styles from './AppShell.module.css';

interface NavItem<T extends string> {
  id: T;
  label: string;
}

interface AppShellProps<T extends string> {
  items: readonly NavItem<T>[];
  active: T;
  onSelect: (id: T) => void;
  locationLabel: string | null;
  children: ReactNode;
}

export function AppShell<T extends string>({
  items,
  active,
  onSelect,
  locationLabel,
  children,
}: AppShellProps<T>) {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="Main">
        <div className={styles.brand}>Stocks Pie</div>
        <ul className={styles.navList}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={`${styles.navItem} ${item.id === active ? styles.navItemActive : ''}`}
                aria-current={item.id === active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.footer}>
          {locationLabel && (
            <div className={styles.location}>Saved to: {locationLabel}</div>
          )}
          <ThemeToggle />
        </div>
      </nav>
      <main className={styles.content}>
        <div className={styles.contentInner}>{children}</div>
      </main>
    </div>
  );
}
