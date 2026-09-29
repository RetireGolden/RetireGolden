/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2028 that differ from the ones enacted for 2027 (./enacted2027.ts). Read by
 * `stateParamsFor` for 2028 and carried forward until a later enacted year
 * replaces them; each entry replaces only the fields it names.
 *
 * - Mississippi: Miss. Code Ann. 27-7-5(1)(b)(ii)5 (2025 H.B. 1), 3.5% above
 *   the $10,000 zero band for calendar year 2028 (`ms-27-7-5-rate-ramp`).
 * - Hawaii: HRS 235-2.4(a)(2)(G), a standard deduction of $9,000 single and
 *   $18,000 joint for taxable years beginning after December 31, 2027
 *   (`hi-hrs-235-2-4-a-2-g-to-i-standard-deduction-steps`). The 2027 rate
 *   tables stay in force until 2029.
 * - Rhode Island: 44-30-2.6(c)(3)(A)(I)(2)(ii), the high-income surtax at 2%
 *   on taxable income over $1,000,000 for 2028
 *   (`ri-44-30-2-6-high-income-surtax`). The statute indexes that threshold
 *   from 2028 on a 2026 base year; it is held at $1,000,000 until the Division
 *   of Taxation publishes it.
 * - Maryland: Tax-General 10-207(mm)(3)(IV), the first $18,000 of public-safety
 *   retirement income (`md-tg-10-207-mm-public-safety-retirement-subtraction`).
 * - Delaware: 30 Del. C. 1106(b)(3)d., the military pension subtraction at
 *   $20,000 (`de-code-30-1106-b-3-military-pension-steps-2027-2029`).
 * - Washington: ESSB 6346 (ch. 238, Laws of 2026): from January 1, 2028, 9.9%
 *   of Washington taxable income, which is federal AGI less long-term capital
 *   gains less a $1,000,000 standard deduction per individual or per couple
 *   (`wa-essb-6346-2028-income-tax`). The entry switches the tax on, includes
 *   the federally taxable share of Social Security, leaves capital gains out,
 *   and indexes the deduction as section 316 does: adjusted each October of an
 *   odd-numbered year from 2029 by one year's inflation, rounded to the nearest
 *   $1,000, for taxes due the next year, read as that year's own tax year, so
 *   from 2029 every second year
 *   (`wa-essb-6346-s316-standard-deduction-indexing`). Its direct-QCD policy
 *   conforms, because section 301 excludes whatever federal AGI excludes
 *   (`wa-essb-6346-s301-direct-qcd-conformity`). Initiative 645, on the
 *   November 3, 2026 ballot, would repeal the act; the entry is revisited when
 *   it is decided.
 * - Virginia: Va. Code 58.1-322.03(1)(b)(vii), a standard deduction of $9,300
 *   single and $18,600 married for taxable years beginning in 2028 and 2029
 *   (`va-code-58-1-322-03-standard-deduction-steps`).
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2028: StateEnactedYear = {
  year: 2028,
  states: {
    MS: {
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3.5 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3.5 }],
      },
    },
    HI: {
      standardDeduction: { single: 9000, marriedFilingJointly: 18000 },
    },
    RI: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.75 }, { lowerBound: 82050, ratePct: 4.75 }, { lowerBound: 186450, ratePct: 5.99 },
          { lowerBound: 1000000, ratePct: 7.99 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.75 }, { lowerBound: 82050, ratePct: 4.75 }, { lowerBound: 186450, ratePct: 5.99 },
          { lowerBound: 1000000, ratePct: 7.99 },
        ],
      },
    },
    VA: {
      standardDeduction: { single: 9300, marriedFilingJointly: 18600 },
    },
    MD: {
      marylandPublicSafetySubtraction: { amount: 18000, minAge: 55, planSystemCode: 'MD-PUBLIC-SAFETY' },
    },
    WA: {
      hasIncomeTax: true,
      taxesSocialSecurity: true,
      capitalGainsAsOrdinary: false,
      capitalGainsTaxablePct: 0,
      standardDeduction: { single: 1000000, marriedFilingJointly: 1000000 },
      standardDeductionStatutoryIndexing: { firstIndexedYear: 2029, intervalYears: 2, roundToNearest: 1000 },
      // Section 301: an item excluded from federal AGI is excluded from the
      // tax, so the IRC 408(d)(8) QCD exclusion carries
      // (`wa-essb-6346-s301-direct-qcd-conformity`).
      directQcdPolicy: {
        kind: 'conforms',
        citation: 'ESSB 6346 (chapter 238, Laws of 2026) section 301: an item excluded from federal adjusted gross income is excluded from the tax',
        effectiveTaxYears: { from: 2028 },
      },
      brackets: { single: [{ lowerBound: 0, ratePct: 9.9 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 9.9 }] },
    },
    DE: {
      delawareUnder60Pension: { ordinaryCap: 2000, militaryCap: 20000 },
      delawareMilitaryPension60Plus: { militaryCap: 20000 },
    },
  },
}
