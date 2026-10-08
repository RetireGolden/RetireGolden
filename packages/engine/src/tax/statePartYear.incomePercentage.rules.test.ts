/**
 * Method (b), the income percentage, and its credit form: a part-year
 * resident's tax is the tax on the whole year's income as if resident, times
 * the resident-period income over the year's (`StateTaxParams.partYear`,
 * tax/stateTax.ts#computeSplitYearResult). The 2025 part-year or nonresident
 * instructions of each state, read for the derivation of 2026-10-07, give the
 * method; the ratio's basis is the one each form divides.
 *
 * One household throughout: single, 50, resident six months in the state
 * (January to June) and six in Texas, no Social Security.
 * - Even: $100,000 of ordinary income spread over the year. The ratio is one
 *   half on every basis, so the slice is half the full-year tax, the figure the
 *   months share already gave: none of these moves.
 * - Uneven: the same $100,000 and a $40,000 Roth conversion of a traditional
 *   IRA, dated March 15 (resident months) or September 15 (Texas months). The
 *   ratio is 90,000 / 140,000 = 9/14 or 50,000 / 140,000 = 5/14, except where
 *   the state's own exclusion reaches the conversion. Before 2026-10-08 the
 *   slice was the months share, half the full-year tax, wherever the
 *   conversion fell.
 *
 * Each full-year tax is worked by hand from the pack's 2026 rates and
 * deduction (params/state/data/year2026.ts), holding constant what the engine
 * does not model and what these inputs do not supply: no household facts, so
 * the exemptions and credits that need them are left out on both sides, as the
 * derivation's comparison left them.
 *
 *   state  T(100,000)   T(140,000)   uneven before   resident     Texas months
 *   AR     3,241.41     4,721.41     2,360.705       3,035.192    1,686.218
 *   CA     5,207.98     8,927.98     4,463.99        5,739.416    3,188.564
 *   CO     3,691.60     5,451.60     2,725.80        3,504.60     1,947.00
 *   CT     4,750.00     7,150.00     3,575.00        4,596.429    2,553.571
 *   DE     5,369.00     8,009.00     4,004.50        5,148.643    2,860.357
 *   IA     3,188.20     4,708.20     2,354.10        3,026.70     1,681.50
 *   KS     5,291.441    7,523.441    3,761.7205      4,836.498    2,686.943
 *   ME     5,507.75     8,932.767    4,466.383       5,742.493    3,190.274
 *   MN     5,276.605    8,156.94     4,078.47        5,243.747    2,913.193
 *   MO     3,762.668    5,642.668    2,821.334       3,627.429    2,015.239
 *   MT     4,289.10     6,549.10     3,274.55        4,210.136    2,338.964
 *   NC     3,481.275    5,077.275    2,538.6375      3,263.963    1,813.313
 *   ND       669.3375   1,449.3375     724.66875       931.717      517.621
 *   NE     3,846.456    5,666.456    2,833.228       3,642.722    2,023.734
 *   NM     3,569.10     5,529.10     2,764.55        3,554.421    1,974.679
 *   NY     4,859.75     7,219.75     3,609.875       4,641.268    2,578.482
 *   OH     2,365.625    3,465.625    1,732.8125      2,227.902    1,237.723
 *   OK     3,999.50     5,349.50     2,899.75        3,292.00     2,057.50
 *   OR     8,176.375   11,815.41     5,907.705       7,595.621    4,219.789
 *   RI     3,397.50     5,297.50     2,648.75        3,405.536    1,891.964
 *   UT     4,450.00     6,230.00     3,115.00        4,005.00     2,225.00
 *   VT     4,432.525    7,165.525    3,582.7625      4,606.409    2,559.116
 *   WV     3,782.50     5,614.50     2,807.25        3,609.321    2,005.179
 *   WI     4,464.6168   6,816.46     3,408.23        4,382.01     2,434.45
 *
 * Oklahoma's before is half of its full-year tax on the coarse path, which
 * never saw the conversion row: (140,000 - 6,350) over the schedule, 5,349.50 +
 * 10,000 x 4.5% = 5,799.50, halved, 2,899.75.
 */
import { describe, expect, it } from 'vitest'
import type { TaxYearInput } from '../projection/types.js'
import type { StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { computeStateTaxYearResult } from './stateTax.js'

function household(state: string, ordinaryIncome: number): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    agesAlive: [50],
    state,
    stateResidency: [{ state, months: 6 }, { state: 'TX', months: 6 }],
  }
}

const conversion = (distributionDate: string): StateRetirementDistributionFact => ({
  accountId: 'ira',
  ownerPersonId: 'p1',
  sourceKind: 'ira',
  federallyIncludedAmount: 40_000,
  grossDistribution: 40_000,
  rothConversionAmount: 40_000,
  accountTaxTreatment: 'traditional',
  recipientAgeYears: 50,
  recipientAgeKnown: true,
  cause: 'ordinary',
  earlyDistributionDisqualifier: 'false',
  distributionDate,
})

const even = (state: string) => computeStateTaxYearResult(household(state, 100_000)).totalTax
const uneven = (state: string, date: string) =>
  computeStateTaxYearResult(household(state, 140_000), { retirementDistributions: [conversion(date)] })

interface Case {
  state: string
  /** The full-year tax on $100,000, by hand. */
  full100k: number
  /** The full-year tax on $140,000 as a resident, by hand. */
  full140k: number
  /** The ratio with the conversion in the resident months, and in Texas's. */
  resident: number
  other: number
}

const NINE_FOURTEENTHS = 90_000 / 140_000
const FIVE_FOURTEENTHS = 50_000 / 140_000

// Each full-year tax: the taxable income (ordinary income less the pack's
// standard deduction), then the schedule.
const CASES: Case[] = [
  // AR1000NR line 38D: net tax times Arkansas AGI over total AGI. $2,470
  // deduction. 97,530: 5,600 x 2% = 112; 4,800 x 3% = 144; 10,400 x 3.4% =
  // 353.60; 71,130 x 3.7% = 2,631.81; 3,241.41. 137,530: the same to 26,400,
  // 111,130 x 3.7% = 4,111.81; 4,721.41. The $6,000 exclusion needs 59 1/2 for
  // an IRA, so the conversion takes none.
  { state: 'AR', full100k: 3_241.41, full140k: 4_721.41, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Form 540NR line 36, the tax rate on all income, times California taxable
  // income: the tax times CA AGI over total AGI. $5,706 deduction. 94,294:
  // 11,079 x 1% = 110.79; 15,185 x 2% = 303.70; 15,188 x 4% = 607.52; 16,090 x
  // 6% = 965.40; 15,182 x 8% = 1,214.56; 21,570 x 9.3% = 2,006.01; 5,207.98.
  // 134,294: 61,570 x 9.3% = 5,726.01 in the last band; 8,927.98.
  { state: 'CA', full100k: 5_207.98, full140k: 8_927.98, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Rule 39-22-110: the tax as a full-year resident times the Colorado ratio.
  // 4.4% of federal taxable income: (100,000 - 16,100) = 3,691.60; (140,000 -
  // 16,100) = 5,451.60. The pension subtraction starts at 55.
  { state: 'CO', full100k: 3_691.6, full140k: 5_451.6, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // CT-1040NR/PY: the tax as a resident, prorated by Connecticut-source
  // Connecticut AGI. No deduction; the IRA schedule subtracts nothing at
  // $140,000 of federal AGI. 100,000: 10,000 x 2% = 200; 40,000 x 4.5% = 1,800;
  // 50,000 x 5.5% = 2,750; 4,750. 140,000: 40,000 x 6% = 2,400 more; 7,150.
  { state: 'CT', full100k: 4_750, full140k: 7_150, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // PIT-NON lines 42 and 43: the tax on all income times the proration
  // decimal. $3,250 deduction. 96,750: 3,000 x 2.2% = 66; 5,000 x 3.9% = 195;
  // 10,000 x 4.8% = 480; 5,000 x 5.2% = 260; 35,000 x 5.55% = 1,942.50; 36,750 x
  // 6.6% = 2,425.50; 5,369. 136,750: 76,750 x 6.6% = 5,065.50 in the top band;
  // 8,009. The pension exclusion's ordinary limb starts at 60.
  { state: 'DE', full100k: 5_369, full140k: 8_009, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // IA 126: the credit for the non-Iowa percentage leaves the Iowa share of the
  // tax. 3.8% of (100,000 - 16,100) = 3,188.20; of 123,900 = 4,708.20. The
  // exclusion starts at 55.
  { state: 'IA', full100k: 3_188.2, full140k: 4_708.2, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // K-40 line 10: the tax times the Schedule S percentage. $3,605 deduction.
  // 96,395: 23,000 x 5.2% = 1,196; 73,395 x 5.58% = 4,095.441; 5,291.441.
  // 136,395: 113,395 x 5.58% = 6,327.441; 7,523.441.
  { state: 'KS', full100k: 5_291.441, full140k: 7_523.441, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Schedule NR: the tax less the credit for the non-Maine share keeps the
  // Maine share. $15,700 deduction, reduced above $102,250 by the share of
  // $75,000 the income exceeds it. 100,000: whole; 84,300 taxable: 27,400 x
  // 5.8% = 1,589.20; 37,450 x 6.75% = 2,527.875; 19,450 x 7.15% = 1,390.675;
  // 5,507.75. 140,000: (140,000 - 102,250) / 75,000 = 0.503333; deduction
  // 15,700 x 0.496667 = 7,797.667; 132,202.333 taxable: 67,352.333 x 7.15% =
  // 4,815.692 in the top band; 8,932.767. A conversion is not a pension
  // benefit, so the deduction does not reach it.
  { state: 'ME', full100k: 5_507.75, full140k: 8_932.767, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Schedule M1NR line 32: the tax on all income times line 30. $15,300
  // deduction. 84,700: 33,310 x 5.35% = 1,782.085; 51,390 x 6.8% = 3,494.52;
  // 5,276.605. 124,700: 76,120 x 6.8% = 5,176.16; 15,270 x 7.85% = 1,198.695;
  // 8,156.94.
  { state: 'MN', full100k: 5_276.605, full140k: 8_156.94, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // MO-NRI: the tax times the Missouri income percentage. $16,100 deduction.
  // The bands to 9,436: 26.96 + 33.70 + 40.44 + 47.18 + 53.92 + 60.66 =
  // 262.86. 83,900: 74,464 x 4.7% = 3,499.808; 3,762.668. 123,900: 114,464 x
  // 4.7% = 5,379.808; 5,642.668. The private pension deduction is income-tested
  // out at these incomes.
  { state: 'MO', full100k: 3_762.668, full140k: 5_642.668, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Form 2: the tax as a resident times Montana-source income over all income.
  // $16,100 deduction. 83,900: 47,500 x 4.7% = 2,232.50; 36,400 x 5.65% =
  // 2,056.60; 4,289.10. 123,900: 76,400 x 5.65% = 4,316.60; 6,549.10.
  { state: 'MT', full100k: 4_289.1, full140k: 6_549.1, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // D-401 line 13: the taxable percentage of the income, at a flat 3.99%: the
  // tax times the ratio. (100,000 - 12,750) x 3.99% = 3,481.275; 127,250 x
  // 3.99% = 5,077.275.
  { state: 'NC', full100k: 3_481.275, full140k: 5_077.275, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Schedule ND-1NR line 23: the tax times the line 20 ratio. $16,100
  // deduction, 0% to 49,575. 83,900: 34,325 x 1.95% = 669.3375. 123,900: 74,325
  // x 1.95% = 1,449.3375.
  { state: 'ND', full100k: 669.3375, full140k: 1_449.3375, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // 1040N and Schedule III: a percentage of the tax a resident owes. $8,850
  // deduction. 91,150: 4,130 x 2.46% = 101.598; 20,630 x 3.51% = 724.113; 66,390
  // x 4.55% = 3,020.745; 3,846.456. 131,150: 106,390 x 4.55% = 4,840.745;
  // 5,666.456.
  { state: 'NE', full100k: 3_846.456, full140k: 5_666.456, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // PIT-B: the tax on all income times New Mexico income over total. $16,100
  // deduction. 83,900: 5,500 x 1.5% = 82.50; 11,000 x 3.2% = 352; 17,000 x 4.3% =
  // 731; 33,000 x 4.7% = 1,551; 17,400 x 4.9% = 852.60; 3,569.10. 123,900:
  // 57,400 x 4.9% = 2,812.60; 5,529.10.
  { state: 'NM', full100k: 3_569.1, full140k: 5_529.1, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // IT-203 line 45: the base tax times the New York column over the federal
  // column. $8,000 deduction. 92,000: 8,500 x 3.9% = 331.50; 3,200 x 4.4% =
  // 140.80; 2,200 x 5.15% = 113.30; 66,750 x 5.4% = 3,604.50; 11,350 x 5.9% =
  // 669.65; 4,859.75. 132,000: 51,350 x 5.9% = 3,029.65; 7,219.75. The pension
  // exclusion starts at 59 1/2.
  { state: 'NY', full100k: 4_859.75, full140k: 7_219.75, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // IT NRC: the credit for the nonresident portion keeps the Ohio portion's
  // share. No deduction. 332 + (100,000 - 26,050) x 2.75% = 2,365.625; 332 +
  // 113,950 x 2.75% = 3,465.625.
  { state: 'OH', full100k: 2_365.625, full140k: 3_465.625, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // 511-NR line 18: the tax times Oklahoma AGI over all-source AGI. Oklahoma's
  // $10,000 retirement exclusion reaches the conversion and is not prorated,
  // so it comes off whichever column holds it. $6,350 deduction. 100,000:
  // 93,650 taxable: 1,150 x 2.5% = 28.75; 2,300 x 3.5% = 80.50; 86,450 x 4.5% =
  // 3,890.25; 3,999.50. 140,000 less the exclusion: 123,650 taxable, 116,450 x
  // 4.5% = 5,240.25 in the top band; 5,349.50. The ratio, on Oklahoma AGI:
  // resident (90,000 - 10,000) / 130,000 = 8/13; Texas months 50,000 /
  // 130,000 = 5/13.
  { state: 'OK', full100k: 3_999.5, full140k: 5_349.5, resident: 80_000 / 130_000, other: 50_000 / 130_000 },
  // OR-40-P line 45: the tax times the Oregon percentage. $2,910 deduction.
  // 97,090: 4,550 x 4.75% = 216.125; 6,850 x 6.75% = 462.375; 85,690 x 8.75% =
  // 7,497.875; 8,176.375. 137,090: 113,600 x 8.75% = 9,940; 12,090 x 9.9% =
  // 1,196.91; 11,815.41.
  { state: 'OR', full100k: 8_176.375, full140k: 11_815.41, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // RI-1040NR Schedule III: the tax times the Rhode Island ratio. $11,200
  // deduction. 88,800: 82,050 x 3.75% = 3,076.875; 6,750 x 4.75% = 320.625;
  // 3,397.50. 128,800: 46,750 x 4.75% = 2,220.625; 5,297.50. The pension
  // modification starts at 67.
  { state: 'RI', full100k: 3_397.5, full140k: 5_297.5, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // TC-40B: the tax times the line 39 decimal. 4.45% flat, no deduction:
  // 4,450 and 6,230.
  { state: 'UT', full100k: 4_450, full140k: 6_230, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // IN-113: IN-111 line 16 is the tax on all income times the line 35
  // percentage. $7,850 deduction (the exemption needs household facts). 92,150:
  // 50,750 x 3.35% = 1,700.125; 41,400 x 6.6% = 2,732.40; 4,432.525. 132,150:
  // 72,100 x 6.6% = 4,758.60; 9,300 x 7.6% = 706.80; 7,165.525.
  { state: 'VT', full100k: 4_432.525, full140k: 7_165.525, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // IT-140 Schedule A: the tax times West Virginia income over federal AGI. No
  // deduction. 100,000: 10,000 x 2.11% = 211; 15,000 x 2.81% = 421.50; 15,000 x
  // 3.16% = 474; 20,000 x 4.22% = 844; 40,000 x 4.58% = 1,832; 3,782.50.
  // 140,000: 80,000 x 4.58% = 3,664; 5,614.50.
  { state: 'WV', full100k: 3_782.5, full140k: 5_614.5, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
  // Form 1NPR: the sliding deduction on the year's federal income, the tax
  // times line 32, Wisconsin income over federal income. 100,000: deduction
  // 13,960 - 0.12 x (100,000 - 20,120) = 4,374.40; 95,625.60 taxable: 15,110 x
  // 3.5% = 528.85; 36,840 x 4.4% = 1,620.96; 43,675.60 x 5.3% = 2,314.8068;
  // 4,464.6168. 140,000: past $136,453 the deduction is zero; 88,050 x 5.3% =
  // 4,666.65 in the third band; 6,816.46. The 67+ subtraction does not apply.
  { state: 'WI', full100k: 4_464.6168, full140k: 6_816.46, resident: NINE_FOURTEENTHS, other: FIVE_FOURTEENTHS },
]

describe('method (b): the full-year tax times the income ratio', () => {
  it.each(CASES)('$state: even income is half the full-year tax, as the months share already was', ({ state, full100k }) => {
    expect(even(state)).toBeCloseTo(full100k / 2, 6)
  })

  it.each(CASES)('$state: a conversion in the resident months raises the ratio, in Texas’s lowers it', ({ state, full140k, resident, other }) => {
    const residentMonths = uneven(state, '2026-03-15')
    const texasMonths = uneven(state, '2026-09-15')
    expect(residentMonths.totalTax).toBeCloseTo(full140k * resident, 3)
    expect(texasMonths.totalTax).toBeCloseTo(full140k * other, 3)
    expect(residentMonths.partYear?.slices[0]).toMatchObject({ state, months: 6, method: 'incomePercentage' })
    expect(residentMonths.partYear?.slices[0]?.incomeRatio).toBeCloseTo(resident, 12)
    // The months share, which the year used to be, sits between the two.
    expect(texasMonths.totalTax).toBeLessThan(full140k / 2)
    expect(residentMonths.totalTax).toBeGreaterThan(full140k / 2)
  })
})
