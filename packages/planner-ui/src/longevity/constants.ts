import { STORAGE_KEYS } from '../data/localStore'
import {
  CURRENT_LIFE_TABLE_EDITION,
  CURVE_EXPECTANCY_GAP,
  SSA_PERIOD_LIFE_TABLE,
  knownLifeTableEdition,
} from '@retiregolden/engine/longevity/ssaPeriodLifeTable'
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
 * What a saved result names when its edition is outside the engine's closed
 * set (engine/longevity/ssaPeriodLifeTable.ts#KNOWN_LIFE_TABLE_EDITIONS) or is
 * not an edition at all (PR #759 review 7). No edition has year 0, so it
 * reads as unrecognized wherever it goes, back through storage included.
 */
export const UNRECOGNIZED_LIFE_TABLE_EDITION: LifeTableEdition = Object.freeze({ periodYear: 0, trusteesReportYear: 0 })

/**
 * The citation for an edition of SSA's period life table, read from the
 * engine's closed set of known editions, each with SSA's own page for it (the
 * live page for the table the engine carries, `table4c6_2022_TR2025.html` for
 * the 2022 table), so a table refresh cannot leave it stale and no page is
 * made up for an edition the engine does not know. An unrecognized edition
 * says so and links SSA's live page (PR #759 review 7).
 */
export function lifeTableCitation(edition: LifeTableEdition): LifeTableCitation {
  const known = knownLifeTableEdition(edition)
  if (!known) {
    return {
      label: 'SSA period life table (table edition not recognized)',
      url: SSA_PERIOD_LIFE_TABLE.source.url,
      note: 'The saved result names a table edition the planner does not recognize; the link is SSA’s current table.',
    }
  }
  const { periodYear, trusteesReportYear } = known.edition
  return {
    label: `SSA period life table, ${periodYear} (${trusteesReportYear} Trustees Report)`,
    url: known.url,
    note: `The “Life expectancy” column is the average remaining years for the Social Security area population, by sex, using ${periodYear} mortality rates.`,
  }
}

/**
 * A stored figure's table in running text (a figure that names none was made
 * on the 2022 table): "SSA 2022 period life table", or "SSA period life
 * table, table edition not recognized" for an edition outside the closed set.
 */
export function storedLifeTablePhrase(stored: LifeTableEdition | undefined): string {
  const known = knownLifeTableEdition(stored)
  return known ? `SSA ${known.edition.periodYear} period life table` : 'SSA period life table, table edition not recognized'
}

/** An edition named in running text: "period life table for 2023, as used in the 2026 Trustees Report". */
export function lifeTableName(edition: LifeTableEdition): string {
  return `period life table for ${edition.periodYear}, as used in the ${edition.trusteesReportYear} Trustees Report`
}

/**
 * The engine's published gap between the survival curve's life expectancy and
 * SSA's printed one (engine/longevity/ssaPeriodLifeTable.ts#CURVE_EXPECTANCY_GAP),
 * rounded up to the thousandth so "at most" stays true: "0.005" on the 2023
 * table. Read from the engine, so a table refresh restates it (PR #759 review 8).
 */
export function curveExpectancyGapText(maxYears: number = CURVE_EXPECTANCY_GAP.maxYears): string {
  return (Math.ceil(maxYears * 1000) / 1000).toFixed(3)
}

/** The SSA period life table the engine carries now (longevity/ssaPeriodLifeTable.ts). */
export const BASELINE_CITATION: LifeTableCitation = lifeTableCitation(CURRENT_LIFE_TABLE_EDITION)
