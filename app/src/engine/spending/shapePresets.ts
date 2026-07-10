/**
 * Spending-shape presets (spending-paths & SWR-lenses plan, Goal 1).
 *
 * Named, research-sourced spending shapes that compile to ordinary
 * `expenses.phases` rows — the anti-drift rule from the shipped spending
 * profiles: presets generate visible, editable phase rows at creation time and
 * never live-couple saved plans to research constants.
 *
 * Shapes (multipliers on the primary person's age clock, always vs. the
 * inflation-adjusted baseline):
 * - constant-real: no phases — spending holds level in real terms (the classic
 *   Bengen assumption).
 * - smile: Blanchett's *average* retiree — a real decline through
 *   mid-retirement that late-life healthcare partly reverses. The shipped
 *   two-step calibration (−10% at 75, −20% at 85) approximates that path's
 *   overall level without an explicit late step-up; edit the generated rows
 *   to add one if desired.
 * - smirk: Blanchett's 2025–26 finding for the *median* retiree — a steady
 *   ~1%/yr real decline with no late uptick (only the sickest tail drives the
 *   average's uptick). Shape-aware plans support meaningfully higher initial
 *   withdrawals than constant-real; the solver-per-shape view quantifies that
 *   on the user's own plan.
 * - custom annual real delta: the same compilation at a user-chosen %/yr.
 *
 * A steady per-year drift is compiled as 5-year steps (the compounded
 * multiplier at each step age) so the generated rows stay reviewable — a
 * documented approximation, editable like any hand-entered phase.
 */

import type { ExpensePhase } from '../model/plan'

export type SpendingShapeId = 'flat' | 'smile' | 'frontLoaded' | 'smirk'

/** Blanchett-median real spending drift used by the smirk preset (%/yr). */
export const SMIRK_ANNUAL_REAL_DELTA_PCT = -1

const STEP_YEARS = 5
const LAST_STEP_AGE = 100

/**
 * Compile a steady annual real spending drift into 5-year phase steps from
 * retirement to age 100: at each step age the multiplier is the fully
 * compounded (1 + delta)^(yearsSinceRetirement), rounded to 2 decimals and
 * clamped to the phase schema's [0, 3] range. A zero delta compiles to no
 * phases (constant-real).
 */
export function annualDeltaPhases(deltaPct: number, retirementAge: number): ExpensePhase[] {
  if (deltaPct === 0) return []
  // Phase rows require fromAge in [40, 110]; start stepping after retirement.
  const startAge = Math.min(Math.max(Math.round(retirementAge), 40), 105)
  const phases: ExpensePhase[] = []
  for (let age = startAge + STEP_YEARS; age <= LAST_STEP_AGE; age += STEP_YEARS) {
    const multiplier = Math.pow(1 + deltaPct / 100, age - startAge)
    phases.push({ fromAge: age, multiplier: Math.min(3, Math.max(0, Math.round(multiplier * 100) / 100)) })
  }
  return phases
}

/** Compile a named shape to phase rows (see module docs for each calibration). */
export function spendingShapePhases(shape: SpendingShapeId, retirementAge: number): ExpensePhase[] {
  switch (shape) {
    case 'flat':
      return []
    case 'smile':
      return [
        { fromAge: 75, multiplier: 0.9 },
        { fromAge: 85, multiplier: 0.8 },
      ]
    case 'smirk':
      return annualDeltaPhases(SMIRK_ANNUAL_REAL_DELTA_PCT, retirementAge)
    case 'frontLoaded': {
      const boostFrom = Math.min(Math.max(retirementAge, 40), 100)
      // The +10% travel boost only covers the pre-75 window and always settles
      // back to baseline at 75. If retirement starts at/after 75 there is no
      // early window to boost, so stay flat (matches the UI label and doc).
      if (boostFrom >= 75) return []
      return [
        { fromAge: boostFrom, multiplier: 1.1 },
        { fromAge: 75, multiplier: 1 },
      ]
    }
  }
}
