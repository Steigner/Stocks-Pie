import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { roundTotal } from '../domain/types';
import { formatDate, formatMoney } from '../format';
import { usePortfolio } from '../state/PortfolioContext';
import styles from './HistoryScreen.module.css';

export function HistoryScreen() {
  const { portfolio, deleteRound } = usePortfolio();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (!portfolio) {
    return null;
  }

  if (portfolio.rounds.length === 0) {
    return (
      <div className={styles.screen}>
        <h1>History</h1>
        <p className={styles.empty}>No deposits recorded yet.</p>
      </div>
    );
  }

  const names = new Map(
    portfolio.positions.map((position) => [position.ticker, position.name]),
  );
  const rounds = [...portfolio.rounds].reverse();
  const pendingRound =
    portfolio.rounds.find((round) => round.id === pendingDeleteId) ?? null;

  return (
    <div className={styles.screen}>
      <h1>History ({portfolio.rounds.length})</h1>
      <div className={styles.list}>
        {rounds.map((round) => (
          <Card key={round.id} className={styles.round}>
            <div className={styles.roundHeader}>
              <span className={styles.date}>{formatDate(round.on)}</span>
              <span className={styles.total}>
                {formatMoney(roundTotal(round), portfolio.currency)} invested
              </span>
              <Button variant="danger" onClick={() => setPendingDeleteId(round.id)}>
                Delete
              </Button>
            </div>
            <ul className={styles.buys}>
              {Object.entries(round.buys).map(([ticker, amount]) => (
                <li key={ticker} className={styles.buy} title={names.get(ticker)}>
                  <span className={styles.buyTicker}>{ticker}</span>
                  <span className={styles.buyAmount}>
                    {formatMoney(amount, portfolio.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {pendingRound && (
        <ConfirmDialog
          title="Delete this round?"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            deleteRound(pendingRound.id);
            setPendingDeleteId(null);
          }}
        >
          This takes {formatMoney(roundTotal(pendingRound), portfolio.currency)} back
          out of the positions it bought on {formatDate(pendingRound.on)}.
        </ConfirmDialog>
      )}
    </div>
  );
}
