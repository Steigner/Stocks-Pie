import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { emptyPortfolio } from './domain/portfolio';
import type { Portfolio } from './domain/types';
import { DOWNLOAD_URL } from './download';
import type { PortfolioStore } from './storage';
import { cleanupWithHistory, pressBack } from './testing/history';
import { InMemoryPortfolioStore } from './testing/InMemoryPortfolioStore';

const PORTFOLIO: Portfolio = {
  positions: [
    { name: 'Alfa Holding', ticker: 'ALFA', targetPct: 60, holding: 0 },
    { name: 'Beta Works', ticker: 'BETA', targetPct: 40, holding: 0 },
  ],
  currency: 'CZK',
  minOrder: 5_000,
  rounds: [],
};

/** Like the app's store: its first folder holds PORTFOLIO, any newly picked one is empty. */
class FolderStore implements PortfolioStore {
  readonly saved: Portfolio[] = [];
  loads = 0;
  private file: Portfolio | null = PORTFOLIO;

  constructor(private readonly pickOnConnect: boolean) {}

  describeLocation(): string | null {
    return 'Investing';
  }

  async connect(): Promise<boolean> {
    if (this.pickOnConnect) {
      this.file = null;
    }
    return this.pickOnConnect;
  }

  async restoreFromPreviousVisit(): Promise<boolean> {
    return true;
  }

  async load(): Promise<Portfolio | null> {
    this.loads += 1;
    return this.file;
  }

  async save(portfolio: Portfolio): Promise<void> {
    this.saved.push(portfolio);
  }
}

async function openPortfolio(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Portfolio' }));
}

async function investOneRound(user: ReturnType<typeof userEvent.setup>) {
  const budgetInput = await screen.findByLabelText('How much are you investing (CZK)');
  await user.clear(budgetInput);
  await user.type(budgetInput, '100000');
  await user.click(screen.getByRole('button', { name: "I've placed the orders" }));
}

describe('App', () => {
  afterEach(async () => {
    await cleanupWithHistory();
    vi.restoreAllMocks();
    localStorage.removeItem('stocks-pie:language');
    document.documentElement.lang = 'en';
  });

  it('switches every screen immediately and remembers the language without saving the portfolio', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    const app = render(<App store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    await user.selectOptions(screen.getByLabelText('Language'), 'cs');

    expect(screen.getByRole('heading', { name: 'Nastavení' })).toBeInTheDocument();
    expect(screen.getByLabelText('Jazyk')).toHaveValue('cs');
    expect(screen.getByRole('button', { name: 'Tmavý' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'cs');
    expect(localStorage.getItem('stocks-pie:language')).toBe('cs');
    await user.click(screen.getByRole('button', { name: 'Historie' }));
    expect(
      screen.getByText('Zatím nejsou zaznamenány žádné vklady.'),
    ).toBeInTheDocument();
    expect(store.saved).toEqual([]);

    app.unmount();
    const restarted = render(<App store={store} />);
    expect(
      await screen.findByRole('heading', { name: 'Investovat' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nastavení' }));
    await user.selectOptions(screen.getByLabelText('Jazyk'), 'en');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(localStorage.getItem('stocks-pie:language')).toBe('en');

    restarted.unmount();
    render(<App store={store} />);
    expect(await screen.findByRole('heading', { name: 'Invest' })).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(store.saved).toEqual([]);
  });

  it('records and deletes a deposit in Czech with local numbers and dates', async () => {
    localStorage.setItem('stocks-pie:language', 'cs');
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await user.type(
      await screen.findByLabelText('Kolik chcete investovat (CZK)'),
      '100000',
    );

    expect(
      screen.getByRole('heading', { name: 'Zadejte tyto pokyny' }),
    ).toBeInTheDocument();
    expect(screen.getByText('60 000 CZK')).toBeInTheDocument();
    expect(screen.getByText('z 0,0 % na 60,0 %, cíl 60 %')).toBeInTheDocument();
    expect(screen.getByLabelText('Portfolio po tomto nákupu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pokyny jsou zadány' }));
    expect(screen.getByText(/Zaznamenáno 100 000 CZK/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Historie' }));
    expect(screen.getByRole('heading', { name: 'Historie (1)' })).toBeInTheDocument();
    expect(screen.getByText('Investováno 100 000 CZK')).toBeInTheDocument();
    await waitFor(() => expect(store.saved.at(-1)?.rounds).toHaveLength(1));
    const roundDate = store.saved.at(-1)!.rounds[0]!.on;
    const [year, month, day] = roundDate.split('-').map(Number);
    expect(
      screen.getByText(
        new Date(year!, month! - 1, day!).toLocaleDateString('cs-CZ', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Smazat' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Smazat tento vklad?' });
    expect(within(dialog).getByRole('button', { name: 'Zrušit' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Smazat' }));
    expect(
      screen.getByText('Zatím nejsou zaznamenány žádné vklady.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(store.saved.at(-1)?.positions).toEqual(PORTFOLIO.positions),
    );
  });

  it('translates the editor, validation, explanations and removal dialog', async () => {
    localStorage.setItem('stocks-pie:language', 'cs');
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);
    await openPortfolio(user);
    await user.click(screen.getByRole('button', { name: 'Nápověda: seznam pozic' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Cílové podíly musí dát dohromady 100 %.',
    );
    expect(screen.getByRole('img', { name: 'Cílové rozložení' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Přidat pozici' }));
    let dialog = screen.getByRole('dialog', { name: 'Nová pozice' });

    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(
      within(dialog).getByText('Každá pozice potřebuje ticker.'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Ticker'), 'ALFA');
    await user.click(within(dialog).getByRole('button', { name: 'Uložit' }));
    expect(
      within(dialog).getByText('Každý ticker lze použít jen jednou.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Hodnota pozice (CZK)')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Zrušit' }));

    await user.click(screen.getByRole('button', { name: 'Upravit ALFA' }));
    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Název')).toHaveValue('Alfa Holding');
    await user.click(within(dialog).getByRole('button', { name: 'Odebrat' }));
    expect(
      screen.getByRole('alertdialog', { name: 'Odebrat ALFA?' }),
    ).toHaveTextContent('Historie zůstane.');
  });

  it('translates invalid portfolio totals without changing validation', async () => {
    localStorage.setItem('stocks-pie:language', 'cs');
    render(
      <App
        store={
          new InMemoryPortfolioStore({
            ...PORTFOLIO,
            positions: [{ ...PORTFOLIO.positions[0]!, targetPct: 90.5 }],
          })
        }
      />,
    );

    expect(
      await screen.findByText(/Cílové podíly dávají dohromady 90,50 % místo 100 %/),
    ).toBeInTheDocument();
  });

  it('uses the saved language before a folder is connected', async () => {
    localStorage.setItem('stocks-pie:language', 'cs');
    const store = new FolderStore(false);
    vi.spyOn(store, 'restoreFromPreviousVisit').mockResolvedValue(false);

    render(<App store={store} />);

    expect(
      await screen.findByRole('button', { name: 'Vybrat složku' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Vyberte složku pro soubor portfolio.json. Aplikace si ji zapamatuje.',
      ),
    ).toBeInTheDocument();
  });

  it('opens the web preview on the sample portfolio, one click from the download', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/A preview with sample data/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download the app' })).toHaveAttribute(
      'href',
      DOWNLOAD_URL,
    );

    await user.click(screen.getByRole('button', { name: 'Portfolio' }));

    expect(screen.getByRole('button', { name: 'Edit NVDA' })).toBeInTheDocument();
  });

  it('invests a deposit, records the round, then fully undoes it from history', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);

    const budgetInput = await screen.findByLabelText(
      'How much are you investing (CZK)',
    );
    await user.clear(budgetInput);
    await user.type(budgetInput, '100000');

    expect(await screen.findByText('Send these orders')).toBeInTheDocument();
    expect(screen.getByText('60,000 CZK')).toBeInTheDocument();
    expect(screen.getByText('40,000 CZK')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: "I've placed the orders" }));

    expect(await screen.findByText(/Recorded 100,000 CZK/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByText('History (1)')).toBeInTheDocument();
    expect(screen.getByText('100,000 CZK invested')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('No deposits recorded yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Portfolio' }));

    expect(await screen.findByText('Alfa Holding')).toBeInTheDocument();
    expect(screen.getAllByText('0 CZK')).toHaveLength(3);
  });

  it('saves an edit from the editor straight away', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await openPortfolio(user);

    await user.click(screen.getByRole('button', { name: 'Edit ALFA' }));
    const dialog = await screen.findByRole('dialog');
    const holding = within(dialog).getByLabelText('Holding (CZK)');
    await user.clear(holding);
    await user.type(holding, '1234');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(store.saved.at(-1)?.positions[0]?.holding).toBe(1234));
  });

  it('keeps the editor open and explains a bad ticker', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await openPortfolio(user);

    await user.click(screen.getByRole('button', { name: 'Edit ALFA' }));
    const dialog = await screen.findByRole('dialog');
    const ticker = within(dialog).getByLabelText('Ticker');
    await user.clear(ticker);
    await user.type(ticker, 'BETA');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      within(dialog).getByText('Each ticker can only be used once.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(store.saved).toEqual([]);
  });

  it('lets one row be saved while another row in the file is invalid', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore({
      ...PORTFOLIO,
      positions: [
        { name: 'Alfa Holding', ticker: 'ALFA', targetPct: 60, holding: 0 },
        { name: 'No ticker', ticker: '', targetPct: 40, holding: 0 },
      ],
    });
    render(<App store={store} />);
    await openPortfolio(user);

    await user.click(screen.getByRole('button', { name: 'Edit ALFA' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Holding (CZK)'), '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(store.saved).toHaveLength(1));
  });

  it('adds a position from an empty portfolio', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(emptyPortfolio());
    render(<App store={store} />);
    await openPortfolio(user);

    expect(screen.getByText('No positions yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add position' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Ticker'), 'NEW');
    await user.type(within(dialog).getByLabelText('Target %'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(store.saved.at(-1)?.positions.map((position) => position.ticker)).toEqual([
        'NEW',
      ]),
    );
  });

  it('asks before removing a position', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await openPortfolio(user);

    await user.click(screen.getByRole('button', { name: 'Edit ALFA' }));
    const editor = await screen.findByRole('dialog');
    await user.click(within(editor).getByRole('button', { name: 'Remove' }));

    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Remove ALFA?',
    });
    await user.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

    expect(store.saved).toEqual([]);

    await user.click(within(editor).getByRole('button', { name: 'Remove' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Remove',
      }),
    );

    await waitFor(() =>
      expect(store.saved.at(-1)?.positions.map((position) => position.ticker)).toEqual([
        'BETA',
      ]),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers to fix targets that do not add up', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore({
      ...PORTFOLIO,
      positions: [
        { name: 'Alfa Holding', ticker: 'ALFA', targetPct: 60, holding: 0 },
        { name: 'Beta Works', ticker: 'BETA', targetPct: 30, holding: 0 },
      ],
    });
    render(<App store={store} />);
    await openPortfolio(user);

    expect(screen.getByText('Targets add up to 90.0%, not 100%.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Make them 100%' }));

    expect(screen.queryByText(/Targets add up to/)).not.toBeInTheDocument();
    await waitFor(() => {
      const positions = store.saved.at(-1)?.positions ?? [];
      expect(positions.reduce((total, item) => total + item.targetPct, 0)).toBeCloseTo(
        100,
      );
    });
  });

  it('shows 0% shares rather than NaN when nothing is held', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);

    await openPortfolio(user);

    expect(screen.getAllByText('0.0% now')).toHaveLength(2);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it('shows each order as a row with where the position ends up', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);

    await user.type(
      await screen.findByLabelText('How much are you investing (CZK)'),
      '100000',
    );

    expect(await screen.findByText('0.0% to 60.0%, target 60%')).toBeInTheDocument();
    expect(screen.getByText('2 positions')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('folds away the positions skipped this round', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore({
      ...PORTFOLIO,
      positions: [
        { name: 'Alfa Holding', ticker: 'ALFA', targetPct: 60, holding: 100_000 },
        { name: 'Beta Works', ticker: 'BETA', targetPct: 40, holding: 0 },
      ],
    });
    render(<App store={store} />);

    await user.type(
      await screen.findByLabelText('How much are you investing (CZK)'),
      '10000',
    );

    expect(await screen.findByText('Skipped this time (1)')).toBeInTheDocument();
    expect(screen.getByText('1 position')).toBeInTheDocument();
  });

  it('sends a first-time user to the Portfolio tab instead of an empty plan', async () => {
    const store = new InMemoryPortfolioStore(emptyPortfolio());
    render(<App store={store} />);

    expect(
      await screen.findByText(/Add your positions on the Portfolio tab/),
    ).toBeInTheDocument();
  });

  it('shows amounts in the portfolio currency', async () => {
    const store = new InMemoryPortfolioStore({ ...PORTFOLIO, currency: 'EUR' });
    render(<App store={store} />);

    const budgetInput = await screen.findByLabelText(
      'How much are you investing (EUR)',
    );
    await userEvent.setup().type(budgetInput, '100000');

    expect(await screen.findByText('60,000 EUR')).toBeInTheDocument();
  });

  it('leaves the stored file alone when nothing has been changed yet', async () => {
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);

    await screen.findByLabelText('How much are you investing (CZK)');

    expect(store.saved).toEqual([]);
  });

  it('reports a failed save instead of dropping it silently', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO, {
      saveError: new Error('Permission to write the folder was revoked.'),
    });
    render(<App store={store} />);

    await investOneRound(user);

    expect(
      await screen.findByText(/Permission to write the folder was revoked/),
    ).toBeInTheDocument();
  });

  it('dismisses the delete confirmation on Escape', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);

    await investOneRound(user);
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('History (1)')).toBeInTheDocument();
  });

  it('remembers an explicit light or dark choice', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('button', { name: 'Dark' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('stocks-pie:theme')).toBe('dark');

    await user.click(screen.getByRole('button', { name: 'Auto' }));

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('keeps the explanations out of the way until asked for', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);

    await user.click(await screen.findByRole('button', { name: 'Portfolio' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'About the portfolio list' }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /Targets must add up to 100%/,
    );

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('closes an explanation on a tap elsewhere, as Safari never focuses the marker', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);
    await user.click(await screen.findByRole('button', { name: 'Portfolio' }));

    // fireEvent.click, unlike user.click, leaves focus alone - as Safari does.
    fireEvent.click(screen.getByRole('button', { name: 'About the portfolio list' }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('moves the open portfolio into a newly chosen empty folder', async () => {
    const user = userEvent.setup();
    const store = new FolderStore(true);
    render(<App store={store} />);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Change folder' }));

    await waitFor(() => expect(store.saved).toEqual([PORTFOLIO]));
    await user.click(await screen.findByRole('button', { name: 'Portfolio' }));
    expect(screen.getByText('Alfa Holding')).toBeInTheDocument();
  });

  it('keeps everything as it was when changing folder is cancelled', async () => {
    const user = userEvent.setup();
    const store = new FolderStore(false);
    render(<App store={store} />);

    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Change folder' }));

    expect(
      await screen.findByRole('button', { name: 'Change folder' }),
    ).toBeInTheDocument();
    expect(store.loads).toBe(1);
    expect(store.saved).toEqual([]);
  });

  it('saves a new minimum order when the field is left', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    const minOrder = screen.getByLabelText('Minimum order per position (CZK)');
    await user.clear(minOrder);
    await user.type(minOrder, '2500');

    expect(store.saved).toEqual([]);

    await user.tab();

    await waitFor(() => expect(store.saved.at(-1)?.minOrder).toBe(2500));
  });

  it('treats an empty minimum order as 0', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    await user.clear(screen.getByLabelText('Minimum order per position (CZK)'));
    await user.tab();

    await waitFor(() => expect(store.saved.at(-1)?.minOrder).toBe(0));
  });

  it('writes nothing when a setting is left unchanged', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    await user.click(screen.getByLabelText('Minimum order per position (CZK)'));
    await user.tab();

    expect(store.saved).toEqual([]);
  });

  it('changes the currency at once', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Settings' }));

    await user.selectOptions(screen.getByLabelText('Currency'), 'EUR');

    await waitFor(() => expect(store.saved.at(-1)?.currency).toBe('EUR'));
  });

  it('closes the editor on Back without saving', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);
    await openPortfolio(user);
    await user.click(screen.getByRole('button', { name: 'Edit ALFA' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Holding (CZK)'), '999');

    await pressBack();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portfolio' })).toBeInTheDocument();
    expect(store.saved).toEqual([]);
  });

  it('returns to Invest on Back', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await screen.findByRole('heading', { name: 'History' });

    await pressBack();

    expect(await screen.findByRole('heading', { name: 'Invest' })).toBeInTheDocument();
  });

  it('lists a round by ticker rather than by company name', async () => {
    const user = userEvent.setup();
    render(<App store={new InMemoryPortfolioStore(PORTFOLIO)} />);

    await investOneRound(user);
    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByText('ALFA')).toBeInTheDocument();
    expect(screen.queryByText('Alfa Holding')).not.toBeInTheDocument();
  });
});
