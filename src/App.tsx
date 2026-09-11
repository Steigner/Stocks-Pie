import { useState, type ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { ConnectGate } from './components/ConnectGate';
import { Banner } from './components/ui/Banner';
import { LinkButton } from './components/ui/Button';
import { DOWNLOAD_URL } from './download';
import { PortfolioProvider, usePortfolio } from './state/PortfolioContext';
import type { PortfolioStore } from './storage';
import { DataLocationScreen } from './screens/DataLocationScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { InvestScreen } from './screens/InvestScreen';
import { PortfolioScreen } from './screens/PortfolioScreen';

type ScreenId = 'invest' | 'portfolio' | 'history' | 'data';

const NAV_ITEMS: ReadonlyArray<{ id: ScreenId; label: string }> = [
  { id: 'invest', label: 'Invest' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'history', label: 'History' },
  { id: 'data', label: 'Data location' },
];

const SCREENS: Record<ScreenId, () => ReactNode> = {
  invest: () => <InvestScreen />,
  portfolio: () => <PortfolioScreen />,
  history: () => <HistoryScreen />,
  data: () => <DataLocationScreen />,
};

function AppContent() {
  const [screen, setScreen] = useState<ScreenId>('invest');
  const { status, locationLabel, saveErrorMessage, isPreview } = usePortfolio();

  if (status !== 'ready') {
    return <ConnectGate />;
  }

  return (
    <AppShell
      items={NAV_ITEMS}
      active={screen}
      onSelect={setScreen}
      locationLabel={locationLabel}
    >
      {isPreview && (
        <Banner
          tone="info"
          action={
            <LinkButton
              variant="primary"
              href={DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Download the app
            </LinkButton>
          }
        >
          A preview with sample data. Nothing you change is saved.
        </Banner>
      )}
      {saveErrorMessage && (
        <Banner tone="error">
          Your last change wasn&apos;t saved: {saveErrorMessage}
        </Banner>
      )}
      {SCREENS[screen]()}
    </AppShell>
  );
}

export function App({ store }: { store?: PortfolioStore }) {
  return (
    <PortfolioProvider store={store}>
      <AppContent />
    </PortfolioProvider>
  );
}
