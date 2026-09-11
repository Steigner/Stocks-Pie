import { useEffect, useState } from 'react';
import { AllocationDonut } from '../components/charts/AllocationDonut';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InfoTip } from '../components/ui/InfoTip';
import { validatePositions } from '../domain/allocation';
import { CURRENCY_CHOICES } from '../domain/currencies';
import { DEFAULT_CURRENCY, normalizeTargets } from '../domain/portfolio';
import { PortfolioValidationError, type Position } from '../domain/types';
import { formatMoney, formatPct } from '../format';
import { generateId } from '../id';
import { usePortfolio } from '../state/PortfolioContext';
import styles from './PortfolioScreen.module.css';

const SAVED_NOTICE_MS = 4_000;

interface DraftRow {
  id: string;
  ticker: string;
  name: string;
  holding: number;
  targetPct: number;
}

function blankRow(): DraftRow {
  return { id: generateId(), ticker: '', name: '', holding: 0, targetPct: 0 };
}

function toDraftRows(positions: readonly Position[]): DraftRow[] {
  if (positions.length === 0) {
    return [blankRow()];
  }
  return positions.map((position) => ({ id: generateId(), ...position }));
}

function toPositions(rows: readonly DraftRow[]): Position[] {
  return rows
    .filter((row) => row.ticker.trim() !== '' || row.name.trim() !== '')
    .map((row) => ({
      ticker: row.ticker.trim(),
      name: row.name.trim(),
      targetPct: row.targetPct,
      holding: Math.trunc(row.holding),
    }));
}

export function PortfolioScreen() {
  const { portfolio, savePositions } = usePortfolio();
  const [rows, setRows] = useState<DraftRow[]>(() =>
    toDraftRows(portfolio?.positions ?? []),
  );
  const [minOrder, setMinOrder] = useState(portfolio?.minOrder ?? 0);
  const [currency, setCurrency] = useState(portfolio?.currency ?? DEFAULT_CURRENCY);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) {
      return;
    }
    const timer = setTimeout(() => setSaved(false), SAVED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  if (!portfolio) {
    return null;
  }

  const touched = () => setSaved(false);

  const updateRow = (id: string, patch: Partial<DraftRow>) => {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    touched();
  };

  const removeRow = (id: string) => {
    setRows((current) => {
      const remaining = current.filter((row) => row.id !== id);
      return remaining.length > 0 ? remaining : [blankRow()];
    });
    touched();
  };

  const addRow = () => setRows((current) => [...current, blankRow()]);

  const positions = toPositions(rows);
  const totalPct = rows.reduce((total, row) => total + row.targetPct, 0);
  const totalHolding = rows.reduce((total, row) => total + row.holding, 0);
  const targetsAddUp = Math.round(totalPct * 100) / 100 === 100;
  // A file may carry any ISO code, not just the offered ones; without its own
  // option the select would show the wrong currency.
  const currencyChoices: readonly string[] = (
    CURRENCY_CHOICES as readonly string[]
  ).includes(currency)
    ? CURRENCY_CHOICES
    : [currency, ...CURRENCY_CHOICES];

  const commit = (edited: Position[]) => {
    try {
      validatePositions(edited);
    } catch (validationError) {
      if (validationError instanceof PortfolioValidationError) {
        setError(validationError.message);
        setSaved(false);
        return;
      }
      throw validationError;
    }
    savePositions(edited, minOrder, currency);
    setRows(toDraftRows(edited));
    setError(null);
    setSaved(true);
  };

  const handleSave = () => commit(positions);
  const handleNormalizeAndSave = () => commit(normalizeTargets(positions));

  return (
    <div className={styles.screen}>
      <div className={styles.withTip}>
        <h1>Portfolio</h1>
        <InfoTip label="the portfolio table">
          Enter what you hold and the share you want for each. Targets must add up to
          100%.
        </InfoTip>
      </div>

      {error && <Banner tone="error">Not saved yet. {error}</Banner>}
      {saved && !error && <Banner tone="success">Portfolio saved.</Banner>}

      <Card>
        <div className={styles.rows}>
          <div className={styles.headerRow}>
            <span>Ticker</span>
            <span>Name</span>
            <span>Holding ({currency})</span>
            <span>Target %</span>
            <span />
          </div>
          {rows.map((row) => (
            <div className={styles.row} key={row.id}>
              <span className={styles.field}>
                <span className={styles.fieldLabel} aria-hidden="true">
                  Ticker
                </span>
                <input
                  className={styles.input}
                  aria-label="Ticker"
                  placeholder="e.g. AAPL"
                  autoComplete="off"
                  spellCheck={false}
                  value={row.ticker}
                  onChange={(event) =>
                    updateRow(row.id, { ticker: event.target.value })
                  }
                />
              </span>
              <span className={styles.field}>
                <span className={styles.fieldLabel} aria-hidden="true">
                  Name
                </span>
                <input
                  className={styles.input}
                  aria-label="Position name"
                  placeholder="Optional"
                  autoComplete="off"
                  // Enhanced spell check in Chrome and Edge sends the text to a cloud service.
                  spellCheck={false}
                  value={row.name}
                  onChange={(event) => updateRow(row.id, { name: event.target.value })}
                />
              </span>
              <span className={styles.field}>
                <span className={styles.fieldLabel} aria-hidden="true">
                  Holding ({currency})
                </span>
                <input
                  className={styles.input}
                  aria-label={`Holding in ${currency}`}
                  type="number"
                  autoComplete="off"
                  min={0}
                  step={1000}
                  value={row.holding}
                  onChange={(event) =>
                    updateRow(row.id, { holding: event.target.valueAsNumber || 0 })
                  }
                />
              </span>
              <span className={styles.field}>
                <span className={styles.fieldLabel} aria-hidden="true">
                  Target %
                </span>
                <input
                  className={styles.input}
                  aria-label="Target percent"
                  type="number"
                  autoComplete="off"
                  min={0}
                  max={100}
                  step={0.5}
                  value={row.targetPct}
                  onChange={(event) =>
                    updateRow(row.id, { targetPct: event.target.valueAsNumber || 0 })
                  }
                />
              </span>
              <button
                type="button"
                className={styles.removeButton}
                aria-label={`Remove ${row.ticker || row.name || 'position'}`}
                onClick={() => removeRow(row.id)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
        <Button variant="secondary" onClick={addRow} className={styles.addButton}>
          Add position
        </Button>
        <div className={styles.totals}>
          <span>
            Holdings{' '}
            <span className={styles.totalValue}>
              {formatMoney(totalHolding, currency)}
            </span>
          </span>
          <span>
            Targets{' '}
            <span
              className={`${styles.totalValue} ${targetsAddUp ? '' : styles.totalOff}`}
            >
              {formatPct(totalPct)}
            </span>
            {!targetsAddUp && ' (must be 100%)'}
          </span>
        </div>
      </Card>

      {positions.length > 0 && (
        <Card>
          <AllocationDonut positions={positions} />
        </Card>
      )}

      <Card className={styles.settings}>
        <span className={styles.field}>
          <span className={styles.withTip}>
            <label htmlFor="currency">Currency</label>
            <InfoTip label="the currency setting">
              Just a label. The app never converts amounts.
            </InfoTip>
          </span>
          <select
            id="currency"
            className={`${styles.input} ${styles.settingsInput}`}
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value);
              touched();
            }}
          >
            {currencyChoices.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </span>
        <span className={styles.field}>
          <span className={styles.withTip}>
            <label htmlFor="min-order">Minimum order per position ({currency})</label>
            <InfoTip label="the minimum order">
              The smallest order worth paying your broker&apos;s fee for. Use 0 if the
              fee is just a percentage.
            </InfoTip>
          </span>
          <input
            id="min-order"
            className={`${styles.input} ${styles.settingsInput}`}
            type="number"
            autoComplete="off"
            min={0}
            step={500}
            value={minOrder}
            onChange={(event) => {
              setMinOrder(Math.max(0, event.target.valueAsNumber || 0));
              touched();
            }}
          />
        </span>
      </Card>

      <div className={styles.footerActions}>
        <Button variant="secondary" onClick={handleNormalizeAndSave}>
          Normalize to 100% &amp; save
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save portfolio
        </Button>
      </div>
    </div>
  );
}
