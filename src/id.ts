/**
 * A unique-enough id for React keys and stored records.
 *
 * `crypto.randomUUID` requires a secure context (HTTPS, or literally
 * `localhost`) and is undefined otherwise - e.g. when the dev server is
 * reached over a plain LAN address. These ids carry no security meaning, so
 * a non-cryptographic fallback is fine.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
