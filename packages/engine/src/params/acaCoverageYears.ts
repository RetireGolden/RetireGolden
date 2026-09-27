/**
 * Premium-tax-credit figures by coverage year: the single source of the
 * Applicable Percentage Table and the poverty guidelines the credit reads,
 * resolved on their own rather than through the income-tax pack.
 *
 * The two run on a different calendar from the income-tax figures. The table
 * for taxable years beginning in a calendar year is published each summer
 * (IRC 36B(b)(3)(A); a Rev. Proc. in July), and the poverty line for coverage
 * in a year is the one most recently published when that year's open
 * enrollment begins (IRC 36B(d)(3)(B); 26 CFR 1.36B-1(h)), which is the HHS
 * notice of January of the year before. So a coverage year's figures are
 * complete months before its income-tax pack, and a year priced here while its
 * income-tax pack is a stand-in says so with the informational support code
 * `income-tax-parameters-projected`.
 *
 * Every published pack references its own year's block (`year2026.aca` and
 * `year2026.federalPovertyLine` are the objects below), and a test holds any
 * later pack to its block, so the figures have one home. The 100 and 400
 * percent bounds are statutory (IRC 36B(c)(1)(A)) and repeat in every block.
 * Published guidelines are used as published: the resolver's callers price a
 * published block at a poverty-line scale of 1, never inflated.
 *
 * @see DOCS/domain/domain-rules-reference.md §8
 * @see DOCS/calculations/medicare-and-aca/aca-coverage-year-parameters.md
 */

import type { ParameterPack } from './types.js'

/** The figures the credit calculation reads; a pack or a coverage-year block. */
export type AcaPricingParameters = Pick<ParameterPack, 'federalPovertyLine' | 'aca'>

export interface AcaCoverageYearParameters extends AcaPricingParameters {
  /** The calendar year of Marketplace coverage (the taxable year of the credit). */
  readonly coverageYear: number
  /** The year of the HHS poverty guidelines in effect when this year's open enrollment began. */
  readonly povertyGuidelineYear: number
  /** Where the Applicable Percentage Table comes from, as the report's provenance row names it. */
  readonly applicablePercentageSource: string
  /** Where the poverty guidelines come from, as the report's provenance row names it. */
  readonly povertyGuidelineSource: string
}

/**
 * 2026 coverage. Enhanced credits expired 12/31/2025, so the 400% cliff is
 * back. Rev. Proc. 2025-25 section 3.01 (Applicable Percentage Table for 2026):
 * 2.10% below 133% FPL, then 3.14 to 4.19 (133-150), 4.19 to 6.60 (150-200),
 * 6.60 to 8.44 (200-250), 8.44 to 9.96 (250-300), 9.96 flat through 400%.
 * Poverty line: HHS 2025 guidelines, 90 FR 5917 (Jan. 17, 2025). The 2026
 * income-tax pack references this block rather than repeating it.
 */
export const acaCoverageYear2026: AcaCoverageYearParameters = {
  coverageYear: 2026,
  povertyGuidelineYear: 2025,
  applicablePercentageSource: 'Rev. Proc. 2025-25',
  povertyGuidelineSource: 'HHS 2025 poverty guidelines, 90 FR 5917',
  federalPovertyLine: {
    contiguous: { firstPerson: 15_650, perAdditionalPerson: 5_500 },
    alaska: { firstPerson: 19_550, perAdditionalPerson: 6_880 },
    hawaii: { firstPerson: 17_990, perAdditionalPerson: 6_330 },
  },
  aca: {
    applicablePctBelowFirstBreakpoint: 2.1,
    minFplPctForCredit: 100,
    applicablePctBreakpoints: [
      // A real step at exactly 133%: income strictly below uses 2.10%; the
      // 133-150 band opens at 3.14%.
      { fplPct: 133, applicablePct: 3.14 },
      { fplPct: 150, applicablePct: 4.19 },
      { fplPct: 200, applicablePct: 6.6 },
      { fplPct: 250, applicablePct: 8.44 },
      { fplPct: 300, applicablePct: 9.96 },
      { fplPct: 400, applicablePct: 9.96 },
    ],
    maxFplPctForCredit: 400,
  },
}

/**
 * 2027 coverage. Rev. Proc. 2026-26 section 3.01 (Applicable Percentage Table
 * for 2027): 2.15% below 133% FPL, then 3.23 to 4.30 (133-150), 4.30 to 6.78
 * (150-200), 6.78 to 8.66 (200-250), 8.66 to 10.22 (250-300), 10.22 flat
 * through 400%. Section 3.02's 10.22% required contribution percentage is an
 * employer-coverage affordability test the household asserts through the year
 * contract's coverageEligibility, so no calculation reads it. Poverty line:
 * HHS 2026 guidelines, 91 FR 1797 (Jan. 15, 2026), the latest published on the
 * first day of 2027 open enrollment (45 CFR 155.410(e)(5): no later than
 * November 1, 2026); every row of all three tables is first person plus a
 * fixed amount per additional person.
 */
const acaCoverageYear2027: AcaCoverageYearParameters = {
  coverageYear: 2027,
  povertyGuidelineYear: 2026,
  applicablePercentageSource: 'Rev. Proc. 2026-26',
  povertyGuidelineSource: 'HHS 2026 poverty guidelines, 91 FR 1797',
  federalPovertyLine: {
    contiguous: { firstPerson: 15_960, perAdditionalPerson: 5_680 },
    alaska: { firstPerson: 19_950, perAdditionalPerson: 7_100 },
    hawaii: { firstPerson: 18_360, perAdditionalPerson: 6_530 },
  },
  aca: {
    applicablePctBelowFirstBreakpoint: 2.15,
    minFplPctForCredit: 100,
    applicablePctBreakpoints: [
      { fplPct: 133, applicablePct: 3.23 },
      { fplPct: 150, applicablePct: 4.3 },
      { fplPct: 200, applicablePct: 6.78 },
      { fplPct: 250, applicablePct: 8.66 },
      { fplPct: 300, applicablePct: 10.22 },
      { fplPct: 400, applicablePct: 10.22 },
    ],
    maxFplPctForCredit: 400,
  },
}

// Keep sorted ascending by coverage year as each summer's table is added.
const coverageYears: readonly AcaCoverageYearParameters[] = [acaCoverageYear2026, acaCoverageYear2027]

/** Every coverage year with a published block, ascending. */
export const ACA_COVERAGE_YEARS: readonly AcaCoverageYearParameters[] = coverageYears

export const EARLIEST_ACA_COVERAGE_YEAR = coverageYears[0]!.coverageYear
export const LATEST_ACA_COVERAGE_YEAR = coverageYears[coverageYears.length - 1]!.coverageYear

export interface AcaCoverageYearLookup {
  params: AcaCoverageYearParameters
  /**
   * True when `year` has no published block and a neighbouring year stands
   * in. A stand-in year is not priced: the ledger marks it
   * `tax-year-parameters-unsupported` and budgets the gross premium.
   */
  isStandIn: boolean
}

/**
 * The credit figures for Marketplace coverage in `year`: the exact published
 * block when there is one, otherwise the latest block for a later year and
 * the earliest for an earlier one, flagged as a stand-in (the same resolution
 * `packForYear` and the state packs use).
 */
export function acaParametersForCoverageYear(year: number): AcaCoverageYearLookup {
  const exact = coverageYears.find((block) => block.coverageYear === year)
  if (exact) return { params: exact, isStandIn: false }
  if (year > LATEST_ACA_COVERAGE_YEAR) return { params: coverageYears[coverageYears.length - 1]!, isStandIn: true }
  return { params: coverageYears[0]!, isStandIn: true }
}
