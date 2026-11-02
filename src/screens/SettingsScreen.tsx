import { useState } from 'react';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InfoTip } from '../components/ui/InfoTip';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { CURRENCY_CHOICES } from '../domain/currencies';
import { DOWNLOAD_URL } from '../download';
import { usePortfolio } from '../state/PortfolioContext';
import styles from './SettingsScreen.module.css';

/** Saved when the field is left, so typing an amount writes the file only once. */
function MinOrderField({
  minOrder,
  currency,
  onCommit,
}: {
  minOrder: number;
  currency: string;
  onCommit: (minOrder: number) => void;
}) {
  const [draft, setDraft] = useState(String(minOrder));

  return (
    <div className={styles.field}>
      <span className={styles.withTip}>
        <label htmlFor="min-order">Minimum order per position ({currency})</label>
        <InfoTip label="the minimum order">
          The smallest order worth paying your broker&apos;s fee for. Use 0 if the fee
          is just a percentage.
        </InfoTip>
      </span>
      <input
        id="min-order"
        className={styles.input}
        type="number"
        inputMode="numeric"
        autoComplete="off"
        min={0}
        step={500}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const committed = Math.max(0, Number(draft) || 0);
          setDraft(String(committed));
          if (committed !== minOrder) {
            onCommit(committed);
          }
        }}
      />
    </div>
  );
}

export function SettingsScreen() {
  const { portfolio, locationLabel, connect, isPreview, savePositions } =
    usePortfolio();

  if (!portfolio) {
    return null;
  }

  const { positions, minOrder, currency } = portfolio;
  // A file may carry any ISO code, not just the offered ones; without its own
  // option the select would show the wrong currency.
  const currencyChoices: readonly string[] = (
    CURRENCY_CHOICES as readonly string[]
  ).includes(currency)
    ? CURRENCY_CHOICES
    : [currency, ...CURRENCY_CHOICES];

  return (
    <div className={styles.screen}>
      <h1>Settings</h1>

      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Your data</h2>
        {isPreview ? (
          <>
            <p>
              This preview doesn&apos;t save anything. Close the page and it starts
              over.
            </p>
            <p>
              The app saves <code>portfolio.json</code> to a folder you choose and never
              goes online.
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

      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Portfolio</h2>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.withTip}>
              <label htmlFor="currency">Currency</label>
              <InfoTip label="the currency setting">
                Just a label. The app never converts amounts.
              </InfoTip>
            </span>
            <select
              id="currency"
              className={styles.input}
              value={currency}
              onChange={(event) =>
                savePositions(positions, minOrder, event.target.value)
              }
            >
              {currencyChoices.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
          {/* Keyed so a value loaded from another folder replaces the draft. */}
          <MinOrderField
            key={minOrder}
            minOrder={minOrder}
            currency={currency}
            onCommit={(committed) => savePositions(positions, committed, currency)}
          />
        </div>
      </Card>

      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>Theme</h2>
        <ThemeToggle />
      </Card>

      <p className={styles.disclaimer}>
        Not investment advice. Always check your orders before you place them.
      </p>
    </div>
  );
}
