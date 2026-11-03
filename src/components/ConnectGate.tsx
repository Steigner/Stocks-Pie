import { usePortfolio } from '../state/PortfolioContext';
import { useTranslation } from '../useTranslation';
import { Banner } from './ui/Banner';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import styles from './ConnectGate.module.css';

/** The app's first screen, until a folder for the portfolio is chosen. */
export function ConnectGate() {
  const { text } = useTranslation();
  const { status, errorMessage, connect } = usePortfolio();

  return (
    <div className={styles.gate}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Stocks Pie</h1>
        <div className={styles.body}>
          <p>{text.connectIntro}</p>
          {errorMessage && <Banner tone="error">{errorMessage}</Banner>}
        </div>
        <Button
          variant="primary"
          fullWidth
          busy={status === 'connecting'}
          onClick={() => void connect()}
        >
          {text.chooseFolder}
        </Button>
        <p className={styles.disclaimer}>{text.disclaimer}</p>
      </Card>
    </div>
  );
}
