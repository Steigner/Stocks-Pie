import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupWithHistory, pressBack, settleHistory } from './testing/history';
import { useBackHandler } from './useBackHandler';

function Handlers({
  outer,
  inner,
  innerActive = true,
}: {
  outer: () => void;
  inner: () => void;
  innerActive?: boolean;
}) {
  useBackHandler(true, outer);
  useBackHandler(innerActive, inner);
  return null;
}

describe('useBackHandler', () => {
  afterEach(cleanupWithHistory);

  it('calls the most recent active handler only', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<Handlers outer={outer} inner={inner} />);

    await pressBack();

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it('moves on to the next handler once the first has been used', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(<Handlers outer={outer} inner={inner} />);

    await pressBack();
    await pressBack();

    expect(inner).toHaveBeenCalledOnce();
    expect(outer).toHaveBeenCalledOnce();
  });

  it('does not call a handler after it was released', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(<Handlers outer={outer} inner={inner} />);

    rerender(<Handlers outer={outer} inner={inner} innerActive={false} />);
    await settleHistory();
    await pressBack();

    expect(inner).not.toHaveBeenCalled();
    expect(outer).toHaveBeenCalledOnce();
  });

  it('ignores the history step caused by its own release', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(<Handlers outer={outer} inner={inner} />);

    rerender(<Handlers outer={outer} inner={inner} innerActive={false} />);
    await settleHistory();

    expect(outer).not.toHaveBeenCalled();
  });
});
