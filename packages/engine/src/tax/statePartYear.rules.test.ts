/**
 * A part-year resident's slice of a split year, priced by the state's own
 * part-year method (`StateTaxParams.partYear`, tax/stateTax.ts#computeSplitYearResult).
 * This file holds the resident-period states, method (a); the income-percentage
 * states are in ./statePartYear.incomePercentage.rules.test.ts.
 *
 * One household throughout: single, 50, $100,000 of ordinary income spread
 * evenly over 2026, resident six months in the state and six in Texas. Even
 * income makes the months ratio equal to every income ratio the forms use, so
 * the readings differ only in the method. The 2025 part-year or nonresident
 * instructions of each state, read on 2026-10-07, give the method.
 *
 * Until 2026-10-07 every state but Virginia scaled its brackets, zero band and
 * standard deduction with the months, which is the months share of a full-year
 * resident's tax. A state whose part-year return taxes the resident-period
 * income on its ordinary schedule keeps the schedule whole; Arizona, Louisiana,
 * Kentucky and Alabama also allow the whole standard deduction. Wisconsin takes
 * the tax on the whole year's income, its sliding deduction phased on that
 * income, times its income ratio (method (b) since 2026-10-08).
 *
 * Each figure is the $50,000 slice worked by hand from the pack's 2026 rates
 * and deduction, holding constant what the engine does not model (named in
 * each case):
 *
 *   state  before (months share)   after        method
 *   NJ     2,090.025               1,242.375    ordinary table, exemption by months
 *   HI     2,941.60                2,395.20     ordinary table, deduction by ratio
 *   SC     1,731.25                1,248.25     ordinary table, deduction by ratio
 *   DC     2,812.50                2,362.50     ordinary table, deduction by days
 *   MS     1,754.00                1,554.00     zero band whole, deduction by ratio
 *   ID     2,095.8585              1,968.367    zero band whole, deduction by ratio
 *   MD     2,268.00                2,241.75     ordinary schedule, deduction by ratio
 *   AZ     1,053.125                 856.25     whole deduction
 *   LA     1,306.875               1,113.75     whole deduction
 *   KY     1,691.20                1,632.40     whole deduction
 *   AL     2,405.00                2,310.00     ordinary schedule, whole deduction
 *   WI     1,798.3868              2,232.3084   full-year tax times the ratio
 *
 * From 2026-10-08 a slice is the income the months resident received, not the
 * months share of the year's income, and it receives the year's household
 * facts. With even income and none supplied, every figure above stands.
 */
import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTaxYearResult, computeStateTaxYearTotal } from './stateTax.js'

/** The household, resident six months in `state` and six in Texas. */
function sixMonths(state: string): TaxYearInput {
  return {
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome: 100_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    agesAlive: [50],
    state,
    stateResidency: [{ state, months: 6 }, { state: 'TX', months: 6 }],
  }
}

const partYear = (state: string, mapParams?: (params: StateTaxParams) => StateTaxParams): number =>
  computeStateTaxYearTotal(sixMonths(state), mapParams === undefined ? {} : { mapParams })

describeRule('nj-stat-54a-3-1-personal-exemptions', {
  note: 'the ordinary table for a part-year resident',
  readings: {
    // NJ-1040 (2025 instructions): there is no part-year return; NJ-1040
    // taxes the income received while resident on the ordinary table, and
    // 54A:3-1(c) limits the exemptions to the months resident. $1,000 x 6/12
    // = $500; 49,500 taxable: 20,000 x 1.4% = 280; 15,000 x 1.75% = 262.50;
    // 5,000 x 3.5% = 175; 9,500 x 5.525% = 524.875. Total 1,242.375. The
    // engine prices the rate schedule, not the $50-wide table rows.
    nj1040ResidentPeriod: 1_242.375,
    // The whole $1,000 on the same table: 1,242.375 - 500 x 5.525%.
    wholeExemption: 1_214.75,
    // The table halved (edges 10,000, 17,500, 20,000, 37,500): 140 + 131.25
    // + 87.50 + 966.875 + 12,000 x 6.37% = 2,090.025.
    monthsShareOfFullYearTax: 2_090.025,
  },
  accepted: 'nj1040ResidentPeriod',
}, ({ accepted }) => {
  it('taxes the resident-period income on the ordinary table, exemption by months', () => {
    expect(partYear('NJ')).toBeCloseTo(accepted, 6)
  })
})

describeRule('hi-hrs-235-2-4-a-2-f-2026-standard-deduction', {
  note: 'a part-year resident',
  readings: {
    // Form N-15: line 40b, $8,000 x the line 37 ratio = 4,000; line 44, the
    // ordinary table on 46,000: 9,600 x 1.4% = 134.40; 4,800 x 3.2% = 153.60;
    // 4,800 x 5.5% = 264; 4,800 x 6.4% = 307.20; 12,000 x 6.8% = 816;
    // 10,000 x 7.2% = 720. Total 2,395.20. Exemptions are not modeled.
    formN15: 2_395.2,
    // The whole $8,000 on the same table: 42,000 taxable, 6,000 at 7.2%.
    wholeDeduction: 2_107.2,
    // Deduction and table both halved.
    monthsShareOfFullYearTax: 2_941.6,
  },
  accepted: 'formN15',
}, ({ accepted }) => {
  it('prorates the deduction and keeps the ordinary table', () => {
    expect(partYear('HI')).toBeCloseTo(accepted, 6)
  })
})

describeRule('dc-code-47-1801-04-3a-standard-deduction-2026-2029', {
  note: 'a part-year resident',
  readings: {
    // D-40 (2025 booklet): the income of the period domiciled in DC, the
    // standard deduction by days (Calculation C; the engine prorates by
    // months, here the same half). 15,000 / 2 = 7,500; 42,500 taxable:
    // 10,000 x 4% = 400; 30,000 x 6% = 1,800; 2,500 x 6.5% = 162.50.
    d40ResidentPeriod: 2_362.5,
    // The whole $15,000: 35,000 taxable, 400 + 25,000 x 6% = 1,900.
    wholeDeduction: 1_900,
    monthsShareOfFullYearTax: 2_812.5,
  },
  accepted: 'd40ResidentPeriod',
}, ({ accepted }) => {
  it('prorates the deduction and keeps the ordinary schedule', () => {
    expect(partYear('DC')).toBeCloseTo(accepted, 6)
  })
})

describeRule('ms-27-7-5-rate-ramp', {
  note: 'the zero band of a part-year resident',
  readings: {
    // Form 80-100 (2025 instructions): the deductions times the line 13c
    // Mississippi AGI ratio, $2,300 / 2 = 1,150, and the ordinary schedule
    // with its whole $10,000 zero band: (48,850 - 10,000) x 4% = 1,554.
    // The $6,000 personal exemption is not modeled
    // (ms-27-7-21-personal-and-age-65-exemptions).
    form80100: 1_554,
    // The zero band halved to $5,000: 43,850 x 4% = 1,754.
    zeroBandHalved: 1_754,
    // The whole deduction with the whole band: 37,700 x 4% = 1,508.
    wholeDeduction: 1_508,
  },
  accepted: 'form80100',
}, ({ accepted }) => {
  it('keeps the whole $10,000 zero band', () => {
    expect(partYear('MS')).toBeCloseTo(accepted, 6)
  })
})

describeRule('ars-43-1041-standard-deduction-published-amount', {
  note: 'a part-year resident',
  readings: {
    // Form 140PY (2025 instructions): "The standard deduction is not
    // prorated"; line 56 is 2.5% of the line 55 taxable income.
    // (50,000 - 15,750) x 2.5% = 856.25.
    form140PY: 856.25,
    // (50,000 - 7,875) x 2.5%.
    deductionHalved: 1_053.125,
  },
  accepted: 'form140PY',
}, ({ accepted }) => {
  it('allows the whole standard deduction', () => {
    expect(partYear('AZ')).toBeCloseTo(accepted, 6)
  })
})

describeRule('la-ldr-it540es-2026-standard-deduction', {
  note: 'a part-year resident',
  readings: {
    // Form IT-540B (2025): line 10 enters the whole standard deduction, line
    // 11E prorates only the itemized excess, line 13 taxes at 3%.
    // (50,000 - 12,875) x 3% = 1,113.75.
    formIT540B: 1_113.75,
    // (50,000 - 6,437.50) x 3%.
    deductionHalved: 1_306.875,
  },
  accepted: 'formIT540B',
}, ({ accepted }) => {
  it('allows the whole standard deduction', () => {
    expect(partYear('LA')).toBeCloseTo(accepted, 6)
  })
})

describeRule('ky-dor-2026-standard-deduction-once-per-return', {
  note: 'a part-year resident',
  readings: {
    // 2025 Form 740-NP Schedule A instructions: the standard deduction "does
    // not have to be prorated". (50,000 - 3,360) x 3.5% = 1,632.40.
    form740NP: 1_632.4,
    // (50,000 - 1,680) x 3.5%.
    deductionHalved: 1_691.2,
  },
  accepted: 'form740NP',
}, ({ accepted }) => {
  it('allows the whole standard deduction', () => {
    expect(partYear('KY')).toBeCloseTo(accepted, 6)
  })
})

describeRule('al-dor-individual-income-tax-rate-schedule', {
  note: 'a part-year resident',
  readings: {
    // Form 40 and 40NR (2025 booklets): the part-year Form 40 carries the
    // resident-period income and the whole standard deduction and
    // exemptions, on the ordinary schedule. 50,000 - 3,000 = 47,000:
    // 500 x 2% = 10; 2,500 x 4% = 100; 44,000 x 5% = 2,200. Total 2,310.
    // The deduction is the pack's $3,000 (the chart's slide is
    // al-form40-standard-deduction-agi-slide); exemptions are not modeled
    // (al-form40-personal-and-dependent-exemptions-not-modeled).
    form40ResidentPeriod: 2_310,
    // The deduction halved on the ordinary schedule: 48,500 taxable, 2,275
    // at 5%, 2,385.
    deductionHalved: 2_385,
    // Deduction and schedule halved (edges 250 and 1,500): 5 + 50 + 47,000
    // x 5% = 2,405.
    monthsShareOfFullYearTax: 2_405,
  },
  accepted: 'form40ResidentPeriod',
}, ({ accepted }) => {
  it('keeps the schedule and the whole deduction', () => {
    expect(partYear('AL')).toBeCloseTo(accepted, 6)
  })
})

// Maryland's deduction is approximated: the engine carries $3,400 single, the
// Comptroller's estimated-tax worksheet prints $3,350. The part-year method is
// the same under both: Form 502 "P" (Tax Tip #52) multiplies the deduction by
// the Maryland income factor and taxes the result on the ordinary schedule
// (2% / 3% / 4% on the first three $1,000, then 4.75%).
describeRule('md-tg-10-217-2026-indexed-standard-deduction', {
  readings: {
    // 3,350 / 2 = 1,675; 48,325 taxable; 90 + 45,325 x 4.75% = 2,242.9375.
    comptrollerWorksheetByIncomeFactor: 2_242.9375,
    // 3,400 / 2 = 1,700; 48,300 taxable; 90 + 45,300 x 4.75% = 2,241.75.
    withholdingGuideByIncomeFactor: 2_241.75,
    // The schedule halved too (edges 500, 1,000, 1,500): 45 + 46,800 x
    // 4.75% = 2,268.
    monthsShareOfFullYearTax: 2_268,
  },
  accepted: 'comptrollerWorksheetByIncomeFactor',
  produced: 'withholdingGuideByIncomeFactor',
  note: 'a part-year resident',
}, ({ accepted, produced, readings }) => {
  it('prorates the deduction by the income factor and keeps the ordinary schedule', () => {
    expect(partYear('MD')).toBeCloseTo(produced, 6)
    expect(partYear('MD')).not.toBeCloseTo(accepted, 6)
    expect(partYear('MD')).not.toBeCloseTo(readings.monthsShareOfFullYearTax, 6)
  })
})

describeRule('wi-2026-rates-standard-deduction-exemptions', {
  note: 'a part-year resident',
  readings: {
    // Form 1NPR (2025 instructions): the deduction is looked up on the year's
    // federal income (the Standard Deduction Table, by line 31) and the tax
    // prorated by the line 32 ratio.
    // Deduction at $100,000: 13,960 - 0.12 x (100,000 - 20,120) = 4,374.40;
    // taxable 95,625.60; tax 15,110 x 3.5% = 528.85, 36,840 x 4.4% =
    // 1,620.96, 43,675.60 x 5.3% = 2,314.8068: 4,464.6168. Half: 2,232.3084.
    // The exemptions need household facts, which this household does not
    // supply (statePartYear.householdFacts.rules.test.ts supplies them).
    form1NPR: 2_232.3084,
    // The slice's own $50,000 on the halved schedule: deduction 13,960 -
    // 0.12 x 29,880 = 10,374.40; 39,625.60 taxable; 7,555 x 3.5% = 264.425,
    // 18,420 x 4.4% = 810.48, 13,650.60 x 5.3% = 723.4818: 1,798.3868.
    deductionPhasedOnTheSlice: 1_798.3868,
  },
  accepted: 'form1NPR',
}, ({ accepted }) => {
  it('takes the full-year tax, the deduction phased on the year, times the ratio', () => {
    expect(partYear('WI')).toBeCloseTo(accepted, 6)
  })
})

describeRule('id-form-43-part-year-resident-period', {
  readings: {
    // Form 43 (2025): lines 38 and 39 multiply the deduction by the Idaho
    // percentage; the line 42 worksheet subtracts the whole $4,811 before
    // 5.3%. 16,100 / 2 = 8,050; 41,950 - 4,811 = 37,139; x 5.3% = 1,968.367.
    form43: 1_968.367,
    // The zero band halved to 2,405.50: 39,544.50 x 5.3% = 2,095.8585.
    zeroBandHalved: 2_095.8585,
    // The whole deduction: (50,000 - 16,100 - 4,811) x 5.3% = 1,541.717.
    wholeDeduction: 1_541.717,
  },
  accepted: 'form43',
}, ({ accepted }) => {
  it('prorates the deduction and keeps the whole zero band', () => {
    expect(partYear('ID')).toBeCloseTo(accepted, 6)
  })
})

// South Carolina's SCIAD phases on federal AGI, a household fact. Without the
// facts the slice deducts the pack's unphased $15,000 and the year is
// incomplete; from 2026-10-08 the slice receives the year's facts, as the
// projection supplies them, and the SCIAD phases on the year's federal AGI.
describe('a part-year resident of South Carolina', () => {
  it('Schedule NR prorates the deduction and taxes on the ordinary table', () => {
    // 2025 Schedule NR: line 45 is the Column B / Column A proration, line 47
    // applies it to the deduction, line 48 goes to SC1040 line 5 and the
    // ordinary table. 15,000 / 2 = 7,500; 42,500 taxable: 30,000 x 1.99% =
    // 597; 12,500 x 5.21% = 651.25. Total 1,248.25. Before: 1,731.25 (the
    // schedule's $30,000 edge halved). With the SCIAD phased out on the year's
    // $100,000: 50,000 taxable, 597 + 20,000 x 5.21% = 1,639.00.
    expect(partYear('SC')).toBeCloseTo(1_248.25, 6)
  })

  it('phases the SCIAD on the year’s federal AGI when the household facts are supplied', () => {
    // Act 110: the $15,000 SCIAD for a single filer phases out from $40,000
    // of federal AGI over $55,000, to nothing at $95,000. At the year's
    // $100,000 it is zero, so the line 45 ratio has nothing to prorate: the
    // $50,000 slice on the ordinary table, 597 + 20,000 x 5.21% = 1,639.00.
    const result = computeStateTaxYearResult(sixMonths('SC'), { householdFacts: { stateFilingStatus: 'single', federalAgi: 100_000 } })
    expect(result.totalTax).toBeCloseTo(1_639, 6)
    expect(result.status).toBe('complete')
  })
})

// The descriptor's `full` branches, through a pack mapped for the test: they
// price what a state allowing the whole amount would owe.
describe('part-year descriptor: a whole exemption or deduction', () => {
  it('allows New Jersey’s whole $1,000 when the exemptions are marked full', () => {
    // 49,000 on the ordinary table: 1,242.375 - 500 x 5.525% = 1,214.75.
    const whole = partYear('NJ', (params) => ({ ...params, partYear: { ...params.partYear!, exemptions: 'full' } }))
    expect(whole).toBeCloseTo(1_214.75, 6)
  })
})

/**
 * The resident-period states again, with the income uneven: the same $100,000
 * and a $40,000 Roth conversion of a traditional IRA dated March 15, in the
 * state's six months, or September 15, in Texas's. The slice is the income the
 * months resident received (tax/statePartYear.ts): 90,000 or 50,000. A
 * deduction or exemption prorated by an income ratio takes 90,000 / 140,000 =
 * 9/14 or 5/14 of the whole year's amount, on federal AGI items or on the
 * state's own income where the form divides that. Before 2026-10-08 the slice
 * took half the year's income and so half the conversion, wherever it fell.
 *
 *   state  before      resident     Texas months   how
 *   AL     3,310.00    4,310.00     2,310.00       87,000 / 47,000 taxable at 5% above 3,000
 *   AZ     1,356.25    1,856.25       856.25       (90,000 - 15,750) x 2.5%
 *   DC     3,712.50    5,412.50     2,362.50       82,500: 400 + 1,800 + 1,300 + 22,500 x 8.5%
 *   GA     3,118.75    4,009.821    2,227.679      (90,000 - 15,000 x 9/14) x 4.99%
 *   HI     3,907.20    5,340.343    2,477.486      deduction 8,000 x 9/14 = 5,142.857
 *   ID     3,028.367   3,966.467    2,090.267      (90,000 - 16,100 x 9/14 - 4,811) x 5.3%
 *   IL     3,465.00    2,475.00     2,475.00       the IRA subtraction takes the conversion
 *   IN     2,065.00    2,655.00     1,475.00       90,000 x 2.95%
 *   KY     2,332.40    1,943.55     1,632.40       the whole $31,110 on the resident period's receipts
 *   LA     1,713.75    2,313.75     1,113.75       (90,000 - 12,875) x 3%
 *   MD     3,191.75    4,118.679    2,264.821      deduction 3,400 x 9/14 = 2,185.714
 *   MA     3,500.00    4,500.00     2,500.00       90,000 x 5%
 *   MI     2,975.00    3,825.00     2,125.00       90,000 x 4.25%
 *   MS     2,354.00    1,554.00     1,554.00       the retirement exclusion takes the conversion
 *   NJ     2,347.375   3,574.90     1,242.375      89,500 on the table
 *   PA     2,149.00    1,535.00     1,535.00       a conversion is not taxable
 *   SC     2,290.25    3,064.307    1,359.893      deduction 15,000 x 9/14, $3,000 retirement deduction
 *   VA     3,489.20    4,567.325    2,411.075      deduction 8,750 x 9/14 = 5,625, exemption 465
 */
describe('method (a) with the income uneven: the slice is the income the months resident received', () => {
  const conversion = (distributionDate: string) => ({
    retirementDistributions: [{
      accountId: 'ira', ownerPersonId: 'p1', sourceKind: 'ira' as const, federallyIncludedAmount: 40_000,
      grossDistribution: 40_000, rothConversionAmount: 40_000, accountTaxTreatment: 'traditional' as const,
      recipientAgeYears: 50, recipientAgeKnown: true, cause: 'ordinary' as const,
      earlyDistributionDisqualifier: 'false' as const, distributionDate,
    }],
  })
  const uneven = (state: string, date: string) =>
    computeStateTaxYearTotal({ ...sixMonths(state), ordinaryIncome: 140_000 }, conversion(date))

  it.each([
    // 90,000 - 3,000 = 87,000: 500 x 2% = 10; 2,500 x 4% = 100; 84,000 x 5% =
    // 4,200. The $6,000 exclusion starts at 65.
    ['AL', 4_310, 2_310],
    // (90,000 - 15,750) x 2.5%; (50,000 - 15,750) x 2.5%.
    ['AZ', 1_856.25, 856.25],
    // Deduction 15,000 x 6/12 = 7,500 either way (Calculation C, by days, here
    // months). 82,500: 400 + 1,800 + 20,000 x 6.5% = 1,300 + 22,500 x 8.5% =
    // 1,912.50; 5,412.50.
    ['DC', 5_412.5, 2_362.5],
    // Schedule 3 line 9, Georgia income over federal income: 9/14 and 5/14 of
    // the $15,000. (90,000 - 9,642.857) x 4.99% = 4,009.821; (50,000 -
    // 5,357.143) x 4.99% = 2,227.679. The exclusion starts at 62.
    ['GA', 4_009.821, 2_227.679],
    // N-15 line 37: Hawaii AGI over total AGI; Hawaii taxes the IRA conversion.
    // 90,000 - 8,000 x 9/14 = 84,857.143: 134.40 + 153.60 + 264 + 307.20 + 816
    // + 12,000 x 7.2% = 864 + 36,857.143 x 7.6% = 2,801.143; 5,340.343.
    // 50,000 - 2,857.143 = 47,142.857: to 36,000, 1,675.20; 11,142.857 x 7.2% =
    // 802.286; 2,477.486.
    ['HI', 5_340.343, 2_477.486],
    // Form 43 line 38: (90,000 - 16,100 x 9/14 - 4,811) x 5.3% = (90,000 -
    // 10,350 - 4,811) x 5.3% = 3,966.467; (50,000 - 5,750 - 4,811) x 5.3% =
    // 2,090.267.
    ['ID', 3_966.467, 2_090.267],
    // Illinois subtracts IRA distributions, a conversion among them, received
    // while a resident; the slice is $50,000 at 4.95% either way.
    ['IL', 2_475, 2_475],
    ['IN', 2_655, 1_475],
    // The $3,360 deduction whole; the $31,110 pension exclusion, with no age
    // test, on the pension and IRA income received while resident, up to the
    // whole cap (2025 Schedule P, Part III line 3): min(40,000, 31,110) =
    // 31,110. (90,000 - 3,360 - 31,110) x 3.5% = 1,943.55. In Texas's months
    // the slice receives none of it: 1,632.40.
    ['KY', 1_943.55, 1_632.4],
    ['LA', 2_313.75, 1_113.75],
    // Form 502 P: the deduction times Maryland AGI over federal AGI, 3,400 x
    // 9/14 = 2,185.714; 87,814.286: 90 + 84,814.286 x 4.75% = 4,118.679.
    // 3,400 x 5/14 = 1,214.286; 48,785.714: 90 + 45,785.714 x 4.75% =
    // 2,264.821.
    ['MD', 4_118.679, 2_264.821],
    ['MA', 4_500, 2_500],
    // Michigan's subtraction counts a conversion only at 59 1/2.
    ['MI', 3_825, 2_125],
    // Mississippi exempts the retirement distribution, so the slice's
    // Mississippi income is $50,000 of $100,000 either way: (50,000 - 1,150 -
    // 10,000) x 4% = 1,554.
    ['MS', 1_554, 1_554],
    // 89,500: 280 + 262.50 + 175 + 35,000 x 5.525% = 1,933.75 + 14,500 x 6.37%
    // = 923.65; 3,574.90.
    ['NJ', 3_574.9, 1_242.375],
    // A traditional IRA converted whole is not taxable: 50,000 x 3.07%.
    ['PA', 1_535, 1_535],
    // Schedule NR line 45 on adjusted gross income: 15,000 x 9/14 = 9,642.857,
    // and the $3,000 retirement deduction under 65, whole, on the conversion:
    // 77,357.143: 597 + 47,357.143 x 5.21% = 3,064.307. In Texas's months:
    // 15,000 x 5/14 = 5,357.143; 44,642.857: 597 + 14,642.857 x 5.21% =
    // 1,359.893.
    ['SC', 3_064.307, 1_359.893],
    // 760PY: 8,750 x 9/14 = 5,625; $930 x 6/12 = 465; 83,910: 720 + 66,910 x
    // 5.75% = 3,847.325; 4,567.325. 8,750 x 5/14 = 3,125; 46,410: 720 + 29,410
    // x 5.75% = 1,691.075; 2,411.075.
    ['VA', 4_567.325, 2_411.075],
  ] as const)('%s', (state, resident, other) => {
    expect(uneven(state, '2026-03-15')).toBeCloseTo(resident, 3)
    expect(uneven(state, '2026-09-15')).toBeCloseTo(other, 3)
  })

  it.each([
    // The flat-rate states that now carry the method, with even income: the
    // figure does not move. Georgia: (50,000 - 15,000 x 6/12) x 4.99%.
    ['GA', 2_120.75],
    ['IL', 2_475],
    ['IN', 1_475],
    ['MI', 2_125],
    ['MA', 2_500],
    ['PA', 1_535],
  ] as const)('%s with even income keeps its figure', (state, figure) => {
    expect(partYear(state)).toBeCloseTo(figure, 6)
  })
})
