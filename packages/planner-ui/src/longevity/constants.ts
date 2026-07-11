import { STORAGE_KEYS } from '../data/localStore'

/** localStorage key for saved longevity answers + last result (primary / household member A) */
export const LONGEVITY_STORAGE_KEY = STORAGE_KEYS.longevity

/** Second saved profile for Social Security couple survivor overlay (partner / household member B) */
export const LONGEVITY_PARTNER_STORAGE_KEY = STORAGE_KEYS.longevityPartner

/** SSA period life table vintage embedded in `ssaPeriod2022.ts` */
export const BASELINE_CITATION = {
  label: 'SSA period life table, 2022 (2025 Trustees Report)',
  url: 'https://www.ssa.gov/oact/STATS/table4c6.html',
  note:
    '“Life expectancy” column is average remaining years for Social Security area population, by sex, using 2022 mortality rates.',
} as const
