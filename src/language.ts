export type Language = 'en' | 'cs';

const STORAGE_KEY = 'stocks-pie:language';

export function readLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'cs' ? 'cs' : 'en';
  } catch (error) {
    console.error('Could not read the language preference.', error);
    return 'en';
  }
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch (error) {
    console.error('Could not save the language preference.', error);
  }
}
