import { useState, type ReactNode } from 'react';
import { AppShell } from './components/AppShell';
import { ConnectGate } from './components/ConnectGate';
import {
  HistoryIcon,
  InvestIcon,
  PortfolioIcon,
  SettingsIcon,
} from './components/NavIcons';
import { Banner } from './components/ui/Banner';
import { LinkButton } from './components/ui/Button';
import { DOWNLOAD_URL } from './download';
import { PortfolioProvider, usePortfolio } from './state/PortfolioContext';
import type { PortfolioStore } from './storage';
import { HistoryScreen } from './screens/HistoryScreen';
import { InvestScreen } from './screens/InvestScreen';
import { PortfolioScreen } from './screens/PortfolioScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useBackHandler } from './useBackHandler';

type ScreenId = 'invest' | 'portfolio' | 'history' | 'settings';

const NAV_ITEMS: ReadonlyArray<{ id: ScreenId; label: string; icon: ReactNode }> = [
  { id: 'invest', label: 'Invest', icon: <InvestIcon /> },
  { id: 'portfolio', label: 'Portfolio', icon: <PortfolioIcon /> },
  { id: 'history', label: 'History', icon: <HistoryIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
];

const SCREENS: Record<ScreenId, () => ReactNode> = {
  invest: () => <InvestScreen />,
  portfolio: () => <PortfolioScreen />,
  history: () => <HistoryScreen />,
  settings: () => <SettingsScreen />,
};

function AppContent() {
  const [screen, setScreen] = useState<ScreenId>('invest');
  const { status, locationLabel, saveErrorMessage, isPreview } = usePortfolio();
  useBackHandler(screen !== 'invest', () => setScreen('invest'));

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
