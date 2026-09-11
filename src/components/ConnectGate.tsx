import { usePortfolio } from '../state/PortfolioContext';
import { Banner } from './ui/Banner';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import styles from './ConnectGate.module.css';

/** The desktop app's first screen, until a folder for the portfolio is chosen. */
export function ConnectGate() {
  const { status, errorMessage, connect } = usePortfolio();

  return (
    <div className={styles.gate}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Stocks Pie</h1>
        <div className={styles.body}>
          <p>
            Pick a folder for your <code>portfolio.json</code>. The app will remember
            it.
          </p>
          {errorMessage && <Banner tone="error">{errorMessage}</Banner>}
        </div>
        <Button
          variant="primary"
          fullWidth
          busy={status === 'connecting'}
          onClick={() => void connect()}
        >
          Choose a folder
        </Button>
        <p className={styles.disclaimer}>
          Not investment advice. Always check your orders before you place them.
        </p>
      </Card>
    </div>
  );
}
