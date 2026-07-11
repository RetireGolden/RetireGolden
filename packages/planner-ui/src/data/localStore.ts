/**
 * Guarded localStorage access plus the central registry of `retiregolden.*`
 * keys. localStorage can throw (private browsing, quota, disabled storage);
 * reads fall back to null and writes/removes fail silently — IndexedDB is the
 * durable store, these are per-device conveniences. "Clear all data" removes
 * every key with the `retiregolden.` prefix, so new keys must keep it.
 */

export const STORAGE_KEYS = {
  theme: 'retiregolden.theme',
  homeWelcomeDismissed: 'retiregolden.home.welcomeDismissed',
  insightsDismissed: 'retiregolden.insights.dismissed',
  examplesExpanded: 'retiregolden.examples.expanded',
  longevity: 'retiregolden.longevity.v1',
  longevityPartner: 'retiregolden.longevity.partner.v1',
  socialSecurityForm: 'retiregolden.ss.v1',
  fedInvestCache: 'retiregolden.fedinvest.v1',
} as const

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable — the visible state still applies this session */
  }
}

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}
