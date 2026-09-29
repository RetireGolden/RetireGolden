/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2032 that differ from the ones enacted for an earlier year. Read by
 * `stateParamsFor` for 2032 and carried forward; each entry replaces only the
 * fields it names, and a field named as `null` ends.
 *
 * - Oregon: Oregon Laws 2009, chapter 913, section 36, as amended by Oregon
 *   Laws 2025, chapter 562, section 5: the ORS 316.157 retirement income credit
 *   "may not be claimed" for tax years beginning on or after January 1, 2032
 *   (`or-laws-2009-c913-s36-retirement-credit-ends-2032`).
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2032: StateEnactedYear = {
  year: 2032,
  states: {
    OR: {
      oregonRetirementIncomeCredit: null,
    },
  },
}
