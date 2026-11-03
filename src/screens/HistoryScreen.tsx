import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { roundTotal } from '../domain/types';
import { usePortfolio } from '../state/PortfolioContext';
import { useTranslation } from '../useTranslation';
import styles from './HistoryScreen.module.css';

export function HistoryScreen() {
  const { text, formatDate, formatMoney } = useTranslation();
  const { portfolio, deleteRound } = usePortfolio();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  if (!portfolio) {
    return null;
  }

  if (portfolio.rounds.length === 0) {
    return (
      <div className={styles.screen}>
        <h1>{text.history}</h1>
        <p className={styles.empty}>{text.noRounds}</p>
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
      <h1>{text.historyCount(portfolio.rounds.length)}</h1>
      <div className={styles.list}>
        {rounds.map((round) => (
          <Card key={round.id} className={styles.round}>
            <div className={styles.roundHeader}>
              <span className={styles.date}>{formatDate(round.on)}</span>
              <span className={styles.total}>
                {text.invested(formatMoney(roundTotal(round), portfolio.currency))}
              </span>
              <Button variant="danger" onClick={() => setPendingDeleteId(round.id)}>
                {text.delete}
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
          title={text.deleteRound}
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={() => {
            deleteRound(pendingRound.id);
            setPendingDeleteId(null);
          }}
        >
          {text.deleteRoundHelp(
            formatMoney(roundTotal(pendingRound), portfolio.currency),
            formatDate(pendingRound.on),
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
