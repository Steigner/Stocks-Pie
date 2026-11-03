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
import { usePortfolio } from '../state/PortfolioContext';
import { useTranslation } from '../useTranslation';
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
  const { text, formatMoney, formatPct, formatSignedPct, validationMessage } =
    useTranslation();
  const { portfolio, confirmRound } = usePortfolio();
  const [budgetInput, setBudgetInput] = useState(0);
  const [confirmation, setConfirmation] = useState<number | null>(null);

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
        return error;
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
    return <Banner tone="info">{text.addPositionsFirst}</Banner>;
  }

  if (invalidReason) {
    return (
      <Banner tone="warning">
        {text.fixPortfolioFirst} {validationMessage(invalidReason)}
      </Banner>
    );
  }

  const handleConfirm = () => {
    if (!plan) {
      return;
    }
    confirmRound(plan);
    setConfirmation(plan.invested);
    setBudgetInput(0);
  };

  const orders = plan ? orderedPositions(plan) : [];
  const skipped = plan ? skippedPositions(plan) : [];

  return (
    <div className={styles.screen}>
      <h1>{text.invest}</h1>
      {confirmation !== null && (
        <Banner tone="success">
          {text.recorded(formatMoney(confirmation, currency))}
        </Banner>
      )}

      <div className={styles.budgetRow}>
        <span className={styles.withTip}>
          <label htmlFor="budget">{text.budget(currency)}</label>
          <InfoTip label={text.depositInfo}>{text.depositHelp}</InfoTip>
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
          {text.belowMinimum(
            formatMoney(plan.leftover, currency),
            formatMoney(portfolio.minOrder, currency),
          )}
        </Banner>
      )}

      {plan && plan.leftover === 0 && (
        <div className={styles.result}>
          <div className={styles.summary}>
            <div className={styles.metrics}>
              <Metric label={text.buying} value={text.positionCount(orders.length)} />
              <Metric
                label={text.drift}
                value={formatPct(plan.driftAfterPct)}
                delta={formatSignedPct(plan.driftAfterPct - plan.driftBeforePct)}
                deltaDirection={
                  plan.driftAfterPct - plan.driftBeforePct > 0 ? 'up' : 'down'
                }
              />
            </div>
            <Card className={styles.after}>
              <h2 className={styles.sectionTitle}>{text.afterBuy}</h2>
              <AllocationDonut
                label={text.afterBuyChart}
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
                <h2 className={styles.sectionTitle}>{text.sendOrders}</h2>
                <ul className={styles.rows}>
                  {orders.map((order) => (
                    <PlanRow
                      key={order.ticker}
                      ticker={order.ticker}
                      name={order.name}
                      amount={formatMoney(order.buy, currency)}
                      detail={text.orderDetail(
                        formatPct(order.currentPct),
                        formatPct(order.projectedPct),
                        formatPct(order.targetPct, null),
                      )}
                    />
                  ))}
                </ul>
              </Card>
            )}

            {skipped.length > 0 && (
              <Card>
                <details className={styles.fold}>
                  <summary>{text.skipped(skipped.length)}</summary>
                  <p className={styles.foldText}>
                    {text.skippedHelp(formatMoney(portfolio.minOrder, currency))}
                  </p>
                  <ul className={styles.rows}>
                    {skipped.map((item) => (
                      <PlanRow
                        key={item.ticker}
                        ticker={item.ticker}
                        name={item.name}
                        amount={formatMoney(item.holding, currency)}
                        detail={text.skippedDetail(
                          formatPct(item.currentPct),
                          formatPct(item.targetPct, null),
                          formatSignedPct(gapPct(item)),
                        )}
                      />
                    ))}
                  </ul>
                </details>
              </Card>
            )}

            <Card>
              <details className={styles.fold}>
                <summary>{text.portfolioMoves}</summary>
                <DriftChart plan={plan} />
              </details>
            </Card>

            <div className={styles.confirm}>
              <Button variant="primary" fullWidth onClick={handleConfirm}>
                {text.confirmOrders}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
