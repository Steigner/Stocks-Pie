import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DOWNLOAD_URL } from '../download';
import { usePortfolio } from '../state/PortfolioContext';
import styles from './DataLocationScreen.module.css';

export function DataLocationScreen() {
  const { locationLabel, connect, isPreview } = usePortfolio();

  return (
    <div className={styles.screen}>
      <h1>Data location</h1>
      <Card className={styles.location}>
        {isPreview ? (
          <>
            <p>
              This preview doesn&apos;t save anything. Close the page and it starts
              over.
            </p>
            <p>
              The desktop app saves <code>portfolio.json</code> to a folder you choose
              and never goes online.
            </p>
            <div className={styles.actions}>
              <LinkButton
                variant="primary"
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
              >
                Download the app
              </LinkButton>
            </div>
          </>
        ) : (
          <>
            <span className={styles.folderName}>
              {locationLabel ? `Folder: ${locationLabel}` : 'No folder connected'}
            </span>
            <p>
              Every change is saved to <code>portfolio.json</code> in this folder.
            </p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => void connect()}>
                Change folder
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
