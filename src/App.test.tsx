import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { emptyPortfolio } from './domain/portfolio';
import type { Portfolio } from './domain/types';
import { DOWNLOAD_URL } from './download';
import type { PortfolioStore } from './storage';
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

/** Like the desktop store: its first folder holds PORTFOLIO, any newly picked one is empty. */
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

async function investOneRound(user: ReturnType<typeof userEvent.setup>) {
  const budgetInput = await screen.findByLabelText('How much am I investing now (CZK)');
  await user.clear(budgetInput);
  await user.type(budgetInput, '100000');
  await user.click(
    screen.getByRole('button', { name: "I've placed the orders, record this round" }),
  );
}

describe('App', () => {
  it('opens the web preview on the sample portfolio, one click from the download', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/A preview with sample data/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download the app' })).toHaveAttribute(
      'href',
      DOWNLOAD_URL,
    );

    await user.click(screen.getByRole('button', { name: 'Portfolio' }));

    expect(screen.getByDisplayValue('NVDA')).toBeInTheDocument();
  });

  it('invests a deposit, records the round, then fully undoes it from history', async () => {
    const user = userEvent.setup();
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);

    const budgetInput = await screen.findByLabelText(
      'How much am I investing now (CZK)',
    );
    await user.clear(budgetInput);
    await user.type(budgetInput, '100000');

    expect(await screen.findByText('Send these orders')).toBeInTheDocument();
    expect(screen.getByText('100,000 CZK')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: "I've placed the orders, record this round" }),
    );

    expect(await screen.findByText(/Recorded 100,000 CZK/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'History' }));

    expect(await screen.findByText('History (1)')).toBeInTheDocument();
    expect(screen.getByText('100,000 CZK invested')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('No deposits recorded yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Portfolio' }));

    expect(await screen.findByDisplayValue('Alfa Holding')).toBeInTheDocument();
    for (const input of screen.getAllByLabelText('Holding in CZK')) {
      expect(input).toHaveValue(0);
    }
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
      'How much am I investing now (EUR)',
    );
    await userEvent.setup().type(budgetInput, '100000');

    expect(await screen.findByText('100,000 EUR')).toBeInTheDocument();
  });

  it('leaves the stored file alone when nothing has been changed yet', async () => {
    const store = new InMemoryPortfolioStore(PORTFOLIO);
    render(<App store={store} />);

    await screen.findByLabelText('How much am I investing now (CZK)');

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

    await user.click(screen.getByRole('button', { name: 'About the portfolio table' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'About the portfolio table' }));
    expect(await screen.findByRole('tooltip')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('moves the open portfolio into a newly chosen empty folder', async () => {
    const user = userEvent.setup();
    const store = new FolderStore(true);
    render(<App store={store} />);

    await user.click(await screen.findByRole('button', { name: 'Data location' }));
    await user.click(screen.getByRole('button', { name: 'Change folder' }));

    await waitFor(() => expect(store.saved).toEqual([PORTFOLIO]));
    await user.click(await screen.findByRole('button', { name: 'Portfolio' }));
    expect(screen.getByDisplayValue('Alfa Holding')).toBeInTheDocument();
  });

  it('keeps everything as it was when changing folder is cancelled', async () => {
    const user = userEvent.setup();
    const store = new FolderStore(false);
    render(<App store={store} />);

    await user.click(await screen.findByRole('button', { name: 'Data location' }));
    await user.click(screen.getByRole('button', { name: 'Change folder' }));

    expect(
      await screen.findByRole('button', { name: 'Change folder' }),
    ).toBeInTheDocument();
    expect(store.loads).toBe(1);
    expect(store.saved).toEqual([]);
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
