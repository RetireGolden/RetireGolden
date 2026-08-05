/**
 * Per-state income tax parameters (V5, "big levers"). One pack per tax year;
 * a data-only refresh each fall. Models brackets, standard deduction, whether
 * the state taxes Social Security, and the major age-based retirement-income
 * exclusion. Per-state credits, local/city taxes, and income phase-outs of
 * exclusions are out of scope.
 *
 * @see DOCS/features/taxes.md
 */

import type { FilingStatus, PerStatus } from '../types.js'

/** Marginal bracket: `ratePct` applies to taxable income above `lowerBound`. */
export interface StateTaxBracket {
  lowerBound: number
  ratePct: number
}

/**
 * Exclusion of retirement income from state taxable income.
 *  - none:   the state taxes retirement income like other ordinary income.
 *  - full:   retirement income is entirely exempt (subject to minAge if set).
 *  - capped: each age-eligible person excludes up to capPerPerson.
 */
export interface StateRetirementExclusion {
  kind: 'none' | 'full' | 'capped'
  /** Annual cap per eligible person (kind 'capped'), in pack-year dollars. */
  capPerPerson?: number
  /** Exclusion applies only to people at or above this age. */
  minAge?: number
}

export interface StateTaxParams {
  /** Two-letter code, e.g. 'KY'. */
  code: string
  name: string
  /** Nine states levy no broad income tax → everything below is ignored. */
  hasIncomeTax: boolean
  /** ~9 states tax Social Security benefits (to the federally taxable extent). */
  taxesSocialSecurity: boolean
  /** Most states tax long-term gains as ordinary income. */
  capitalGainsAsOrdinary: boolean
  /**
   * Percent of modeled realized/net capital gain included in the state base.
   * Defaults to 100 when `capitalGainsAsOrdinary` is true, else 0.
   */
  capitalGainsTaxablePct?: number
  /**
   * Whether the state follows the federal capital-loss carryforward netting
   * already applied by the ledger, or taxes only current-year realized gains
   * and ignores prior-year carryforward offsets (PA-style planning case).
   */
  capitalLossCarryforwardConformity?: 'federal' | 'currentYearOnly'
  /** Source notes for state capital-gain/conformity treatment. */
  capitalGainsNotes?: string
  capitalGainsSources?: string[]
  standardDeduction: PerStatus<number>
  /**
   * Set to `'federal'` when the amount above is not an independent state figure
   * but the FEDERAL standard deduction for the pack year, carried here because
   * the state defines its own by reference to it (or, for CO and ND, because
   * the state's brackets are defined on federal taxable income and this field
   * is what converts the engine's gross base into that base).
   *
   * Marking it matters because IRC 63(c)(7)(B)(ii) increases the federal amount
   * for every taxable year beginning after 2025. A copy of that amount left
   * frozen at the pack year would take a different value from the original in
   * the very same projected year, and the whole widening gap would be taxed at
   * the state rate. `conformStateStandardDeduction` reads this flag and moves
   * the copy with the original.
   *
   * The same flag is what entitles the state base to the age-65 additional
   * deduction: "the standard deduction" the state is pointing at is IRC
   * 63(c)(1)'s, which is the basic amount plus the additional amounts of
   * 63(c)(3). See `standardDeductionAge65Addition`.
   *
   * Absent (the default) means the state publishes its own deduction, which no
   * federal provision reaches. ME and SC are the type case: both decoupled from
   * the federal figure for 2026 and must NOT move with it.
   */
  standardDeductionConformity?: 'federal'
  /**
   * Per-person federal additional standard deduction for age 65 or older (IRC
   * 63(c)(3), 63(f)(1)), attached to a conformed state's params so the state
   * base gets the same deduction the federal base gets.
   *
   * NOT part of the published pack data, and never set for an untagged state.
   * `conformStateStandardDeduction` attaches it — from the federal pack for the
   * year, scaled by the same inflation factor as the basic amount — because it
   * is a federal figure the state borrows whole, not a state dollar amount
   * anyone in the pack could edit. So this field is a property of CONFORMED
   * params, not of published ones: a raw `stateParamsFor` result carries
   * neither the indexed basic amount nor this one, and pricing against it
   * charges a conforming state its pack-year basic amount alone. Conforming
   * before pricing a household-year is the contract, and
   * `computeStateTaxYearTotal` is where it is met.
   *
   * Stored per person rather than pre-multiplied by the household's head count
   * so `prorateParams` can scale it for part-year residency exactly as it scales
   * the basic amount — a 65+ filer resident for five months gets five twelfths
   * of the addition, not all of it.
   */
  standardDeductionAge65Addition?: PerStatus<number>
  brackets: PerStatus<StateTaxBracket[]>
  /** Private pensions, annuities, traditional IRA/401(k), RMD, SEPP, and inherited distributions. */
  retirementPrivate: StateRetirementExclusion
  /** Public civil-service / military pensions, where state law separates them. */
  retirementPublic: StateRetirementExclusion
  /**
   * True when the state has one all-retirement rule copied into both buckets
   * (no separate public-pension law): a capped exclusion then applies once to
   * the combined retirement income, never once per bucket.
   */
  retirementRuleShared?: boolean
  /** Citation / modeled simplifications for the data-refresh workstream. */
  notes?: string
}

export interface StateTaxPack {
  year: number
  /** Keyed by two-letter code. Absent states fall back to the flat override. */
  states: Record<string, StateTaxParams>
}

export type { FilingStatus }
