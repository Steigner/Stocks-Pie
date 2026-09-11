import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { emptyPortfolio } from '../domain/portfolio';
import type { Portfolio, Position, PurchasePlan } from '../domain/types';
import { MemoryPortfolioStore, createPortfolioStore } from '../storage';
import type { PortfolioStore } from '../storage';
import { portfolioReducer } from './portfolioReducer';

type ConnectionStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

interface PortfolioContextValue {
  portfolio: Portfolio | null;
  status: ConnectionStatus;
  errorMessage: string | null;
  /** Set when the last autosave failed; the change is still in memory. */
  saveErrorMessage: string | null;
  locationLabel: string | null;
  /** The web preview: sample data, kept in memory only. */
  isPreview: boolean;
  connect: () => Promise<void>;
  savePositions: (
    positions: readonly Position[],
    minOrder: number,
    currency: string,
  ) => void;
  confirmRound: (plan: PurchasePlan) => void;
  deleteRound: (id: string) => void;
}

const PortfolioReactContext = createContext<PortfolioContextValue | null>(null);

/** The local calendar date; toISOString() would give yesterday's UTC date after midnight. */
function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function PortfolioProvider({
  children,
  store: providedStore,
}: {
  children: ReactNode;
  /** Overrides the auto-selected store; used by tests. */
  store?: PortfolioStore;
}) {
  const storeRef = useRef<PortfolioStore>();
  if (!storeRef.current) {
    storeRef.current = providedStore ?? createPortfolioStore();
  }
  const store = storeRef.current;

  const [portfolio, dispatch] = useReducer(portfolioReducer, null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  /** What the connected location already holds, so autosave can skip a no-op write. */
  const storedRef = useRef<Portfolio | null>(null);
  /** Saves run one at a time, so an older write can never land after a newer one. */
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const adopt = useCallback((loaded: Portfolio | null, fallback: Portfolio) => {
    // A location with no file yet still needs the fallback written out, so only
    // an actually-loaded portfolio counts as already stored. The autosave runs
    // once the status returns to ready.
    storedRef.current = loaded;
    dispatch({ type: 'loaded', portfolio: loaded ?? fallback });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setStatus('connecting');
      try {
        const restored = await store.restoreFromPreviousVisit();
        if (!restored) {
          if (!cancelled) {
            setStatus('disconnected');
          }
          return;
        }
        const loaded = await store.load();
        if (cancelled) {
          return;
        }
        adopt(loaded, emptyPortfolio());
        setLocationLabel(store.describeLocation());
        setStatus('ready');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(describeError(error));
          setStatus('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, adopt]);

  const connect = useCallback(async () => {
    const previousStatus = status;
    setStatus('connecting');
    try {
      if (!(await store.connect())) {
        setStatus(previousStatus);
        return;
      }
      setErrorMessage(null);
      // A folder with no portfolio yet takes over the one already open, so
      // changing folder never swaps the user's positions for an empty list.
      adopt(await store.load(), portfolio ?? emptyPortfolio());
      setLocationLabel(store.describeLocation());
      setStatus('ready');
    } catch (error) {
      setErrorMessage(describeError(error));
      setStatus('error');
    }
  }, [store, adopt, status, portfolio]);

  useEffect(() => {
    if (!portfolio || status !== 'ready' || portfolio === storedRef.current) {
      return;
    }
    storedRef.current = portfolio;
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        await store.save(portfolio);
        setSaveErrorMessage(null);
      } catch (error) {
        setSaveErrorMessage(describeError(error));
      }
    });
  }, [portfolio, status, store]);

  const savePositions = useCallback(
    (positions: readonly Position[], minOrder: number, currency: string) => {
      dispatch({ type: 'positionsSaved', positions, minOrder, currency });
    },
    [],
  );

  const confirmRound = useCallback((plan: PurchasePlan) => {
    dispatch({ type: 'roundConfirmed', plan, on: todayIso() });
  }, []);

  const deleteRound = useCallback((id: string) => {
    dispatch({ type: 'roundDeleted', id });
  }, []);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      portfolio,
      status,
      errorMessage,
      saveErrorMessage,
      locationLabel,
      isPreview: store instanceof MemoryPortfolioStore,
      connect,
      savePositions,
      confirmRound,
      deleteRound,
    }),
    [
      portfolio,
      status,
      errorMessage,
      saveErrorMessage,
      locationLabel,
      store,
      connect,
      savePositions,
      confirmRound,
      deleteRound,
    ],
  );

  return (
    <PortfolioReactContext.Provider value={value}>
      {children}
    </PortfolioReactContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook belongs with its provider
export function usePortfolio(): PortfolioContextValue {
  const context = useContext(PortfolioReactContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
