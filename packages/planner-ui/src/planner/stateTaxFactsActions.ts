/**
 * Plan mutations for `stateTaxFacts.householdYearFacts` — one shared row per
 * tax year. A state filter in the UI only controls visibility; it never forks rows.
 */

import type { Plan, StateTaxYearHouseholdFacts } from '@retiregolden/engine/model/plan'

export type HouseholdYearFactsRow = StateTaxYearHouseholdFacts

export function householdYearFactsFor(plan: Readonly<Plan>, year: number): HouseholdYearFactsRow | undefined {
  return plan.stateTaxFacts.householdYearFacts.find((row) => row.year === year)
}

export function upsertHouseholdYearFacts(draft: Plan, row: HouseholdYearFactsRow): void {
  const index = draft.stateTaxFacts.householdYearFacts.findIndex((entry) => entry.year === row.year)
  if (index === -1) {
    draft.stateTaxFacts.householdYearFacts.push(row)
    draft.stateTaxFacts.householdYearFacts.sort((a, b) => a.year - b.year)
    return
  }
  draft.stateTaxFacts.householdYearFacts[index] = row
}

export function patchHouseholdYearFacts(
  draft: Plan,
  year: number,
  patch: Partial<Omit<HouseholdYearFactsRow, 'year'>>,
): void {
  const existing = householdYearFactsFor(draft, year)
  upsertHouseholdYearFacts(draft, { year, ...(existing ?? {}), ...patch })
}

export function removeHouseholdYearFacts(draft: Plan, year: number): void {
  draft.stateTaxFacts.householdYearFacts = draft.stateTaxFacts.householdYearFacts.filter((row) => row.year !== year)
}

export function addHouseholdYearFactsRow(draft: Plan, year: number): boolean {
  if (householdYearFactsFor(draft, year) !== undefined) return false
  draft.stateTaxFacts.householdYearFacts.push({ year })
  draft.stateTaxFacts.householdYearFacts.sort((a, b) => a.year - b.year)
  return true
}

/** States whose worksheet fields this UI authors (filter only — not stored on the row). */
export const STATE_TAX_WORKSHEET_STATES = ['IA', 'CT', 'VT', 'WI', 'MA', 'IL', 'OR', 'WV'] as const
export type StateTaxWorksheetState = (typeof STATE_TAX_WORKSHEET_STATES)[number]

export const STATE_TAX_WORKSHEET_ANCHOR = 'state-tax-worksheet-facts'
