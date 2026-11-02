import { act, cleanup } from '@testing-library/react';

/** History steps run on a timer, so one taken in a test can land in the next. */
export async function settleHistory(): Promise<void> {
  await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
}

export async function pressBack(): Promise<void> {
  history.back();
  await settleHistory();
}

/** Unmounts now and waits, so handlers released by unmounting finish their step. */
export async function cleanupWithHistory(): Promise<void> {
  cleanup();
  await settleHistory();
}
