import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { validatePosition } from '../domain/allocation';
import { PortfolioValidationError, type Position } from '../domain/types';
import { useBackHandler } from '../useBackHandler';
import { Banner } from './ui/Banner';
import { Button } from './ui/Button';
import styles from './PositionEditor.module.css';

interface PositionEditorProps {
  /** The position being changed, or null when adding a new one. */
  position: Position | null;
  /** Every other position, which the ticker must not clash with. */
  others: readonly Position[];
  currency: string;
  onSave: (edited: Position) => void;
  onRemove?: () => void;
  onClose: () => void;
}

/** A bottom sheet on a phone and a centred dialog on a wider screen. */
export function PositionEditor({
  position,
  others,
  currency,
  onSave,
  onRemove,
  onClose,
}: PositionEditorProps) {
  const [ticker, setTicker] = useState(position?.ticker ?? '');
  const [name, setName] = useState(position?.name ?? '');
  const [holding, setHolding] = useState(position ? String(position.holding) : '');
  const [target, setTarget] = useState(position ? String(position.targetPct) : '');
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const tickerId = useId();
  const nameId = useId();
  const holdingId = useId();
  const targetId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useBackHandler(true, onClose);

  // Focus on the dialog rather than a field, so a phone's keyboard stays closed
  // until a field is tapped, and Escape reaches this dialog from the start.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const edited: Position = {
      ticker: ticker.trim(),
      name: name.trim(),
      holding: Math.trunc(Number(holding) || 0),
      targetPct: Number(target) || 0,
    };
    try {
      validatePosition(edited, others);
    } catch (validationError) {
      if (validationError instanceof PortfolioValidationError) {
        setError(validationError.message);
        return;
      }
      throw validationError;
    }
    onSave(edited);
  };

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {position ? position.ticker || position.name || 'Position' : 'New position'}
        </h2>
        {error && <Banner tone="error">{error}</Banner>}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label htmlFor={tickerId}>Ticker</label>
            <input
              id={tickerId}
              className={styles.input}
              placeholder="e.g. AAPL"
              autoComplete="off"
              spellCheck={false}
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={nameId}>Name</label>
            <input
              id={nameId}
              className={styles.input}
              placeholder="Optional"
              autoComplete="off"
              // Enhanced spell check in Chrome and Edge sends the text to a cloud service.
              spellCheck={false}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className={styles.pair}>
            <div className={styles.field}>
              <label htmlFor={holdingId}>Holding ({currency})</label>
              <input
                id={holdingId}
                className={styles.input}
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min={0}
                step={1000}
                value={holding}
                onChange={(event) => setHolding(event.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor={targetId}>Target %</label>
              <input
                id={targetId}
                className={styles.input}
                type="number"
                inputMode="decimal"
                autoComplete="off"
                min={0}
                max={100}
                step={0.5}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
            </div>
          </div>
          <div className={styles.actions}>
            {onRemove && (
              <Button variant="danger" type="button" onClick={onRemove}>
                Remove
              </Button>
            )}
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
