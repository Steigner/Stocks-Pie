/**
 * Persistence for the desktop app: `portfolio.json` in a folder the user picks
 * through the operating system's own dialog. The path never reaches this side -
 * the Rust commands in src-tauri hold it and only ever touch that one file.
 */
import { invoke } from '@tauri-apps/api/core';
import type { Portfolio } from '../domain/types';
import { loadPortfolioFromText, savePortfolioToText } from './serialization';
import type { PortfolioStore } from './types';

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export class TauriPortfolioStore implements PortfolioStore {
  private folderName: string | null = null;

  describeLocation(): string | null {
    return this.folderName;
  }

  async connect(): Promise<boolean> {
    const name = await invoke<string | null>('choose_folder');
    if (name === null) {
      return false;
    }
    this.folderName = name;
    return true;
  }

  async restoreFromPreviousVisit(): Promise<boolean> {
    this.folderName = await invoke<string | null>('restore_folder');
    return this.folderName !== null;
  }

  async load(): Promise<Portfolio | null> {
    const text = await invoke<string | null>('load_portfolio');
    return text === null ? null : loadPortfolioFromText(text);
  }

  async save(portfolio: Portfolio): Promise<void> {
    await invoke('save_portfolio', { text: savePortfolioToText(portfolio) });
  }
}
