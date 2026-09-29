/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2031 that differ from the ones enacted for an earlier year. Read by
 * `stateParamsFor` for 2031 and carried forward; each entry replaces only the
 * fields it names.
 *
 * - Hawaii: HRS 235-2.4(a)(2)(I), a standard deduction of $12,000 single and
 *   $24,000 joint for taxable years beginning after December 31, 2030
 *   (`hi-hrs-235-2-4-a-2-g-to-i-standard-deduction-steps`), the last step Act
 *   46, SLH 2024 sets.
 * - California: Cal. Const. art. XIII, sec. 36(f)(2) modifies the 9.3% bracket
 *   only for taxable years before 2031, so the 10.3%, 11.3% and 12.3% bands end
 *   and 9.3% applies above its threshold, at the thresholds the 2026 figures
 *   carry (`ca-const-art-13-sec-36-f-2-top-bands-end-2031`). Proposition 3 on
 *   the November 3, 2026 ballot would make the bands permanent; the entry is
 *   revisited when it is decided.
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2031: StateEnactedYear = {
  year: 2031,
  states: {
    HI: {
      standardDeduction: { single: 12000, marriedFilingJointly: 24000 },
    },
    CA: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1 }, { lowerBound: 11079, ratePct: 2 }, { lowerBound: 26264, ratePct: 4 },
          { lowerBound: 41452, ratePct: 6 }, { lowerBound: 57542, ratePct: 8 }, { lowerBound: 72724, ratePct: 9.3 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1 }, { lowerBound: 22158, ratePct: 2 }, { lowerBound: 52528, ratePct: 4 },
          { lowerBound: 82904, ratePct: 6 }, { lowerBound: 115084, ratePct: 8 }, { lowerBound: 145448, ratePct: 9.3 },
        ],
      },
    },
  },
}
