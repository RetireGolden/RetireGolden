/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2033 that differ from the ones enacted for an earlier year. Read by
 * `stateParamsFor` for 2033 and carried forward; each entry replaces only the
 * fields it names.
 *
 * - North Carolina: S.L. 2026-41, section 44.1(a), rewriting G.S.
 *   105-153.7(a) to 2.99% for taxable years beginning after 2032
 *   (`nc-sl-2026-41-rate-steps-2030-and-after`). The rewritten (a1) revenue
 *   trigger can cut it further, a quarter point a year to a floor of 2.49%,
 *   from taxable years beginning in 2035, when General Fund revenue for the
 *   fiscal year named in its table exceeds the trigger amount; that is not
 *   loaded.
 * - New York: Tax Law 601(a) and (c), paragraph (ix) of each, for taxable years
 *   beginning after 2032: the lower bands keep the 2027 rates and the top band,
 *   above $2,155,350 joint and $1,077,550 single, falls from 9.65% to 8.82%,
 *   with no band above it (`ny-tax-601-2027-rate-cuts-and-2033-top-rate`).
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2033: StateEnactedYear = {
  year: 2033,
  states: {
    NC: {
      brackets: { single: [{ lowerBound: 0, ratePct: 2.99 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 2.99 }] },
    },
    NY: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.8 },
          { lowerBound: 8500, ratePct: 4.3, baseTax: 323 },
          { lowerBound: 11700, ratePct: 5.05, baseTax: 461 },
          { lowerBound: 13900, ratePct: 5.3, baseTax: 572 },
          { lowerBound: 80650, ratePct: 5.8, baseTax: 4110 },
          { lowerBound: 215400, ratePct: 6.85, baseTax: 11926 },
          { lowerBound: 1077550, ratePct: 8.82, baseTax: 70983 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.8 },
          { lowerBound: 17150, ratePct: 4.3, baseTax: 652 },
          { lowerBound: 23600, ratePct: 5.05, baseTax: 929 },
          { lowerBound: 27900, ratePct: 5.3, baseTax: 1146 },
          { lowerBound: 161550, ratePct: 5.8, baseTax: 8229 },
          { lowerBound: 323200, ratePct: 6.85, baseTax: 17605 },
          { lowerBound: 2155350, ratePct: 8.82, baseTax: 143107 },
        ],
      },
    },
  },
}
