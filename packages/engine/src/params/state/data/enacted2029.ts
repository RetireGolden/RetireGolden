/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2029 that differ from the ones enacted for an earlier year. Read by
 * `stateParamsFor` for 2029 and carried forward until a later enacted year
 * replaces them; each entry replaces only the fields it names.
 *
 * - Mississippi: Miss. Code Ann. 27-7-5(1)(b)(ii)6 (2025 H.B. 1), 3.25% above
 *   the $10,000 zero band for calendar year 2029 (`ms-27-7-5-rate-ramp`).
 * - Hawaii: HRS 235-51(a) to (c) as amended by Act 24, SLH 2026, the tables
 *   "In the case of any taxable year beginning after December 31, 2028" for a
 *   joint return, a head of household and a single filer: the bands up to
 *   7.2% widen again, the 7.6% band goes, and 13% applies above the same
 *   amounts as from 2027, with the statute's whole-dollar base tax on each band
 *   (`hi-act-24-2026-rate-schedules`). The standard deduction set for 2028
 *   stays until 2030.
 * - Rhode Island: 44-30-2.6(c)(3)(A)(I)(2)(iii), the high-income surtax at 3%
 *   on taxable income over $1,000,000 from 2029
 *   (`ri-44-30-2-6-high-income-surtax`), the threshold held at $1,000,000.
 * - Delaware: 30 Del. C. 1106(b)(3)e., the military pension subtraction at
 *   $25,000 from 2029 (`de-code-30-1106-b-3-military-pension-steps-2027-2029`).
 * - Illinois: 35 ILCS 5/204(b): the basic exemption returns to $1,000 when item
 *   (7), $2,050 plus the cost-of-living adjustment, ends with tax year 2028
 *   (`il-35-ilcs-5-204-b-basic-amount-1000-from-2029`); 2027 and 2028 are
 *   indexed and stand at the 2026 $2,925.
 * - Maryland: Tax-General 10-207(mm)(3)(V), the first $19,000 of public-safety
 *   retirement income (`md-tg-10-207-mm-public-safety-retirement-subtraction`).
 * - Colorado: C.R.S. 39-22-104(4)(y)(I) allows the military retirement
 *   subtraction under 55 only for income tax years before January 1, 2029, so
 *   it ends (`co-crs-39-22-104-4-y-military-retirement-subtraction`).
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2029: StateEnactedYear = {
  year: 2029,
  states: {
    MS: {
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3.25 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3.25 }],
      },
    },
    HI: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1.4 },
          { lowerBound: 19200, ratePct: 2.5, baseTax: 269 },
          { lowerBound: 24000, ratePct: 5, baseTax: 389 },
          { lowerBound: 36000, ratePct: 6.4, baseTax: 989 },
          { lowerBound: 48000, ratePct: 6.8, baseTax: 1757 },
          { lowerBound: 125000, ratePct: 7.2, baseTax: 6993 },
          { lowerBound: 175000, ratePct: 8.25, baseTax: 10593 },
          { lowerBound: 225000, ratePct: 9, baseTax: 14718 },
          { lowerBound: 275000, ratePct: 10, baseTax: 19218 },
          { lowerBound: 325000, ratePct: 11, baseTax: 24218 },
          { lowerBound: 500000, ratePct: 13, baseTax: 43468 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1.4 },
          { lowerBound: 38400, ratePct: 2.5, baseTax: 538 },
          { lowerBound: 48000, ratePct: 5, baseTax: 778 },
          { lowerBound: 72000, ratePct: 6.4, baseTax: 1978 },
          { lowerBound: 96000, ratePct: 6.8, baseTax: 3514 },
          { lowerBound: 250000, ratePct: 7.2, baseTax: 13986 },
          { lowerBound: 350000, ratePct: 8.25, baseTax: 21186 },
          { lowerBound: 450000, ratePct: 9, baseTax: 29436 },
          { lowerBound: 550000, ratePct: 10, baseTax: 38436 },
          { lowerBound: 650000, ratePct: 11, baseTax: 48436 },
          { lowerBound: 1000000, ratePct: 13, baseTax: 86936 },
        ],
      },
      bracketsHeadOfHousehold: [
        { lowerBound: 0, ratePct: 1.4 },
        { lowerBound: 28800, ratePct: 2.5, baseTax: 403 },
        { lowerBound: 36000, ratePct: 5, baseTax: 583 },
        { lowerBound: 54000, ratePct: 6.4, baseTax: 1483 },
        { lowerBound: 72000, ratePct: 6.8, baseTax: 2635 },
        { lowerBound: 187500, ratePct: 7.2, baseTax: 10489 },
        { lowerBound: 262500, ratePct: 8.25, baseTax: 15889 },
        { lowerBound: 337500, ratePct: 9, baseTax: 22077 },
        { lowerBound: 412500, ratePct: 10, baseTax: 28827 },
        { lowerBound: 487500, ratePct: 11, baseTax: 36327 },
        { lowerBound: 750000, ratePct: 13, baseTax: 65202 },
      ],
    },
    RI: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.75 }, { lowerBound: 82050, ratePct: 4.75 }, { lowerBound: 186450, ratePct: 5.99 },
          { lowerBound: 1000000, ratePct: 8.99 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.75 }, { lowerBound: 82050, ratePct: 4.75 }, { lowerBound: 186450, ratePct: 5.99 },
          { lowerBound: 1000000, ratePct: 8.99 },
        ],
      },
    },
    MD: {
      marylandPublicSafetySubtraction: { amount: 19000, minAge: 55, planSystemCode: 'MD-PUBLIC-SAFETY' },
    },
    DE: {
      delawareUnder60Pension: { ordinaryCap: 2000, militaryCap: 25000 },
      delawareMilitaryPension60Plus: { militaryCap: 25000 },
    },
    IL: {
      illinoisPersonalExemption: {
        basicAllowance: 1000,
        age65Addition: 1000,
        agiCutoffNonjoint: 250000,
        agiCutoffJoint: 500000,
      },
    },
    CO: {
      militaryRetirementExclusion: null,
    },
  },
}
