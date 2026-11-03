import { useState } from 'react';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InfoTip } from '../components/ui/InfoTip';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { CURRENCY_CHOICES } from '../domain/currencies';
import { DOWNLOAD_URL } from '../download';
import { usePortfolio } from '../state/PortfolioContext';
import { useTranslation } from '../useTranslation';
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
  const { text } = useTranslation();
  const [draft, setDraft] = useState(String(minOrder));

  return (
    <div className={styles.field}>
      <span className={styles.withTip}>
        <label htmlFor="min-order">{text.minOrder(currency)}</label>
        <InfoTip label={text.minOrderInfo}>{text.minOrderHelp}</InfoTip>
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
  const { text, language, setLanguage } = useTranslation();
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
      <h1>{text.settings}</h1>

      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <label htmlFor="language">{text.language}</label>
        </h2>
        <select
          id="language"
          className={styles.input}
          value={language}
          onChange={(event) => setLanguage(event.target.value === 'cs' ? 'cs' : 'en')}
        >
          <option value="en" lang="en">
            English
          </option>
          <option value="cs" lang="cs">
            Čeština
          </option>
        </select>
      </Card>

      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>{text.yourData}</h2>
        {isPreview ? (
          <>
            <p>{text.previewData}</p>
            <p>{text.appData}</p>
            <div className={styles.actions}>
              <LinkButton
                variant="primary"
                href={DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
              >
                {text.download}
              </LinkButton>
            </div>
          </>
        ) : (
          <>
            <span className={styles.folderName}>
              {locationLabel ? text.folder(locationLabel) : text.noFolder}
            </span>
            <p>{text.savedData}</p>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => void connect()}>
                {text.changeFolder}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className={styles.section}>
        <h2 className={styles.sectionTitle}>{text.portfolio}</h2>
        <div className={styles.fields}>
          <div className={styles.field}>
            <span className={styles.withTip}>
              <label htmlFor="currency">{text.currency}</label>
              <InfoTip label={text.currencyInfo}>{text.currencyHelp}</InfoTip>
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
        <h2 className={styles.sectionTitle}>{text.theme}</h2>
        <ThemeToggle />
      </Card>

      <p className={styles.disclaimer}>{text.disclaimer}</p>
    </div>
  );
}
