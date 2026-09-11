import { useMemo, useState } from 'react';
import { DriftChart } from '../components/charts/DriftChart';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InfoTip } from '../components/ui/InfoTip';
import { Metric } from '../components/ui/Metric';
import tableStyles from '../components/ui/Table.module.css';
import { planPurchases, validatePositions } from '../domain/allocation';
import {
  PortfolioValidationError,
  gapPct,
  orderedPositions,
  skippedPositions,
} from '../domain/types';
import { formatMoney, formatPct, formatSignedPct } from '../format';
import { usePortfolio } from '../state/PortfolioContext';
import styles from './InvestScreen.module.css';

export function InvestScreen() {
  const { portfolio, confirmRound } = usePortfolio();
  const [budgetInput, setBudgetInput] = useState(0);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  /** Why the stored portfolio cannot be invested, or null when it is fine. */
  const invalidReason = useMemo(() => {
    if (!portfolio || portfolio.positions.length === 0) {
      return null;
    }
    try {
      validatePositions(portfolio.positions);
      return null;
    } catch (error) {
      if (error instanceof PortfolioValidationError) {
        return error.message;
      }
      throw error;
    }
  }, [portfolio]);

  const plan = useMemo(
    () =>
      portfolio && portfolio.positions.length > 0 && !invalidReason && budgetInput > 0
        ? planPurchases(portfolio.positions, budgetInput, portfolio.minOrder)
        : null,
    [portfolio, invalidReason, budgetInput],
  );

  if (!portfolio) {
    return null;
  }

  const { currency } = portfolio;

  if (portfolio.positions.length === 0) {
    return <Banner tone="info">Add your positions on the Portfolio tab first.</Banner>;
  }

  if (invalidReason) {
    return (
      <Banner tone="warning">
        Fix your portfolio on the Portfolio tab first. {invalidReason}
      </Banner>
    );
  }

  const handleConfirm = () => {
    if (!plan) {
      return;
    }
    confirmRound(plan);
    setConfirmation(
      `Recorded ${formatMoney(plan.invested, currency)}. Update your holdings ` +
        'on the Portfolio tab when prices change.',
    );
    setBudgetInput(0);
  };

  const orders = plan ? orderedPositions(plan) : [];
  const skipped = plan ? skippedPositions(plan) : [];

  return (
    <div className={styles.screen}>
      <h1>Invest</h1>
      {confirmation && <Banner tone="success">{confirmation}</Banner>}

      <div className={styles.budgetRow}>
        <span className={styles.withTip}>
          <label htmlFor="budget">How much am I investing now ({currency})</label>
          <InfoTip label="the deposit">
            The app splits the whole amount to get you as close to your targets as
            possible.
          </InfoTip>
        </span>
        <input
          id="budget"
          className={styles.budgetInput}
          type="number"
          autoComplete="off"
          min={0}
          step={1000}
          value={budgetInput || ''}
          onChange={(event) => {
            // Orders are placed in whole units; a fractional budget cannot be split exactly.
            setBudgetInput(Math.max(0, Math.trunc(event.target.valueAsNumber || 0)));
            setConfirmation(null);
          }}
        />
      </div>

      {plan && plan.leftover > 0 && (
        <Banner tone="warning">
          {formatMoney(plan.leftover, currency)} is less than the minimum order of{' '}
          {formatMoney(portfolio.minOrder, currency)}. Keep it for next time.
        </Banner>
      )}

      {plan && plan.leftover === 0 && (
        <>
          <div className={styles.metrics}>
            <Metric label="Investing" value={formatMoney(plan.invested, currency)} />
            <Metric label="Positions bought" value={String(orders.length)} />
            <Metric
              label="Drift from target"
              value={formatPct(plan.driftAfterPct)}
              delta={formatSignedPct(plan.driftAfterPct - plan.driftBeforePct)}
              deltaDirection={
                plan.driftAfterPct - plan.driftBeforePct > 0 ? 'up' : 'down'
              }
            />
          </div>

          {orders.length > 0 && (
            <Card>
              <h2 className={styles.sectionTitle}>Send these orders</h2>
              <div className={tableStyles.wrap}>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Name</th>
                      <th className={tableStyles.numeric}>Send</th>
                      <th className={tableStyles.numeric}>Now</th>
                      <th className={tableStyles.numeric}>After buy</th>
                      <th className={tableStyles.numeric}>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.ticker}>
                        <td>{order.ticker}</td>
                        <td>{order.name}</td>
                        <td className={tableStyles.numeric}>
                          {formatMoney(order.buy, currency)}
                        </td>
                        <td className={tableStyles.numeric}>
                          {formatPct(order.currentPct)}
                        </td>
                        <td className={tableStyles.numeric}>
                          {formatPct(order.projectedPct)}
                        </td>
                        <td className={tableStyles.numeric}>
                          {formatPct(order.targetPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {skipped.length > 0 && (
            <Card>
              <h2 className={styles.sectionTitle}>Skip these this time</h2>
              <p>
                These are on target already, or a{' '}
                {formatMoney(portfolio.minOrder, currency)} order would overshoot them.
                They go first next time.
              </p>
              <div className={tableStyles.wrap}>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Name</th>
                      <th className={tableStyles.numeric}>Holding</th>
                      <th className={tableStyles.numeric}>Now</th>
                      <th className={tableStyles.numeric}>Target</th>
                      <th className={tableStyles.numeric}>Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skipped.map((item) => (
                      <tr key={item.ticker}>
                        <td>{item.ticker}</td>
                        <td>{item.name}</td>
                        <td className={tableStyles.numeric}>
                          {formatMoney(item.holding, currency)}
                        </td>
                        <td className={tableStyles.numeric}>
                          {formatPct(item.currentPct)}
                        </td>
                        <td className={tableStyles.numeric}>
                          {formatPct(item.targetPct)}
                        </td>
                        <td className={tableStyles.numeric}>
                          {formatSignedPct(gapPct(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <details className={styles.details}>
              <summary>How the portfolio moves</summary>
              <DriftChart plan={plan} />
            </details>
          </Card>

          <Button variant="primary" onClick={handleConfirm}>
            I&apos;ve placed the orders, record this round
          </Button>
        </>
      )}
    </div>
  );
}
