/**
 * State income tax figures already enacted, without a condition, for tax year
 * 2027.
 *
 * The state packs are one per tax year, and until a 2027 pack exists the 2026
 * pack stands in for 2027 (see ../index.ts). Where a statute in force today
 * already sets a 2027 figure, the 2026 figure is knowably wrong, so the field
 * the statute sets is read as enacted for 2027 and, like any latest figure,
 * carried forward nominally until a later enacted year replaces it
 * (./enacted2028.ts to ./enacted2033.ts hold the later steps). A field an entry
 * does not name, and every state with no entry, still comes from the 2026 pack.
 *
 * This module holds what has been verified against the statutes. It is not a
 * claim that no other state has enacted a 2027 figure: the survey of all 51
 * jurisdictions, recorded state by state in
 * DOCS/domain/state-tax-research/later-years-survey-2026-09-28.md, covers the
 * rest.
 *
 * - Indiana: IC 6-3-2-1(b)(8), 2.9% for taxable years beginning after December
 *   31, 2026 and before January 1, 2030 (`ic-6-3-2-1-flat-rate-ramp`). The
 *   later steps, (b)(9) to (b)(15), are 0.05-point cuts that apply only on a
 *   budget agency determination under (e), so none is loaded and 2.9% is
 *   carried forward from 2030 ((b)(16) speaks only to years after 2043).
 * - Mississippi: Miss. Code Ann. 27-7-5(1)(b)(ii)4, 3.75% above the $10,000
 *   zero band for calendar year 2027 (`ms-27-7-5-rate-ramp`). The later steps,
 *   3.5% (2028), 3.25% (2029) and 3% (2030), are in the later modules.
 * - Montana: MCA 15-30-2103, the version effective January 1, 2027 (HB 337, Ch.
 *   227, L. 2025): 4.7% to $65,000 single and married filing separately,
 *   $97,500 head of household and $130,000 joint, 5.4% above, and the
 *   long-term capital-gain breaks at the same figures (3.0% / 4.1%).
 *   Subsection (3) indexes the breaks by the modified inflation factor, whose
 *   base is June 2026 CPI, so the factor for 2027 is exactly 1 and the first
 *   indexed breaks are 2028's (`mt-mca-15-30-2103-2027-rate-schedule`).
 * - Nebraska: Neb. Rev. Stat. 77-2715.03(2)(b)(iii) and (2)(c)(vi), 3.99% for
 *   rates three and four for taxable years beginning on or after January 1,
 *   2027 (`neb-rev-stat-77-2715-03-2027-rates-three-and-four`). The pack joins
 *   those two bands, as the 2026 pack did at 4.55%. The thresholds are indexed
 *   each year by the Tax Commissioner under (3) and the 2027 schedule is not
 *   published yet, so the 2026 thresholds stand in.
 * - North Carolina: S.L. 2026-41, section 44.1(a), rewriting G.S. 105-153.7(a)
 *   to 3.49% for taxable years beginning in 2027, 2028 and 2029
 *   (`nc-sl-2026-41-2027-flat-rate`). The act's later steps, 3.24% for 2030 to
 *   2032 and 2.99% after 2032, are in ./enacted2030.ts and ./enacted2033.ts.
 * - Hawaii: HRS 235-51(a) to (c) as amended by Act 24, SLH 2026 (S.B. 3125
 *   C.D. 2, approved May 21, 2026), the tables "In the case of any taxable year
 *   beginning after December 31, 2026" for a joint return, a head of household
 *   and a single filer (the single table also serves a married individual
 *   filing separately): 2.5% and 5% in the second and third bands, no 7.9%
 *   band, and 13% above $500,000 single, $1,000,000 joint and $750,000 head of
 *   household, with the statute's whole-dollar base tax on each band
 *   (`hi-act-24-2026-rate-schedules`). Act 24 replaced the Act 46, SLH 2024
 *   tables for 2027 and 2029 before either took effect. The 2029 tables are in
 *   ./enacted2029.ts, and the standard deduction steps in ./enacted2028.ts,
 *   ./enacted2030.ts and ./enacted2031.ts.
 * - New York: Tax Law 601(a) and (c), paragraph (viii) of each, for taxable
 *   years beginning after 2026 and before 2033: the five lowest rates fall by
 *   0.1 point to 3.80%, 4.30%, 5.05%, 5.30% and 5.80%, with the statute's base
 *   tax on each band (`ny-tax-601-2027-rate-cuts-and-2033-top-rate`). The
 *   10.30% and 10.90% bands above $5,000,000 and $25,000,000 are omitted, as
 *   in the 2026 pack. The top rate from 2033 is in ./enacted2033.ts.
 * - Rhode Island: 44-30-2.6(c)(3)(A)(I)(2) as added by 2026 H 7127 Sub A,
 *   Article 6, section 5: a 1% high-income surtax on Rhode Island taxable
 *   income over $1,000,000 for 2027, the same threshold for every filing
 *   status, carried as a band above the 5.99% band
 *   (`ri-44-30-2-6-high-income-surtax`). The lower bands are the 2026 indexed
 *   amounts, standing in until the Division of Taxation publishes 2027's. The
 *   2% and 3% steps are in ./enacted2028.ts and ./enacted2029.ts. The same
 *   section adds 44-30-12(c)(8)(ii): from 2027 the Social Security
 *   modification keeps its AGI test and drops the full-retirement-age test
 *   (`ri-h7127-2027-social-security-modification-without-age-test`); the
 *   limits are the latest published, standing in.
 * - Georgia: O.C.G.A. 48-7-27(a)(5)(A)(xiv) as added by HB 463 (2026), section
 *   2-3: a retirement income exclusion of $70,000 for each taxpayer 65 or older
 *   for taxable years beginning on or after January 1, 2027, up from $65,000
 *   (`ga-hb-463-2027-retirement-exclusion`). Georgia's rate is not changed:
 *   HB 463 cuts it 0.125 point from January 1, 2027 unless the Office of
 *   Planning and Budget's test "as of December 1" delays it, and its standard
 *   deduction steps carry the same delay, so both price 2027 at their 2026
 *   figures until that determination.
 * - Maryland: Tax-General 10-207(mm)(3)(III) as amended by 2026 Md. Laws ch.
 *   686, the first $17,000 of public-safety retirement income at 55 or older
 *   (`md-tg-10-207-mm-public-safety-retirement-subtraction`); $18,000, $19,000
 *   and $20,000 follow in 2028, 2029 and 2030.
 * - Delaware: 30 Del. C. 1106(b)(3)c. as amended by S.B. 219 (85 Del. Laws c.
 *   426): the military pension subtraction is $15,000 under 60 and, as a
 *   greater-of limb, at 60 and over (`de-code-30-1106-b-3-military-pension-steps-2027-2029`);
 *   $20,000 for 2028 and $25,000 from 2029.
 * - Maine: 36 M.R.S. 5124-C(1-D), enacted by P.L. 2025, c. 650, Pt. K: the
 *   standard deduction equals the federal one from 2027, so the entry tags it
 *   federal at the 2026 federal figures, which the projection's inflation
 *   scale moves, and ends the separate age-addition tag the whole-federal tag
 *   already implies (`me-pl-2025-c650-k-15-federal-standard-deduction-from-2027`).
 * - Virginia: Va. Code 58.1-322.03(1)(b)(vi), a standard deduction of $9,200
 *   single and $18,400 married for taxable years beginning in 2027
 *   (`va-code-58-1-322-03-standard-deduction-steps`). The 2028 and 2030 steps
 *   are in ./enacted2028.ts and ./enacted2030.ts.
 *
 * Montana and Nebraska have no later rate step: MT's 2027 schedule continues,
 * its breaks indexed from 2028, and NE's 3.99% applies "on or after January 1,
 * 2027".
 *
 * Not loaded, because the 2027 rate depends on a determination not yet made:
 * Georgia (above) and South Carolina (the 2027 reduction is set by the Board
 * of Economic Advisors forecast "in effect on February fifteenth"). Both price
 * 2027 at their 2026 rates until the determination is published.
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateEnactedYear } from '../types.js'

export const stateEnacted2027: StateEnactedYear = {
  year: 2027,
  states: {
    IN: {
      brackets: { single: [{ lowerBound: 0, ratePct: 2.9 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 2.9 }] },
    },
    MS: {
      brackets: {
        single: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3.75 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 0 }, { lowerBound: 10000, ratePct: 3.75 }],
      },
    },
    MT: {
      brackets: {
        single: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 65000, ratePct: 5.4 }],
        marriedFilingJointly: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 130000, ratePct: 5.4 }],
      },
      bracketsHeadOfHousehold: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 97500, ratePct: 5.4 }],
      bracketsMarriedFilingSeparately: [{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 65000, ratePct: 5.4 }],
      montanaLtcg: {
        lowerRate: 0.03,
        upperRate: 0.041,
        thresholdSingle: 65000,
        thresholdHoh: 97500,
        thresholdJoint: 130000,
      },
    },
    NE: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 2.46 }, { lowerBound: 4130, ratePct: 3.51 }, { lowerBound: 24760, ratePct: 3.99 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 2.46 }, { lowerBound: 8250, ratePct: 3.51 }, { lowerBound: 49530, ratePct: 3.99 },
        ],
      },
    },
    NC: {
      brackets: { single: [{ lowerBound: 0, ratePct: 3.49 }], marriedFilingJointly: [{ lowerBound: 0, ratePct: 3.49 }] },
    },
    HI: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 1.4 },
          { lowerBound: 14400, ratePct: 2.5, baseTax: 202 },
          { lowerBound: 19200, ratePct: 5, baseTax: 322 },
          { lowerBound: 24000, ratePct: 6.4, baseTax: 562 },
          { lowerBound: 36000, ratePct: 6.8, baseTax: 1330 },
          { lowerBound: 48000, ratePct: 7.2, baseTax: 2146 },
          { lowerBound: 125000, ratePct: 7.6, baseTax: 7690 },
          { lowerBound: 175000, ratePct: 8.25, baseTax: 11490 },
          { lowerBound: 225000, ratePct: 9, baseTax: 15615 },
          { lowerBound: 275000, ratePct: 10, baseTax: 20115 },
          { lowerBound: 325000, ratePct: 11, baseTax: 25115 },
          { lowerBound: 500000, ratePct: 13, baseTax: 44365 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 1.4 },
          { lowerBound: 28800, ratePct: 2.5, baseTax: 403 },
          { lowerBound: 38400, ratePct: 5, baseTax: 643 },
          { lowerBound: 48000, ratePct: 6.4, baseTax: 1123 },
          { lowerBound: 72000, ratePct: 6.8, baseTax: 2659 },
          { lowerBound: 96000, ratePct: 7.2, baseTax: 4291 },
          { lowerBound: 250000, ratePct: 7.6, baseTax: 15379 },
          { lowerBound: 350000, ratePct: 8.25, baseTax: 22979 },
          { lowerBound: 450000, ratePct: 9, baseTax: 31229 },
          { lowerBound: 550000, ratePct: 10, baseTax: 40229 },
          { lowerBound: 650000, ratePct: 11, baseTax: 50229 },
          { lowerBound: 1000000, ratePct: 13, baseTax: 88729 },
        ],
      },
      bracketsHeadOfHousehold: [
        { lowerBound: 0, ratePct: 1.4 },
        { lowerBound: 21600, ratePct: 2.5, baseTax: 302 },
        { lowerBound: 28800, ratePct: 5, baseTax: 482 },
        { lowerBound: 36000, ratePct: 6.4, baseTax: 842 },
        { lowerBound: 54000, ratePct: 6.8, baseTax: 1994 },
        { lowerBound: 72000, ratePct: 7.2, baseTax: 3218 },
        { lowerBound: 187500, ratePct: 7.6, baseTax: 11534 },
        { lowerBound: 262500, ratePct: 8.25, baseTax: 17234 },
        { lowerBound: 337500, ratePct: 9, baseTax: 23422 },
        { lowerBound: 412500, ratePct: 10, baseTax: 30172 },
        { lowerBound: 487500, ratePct: 11, baseTax: 37672 },
        { lowerBound: 750000, ratePct: 13, baseTax: 66547 },
      ],
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
          { lowerBound: 1077550, ratePct: 9.65, baseTax: 70983 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.8 },
          { lowerBound: 17150, ratePct: 4.3, baseTax: 652 },
          { lowerBound: 23600, ratePct: 5.05, baseTax: 929 },
          { lowerBound: 27900, ratePct: 5.3, baseTax: 1146 },
          { lowerBound: 161550, ratePct: 5.8, baseTax: 8229 },
          { lowerBound: 323200, ratePct: 6.85, baseTax: 17605 },
          { lowerBound: 2155350, ratePct: 9.65, baseTax: 143107 },
        ],
      },
    },
    RI: {
      brackets: {
        single: [
          { lowerBound: 0, ratePct: 3.75 }, { lowerBound: 82050, ratePct: 4.75 }, { lowerBound: 186450, ratePct: 5.99 },
          { lowerBound: 1000000, ratePct: 6.99 },
        ],
        marriedFilingJointly: [
          { lowerBound: 0, ratePct: 3.75 }, { lowerBound: 82050, ratePct: 4.75 }, { lowerBound: 186450, ratePct: 5.99 },
          { lowerBound: 1000000, ratePct: 6.99 },
        ],
      },
      rhodeIslandSocialSecurityModification: { nonjointAgiLimit: 107000, jointAgiLimit: 133750 },
    },
    GA: {
      retirementPrivate: { kind: 'capped', capPerPerson: 70000, minAge: 65 },
      retirementPublic: { kind: 'capped', capPerPerson: 70000, minAge: 65 },
    },
    VA: {
      standardDeduction: { single: 9200, marriedFilingJointly: 18400 },
    },
    MD: {
      marylandPublicSafetySubtraction: { amount: 17000, minAge: 55, planSystemCode: 'MD-PUBLIC-SAFETY' },
    },
    DE: {
      delawareUnder60Pension: { ordinaryCap: 2000, militaryCap: 15000 },
      delawareMilitaryPension60Plus: { militaryCap: 15000 },
    },
    ME: {
      standardDeduction: { single: 16100, marriedFilingJointly: 32200 },
      standardDeductionConformity: 'federal',
      standardDeductionAge65AdditionConformity: null,
    },
  },
}
