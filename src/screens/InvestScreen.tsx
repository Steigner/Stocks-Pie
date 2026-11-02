import { useMemo, useState } from 'react';
import { AllocationDonut } from '../components/charts/AllocationDonut';
import { DriftChart } from '../components/charts/DriftChart';
import { Banner } from '../components/ui/Banner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { InfoTip } from '../components/ui/InfoTip';
import { Metric } from '../components/ui/Metric';
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

function PlanRow({
  ticker,
  name,
  amount,
  detail,
}: {
  ticker: string;
  name: string;
  amount: string;
  detail: string;
}) {
  return (
    <li className={styles.row}>
      <span className={styles.identity}>
        <span className={styles.ticker}>{ticker}</span>
        <span className={styles.name}>{name}</span>
      </span>
      <span className={styles.amount}>{amount}</span>
      <span className={styles.detail}>{detail}</span>
    </li>
  );
}

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
          <label htmlFor="budget">How much are you investing ({currency})</label>
          <InfoTip label="the deposit">
            The app splits the whole amount to get you as close to your targets as
            possible.
          </InfoTip>
        </span>
        <input
          id="budget"
          className={styles.budgetInput}
          type="number"
          inputMode="numeric"
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
        <div className={styles.result}>
          <div className={styles.summary}>
            <div className={styles.metrics}>
              <Metric
                label="Buying"
                value={`${orders.length} ${orders.length === 1 ? 'position' : 'positions'}`}
              />
              <Metric
                label="Drift"
                value={formatPct(plan.driftAfterPct)}
                delta={formatSignedPct(plan.driftAfterPct - plan.driftBeforePct)}
                deltaDirection={
                  plan.driftAfterPct - plan.driftBeforePct > 0 ? 'up' : 'down'
                }
              />
            </div>
            <Card className={styles.after}>
              <h2 className={styles.sectionTitle}>After this buy</h2>
              <AllocationDonut
                label="Portfolio after this buy"
                positions={plan.positions.map((item) => ({
                  ...item,
                  targetPct: item.projectedPct,
                }))}
              />
            </Card>
          </div>

          <div className={styles.details}>
            {orders.length > 0 && (
              <Card>
                <h2 className={styles.sectionTitle}>Send these orders</h2>
                <ul className={styles.rows}>
                  {orders.map((order) => (
                    <PlanRow
                      key={order.ticker}
                      ticker={order.ticker}
                      name={order.name}
                      amount={formatMoney(order.buy, currency)}
                      detail={`${formatPct(order.currentPct)} to ${formatPct(order.projectedPct)}, target ${order.targetPct}%`}
                    />
                  ))}
                </ul>
              </Card>
            )}

            {skipped.length > 0 && (
              <Card>
                <details className={styles.fold}>
                  <summary>Skipped this time ({skipped.length})</summary>
                  <p className={styles.foldText}>
                    These are on target already, or a{' '}
                    {formatMoney(portfolio.minOrder, currency)} order would overshoot
                    them. They go first next time.
                  </p>
                  <ul className={styles.rows}>
                    {skipped.map((item) => (
                      <PlanRow
                        key={item.ticker}
                        ticker={item.ticker}
                        name={item.name}
                        amount={formatMoney(item.holding, currency)}
                        detail={`${formatPct(item.currentPct)} now, target ${item.targetPct}%, ${formatSignedPct(gapPct(item))}`}
                      />
                    ))}
                  </ul>
                </details>
              </Card>
            )}

            <Card>
              <details className={styles.fold}>
                <summary>How the portfolio moves</summary>
                <DriftChart plan={plan} />
              </details>
            </Card>

            <div className={styles.confirm}>
              <Button variant="primary" fullWidth onClick={handleConfirm}>
                I&apos;ve placed the orders
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
