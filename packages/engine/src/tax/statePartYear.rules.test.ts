/**
 * A part-year resident's slice of a split year, priced by the state's own
 * part-year method (`StateTaxParams.partYear`, tax/stateTax.ts#prorateParams).
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
 * Kentucky and Alabama also allow the whole standard deduction. Wisconsin keeps
 * the months share, but phases its sliding deduction on the year's income.
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
 *   WI     1,798.3868              2,232.3084   months share, deduction on the year
 */
import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTaxYearTotal } from './stateTax.js'

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
    // The exemptions need household facts, which a slice does not receive.
    form1NPR: 2_232.3084,
    // The slice's own $50,000 on the halved schedule: deduction 13,960 -
    // 0.12 x 29,880 = 10,374.40; 39,625.60 taxable; 7,555 x 3.5% = 264.425,
    // 18,420 x 4.4% = 810.48, 13,650.60 x 5.3% = 723.4818: 1,798.3868.
    deductionPhasedOnTheSlice: 1_798.3868,
  },
  accepted: 'form1NPR',
}, ({ accepted }) => {
  it('phases the deduction on the year’s income and keeps the months share', () => {
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

// South Carolina's figure holds what a slice is handed: no federal AGI, so the
// pack's unphased $15,000 in place of the SCIAD, which phases to zero at
// $95,000. The SCIAD record states the gap; this pins what the engine charges,
// so it fails when the slice receives federal AGI.
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
})

// The descriptor's `full` branches, through a pack mapped for the test: they
// price what a state allowing the whole amount would owe.
describe('part-year descriptor: a whole exemption or deduction', () => {
  it('allows New Jersey’s whole $1,000 when the exemptions are marked full', () => {
    // 49,000 on the ordinary table: 1,242.375 - 500 x 5.525% = 1,214.75.
    const whole = partYear('NJ', (params) => ({ ...params, partYear: { ...params.partYear!, exemptions: 'full' } }))
    expect(whole).toBeCloseTo(1_214.75, 6)
  })

  it('gives Wisconsin the whole year’s sliding deduction when the deduction is marked full', () => {
    // The year's $4,374.40 against the slice's $50,000 on the halved
    // schedule: 45,625.60 taxable; 264.425 + 810.48 + 19,650.60 x 5.3% =
    // 2,116.3868.
    const whole = partYear('WI', (params) => ({
      ...params,
      partYear: { rateSchedule: 'scaled', standardDeduction: 'full', exemptions: 'months' },
    }))
    expect(whole).toBeCloseTo(2_116.3868, 6)
  })
})
