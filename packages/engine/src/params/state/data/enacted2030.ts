/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2030 that differ from the ones enacted for an earlier year. Read by
 * `stateParamsFor` for 2030 and carried forward until a later enacted year
 * replaces them; each entry replaces only the fields it names.
 *
 * - Mississippi: Miss. Code Ann. 27-7-5(1)(b)(ii)7 (2025 H.B. 1), 3% above the
 *   $10,000 zero band "for calendar year 2030 and all calendar years
 *   thereafter, except as otherwise provided in Section 2 of this act"
 *   (`ms-27-7-5-rate-ramp`). Section 2's further cuts, from 2031, depend on the
 *   Working Cash-Stabilization Reserve Fund being full and on a revenue test,
 *   so they are not loaded.
 * - North Carolina: S.L. 2026-41, section 44.1(a), rewriting G.S.
 *   105-153.7(a) to 3.24% for taxable years beginning in 2030, 2031 and 2032
 *   (`nc-sl-2026-41-rate-steps-2030-and-after`).
 * - Hawaii: HRS 235-2.4(a)(2)(H), a standard deduction of $10,000 single and
 *   $20,000 joint for taxable years beginning after December 31, 2029
 *   (`hi-hrs-235-2-4-a-2-g-to-i-standard-deduction-steps`).
 * - California: RTC 17132.9 and 17132.10, the military retirement and Survivor
 *   Benefit Plan exclusions, apply only to taxable years before 2030 and are
 *   repealed December 1, 2030, so the block ends
 *   (`ca-rtc-17132-9-10-military-retirement-exclusions`).
 * - Maryland: Tax-General 10-207(mm)(3)(VI), the first $20,000 of public-safety
 *   retirement income from 2030 (`md-tg-10-207-mm-public-safety-retirement-subtraction`).
 * - Virginia: Va. Code 58.1-322.03(1)(b)(i), a standard deduction of $3,000
 *   single and $6,000 married "on and after January 1, 2030", when the
 *   temporary amounts in (ii) to (vii) end
 *   (`va-code-58-1-322-03-standard-deduction-steps`).
 * - District of Columbia: D.C. Code 47-1801.04(44)(A)(vi), as D.C. Act 26-416
 *   amends it, the federal standard deduction for taxable years beginning after
 *   December 31, 2029, when the District's own basic deduction ends
 *   (`dc-code-47-1801-04-3a-standard-deduction-2026-2029`).
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2030: StateEnactedYear = {
  year: 2030,
  states: {
    MS: {
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3 }],
      },
    },
    NC: {
      brackets: { single: [{ lowerBound: 0, ratePct: 3.24 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.24 }] },
    },
    HI: {
      standardDeduction: { single: 10000, marriedFilingJointly: 20000 },
    },
    VA: {
      standardDeduction: { single: 3000, marriedFilingJointly: 6000 },
    },
    MD: {
      marylandPublicSafetySubtraction: { amount: 20000, minAge: 55, planSystemCode: 'MD-PUBLIC-SAFETY' },
    },
    // D.C. Code 47-1801.04(44)(A)(vi), as D.C. Act 26-416 amends it: for
    // taxable years beginning after December 31, 2029, the federal standard
    // deduction (`dc-code-47-1801-04-3a-standard-deduction-2026-2029`).
    DC: {
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 },
      standardDeductionConformity: 'federal',
      standardDeductionAge65AdditionConformity: null,
      standardDeductionStatutoryIndexing: null,
    },
    CA: {
      californiaMilitaryExclusions: null,
    },
  },
}
