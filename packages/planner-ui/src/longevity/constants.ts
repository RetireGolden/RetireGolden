import { STORAGE_KEYS } from '../data/localStore'
import { CURRENT_LIFE_TABLE_EDITION, SSA_PERIOD_LIFE_TABLE } from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
import type { LifeTableEdition } from '@retiregolden/engine/longevity/types'

/** localStorage key for saved longevity answers + last result (primary / household member A) */
export const LONGEVITY_STORAGE_KEY = STORAGE_KEYS.longevity

/** Second saved profile for Social Security couple survivor overlay (partner / household member B) */
export const LONGEVITY_PARTNER_STORAGE_KEY = STORAGE_KEYS.longevityPartner

export interface LifeTableCitation {
  readonly label: string
  readonly url: string
  readonly note: string
}

/**
 * The citation for an edition of SSA's period life table, read from the
 * engine's source record so a table refresh cannot leave it stale. The table
 * the engine carries links to SSA's live page; an earlier edition links to the
 * page SSA keeps for it (`table4c6_<period>_TR<report>.html`; the 2022
 * edition's page, the only earlier one a stored figure can name, was read on
 * 2026-09-27).
 */
export function lifeTableCitation(edition: LifeTableEdition): LifeTableCitation {
  const { periodYear, trusteesReportYear } = edition
  const current =
    periodYear === CURRENT_LIFE_TABLE_EDITION.periodYear && trusteesReportYear === CURRENT_LIFE_TABLE_EDITION.trusteesReportYear
  return {
    label: `SSA period life table, ${periodYear} (${trusteesReportYear} Trustees Report)`,
    url: current ? SSA_PERIOD_LIFE_TABLE.source.url : `https://www.ssa.gov/oact/STATS/table4c6_${periodYear}_TR${trusteesReportYear}.html`,
    note: `The “Life expectancy” column is the average remaining years for the Social Security area population, by sex, using ${periodYear} mortality rates.`,
  }
}

/** An edition named in running text: "period life table for 2023, as used in the 2026 Trustees Report". */
export function lifeTableName(edition: LifeTableEdition): string {
  return `period life table for ${edition.periodYear}, as used in the ${edition.trusteesReportYear} Trustees Report`
}

/** The SSA period life table the engine carries now (longevity/ssaPeriodLifeTable.ts). */
export const BASELINE_CITATION: LifeTableCitation = lifeTableCitation(CURRENT_LIFE_TABLE_EDITION)
