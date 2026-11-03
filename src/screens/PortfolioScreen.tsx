import { useState } from 'react';
import { AllocationDonut } from '../components/charts/AllocationDonut';
import { TargetBar } from '../components/charts/TargetBar';
import { PositionEditor } from '../components/PositionEditor';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { InfoTip } from '../components/ui/InfoTip';
import { targetsAddUp } from '../domain/allocation';
import { normalizeTargets } from '../domain/portfolio';
import type { Position } from '../domain/types';
import { usePortfolio } from '../state/PortfolioContext';
import { useTranslation } from '../useTranslation';
import styles from './PortfolioScreen.module.css';

/** A row's place in the list, or a position that does not exist yet. */
type Editing = number | 'new';

export function PortfolioScreen() {
  const { text, formatMoney, formatPct } = useTranslation();
  const { portfolio, savePositions } = usePortfolio();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState(false);

  if (!portfolio) {
    return null;
  }

  const { positions, currency, minOrder } = portfolio;
  const positionLabel = (position: Position): string =>
    position.ticker || position.name || text.unnamedPosition;
  const save = (next: readonly Position[]) => savePositions(next, minOrder, currency);

  const totalHolding = positions.reduce((total, item) => total + item.holding, 0);
  const totalPct = positions.reduce((total, item) => total + item.targetPct, 0);
  const editingPosition = typeof editing === 'number' ? positions[editing] : undefined;

  const closeEditor = () => {
    setEditing(null);
    setRemoving(false);
  };

  const handleSave = (edited: Position) => {
    save(
      editing === 'new'
        ? [...positions, edited]
        : positions.map((item, index) => (index === editing ? edited : item)),
    );
    closeEditor();
  };

  const handleRemove = () => {
    save(positions.filter((_item, index) => index !== editing));
    closeEditor();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.heading}>
        <div className={styles.withTip}>
          <h1>{text.portfolio}</h1>
          <InfoTip label={text.portfolioInfo}>{text.portfolioHelp}</InfoTip>
        </div>
        <span className={styles.total}>{formatMoney(totalHolding, currency)}</span>
      </div>

      {positions.length > 0 && !targetsAddUp(positions) && (
        <Banner
          tone="warning"
          action={
            <Button
              variant="secondary"
              onClick={() => save(normalizeTargets(positions))}
            >
              {text.normalize}
            </Button>
          }
        >
          {text.targetsTotal(formatPct(totalPct))}
        </Banner>
      )}

      <Card>
        {positions.length === 0 ? (
          <p>{text.noPositions}</p>
        ) : (
          // Keyed by place: a file edited by hand can hold a blank or repeated ticker.
          <ul className={styles.list}>
            {positions.map((position, index) => {
              const share =
                totalHolding > 0 ? (position.holding / totalHolding) * 100 : 0;
              return (
                <li key={index}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-label={text.editPosition(positionLabel(position))}
                    onClick={() => setEditing(index)}
                  >
                    <span className={styles.rowLine}>
                      <span className={styles.identity}>
                        <span className={styles.ticker}>{position.ticker}</span>
                        <span className={styles.name}>{position.name}</span>
                      </span>
                      <span className={styles.holding}>
                        {formatMoney(position.holding, currency)}
                      </span>
                    </span>
                    <span className={styles.rowLine}>
                      <span className={styles.detail}>
                        {text.currentShare(formatPct(share))}
                      </span>
                      <span className={styles.detail}>
                        {text.targetShare(formatPct(position.targetPct))}
                      </span>
                    </span>
                    <TargetBar currentPct={share} targetPct={position.targetPct} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          variant="secondary"
          fullWidth
          className={styles.addButton}
          onClick={() => setEditing('new')}
        >
          {text.addPosition}
        </Button>
      </Card>

      {positions.length > 0 && (
        <Card>
          <AllocationDonut positions={positions} />
        </Card>
      )}

      {editing !== null && (
        <PositionEditor
          position={editingPosition ?? null}
          others={positions.filter((_item, index) => index !== editing)}
          currency={currency}
          onSave={handleSave}
          onRemove={editingPosition ? () => setRemoving(true) : undefined}
          onClose={closeEditor}
        />
      )}

      {removing && editingPosition && (
        <ConfirmDialog
          title={text.removePosition(positionLabel(editingPosition))}
          confirmLabel={text.remove}
          onCancel={() => setRemoving(false)}
          onConfirm={handleRemove}
        >
          {text.removeHelp}
        </ConfirmDialog>
      )}
    </div>
  );
}
