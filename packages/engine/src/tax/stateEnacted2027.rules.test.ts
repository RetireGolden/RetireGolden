/**
 * The 2027 state rates already enacted, priced for tax year 2027 through the
 * production resolver (`stateParamsFor` inside `computeStateTaxYearTotal`),
 * against the figure the engine priced 2027 at before they were loaded: the
 * 2026 rates standing in for 2027.
 *
 * Every household below has $100,000 of state taxable income, married filing
 * jointly (Montana, $150,000), so the difference between the two readings is
 * the rate change alone: the income is the state's own standard deduction plus
 * the taxable income, and nothing else enters the base. The expected values are
 * written out from the statutes, not read from the figures the calculator
 * reads, for the reason the North Dakota helper in stateTax.rules.test.ts
 * gives: a fixture that took its rate from the table under test would agree
 * with a wrong table as readily as a right one.
 *
 *   state  2027 law                                  2026 rates held for 2027   overstated by
 *   IN     100,000 x 2.9%              = 2,900.00    100,000 x 2.95% = 2,950.00     50.00
 *   MS     90,000 x 3.75%              = 3,375.00    90,000 x 4%     = 3,600.00    225.00
 *   NE     202.95 + 1,448.928 + 2,013.753 = 3,665.631   ... + 2,296.385 = 3,948.263   282.632
 *   NC     100,000 x 3.49%             = 3,490.00    100,000 x 3.99% = 3,990.00    500.00
 *   MT     130,000 x 4.7% + 20,000 x 5.4% = 7,190.00  95,000 x 4.7% + 55,000 x 5.65% = 7,572.50  382.50
 *
 * The later steps follow, then the figures loaded with the widened set:
 * Hawaii's rate tables and standard deduction steps, New York's rate cuts and
 * 2033 top rate, Rhode Island's high-income surtax, Georgia's retirement
 * exclusion at 65 or older and Virginia's standard deduction steps. Each of
 * those is priced from the statute's own table or amounts against what the
 * engine charged before it was loaded.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { stateEnactedYearFor, stateParamsFor } from '../params/state/index.js'
import type { StateTaxParams } from '../params/state/types.js'
import type { TaxYearInput } from '../projection/types.js'
import { computeStateTaxYearResult, computeStateTaxYearTotal } from './stateTax.js'
import { statutorilyIndexedStandardDeduction } from './stateEnactedLaw.js'
import type { StateQcdEventFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'

const ENACTED_YEAR = 2027
const TAXABLE = 100_000

function joint(state: string, standardDeduction: number, taxable = TAXABLE): TaxYearInput {
  return {
    year: ENACTED_YEAR,
    filingStatus: 'marriedFilingJointly',
    ordinaryIncome: standardDeduction + taxable,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state,
    agesAlive: [50, 50],
  }
}

/** The 2027 tax, and the tax on the same household at the 2026 rates. */
function priced(input: TaxYearInput): { enacted: number; heldFrom2026: number } {
  const standIn = stateParamsFor(input.state!, 2026)!
  return {
    enacted: computeStateTaxYearTotal(input),
    heldFrom2026: computeStateTaxYearTotal(input, {
      mapParams: (params) => ({
        ...params,
        brackets: standIn.brackets,
        ...(standIn.bracketsHeadOfHousehold === undefined ? {} : { bracketsHeadOfHousehold: standIn.bracketsHeadOfHousehold }),
        ...(standIn.bracketsMarriedFilingSeparately === undefined ? {} : { bracketsMarriedFilingSeparately: standIn.bracketsMarriedFilingSeparately }),
        ...(standIn.montanaLtcg === undefined ? {} : { montanaLtcg: standIn.montanaLtcg }),
      }),
    }),
  }
}

describeRule('ic-6-3-2-1-flat-rate-ramp', {
  note: 'the 2027 step read as enacted',
  readings: { enacted2027: TAXABLE * 0.029, twentyTwentySixRateHeldForward: TAXABLE * 0.0295 },
  accepted: 'enacted2027',
}, ({ accepted, readings }) => {
  it('charges IC 6-3-2-1(b)(8) 2.9% for 2027, $50 less than 2.95% on $100,000', () => {
    const { enacted, heldFrom2026 } = priced(joint('IN', 0))
    expect(stateEnactedYearFor('IN', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(enacted).toBeCloseTo(accepted, 6)
    expect(heldFrom2026).toBeCloseTo(readings.twentyTwentySixRateHeldForward, 6)
    expect(heldFrom2026 - enacted).toBeCloseTo(50, 6)
  })

  it('keeps 2.9% through 2029, the end of (b)(8)', () => {
    expect(computeStateTaxYearTotal({ ...joint('IN', 0), year: 2029 })).toBeCloseTo(accepted, 6)
  })
})

describeRule('ms-27-7-5-rate-ramp', {
  note: 'the 2027 step read as enacted',
  readings: { enacted2027: (TAXABLE - 10_000) * 0.0375, twentyTwentySixRateHeldForward: (TAXABLE - 10_000) * 0.04 },
  accepted: 'enacted2027',
}, ({ accepted, readings }) => {
  it('charges 27-7-5(1)(b)(ii)4 3.75% above the $10,000 band for 2027, $225 less than 4%', () => {
    const { enacted, heldFrom2026 } = priced(joint('MS', 4_600))
    expect(stateEnactedYearFor('MS', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(enacted).toBeCloseTo(accepted, 6)
    expect(heldFrom2026).toBeCloseTo(readings.twentyTwentySixRateHeldForward, 6)
    expect(heldFrom2026 - enacted).toBeCloseTo(225, 6)
  })
})

const NE_2027 = 8_250 * 0.0246 + (49_530 - 8_250) * 0.0351 + (TAXABLE - 49_530) * 0.0399
const NE_2026 = 8_250 * 0.0246 + (49_530 - 8_250) * 0.0351 + (TAXABLE - 49_530) * 0.0455

describeRule('neb-rev-stat-77-2715-03-2027-rates-three-and-four', {
  readings: { enacted2027: NE_2027, twentyTwentySixRatesHeldForward: NE_2026 },
  accepted: 'enacted2027',
}, ({ accepted, readings }) => {
  it('charges 3.99% above the third threshold for 2027, $282.63 less than 4.55%', () => {
    const { enacted, heldFrom2026 } = priced(joint('NE', 17_700))
    expect(stateEnactedYearFor('NE', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(enacted).toBeCloseTo(accepted, 6)
    expect(enacted).toBeCloseTo(3_665.631, 6)
    expect(heldFrom2026).toBeCloseTo(readings.twentyTwentySixRatesHeldForward, 6)
    expect(heldFrom2026 - enacted).toBeCloseTo(282.632, 6)
  })

  it('leaves rates one and two, and the 2026 thresholds, where they were', () => {
    const params = stateParamsFor('NE', ENACTED_YEAR)!
    expect(params.brackets.marriedFilingJointly.map((band) => band.ratePct)).toEqual([2.46, 3.51, 3.99])
    expect(params.brackets.marriedFilingJointly.map((band) => band.lowerBound))
      .toEqual(stateParamsFor('NE', 2026)!.brackets.marriedFilingJointly.map((band) => band.lowerBound))
  })
})

describeRule('nc-sl-2026-41-2027-flat-rate', {
  readings: { enacted2027: TAXABLE * 0.0349, twentyTwentySixRateHeldForward: TAXABLE * 0.0399 },
  accepted: 'enacted2027',
}, ({ accepted, readings }) => {
  it('charges the S.L. 2026-41 rate of 3.49% for 2027, $500 less than 3.99%', () => {
    const { enacted, heldFrom2026 } = priced(joint('NC', 25_500))
    expect(stateEnactedYearFor('NC', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(enacted).toBeCloseTo(accepted, 6)
    expect(heldFrom2026).toBeCloseTo(readings.twentyTwentySixRateHeldForward, 6)
    expect(heldFrom2026 - enacted).toBeCloseTo(500, 6)
  })

  it('keeps 2026 at 3.99%, the year the rewritten table still sets there', () => {
    expect(stateEnactedYearFor('NC', 2026)).toBeNull()
    expect(computeStateTaxYearTotal({ ...joint('NC', 25_500), year: 2026 })).toBeCloseTo(readings.twentyTwentySixRateHeldForward, 6)
  })
})

const MT_TAXABLE = 150_000
const MT_2027 = 130_000 * 0.047 + (MT_TAXABLE - 130_000) * 0.054
const MT_2026 = 95_000 * 0.047 + (MT_TAXABLE - 95_000) * 0.0565

describeRule('mt-mca-15-30-2103-2027-rate-schedule', {
  readings: {
    enacted2027: {
      joint150k: MT_2027,
      single80k: 65_000 * 0.047 + 15_000 * 0.054,
      headOfHousehold100k: 97_500 * 0.047 + 2_500 * 0.054,
      // $20,000 of gains on top of $80,000 of ordinary income: $17,500 below
      // the $97,500 break at 3.0%, $2,500 above it at 4.1%.
      headOfHouseholdGainOn80k: 17_500 * 0.03 + 2_500 * 0.041,
    },
    twentyTwentySixScheduleHeldForward: {
      joint150k: MT_2026,
      single80k: 47_500 * 0.047 + 32_500 * 0.0565,
      headOfHousehold100k: 71_250 * 0.047 + 28_750 * 0.0565,
      // The 2026 break is $71,250, below the $80,000 of ordinary income, so
      // every dollar of gain is at 4.1%.
      headOfHouseholdGainOn80k: 20_000 * 0.041,
    },
  },
  accepted: 'enacted2027',
}, ({ accepted, readings }) => {
  // Montana's deduction is the federal one (conformity tag), $32,200 joint and
  // $16,100 single at the 2026 figure, which the calculator leaves unscaled
  // when no inflation scale is passed.
  it('charges 4.7% to $130,000 and 5.4% above for a joint return, $382.50 less on $150,000', () => {
    const { enacted, heldFrom2026 } = priced(joint('MT', 32_200, MT_TAXABLE))
    expect(stateEnactedYearFor('MT', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(enacted).toBeCloseTo(accepted.joint150k, 6)
    expect(enacted).toBeCloseTo(7_190, 6)
    expect(heldFrom2026).toBeCloseTo(readings.twentyTwentySixScheduleHeldForward.joint150k, 6)
    expect(heldFrom2026 - enacted).toBeCloseTo(382.5, 6)
  })

  it('breaks at $65,000 for a single filer', () => {
    const single: TaxYearInput = { ...joint('MT', 16_100, 80_000), filingStatus: 'single', agesAlive: [50] }
    const { enacted, heldFrom2026 } = priced(single)
    expect(enacted).toBeCloseTo(accepted.single80k, 6)
    expect(heldFrom2026).toBeCloseTo(readings.twentyTwentySixScheduleHeldForward.single80k, 6)
  })

  it('breaks at $97,500 for a head of household and $65,000 for a married individual filing separately', () => {
    const params = stateParamsFor('MT', ENACTED_YEAR)!
    expect(params.bracketsHeadOfHousehold).toEqual([{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 97_500, ratePct: 5.4 }])
    expect(params.bracketsMarriedFilingSeparately).toEqual([{ lowerBound: 0, ratePct: 4.7 }, { lowerBound: 65_000, ratePct: 5.4 }])
    const headOfHousehold = computeStateTaxYearResult(
      { ...joint('MT', 0, 100_000), filingStatus: 'single', agesAlive: [50] },
      { standardDeductionAllowedOverride: 0, householdFacts: { stateFilingStatus: 'headOfHousehold', montanaNetTaxableLtcg: 0 } },
    )
    expect(headOfHousehold.amount).toBeCloseTo(accepted.headOfHousehold100k, 6)
    expect(headOfHousehold.amount).not.toBeCloseTo(readings.twentyTwentySixScheduleHeldForward.headOfHousehold100k, 6)
  })

  it('taxes long-term gains at 3.0% up to the same $65,000 break and 4.1% above', () => {
    const facts = (gain: number) => ({ standardDeductionAllowedOverride: 0, householdFacts: { stateFilingStatus: 'single' as const, montanaNetTaxableLtcg: gain } })
    const base: TaxYearInput = { ...joint('MT', 0, 64_500), filingStatus: 'single', agesAlive: [50] }
    const withGain = computeStateTaxYearResult({ ...base, capitalGains: 1_000 }, facts(1_000))
    const noGain = computeStateTaxYearResult(base, facts(0))
    // $500 of gain below the $65,000 break at 3.0%, $500 above it at 4.1%.
    expect(withGain.amount - noGain.amount).toBeCloseTo(500 * 0.03 + 500 * 0.041, 8)
  })

  it('taxes a head of household’s gains at 3.0% up to the $97,500 break: $627.50 on $20,000 above $80,000 of ordinary income', () => {
    const standIn = stateParamsFor('MT', 2026)!
    const heldFrom2026 = (params: StateTaxParams): StateTaxParams => ({
      ...params,
      brackets: standIn.brackets,
      bracketsHeadOfHousehold: standIn.bracketsHeadOfHousehold!,
      bracketsMarriedFilingSeparately: standIn.bracketsMarriedFilingSeparately!,
      montanaLtcg: standIn.montanaLtcg!,
    })
    const base: TaxYearInput = { ...joint('MT', 0, 80_000), filingStatus: 'single', agesAlive: [50] }
    const gainTax = (mapParams?: (params: StateTaxParams) => StateTaxParams): number => {
      const facts = (gain: number) => ({
        standardDeductionAllowedOverride: 0,
        householdFacts: { stateFilingStatus: 'headOfHousehold' as const, montanaNetTaxableLtcg: gain },
        ...(mapParams === undefined ? {} : { mapParams }),
      })
      return computeStateTaxYearResult({ ...base, capitalGains: 20_000 }, facts(20_000)).amount - computeStateTaxYearResult(base, facts(0)).amount
    }
    expect(gainTax()).toBeCloseTo(accepted.headOfHouseholdGainOn80k, 8)
    expect(gainTax()).toBeCloseTo(627.5, 8)
    expect(gainTax(heldFrom2026)).toBeCloseTo(readings.twentyTwentySixScheduleHeldForward.headOfHouseholdGainOn80k, 8)
    expect(gainTax(heldFrom2026)).toBeCloseTo(820, 8)
  })
})

// The later unconditional steps. Each year is priced on the same $100,000 of
// taxable income, married filing jointly, against the 2027 rate held forward,
// which is what the engine priced those years at before the steps were loaded.
const MS_LATER = { 2028: 0.035, 2029: 0.0325, 2030: 0.03, 2032: 0.03 } as const
const NC_LATER = { 2029: 0.0349, 2030: 0.0324, 2032: 0.0324, 2033: 0.0299, 2040: 0.0299 } as const
const byYear = <T extends Record<number, number>>(rates: T, base: number) =>
  Object.fromEntries(Object.entries(rates).map(([year, rate]) => [year, Math.round(base * rate * 100) / 100]))

describeRule('ms-27-7-5-rate-ramp', {
  note: 'the 2028 to 2030 steps read as enacted',
  readings: {
    enactedSteps: byYear(MS_LATER, TAXABLE - 10_000),
    the2027RateHeldForward: byYear({ 2028: 0.0375, 2029: 0.0375, 2030: 0.0375, 2032: 0.0375 }, TAXABLE - 10_000),
  },
  accepted: 'enactedSteps',
}, ({ accepted, readings }) => {
  it('charges 3.5% for 2028, 3.25% for 2029 and 3% from 2030 above the $10,000 band', () => {
    for (const year of Object.keys(MS_LATER).map(Number)) {
      const tax = computeStateTaxYearTotal({ ...joint('MS', 4_600), year })
      expect(tax, String(year)).toBeCloseTo(accepted[year]!, 6)
      expect(tax, String(year)).not.toBeCloseTo(readings.the2027RateHeldForward[year]!, 6)
    }
    expect(stateEnactedYearFor('MS', 2032)).toBe(2030)
  })
})

describeRule('nc-sl-2026-41-rate-steps-2030-and-after', {
  readings: {
    enactedSteps: byYear(NC_LATER, TAXABLE),
    the2027RateHeldForward: byYear({ 2029: 0.0349, 2030: 0.0349, 2032: 0.0349, 2033: 0.0349, 2040: 0.0349 }, TAXABLE),
  },
  accepted: 'enactedSteps',
}, ({ accepted, readings }) => {
  it('charges 3.49% through 2029, 3.24% for 2030 to 2032 and 2.99% after 2032', () => {
    for (const year of Object.keys(NC_LATER).map(Number)) {
      const tax = computeStateTaxYearTotal({ ...joint('NC', 25_500), year })
      expect(tax, String(year)).toBeCloseTo(accepted[year]!, 6)
      if (year >= 2030) expect(tax, String(year)).not.toBeCloseTo(readings.the2027RateHeldForward[year]!, 6)
    }
    expect(stateEnactedYearFor('NC', 2029)).toBe(2027)
    expect(stateEnactedYearFor('NC', 2031)).toBe(2030)
    expect(stateEnactedYearFor('NC', 2040)).toBe(2033)
  })
})

// The widened set: Hawaii, New York, Rhode Island, Georgia and Virginia. Each
// expected value is written out from the statute's own table or amounts.

/** A household's state tax with the deduction set to zero, so the income is the taxable income. */
function onTaxable(
  state: string,
  year: number,
  taxable: number,
  status: 'single' | 'marriedFilingJointly' | 'headOfHousehold',
  mapParams?: (params: StateTaxParams) => StateTaxParams,
): number {
  const base: TaxYearInput = {
    ...joint(state, 0, taxable),
    year,
    filingStatus: status === 'marriedFilingJointly' ? 'marriedFilingJointly' : 'single',
    agesAlive: status === 'marriedFilingJointly' ? [50, 50] : [50],
  }
  return computeStateTaxYearResult(base, {
    standardDeductionAllowedOverride: 0,
    householdFacts: { stateFilingStatus: status },
    ...(mapParams === undefined ? {} : { mapParams }),
  }).amount
}

/** The same params with another year's schedules, for the reading the engine used before. */
const schedulesOf = (state: string, year: number) => (params: StateTaxParams): StateTaxParams => {
  const from = stateParamsFor(state, year)!
  return {
    ...params,
    brackets: from.brackets,
    ...(from.bracketsHeadOfHousehold === undefined ? {} : { bracketsHeadOfHousehold: from.bracketsHeadOfHousehold }),
  }
}

// Hawaii, $100,000 of taxable income, on the tables Act 24, SLH 2026 put in
// HRS 235-51 for 2027 and for 2029. The statute prints a whole-dollar base on
// each band: joint 2027, $4,291.00 plus 7.20% over $96,000; single 2027,
// $2,146.00 plus 7.20% over $48,000; head of household 2027, $3,218.00 plus
// 7.20% over $72,000; and from 2029 $3,514.00, $1,757.00 and $2,635.00 plus
// 6.80% over the same amounts. The 2026 tables, which the engine priced every
// later year at before, run continuously from 1.40%. The Act 46 tables Act 24
// struck before they took effect are the other wrong reading.
const HI_2026 = {
  joint: 19_200 * 0.014 + 9_600 * 0.032 + 9_600 * 0.055 + 9_600 * 0.064 + 24_000 * 0.068 + 24_000 * 0.072 + 4_000 * 0.076,
  single: 9_600 * 0.014 + 4_800 * 0.032 + 4_800 * 0.055 + 4_800 * 0.064 + 12_000 * 0.068 + 12_000 * 0.072 + 52_000 * 0.076,
  headOfHousehold: 14_400 * 0.014 + 7_200 * 0.032 + 7_200 * 0.055 + 7_200 * 0.064 + 18_000 * 0.068 + 18_000 * 0.072 + 28_000 * 0.076,
}

describeRule('hi-act-24-2026-rate-schedules', {
  readings: {
    act24Tables: {
      joint2027: 4_291 + 4_000 * 0.072,
      single2027: 2_146 + 52_000 * 0.072,
      headOfHousehold2027: 3_218 + 28_000 * 0.072,
      joint2029: 3_514 + 4_000 * 0.068,
      single2029: 1_757 + 52_000 * 0.068,
      headOfHousehold2029: 2_635 + 28_000 * 0.068,
    },
    act46TablesStruckByAct24: {
      joint2027: 4_406 + 4_000 * 0.072,
      single2027: 2_203 + 52_000 * 0.072,
      headOfHousehold2027: 3_305 + 28_000 * 0.072,
      joint2029: 3_701 + 4_000 * 0.068,
      single2029: 1_850 + 52_000 * 0.068,
      headOfHousehold2029: 2_776 + 28_000 * 0.068,
    },
    twentyTwentySixTablesHeldForward: {
      joint2027: HI_2026.joint,
      single2027: HI_2026.single,
      headOfHousehold2027: HI_2026.headOfHousehold,
      joint2029: HI_2026.joint,
      single2029: HI_2026.single,
      headOfHousehold2029: HI_2026.headOfHousehold,
    },
  },
  accepted: 'act24Tables',
}, ({ accepted, readings }) => {
  it('prices $100,000 at the 2027 tables: $4,579 joint, $5,890 single, $5,234 head of household', () => {
    expect(stateEnactedYearFor('HI', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(onTaxable('HI', 2027, 100_000, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2027, 6)
    expect(onTaxable('HI', 2027, 100_000, 'single')).toBeCloseTo(accepted.single2027, 6)
    expect(onTaxable('HI', 2027, 100_000, 'headOfHousehold')).toBeCloseTo(accepted.headOfHousehold2027, 6)
    expect(accepted.joint2027).toBeCloseTo(4_579, 6)
    expect(accepted.single2027).toBeCloseTo(5_890, 6)
    expect(accepted.headOfHousehold2027).toBeCloseTo(5_234, 6)
    for (const status of ['single', 'marriedFilingJointly', 'headOfHousehold'] as const) {
      const key = status === 'marriedFilingJointly' ? 'joint2027' : `${status}2027` as const
      expect(onTaxable('HI', 2027, 100_000, status), status).not.toBeCloseTo(readings.act46TablesStruckByAct24[key], 6)
    }
  })

  it('charges $803.40 joint, $601.20 single and $702.80 head of household less than the 2026 tables held forward', () => {
    const held = schedulesOf('HI', 2026)
    expect(onTaxable('HI', 2027, 100_000, 'marriedFilingJointly', held)).toBeCloseTo(readings.twentyTwentySixTablesHeldForward.joint2027, 6)
    expect(onTaxable('HI', 2027, 100_000, 'single', held)).toBeCloseTo(readings.twentyTwentySixTablesHeldForward.single2027, 6)
    expect(onTaxable('HI', 2027, 100_000, 'headOfHousehold', held)).toBeCloseTo(readings.twentyTwentySixTablesHeldForward.headOfHousehold2027, 6)
    expect(HI_2026.joint - accepted.joint2027).toBeCloseTo(803.4, 6)
    expect(HI_2026.single - accepted.single2027).toBeCloseTo(601.2, 6)
    expect(HI_2026.headOfHousehold - accepted.headOfHousehold2027).toBeCloseTo(702.8, 6)
  })

  it('uses the printed base: 40 cents over the continuous sum single, 20 cents joint', () => {
    // The same tables summed band by band, without the printed bases.
    const single = 14_400 * 0.014 + 4_800 * 0.025 + 4_800 * 0.05 + 12_000 * 0.064 + 12_000 * 0.068 + 52_000 * 0.072
    const joint = 28_800 * 0.014 + 9_600 * 0.025 + 9_600 * 0.05 + 24_000 * 0.064 + 24_000 * 0.068 + 4_000 * 0.072
    const single2029 = 19_200 * 0.014 + 4_800 * 0.025 + 12_000 * 0.05 + 12_000 * 0.064 + 52_000 * 0.068
    expect(single).toBeCloseTo(5_889.6, 6)
    expect(single2029).toBeCloseTo(5_292.8, 6)
    expect(accepted.single2027 - single).toBeCloseTo(0.4, 6)
    expect(accepted.joint2027 - joint).toBeCloseTo(-0.2, 6)
    expect(accepted.single2029 - single2029).toBeCloseTo(0.2, 6)
  })

  it('taxes 13% above $500,000 single: $135,365 on $1,200,000 for 2027, against $122,216.20 on the 2026 tables', () => {
    expect(onTaxable('HI', 2027, 1_200_000, 'single')).toBeCloseTo(44_365 + 700_000 * 0.13, 6)
    expect(onTaxable('HI', 2027, 1_200_000, 'single')).toBeCloseTo(135_365, 6)
    expect(onTaxable('HI', 2027, 1_200_000, 'single', schedulesOf('HI', 2026))).toBeCloseTo(122_216.2, 6)
    expect(onTaxable('HI', 2029, 1_200_000, 'marriedFilingJointly')).toBeCloseTo(86_936 + 200_000 * 0.13, 6)
    expect(onTaxable('HI', 2029, 1_200_000, 'headOfHousehold')).toBeCloseTo(65_202 + 450_000 * 0.13, 6)
  })

  it('keeps the 2027 tables for 2028 and moves to the 2029 tables from 2029', () => {
    expect(onTaxable('HI', 2028, 100_000, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2027, 6)
    for (const year of [2029, 2035]) {
      expect(onTaxable('HI', year, 100_000, 'marriedFilingJointly'), String(year)).toBeCloseTo(accepted.joint2029, 6)
      expect(onTaxable('HI', year, 100_000, 'single'), String(year)).toBeCloseTo(accepted.single2029, 6)
      expect(onTaxable('HI', year, 100_000, 'headOfHousehold'), String(year)).toBeCloseTo(accepted.headOfHousehold2029, 6)
    }
    // Against the 2027 tables held forward, which is what 2029 read before.
    expect(onTaxable('HI', 2029, 100_000, 'marriedFilingJointly', schedulesOf('HI', 2027))).toBeCloseTo(accepted.joint2027, 6)
    expect(onTaxable('HI', 2029, 100_000, 'single')).not.toBeCloseTo(readings.act46TablesStruckByAct24.single2029, 6)
  })
})

// Hawaii's standard deduction on $116,000 of joint income: the 2027 deduction
// of $16,000 leaves $100,000; $18,000 from 2028, $20,000 from 2030 and $24,000
// from 2031 leave $98,000, $96,000 and $92,000, priced on the Act 24 table for
// the year.
describeRule('hi-hrs-235-2-4-a-2-g-to-i-standard-deduction-steps', {
  readings: {
    enactedSteps: {
      2027: 4_291 + 4_000 * 0.072,
      2028: 4_291 + 2_000 * 0.072,
      2029: 3_514 + 2_000 * 0.068,
      2030: 1_978 + 24_000 * 0.064,
      2031: 1_978 + 20_000 * 0.064,
    },
    the2027DeductionHeldForward: {
      2027: 4_291 + 4_000 * 0.072,
      2028: 4_291 + 4_000 * 0.072,
      2029: 3_514 + 4_000 * 0.068,
      2030: 3_514 + 4_000 * 0.068,
      2031: 3_514 + 4_000 * 0.068,
    },
  },
  accepted: 'enactedSteps',
}, ({ accepted, readings }) => {
  it('deducts $18,000 joint from 2028, $20,000 from 2030 and $24,000 from 2031', () => {
    const held = (params: StateTaxParams): StateTaxParams => ({ ...params, standardDeduction: stateParamsFor('HI', 2027)!.standardDeduction })
    for (const year of [2027, 2028, 2029, 2030, 2031] as const) {
      const input: TaxYearInput = { ...joint('HI', 16_000), year }
      expect(computeStateTaxYearTotal(input), String(year)).toBeCloseTo(accepted[year], 6)
      expect(computeStateTaxYearTotal(input, { mapParams: held }), String(year)).toBeCloseTo(readings.the2027DeductionHeldForward[year], 6)
    }
    expect(stateParamsFor('HI', 2028)!.standardDeduction).toEqual({ single: 9_000, marriedFilingJointly: 18_000 })
    expect(stateParamsFor('HI', 2030)!.standardDeduction).toEqual({ single: 10_000, marriedFilingJointly: 20_000 })
    expect(stateParamsFor('HI', 2040)!.standardDeduction).toEqual({ single: 12_000, marriedFilingJointly: 24_000 })
  })
})

// New York, joint and single on $100,000 of taxable income, and joint on
// $3,000,000 for the 2033 top rate. Paragraph (viii): joint $1,146 plus 5.30%
// over $27,900; single $4,110 plus 5.80% over $80,650; joint $143,107 plus
// 9.65% over $2,155,350, and 8.82% under paragraph (ix) from 2033.
const NY_2026 = {
  joint: 17_150 * 0.039 + 6_450 * 0.044 + 4_300 * 0.0515 + 72_100 * 0.054,
  single: 8_500 * 0.039 + 3_200 * 0.044 + 2_200 * 0.0515 + 66_750 * 0.054 + 19_350 * 0.059,
}

describeRule('ny-tax-601-2027-rate-cuts-and-2033-top-rate', {
  readings: {
    enactedTables: {
      joint2027: 1_146 + 72_100 * 0.053,
      single2027: 4_110 + 19_350 * 0.058,
      jointThreeMillion2032: 143_107 + 844_650 * 0.0965,
      jointThreeMillion2033: 143_107 + 844_650 * 0.0882,
    },
    earlierTablesHeldForward: {
      joint2027: NY_2026.joint,
      single2027: NY_2026.single,
      jointThreeMillion2032: 143_107 + 844_650 * 0.0965,
      jointThreeMillion2033: 143_107 + 844_650 * 0.0965,
    },
  },
  accepted: 'enactedTables',
}, ({ accepted, readings }) => {
  it('charges 0.1 point less on each of the five lowest bands from 2027: $100.20 joint and $99.45 single on $100,000', () => {
    const held = schedulesOf('NY', 2026)
    expect(stateEnactedYearFor('NY', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(onTaxable('NY', 2027, 100_000, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2027, 6)
    expect(onTaxable('NY', 2027, 100_000, 'single')).toBeCloseTo(accepted.single2027, 6)
    expect(onTaxable('NY', 2027, 100_000, 'marriedFilingJointly', held)).toBeCloseTo(readings.earlierTablesHeldForward.joint2027, 6)
    expect(onTaxable('NY', 2027, 100_000, 'single', held)).toBeCloseTo(readings.earlierTablesHeldForward.single2027, 6)
    expect(NY_2026.joint - accepted.joint2027).toBeCloseTo(100.2, 6)
    expect(NY_2026.single - accepted.single2027).toBeCloseTo(99.45, 6)
    // A single filer inside the 5.30% band: $572 plus 5.30% over $13,900.
    expect(onTaxable('NY', 2027, 50_000, 'single')).toBeCloseTo(572 + 36_100 * 0.053, 6)
  })

  it('keeps 9.65% through 2032 and charges 8.82% above $2,155,350 joint from 2033', () => {
    expect(onTaxable('NY', 2032, 3_000_000, 'marriedFilingJointly')).toBeCloseTo(accepted.jointThreeMillion2032, 6)
    expect(onTaxable('NY', 2033, 3_000_000, 'marriedFilingJointly')).toBeCloseTo(accepted.jointThreeMillion2033, 6)
    expect(onTaxable('NY', 2033, 3_000_000, 'marriedFilingJointly', schedulesOf('NY', 2032)))
      .toBeCloseTo(readings.earlierTablesHeldForward.jointThreeMillion2033, 6)
    expect(stateEnactedYearFor('NY', 2032)).toBe(2027)
    expect(stateEnactedYearFor('NY', 2040)).toBe(2033)
    // The lower bands are the 2027 ones: $100,000 prices the same in 2033.
    expect(onTaxable('NY', 2033, 100_000, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2027, 6)
  })
})

// Rhode Island, joint, $2,000,000 of taxable income: the surtax is 1%, 2% and
// 3% of the $1,000,000 above the threshold, on top of the tax the 2026 bands
// charge. Below the threshold it adds nothing.
describeRule('ri-44-30-2-6-high-income-surtax', {
  readings: {
    enactedSurtax: { 2027: 1_000_000 * 0.01, 2028: 1_000_000 * 0.02, 2029: 1_000_000 * 0.03, 2035: 1_000_000 * 0.03 },
    noSurtax: { 2027: 0, 2028: 0, 2029: 0, 2035: 0 },
  },
  accepted: 'enactedSurtax',
}, ({ accepted, readings }) => {
  it('adds 1% for 2027, 2% for 2028 and 3% from 2029 on taxable income over $1,000,000', () => {
    const held = schedulesOf('RI', 2026)
    for (const year of [2027, 2028, 2029, 2035] as const) {
      const enacted = onTaxable('RI', year, 2_000_000, 'marriedFilingJointly')
      const without = onTaxable('RI', year, 2_000_000, 'marriedFilingJointly', held)
      expect(enacted - without, String(year)).toBeCloseTo(accepted[year], 6)
      expect(enacted - without, String(year)).not.toBeCloseTo(readings.noSurtax[year], 6)
    }
    // The whole 2027 amount: the 2026 bands on $2,000,000, then the surtax.
    const bands = 82_050 * 0.0375 + (186_450 - 82_050) * 0.0475 + (2_000_000 - 186_450) * 0.0599
    expect(onTaxable('RI', 2027, 2_000_000, 'marriedFilingJointly')).toBeCloseTo(bands + 10_000, 6)
  })

  it('uses the same $1,000,000 for a single filer and adds nothing at or below it', () => {
    const held = schedulesOf('RI', 2026)
    expect(onTaxable('RI', 2027, 1_500_000, 'single') - onTaxable('RI', 2027, 1_500_000, 'single', held)).toBeCloseTo(5_000, 6)
    expect(onTaxable('RI', 2028, 1_500_000, 'single') - onTaxable('RI', 2028, 1_500_000, 'single', held)).toBeCloseTo(10_000, 6)
    expect(onTaxable('RI', 2029, 1_500_000, 'single') - onTaxable('RI', 2029, 1_500_000, 'single', held)).toBeCloseTo(15_000, 6)
    expect(onTaxable('RI', 2029, 1_000_000, 'single') - onTaxable('RI', 2029, 1_000_000, 'single', held)).toBeCloseTo(0, 6)
  })
})

// Georgia, a single filer aged 70 with $100,000 of private retirement income in
// 2027: the $15,000 deduction and the $70,000 exclusion leave $15,000 at 4.99%;
// the $65,000 exclusion held forward leaves $20,000.
describeRule('ga-hb-463-2027-retirement-exclusion', {
  readings: {
    enacted2027: (100_000 - 15_000 - 70_000) * 0.0499,
    twentyTwentySixCapHeldForward: (100_000 - 15_000 - 65_000) * 0.0499,
  },
  accepted: 'enacted2027',
}, ({ accepted, readings }) => {
  const retiree = (year: number): TaxYearInput => ({
    year,
    filingStatus: 'single',
    ordinaryIncome: 100_000,
    privateRetirementIncome: 100_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 1,
    state: 'GA',
    agesAlive: [70],
  })

  it('excludes $70,000 at 65 or older from 2027, $249.50 less tax than $65,000', () => {
    const held = (params: StateTaxParams): StateTaxParams => {
      const from = stateParamsFor('GA', 2026)!
      return { ...params, retirementPrivate: from.retirementPrivate, retirementPublic: from.retirementPublic }
    }
    expect(stateEnactedYearFor('GA', ENACTED_YEAR)).toBe(ENACTED_YEAR)
    expect(computeStateTaxYearTotal(retiree(2027))).toBeCloseTo(accepted, 6)
    expect(computeStateTaxYearTotal(retiree(2027), { mapParams: held })).toBeCloseTo(readings.twentyTwentySixCapHeldForward, 6)
    expect(readings.twentyTwentySixCapHeldForward - accepted).toBeCloseTo(249.5, 6)
    expect(computeStateTaxYearTotal(retiree(2026))).toBeCloseTo(readings.twentyTwentySixCapHeldForward, 6)
    expect(computeStateTaxYearTotal(retiree(2034))).toBeCloseTo(accepted, 6)
  })

  it('leaves the rate and the standard deduction at their 2026 figures', () => {
    expect(stateParamsFor('GA', 2027)!.brackets).toEqual(stateParamsFor('GA', 2026)!.brackets)
    expect(stateParamsFor('GA', 2027)!.standardDeduction).toEqual(stateParamsFor('GA', 2026)!.standardDeduction)
  })
})

// Virginia: the tax moves by the change in the deduction at the 5.75% rate.
// Joint: $18,400 in 2027 is $900 above $17,500, $18,600 in 2028 is $1,100
// above, and $6,000 from 2030 is $11,500 below. Single: $9,200 is $450 above.
describeRule('va-code-58-1-322-03-standard-deduction-steps', {
  readings: {
    enactedSteps: { joint2027: -900 * 0.0575, single2027: -450 * 0.0575, joint2028: -1_100 * 0.0575, joint2030: 11_500 * 0.0575 },
    the2026DeductionHeldForward: { joint2027: 0, single2027: 0, joint2028: 0, joint2030: 0 },
  },
  accepted: 'enactedSteps',
}, ({ accepted, readings }) => {
  it('deducts $18,400 joint for 2027, $18,600 for 2028 and 2029 and $6,000 from 2030', () => {
    const held = (params: StateTaxParams): StateTaxParams => ({ ...params, standardDeduction: stateParamsFor('VA', 2026)!.standardDeduction })
    const change = (year: number, status: 'single' | 'marriedFilingJointly'): number => {
      const input: TaxYearInput = {
        ...joint('VA', 0, 100_000),
        year,
        filingStatus: status,
        agesAlive: status === 'single' ? [50] : [50, 50],
      }
      return computeStateTaxYearTotal(input) - computeStateTaxYearTotal(input, { mapParams: held })
    }
    expect(change(2027, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2027, 6)
    expect(change(2027, 'single')).toBeCloseTo(accepted.single2027, 6)
    expect(change(2028, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2028, 6)
    expect(change(2029, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2028, 6)
    expect(change(2030, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2030, 6)
    expect(change(2040, 'marriedFilingJointly')).toBeCloseTo(accepted.joint2030, 6)
    expect(change(2027, 'marriedFilingJointly')).not.toBeCloseTo(readings.the2026DeductionHeldForward.joint2027, 6)
    expect(stateParamsFor('VA', 2030)!.standardDeduction).toEqual({ single: 3_000, marriedFilingJointly: 6_000 })
  })
})

// Rhode Island's Social Security modification without the age test from 2027.
// A single filer aged 64 with $40,000 of other income and $30,000 of benefits:
// the federal share is 0.85 x (55,000 - 34,000) + 4,500 = 22,350, so federal
// AGI is $62,350, under the $107,000 limit. In 2026 the filer is under full
// retirement age and keeps the share in Rhode Island income; from 2027 the
// share comes out. Each is priced on the 3.75% band after the $11,200
// deduction.
describeRule('ri-h7127-2027-social-security-modification-without-age-test', {
  readings: {
    ageTestDropped: { 2026: (40_000 + 22_350 - 11_200) * 0.0375, 2027: (40_000 - 11_200) * 0.0375 },
    ageTestHeldForward: { 2026: (40_000 + 22_350 - 11_200) * 0.0375, 2027: (40_000 + 22_350 - 11_200) * 0.0375 },
  },
  accepted: 'ageTestDropped',
}, ({ accepted, readings }) => {
  const filer = (year: number, ages: number[] = [64]): TaxYearInput => ({
    year,
    filingStatus: 'single',
    ordinaryIncome: 40_000,
    capitalGains: 0,
    ssBenefits: 30_000,
    peopleAged65Plus: 0,
    state: 'RI',
    agesAlive: ages,
  })

  it('subtracts the Social Security of a filer under full retirement age from 2027, $838.13 less tax', () => {
    expect(computeStateTaxYearTotal(filer(2026))).toBeCloseTo(accepted[2026], 6)
    expect(computeStateTaxYearTotal(filer(2027))).toBeCloseTo(accepted[2027], 6)
    expect(computeStateTaxYearTotal(filer(2027))).not.toBeCloseTo(readings.ageTestHeldForward[2027], 6)
    expect(readings.ageTestHeldForward[2027] - accepted[2027]).toBeCloseTo(22_350 * 0.0375, 6)
    expect(computeStateTaxYearTotal(filer(2031))).toBeCloseTo(accepted[2027], 6)
  })

  it('keeps the AGI test: nothing comes out above $107,000 single or $133,750 joint', () => {
    const above: TaxYearInput = { ...filer(2027), ordinaryIncome: 120_000 }
    // 25,500 of the benefits is taxable, federal AGI is 145,500; RI income is
    // 120,000 + 25,500 - 11,200 = 134,300.
    expect(computeStateTaxYearTotal(above)).toBeCloseTo(
      82_050 * 0.0375 + (134_300 - 82_050) * 0.0475, 6)
    const joint: TaxYearInput = { ...filer(2027, [64, 64]), filingStatus: 'marriedFilingJointly', ordinaryIncome: 100_000, ssBenefits: 40_000 }
    // Joint provisional income 120,000: 0.85 x (120,000 - 44,000) + 6,000 is
    // above 0.85 x 40,000, so 34,000 is taxable and federal AGI is 134,000,
    // above $133,750, so it stays in.
    expect(computeStateTaxYearTotal(joint)).toBeCloseTo(82_050 * 0.0375 + (134_000 - 22_400 - 82_050) * 0.0475, 6)
    const jointUnder: TaxYearInput = { ...joint, ordinaryIncome: 99_000 }
    // Federal AGI 133,000 is under the limit, so the 34,000 comes out.
    expect(computeStateTaxYearTotal(jointUnder)).toBeCloseTo((99_000 - 22_400) * 0.0375, 6)
  })
})

// Virginia's personal exemptions (58.1-322.03(2)), a 2026 correction: $930 for
// each exemption the filer could claim federally, plus $800 for each taxpayer
// 65 or older. A single filer aged 65 and a couple both 65, each well inside
// the 5.75% band, pay 5.75% less on $1,730 and $3,460. Both have enough
// income that the 58.1-322.03(5) age deduction is gone ($70,000 is $20,000
// over the $50,000 single limit, $120,000 is $45,000 over the $75,000 joint
// one, each more than the $12,000 or $24,000 it could reduce), so the
// exemptions are the only difference between the two readings.
describeRule('va-code-58-1-322-03-2-personal-exemptions', {
  readings: {
    exemptionsAllowed: { single65: (70_000 - 8_750 - 930 - 800 - 17_000) * 0.0575 + 720, joint65: (120_000 - 17_500 - 2 * 930 - 2 * 800 - 17_000) * 0.0575 + 720 },
    noExemptions: { single65: (70_000 - 8_750 - 17_000) * 0.0575 + 720, joint65: (120_000 - 17_500 - 17_000) * 0.0575 + 720 },
  },
  accepted: 'exemptionsAllowed',
}, ({ accepted, readings }) => {
  // 720 is the tax on the first $17,000: 3,000 x 2% + 2,000 x 3% + 12,000 x 5%.
  const retiree = (joint: boolean): TaxYearInput => ({
    year: 2026,
    filingStatus: joint ? 'marriedFilingJointly' : 'single',
    ordinaryIncome: joint ? 120_000 : 70_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: joint ? 2 : 1,
    state: 'VA',
    agesAlive: joint ? [65, 65] : [65],
  })
  const withoutExemptions = (params: StateTaxParams): StateTaxParams => ({ ...params, virginiaPersonalExemptions: undefined })

  it('deducts $1,730 for a single filer aged 65 and $3,460 for a couple both 65', () => {
    expect(computeStateTaxYearTotal(retiree(false))).toBeCloseTo(accepted.single65, 6)
    expect(computeStateTaxYearTotal(retiree(true))).toBeCloseTo(accepted.joint65, 6)
    expect(computeStateTaxYearTotal(retiree(false), { mapParams: withoutExemptions })).toBeCloseTo(readings.noExemptions.single65, 6)
    expect(readings.noExemptions.single65 - accepted.single65).toBeCloseTo(99.475, 6)
    expect(readings.noExemptions.joint65 - accepted.joint65).toBeCloseTo(198.95, 6)
  })

  it('gives a filer under 65 the $930 exemption alone', () => {
    const younger: TaxYearInput = { ...retiree(false), peopleAged65Plus: 0, agesAlive: [60] }
    expect(computeStateTaxYearTotal(younger)).toBeCloseTo(readings.noExemptions.single65 - 930 * 0.0575, 6)
  })
})

// Maryland. The state schedule starts 2% / 3% / 4% on the first three $1,000
// bands ($90 in all) and charges 4.75% to $100,000 single, $150,000 joint.
const MD_FIRST_3000 = 20 + 30 + 40
const mdTax = (taxable: number): number => MD_FIRST_3000 + (taxable - 3_000) * 0.0475

// The standard deduction indexed for 2026 under 10-217(c): the engine carries
// $3,400 single (the withholding guide) and $6,850 joint (the statute's rule),
// where the Comptroller's 2026 estimated-tax worksheet prints the 2025 $3,350
// and $6,700. The statute leaves the adjustment to the Comptroller, so the
// worksheet's figures are the accepted reading until the 2026 Form 502
// instructions settle it; the engine's are the produced one.
describeRule('md-tg-10-217-2026-indexed-standard-deduction', {
  readings: {
    comptrollerEstimatedTaxWorksheet: { single60k: mdTax(60_000 - 3_350), joint100k: mdTax(100_000 - 6_700) },
    withholdingGuideAndStatuteRule: { single60k: mdTax(60_000 - 3_400), joint100k: mdTax(100_000 - 6_850) },
  },
  accepted: 'comptrollerEstimatedTaxWorksheet',
  produced: 'withholdingGuideAndStatuteRule',
  note: 'the Comptroller has printed two 2026 amounts',
}, ({ accepted, produced }) => {
  const household = (joint: boolean): TaxYearInput => ({
    year: 2026,
    filingStatus: joint ? 'marriedFilingJointly' : 'single',
    ordinaryIncome: joint ? 100_000 : 60_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state: 'MD',
    agesAlive: joint ? [50, 50] : [50],
  })

  it('deducts $3,400 single and $6,850 joint in 2026, not the worksheet’s $3,350 and $6,700', () => {
    expect(computeStateTaxYearTotal(household(false))).toBeCloseTo(produced.single60k, 6)
    expect(computeStateTaxYearTotal(household(true))).toBeCloseTo(produced.joint100k, 6)
    expect(computeStateTaxYearTotal(household(true))).not.toBeCloseTo(accepted.joint100k, 6)
    expect(produced.single60k).toBeCloseTo(2_636, 6)
    expect(produced.joint100k).toBeCloseTo(4_372.125, 6)
    expect(accepted.single60k - produced.single60k).toBeCloseTo(2.375, 6)
    expect(accepted.joint100k - produced.joint100k).toBeCloseTo(7.125, 6)
  })
})

// The 2% on net capital gain above $350,000 of federal AGI (10-105(a)(3)-(4)):
// a single filer with $400,000 of other income and $100,000 of gain pays
// $2,000 more; at $300,000 of federal AGI, nothing more.
// A primary residence sold for less than $1,500,000 is excluded from the
// surtax base by (a)(3)(ii), but its taxable gain reaches the state
// calculation as capital gain like any other, so the engine surcharges it:
// $100,000 of residence gain above the section 121 exclusion on a $500,000
// return is charged $2,000 the law does not charge.
describeRule('md-tg-10-105-a-3-capital-gain-surtax', {
  readings: {
    statute: { gainOn500k: 100_000 * 0.02, gainOn300k: 0, residenceGainOn500k: 0 },
    engine: { gainOn500k: 100_000 * 0.02, gainOn300k: 0, residenceGainOn500k: 100_000 * 0.02 },
  },
  accepted: 'statute',
  produced: 'engine',
  note: 'a primary-residence gain the surtax base excludes',
}, ({ accepted, produced }) => {
  const filer = (ordinaryIncome: number): TaxYearInput => ({
    year: 2026,
    filingStatus: 'single',
    ordinaryIncome,
    capitalGains: 100_000,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state: 'MD',
    agesAlive: [50],
  })
  const withoutSurtax = (params: StateTaxParams): StateTaxParams => ({ ...params, marylandCapitalGainSurtax: undefined })
  const added = (ordinaryIncome: number): number =>
    computeStateTaxYearTotal(filer(ordinaryIncome)) - computeStateTaxYearTotal(filer(ordinaryIncome), { mapParams: withoutSurtax })

  it('adds 2% of the gain when federal AGI is above $350,000, and nothing below', () => {
    expect(added(400_000)).toBeCloseTo(accepted.gainOn500k, 6)
    expect(added(400_000)).not.toBeCloseTo(0, 6)
    expect(added(200_000)).toBeCloseTo(accepted.gainOn300k, 6)
  })

  it('surcharges a primary-residence gain the law excludes, because it arrives as ordinary capital gain', () => {
    // The same $100,000 of gain, from a home sold for $900,000: the state
    // calculation has no field that says so.
    expect(added(400_000)).toBeCloseTo(produced.residenceGainOn500k, 6)
    expect(added(400_000)).not.toBeCloseTo(accepted.residenceGainOn500k, 6)
  })

  it('charges it as state tax only: the county rate does not reach it', () => {
    const local = { localPct: 3.2 }
    const withCounty = computeStateTaxYearTotal(filer(400_000), local) - computeStateTaxYearTotal(filer(400_000), { ...local, mapParams: withoutSurtax })
    expect(withCounty).toBeCloseTo(2_000, 6)
  })
})

// The public-safety retirement subtraction (10-207(mm)): a single retiree aged
// 58 with a $30,000 police pension the plan marks MD-PUBLIC-SAFETY. 2026
// subtracts $16,000, 2027 $17,000, 2028 $18,000 and 2030 on $20,000, after the
// $3,400 deduction held from 2026. Unmarked, the pension is taxed in full.
describeRule('md-tg-10-207-mm-public-safety-retirement-subtraction', {
  readings: {
    subtracted: {
      2026: mdTax(30_000 - 16_000 - 3_400),
      2027: mdTax(30_000 - 17_000 - 3_400),
      2028: mdTax(30_000 - 18_000 - 3_400),
      2030: mdTax(30_000 - 20_000 - 3_400),
    },
    notSubtracted: {
      2026: mdTax(30_000 - 3_400),
      2027: mdTax(30_000 - 3_400),
      2028: mdTax(30_000 - 3_400),
      2030: mdTax(30_000 - 3_400),
    },
  },
  accepted: 'subtracted',
}, ({ accepted, readings }) => {
  const pension = (code: string | undefined, age = 58, amount = 30_000): StateRetirementDistributionFact => ({
    ownerPersonId: 'retiree',
    sourceKind: 'stateLocalPublic',
    federallyIncludedAmount: amount,
    recipientAgeYears: age,
    cause: 'ordinary',
    earlyDistributionDisqualifier: 'false',
    ...(code === undefined ? {} : { planSystemCode: code }),
  })
  const retiree = (year: number, ordinaryIncome = 30_000, age = 58): TaxYearInput => ({
    year,
    filingStatus: 'single',
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: age >= 65 ? 1 : 0,
    state: 'MD',
    agesAlive: [age],
  })

  it('subtracts $16,000 in 2026 and steps to $20,000 by 2030: $451, $403.50, $356, $261', () => {
    for (const year of [2026, 2027, 2028, 2030] as const) {
      const tax = computeStateTaxYearResult(retiree(year), { retirementDistributions: [pension('MD-PUBLIC-SAFETY')] }).amount
      expect(tax, String(year)).toBeCloseTo(accepted[year], 6)
      expect(tax, String(year)).not.toBeCloseTo(readings.notSubtracted[year], 6)
    }
    expect(accepted[2026]).toBeCloseTo(451, 6)
    expect(accepted[2027]).toBeCloseTo(403.5, 6)
    expect(accepted[2030]).toBeCloseTo(261, 6)
  })

  it('needs the marker and age 55', () => {
    expect(computeStateTaxYearResult(retiree(2026), { retirementDistributions: [pension(undefined)] }).amount).toBeCloseTo(readings.notSubtracted[2026], 6)
    expect(computeStateTaxYearResult(retiree(2026, 30_000, 54), { retirementDistributions: [pension('MD-PUBLIC-SAFETY', 54)] }).amount).toBeCloseTo(readings.notSubtracted[2026], 6)
  })

  it('keeps the subtracted amount out of the pension exclusion at 65 (10-209(d)(2))', () => {
    // Aged 66 with the $30,000 pension and $50,000 of other income, no Social
    // Security: $16,000 comes out under (mm), and the $40,600 pension
    // exclusion reaches only the other $14,000 of the pension, so Maryland
    // taxable income is 80,000 - 16,000 - 14,000 - 3,400 = 46,600.
    const result = computeStateTaxYearResult(retiree(2026, 80_000, 66), {
      retirementDistributions: [pension('MD-PUBLIC-SAFETY', 66)],
      householdFacts: { householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0 },
    })
    expect(result.taxableIncome).toBeCloseTo(46_600, 6)
    expect(result.amount).toBeCloseTo(mdTax(46_600), 6)
  })
})

// The federal senior deduction carried into Arizona, Colorado and Idaho (2026
// corrections): $6,000 for a single filer aged 70 with $50,000 of wages,
// below the $75,000 phase-out, priced at each state's flat or top rate; at
// $100,000 the deduction is 6,000 - 6% x 25,000 = 4,500; from 2029 the federal
// deduction, and so the state one, is zero.
const seniorFiler = (state: string, year: number, ordinaryIncome = 50_000): TaxYearInput => ({
  year,
  filingStatus: 'single',
  ordinaryIncome,
  capitalGains: 0,
  ssBenefits: 0,
  peopleAged65Plus: 1,
  state,
  agesAlive: [70],
})
const withoutSenior = (params: StateTaxParams): StateTaxParams => ({ ...params, federalSeniorDeduction: undefined })
const seniorSaving = (state: string, year: number, ordinaryIncome = 50_000): number =>
  computeStateTaxYearTotal(seniorFiler(state, year, ordinaryIncome), { mapParams: withoutSenior }) -
  computeStateTaxYearTotal(seniorFiler(state, year, ordinaryIncome))
const seniorReadings = (ratePct: number) => ({
  federalSeniorDeductionCarried: { full: 6_000 * (ratePct / 100), phasedOut: 4_500 * (ratePct / 100), after2028: 0 },
  notCarried: { full: 0, phasedOut: 0, after2028: 0 },
})
const seniorCases = (state: string, accepted: ReturnType<typeof seniorReadings>['federalSeniorDeductionCarried'], notCarried: number): void => {
  it(`lowers ${state} tax by the federal deduction through 2028, and by nothing from 2029`, () => {
    expect(seniorSaving(state, 2026)).toBeCloseTo(accepted.full, 6)
    expect(seniorSaving(state, 2026)).not.toBeCloseTo(notCarried, 6)
    expect(seniorSaving(state, 2028)).toBeCloseTo(accepted.full, 6)
    expect(seniorSaving(state, 2026, 100_000)).toBeCloseTo(accepted.phasedOut, 6)
    expect(seniorSaving(state, 2029)).toBeCloseTo(accepted.after2028, 6)
  })
}

describeRule('ars-43-1022-35-federal-senior-deduction-subtraction', {
  readings: seniorReadings(2.5),
  accepted: 'federalSeniorDeductionCarried',
}, ({ accepted, readings }) => {
  seniorCases('AZ', accepted, readings.notCarried.full)
  it('is $150 for each person 65 or older below the phase-out', () => expect(accepted.full).toBeCloseTo(150, 6))
})

describeRule('co-crs-39-22-104-federal-taxable-income-senior-deduction', {
  readings: seniorReadings(4.4),
  accepted: 'federalSeniorDeductionCarried',
}, ({ accepted, readings }) => {
  seniorCases('CO', accepted, readings.notCarried.full)
  it('is $264 for each person 65 or older below the phase-out', () => expect(accepted.full).toBeCloseTo(264, 6))
})

describeRule('id-h559-2026-conformity-senior-deduction', {
  readings: seniorReadings(5.3),
  accepted: 'federalSeniorDeductionCarried',
}, ({ accepted, readings }) => {
  seniorCases('ID', accepted, readings.notCarried.full)
  it('is $318 for each person 65 or older below the phase-out', () => expect(accepted.full).toBeCloseTo(318, 6))
})

// Delaware's military pension steps (1106(b)(3)c.-e.): a $30,000 U.S. military
// pension. Under 60 the subtraction is the greater of the $2,000 pension limb
// and the military limb: $12,500 in 2026, $15,000, $20,000 and $25,000 over
// 2027 to 2029. At 60 or older the military limb becomes a greater-of
// alternative to the $12,500 pension limb, where before it counted inside it.
const militaryPension = (age: number, amount = 30_000, sourceKind: StateRetirementDistributionFact['sourceKind'] = 'militaryRetirement'): StateRetirementDistributionFact => ({
  ownerPersonId: 'veteran',
  sourceKind,
  federallyIncludedAmount: amount,
  recipientAgeYears: age,
  cause: 'ordinary',
  earlyDistributionDisqualifier: 'false',
})
const deSubtracted = (year: number, age: number, facts: StateRetirementDistributionFact[]): number => {
  const income = facts.reduce((sum, fact) => sum + fact.federallyIncludedAmount, 0)
  const filer: TaxYearInput = { year, filingStatus: 'single', ordinaryIncome: income, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, state: 'DE', agesAlive: [age] }
  const withEvents = computeStateTaxYearResult(filer, { retirementDistributions: facts, standardDeductionAllowedOverride: 0 }).taxableIncome
  const without = computeStateTaxYearResult(filer, { retirementDistributions: [], standardDeductionAllowedOverride: 0 }).taxableIncome
  return without - withEvents
}

describeRule('de-code-30-1106-b-3-military-pension-steps-2027-2029', {
  readings: {
    enactedSteps: { under60: { 2026: 12_500, 2027: 15_000, 2028: 20_000, 2029: 25_000, 2035: 25_000 }, age62: { 2026: 12_500, 2027: 15_000, 2028: 20_000, 2029: 25_000, 2035: 25_000 } },
    the2026LimitsHeld: { under60: { 2026: 12_500, 2027: 12_500, 2028: 12_500, 2029: 12_500, 2035: 12_500 }, age62: { 2026: 12_500, 2027: 12_500, 2028: 12_500, 2029: 12_500, 2035: 12_500 } },
  },
  accepted: 'enactedSteps',
}, ({ accepted, readings }) => {
  it('subtracts $15,000, $20,000 and $25,000 of a military pension over 2027 to 2029, under 60 and at 62', () => {
    for (const year of [2026, 2027, 2028, 2029, 2035] as const) {
      expect(deSubtracted(year, 55, [militaryPension(55)]), `under 60 ${year}`).toBeCloseTo(accepted.under60[year], 6)
      expect(deSubtracted(year, 62, [militaryPension(62)]), `62 ${year}`).toBeCloseTo(accepted.age62[year], 6)
    }
    expect(deSubtracted(2029, 62, [militaryPension(62)])).not.toBeCloseTo(readings.the2026LimitsHeld.age62[2029], 6)
  })

  it('takes the greater limb at 60 or older, never both', () => {
    // $20,000 of other pension and $10,000 of military: the $12,500 pension
    // limb beats the $10,000 military limb in 2027.
    const mixed = [militaryPension(62, 20_000, 'ordinaryPrivatePension'), militaryPension(62, 10_000)]
    expect(deSubtracted(2027, 62, mixed)).toBeCloseTo(12_500, 6)
    // With $20,000 of military pension alone, the $15,000 military limb wins.
    expect(deSubtracted(2027, 62, [militaryPension(62, 20_000)])).toBeCloseTo(15_000, 6)
  })
})

// Illinois's exemption from 2029 (204(b)): $1,000, where 2028 still has the
// indexed amount, held at 2026's $2,925. A single filer under 65 with $100,000
// of income: 4.95% of $97,075 in 2028 and of $99,000 in 2029.
describeRule('il-35-ilcs-5-204-b-basic-amount-1000-from-2029', {
  readings: {
    basicAmountFrom2029: { 2028: (100_000 - 2_925) * 0.0495, 2029: (100_000 - 1_000) * 0.0495 },
    indexedAmountHeldForward: { 2028: (100_000 - 2_925) * 0.0495, 2029: (100_000 - 2_925) * 0.0495 },
  },
  accepted: 'basicAmountFrom2029',
}, ({ accepted, readings }) => {
  const filer = (year: number): TaxYearInput => ({ year, filingStatus: 'single', ordinaryIncome: 100_000, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, state: 'IL', agesAlive: [50] })
  const facts = { federalAgi: 100_000, exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0 }

  it('allows $1,000 from 2029, $95.29 more tax than the 2026 amount held', () => {
    expect(computeStateTaxYearResult(filer(2028), { householdFacts: facts }).amount).toBeCloseTo(accepted[2028], 6)
    expect(computeStateTaxYearResult(filer(2029), { householdFacts: facts }).amount).toBeCloseTo(accepted[2029], 6)
    expect(computeStateTaxYearResult(filer(2029), { householdFacts: facts }).amount).not.toBeCloseTo(readings.indexedAmountHeldForward[2029], 6)
    expect(accepted[2029] - readings.indexedAmountHeldForward[2029]).toBeCloseTo(95.2875, 6)
  })
})

// Maine's standard deduction from 2027 (5124-C(1-D)): the federal one, $16,100
// single and $32,200 joint at the 2026 federal figures, where the engine held
// Maine's own $15,700 and $31,400. A single filer with $60,000 and a couple
// with $100,000, under 65 and below the phase-out, are in the 6.75% band.
describeRule('me-pl-2025-c650-k-15-federal-standard-deduction-from-2027', {
  readings: {
    federalDeduction: { single: 27_400 * 0.058 + (60_000 - 16_100 - 27_400) * 0.0675, joint: 54_850 * 0.058 + (100_000 - 32_200 - 54_850) * 0.0675 },
    maineAmountHeld: { single: 27_400 * 0.058 + (60_000 - 15_700 - 27_400) * 0.0675, joint: 54_850 * 0.058 + (100_000 - 31_400 - 54_850) * 0.0675 },
  },
  accepted: 'federalDeduction',
}, ({ accepted, readings }) => {
  const household = (joint: boolean, year = 2027): TaxYearInput => ({
    year,
    filingStatus: joint ? 'marriedFilingJointly' : 'single',
    ordinaryIncome: joint ? 100_000 : 60_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state: 'ME',
    agesAlive: joint ? [50, 50] : [50],
  })

  it('deducts the federal amount from 2027: $27 less tax single and $54 joint', () => {
    expect(computeStateTaxYearTotal(household(false))).toBeCloseTo(accepted.single, 6)
    expect(computeStateTaxYearTotal(household(true))).toBeCloseTo(accepted.joint, 6)
    expect(readings.maineAmountHeld.single - accepted.single).toBeCloseTo(27, 6)
    expect(readings.maineAmountHeld.joint - accepted.joint).toBeCloseTo(54, 6)
    // 2026 keeps Maine's own amount.
    expect(computeStateTaxYearTotal(household(false, 2026))).toBeCloseTo(readings.maineAmountHeld.single, 6)
  })

  it('moves with the federal figure in a projected year', () => {
    const scaled: TaxYearInput = { ...household(false, 2030), inflationScale: 1.1 }
    expect(computeStateTaxYearTotal(scaled)).toBeCloseTo(27_400 * 0.058 + (60_000 - 16_100 * 1.1 - 27_400) * 0.0675, 6)
  })

  it('keeps the federal age-65 addition, as in 2026', () => {
    const older: TaxYearInput = { ...household(false), peopleAged65Plus: 1, agesAlive: [66] }
    expect(stateParamsFor('ME', 2027)!.standardDeductionConformity).toBe('federal')
    expect(stateParamsFor('ME', 2027)!.standardDeductionAge65AdditionConformity).toBeUndefined()
    // The 2026 federal single addition, ,050, in the 6.75% band.
    expect(computeStateTaxYearTotal(older)).toBeCloseTo(accepted.single - 2_050 * 0.0675, 6)
  })
})

// Oregon's retirement income credit ends with tax year 2031 (2009 c.913 §36).
// A single filer at 65 with a $10,000 pension and $15,000 of household income:
// Oregon tax on $12,090 is 4,550 x 4.75% + 6,850 x 6.75% + 690 x 8.75% =
// 738.875; the credit is 9% of the $7,500 ceiling, $675, through 2031.
describeRule('or-laws-2009-c913-s36-retirement-credit-ends-2032', {
  readings: {
    creditEndsAfter2031: { 2031: 738.875 - 675, 2032: 738.875 },
    creditKeptForever: { 2031: 738.875 - 675, 2032: 738.875 - 675 },
  },
  accepted: 'creditEndsAfter2031',
}, ({ accepted, readings }) => {
  const priced = (year: number) => computeStateTaxYearResult(
    { year, filingStatus: 'single', ordinaryIncome: 15_000, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 1, state: 'OR', agesAlive: [65] },
    {
      retirementDistributions: [{ ownerPersonId: 'retiree', sourceKind: 'ira', federallyIncludedAmount: 10_000, recipientAgeYears: 65, cause: 'ordinary', earlyDistributionDisqualifier: 'false' }],
      householdFacts: { stateFilingStatus: 'single', oregonHouseholdIncome: 15_000, householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0 },
    },
  )

  it('allows the $675 credit through 2031 and none from 2032, with no missing-fact warning', () => {
    expect(priced(2031).amount).toBeCloseTo(accepted[2031], 6)
    expect(priced(2032).amount).toBeCloseTo(accepted[2032], 6)
    expect(priced(2032).amount).not.toBeCloseTo(readings.creditKeptForever[2032], 6)
    expect(priced(2040).amount).toBeCloseTo(accepted[2032], 6)
    expect(priced(2032).warnings.some((warning) => warning.code === 'or-retirement-credit-incomplete')).toBe(false)
    expect(stateParamsFor('OR', 2032)!.oregonRetirementIncomeCredit).toBeUndefined()
  })
})

// California's top bands end from 2031 (Cal. Const. art. XIII, sec. 36(f)(2)):
// on $1,000,000 of single taxable income at the thresholds the 2026 figures
// carry, the tax to the 9.3% threshold is 110.79 + 303.70 + 607.52 + 965.40 +
// 1,214.56 = 3,201.97, and above it 9.3%, 10.3%, 11.3% and 12.3% through 2030
// but 9.3% throughout from 2031.
const CA_TO_9_3 = 11_079 * 0.01 + (26_264 - 11_079) * 0.02 + (41_452 - 26_264) * 0.04 + (57_542 - 41_452) * 0.06 + (72_724 - 57_542) * 0.08
describeRule('ca-const-art-13-sec-36-f-2-top-bands-end-2031', {
  readings: {
    bandsEndFrom2031: {
      2030: CA_TO_9_3 + (371_479 - 72_724) * 0.093 + (445_771 - 371_479) * 0.103 + (742_953 - 445_771) * 0.113 + (1_000_000 - 742_953) * 0.123,
      2031: CA_TO_9_3 + (1_000_000 - 72_724) * 0.093,
    },
    bandsHeldForward: {
      2030: CA_TO_9_3 + (371_479 - 72_724) * 0.093 + (445_771 - 371_479) * 0.103 + (742_953 - 445_771) * 0.113 + (1_000_000 - 742_953) * 0.123,
      2031: CA_TO_9_3 + (371_479 - 72_724) * 0.093 + (445_771 - 371_479) * 0.103 + (742_953 - 445_771) * 0.113 + (1_000_000 - 742_953) * 0.123,
    },
  },
  accepted: 'bandsEndFrom2031',
}, ({ accepted, readings }) => {
  it('taxes $1,000,000 at $103,836.61 through 2030 and $89,438.64 from 2031', () => {
    expect(onTaxable('CA', 2030, 1_000_000, 'single')).toBeCloseTo(accepted[2030], 6)
    expect(onTaxable('CA', 2031, 1_000_000, 'single')).toBeCloseTo(accepted[2031], 6)
    expect(onTaxable('CA', 2031, 1_000_000, 'single')).not.toBeCloseTo(readings.bandsHeldForward[2031], 6)
    expect(accepted[2030]).toBeCloseTo(103_836.608, 3)
    expect(accepted[2031]).toBeCloseTo(89_438.638, 3)
    // Joint: 9.3% from $145,448, with nothing above it from 2031.
    expect(stateParamsFor('CA', 2031)!.brackets.marriedFilingJointly.at(-1)).toEqual({ lowerBound: 145_448, ratePct: 9.3 })
    expect(onTaxable('CA', 2040, 1_000_000, 'single')).toBeCloseTo(accepted[2031], 6)
  })
})

// California's military exclusions (RTC 17132.9, 17132.10): a single filer
// with $30,000 of military retirement pay and $40,000 of other income excludes
// $20,000; with $140,000 of other income federal AGI is above $125,000 and
// nothing is excluded; a Survivor Benefit Plan annuity has its own $20,000 cap;
// from 2030 neither applies.
describeRule('ca-rtc-17132-9-10-military-retirement-exclusions', {
  readings: {
    excludedThrough2029: { retirement: 20_000, aboveAgiLimit: 0, survivor: 20_000, from2030: 0 },
    taxedInFull: { retirement: 0, aboveAgiLimit: 0, survivor: 0, from2030: 0 },
  },
  accepted: 'excludedThrough2029',
}, ({ accepted, readings }) => {
  const excluded = (year: number, otherIncome: number, sourceKind: 'militaryRetirement' | 'militarySurvivor'): number => {
    const filer: TaxYearInput = { year, filingStatus: 'single', ordinaryIncome: otherIncome + 30_000, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 1, state: 'CA', agesAlive: [70] }
    const pension: StateRetirementDistributionFact = { ownerPersonId: 'veteran', sourceKind, federallyIncludedAmount: 30_000, recipientAgeYears: 70, cause: 'ordinary', earlyDistributionDisqualifier: 'false' }
    return computeStateTaxYearResult(filer, { retirementDistributions: [] }).taxableIncome -
      computeStateTaxYearResult(filer, { retirementDistributions: [pension] }).taxableIncome
  }

  it('excludes up to $20,000 at federal AGI up to $125,000 through 2029', () => {
    expect(excluded(2026, 40_000, 'militaryRetirement')).toBeCloseTo(accepted.retirement, 6)
    expect(excluded(2026, 40_000, 'militaryRetirement')).not.toBeCloseTo(readings.taxedInFull.retirement, 6)
    expect(excluded(2029, 40_000, 'militaryRetirement')).toBeCloseTo(accepted.retirement, 6)
    expect(excluded(2026, 140_000, 'militaryRetirement')).toBeCloseTo(accepted.aboveAgiLimit, 6)
    expect(excluded(2026, 40_000, 'militarySurvivor')).toBeCloseTo(accepted.survivor, 6)
    expect(excluded(2030, 40_000, 'militaryRetirement')).toBeCloseTo(accepted.from2030, 6)
    expect(stateParamsFor('CA', 2030)!.californiaMilitaryExclusions).toBeUndefined()
  })
})

// Washington's income tax from 2028 (ESSB 6346): 9.9% of federal AGI less
// long-term capital gains less $1,000,000 per individual or per couple. A
// single filer with $1,500,000 of ordinary income owes $49,500; a couple with
// $3,000,000, $198,000; $500,000 of gains on top adds nothing; 2027 owes none.
describeRule('wa-essb-6346-2028-income-tax', {
  readings: {
    taxFrom2028: { single15: 500_000 * 0.099, joint30: 2_000_000 * 0.099, withGains: 500_000 * 0.099, in2027: 0 },
    noIncomeTax: { single15: 0, joint30: 0, withGains: 0, in2027: 0 },
  },
  accepted: 'taxFrom2028',
}, ({ accepted, readings }) => {
  const household = (year: number, joint: boolean, ordinaryIncome: number, capitalGains = 0): TaxYearInput => ({
    year,
    filingStatus: joint ? 'marriedFilingJointly' : 'single',
    ordinaryIncome,
    capitalGains,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state: 'WA',
    agesAlive: joint ? [60, 60] : [60],
  })

  it('charges 9.9% above $1,000,000 from 2028, the same deduction for a couple', () => {
    expect(computeStateTaxYearTotal(household(2028, false, 1_500_000))).toBeCloseTo(accepted.single15, 6)
    expect(computeStateTaxYearTotal(household(2028, false, 1_500_000))).not.toBeCloseTo(readings.noIncomeTax.single15, 6)
    expect(computeStateTaxYearTotal(household(2028, true, 3_000_000))).toBeCloseTo(accepted.joint30, 6)
    expect(computeStateTaxYearTotal(household(2028, false, 1_500_000, 500_000))).toBeCloseTo(accepted.withGains, 6)
    expect(computeStateTaxYearTotal(household(2027, false, 1_500_000))).toBeCloseTo(accepted.in2027, 6)
    expect(computeStateTaxYearTotal(household(2028, false, 900_000))).toBe(0)
  })

  it('includes the federally taxable share of Social Security', () => {
    const withBenefits: TaxYearInput = { ...household(2028, false, 1_000_000), ssBenefits: 40_000 }
    // 85% of $40,000 is taxable federally at this income; all of it is above
    // the deduction.
    expect(computeStateTaxYearTotal(withBenefits)).toBeCloseTo(34_000 * 0.099, 6)
    expect(stateParamsFor('WA', 2028)!.hasIncomeTax).toBe(true)
    expect(stateParamsFor('WA', 2027)!.hasIncomeTax).toBe(false)
  })
})

// District of Columbia, 47-1806.03(a)(11) rates: 4% to $10,000, 6% to
// $40,000, 6.5% to $60,000, 8.5% to $250,000. The emergency act's deduction
// in force ($15,000 / $30,000) against the federal one the engine carried
// before ($16,100 / $32,200), both for filers under 65 in 2026:
//   single, $60,000:  act     45,000 -> 400 + 1,800 + 5,000 x 6.5% = 2,525.00
//                     federal 43,900 -> 400 + 1,800 + 3,900 x 6.5% = 2,453.50
//   joint, $120,000:  act     90,000 -> 400 + 1,800 + 1,300 + 30,000 x 8.5% = 6,050.00
//                     federal 87,800 -> 400 + 1,800 + 1,300 + 27,800 x 8.5% = 5,863.00
// From 2027 the basic amount is indexed from a 2025 base and rounded down to
// $50: at 2.5% a year, 15,000 x 1.025 = 15,375 -> 15,350 for 2027, and
// 15,000 x 1.025^3 = 16,153.36 -> 16,150 for 2029. From 2030 the federal
// deduction returns.
const DC_TO_60000 = 10_000 * 0.04 + 30_000 * 0.06 + 20_000 * 0.065
describeRule('dc-code-47-1801-04-3a-standard-deduction-2026-2029', {
  note: 'the emergency act’s deduction loaded as the law in force',
  readings: {
    emergencyActDeductionInForce: {
      single: 10_000 * 0.04 + 30_000 * 0.06 + (60_000 - 15_000 - 40_000) * 0.065,
      joint: DC_TO_60000 + (120_000 - 30_000 - 60_000) * 0.085,
    },
    federalDeductionUntilThePermanentActIsLaw: {
      single: 10_000 * 0.04 + 30_000 * 0.06 + (60_000 - 16_100 - 40_000) * 0.065,
      joint: DC_TO_60000 + (120_000 - 32_200 - 60_000) * 0.085,
    },
  },
  accepted: 'emergencyActDeductionInForce',
}, ({ accepted, readings }) => {
  const household = (joint: boolean, ordinaryIncome: number, year = 2026, inflationScale = 1): TaxYearInput => ({
    year,
    filingStatus: joint ? 'marriedFilingJointly' : 'single',
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state: 'DC',
    agesAlive: joint ? [50, 50] : [50],
    inflationScale,
  })

  it('prices 2026 on the emergency act’s $15,000 and $30,000, $71.50 and $187 over the federal deduction', () => {
    expect(accepted.single).toBeCloseTo(2_525, 6)
    expect(readings.federalDeductionUntilThePermanentActIsLaw.single).toBeCloseTo(2_453.5, 6)
    expect(accepted.joint).toBeCloseTo(6_050, 6)
    expect(readings.federalDeductionUntilThePermanentActIsLaw.joint).toBeCloseTo(5_863, 6)
    expect(computeStateTaxYearTotal(household(false, 60_000))).toBeCloseTo(accepted.single, 6)
    expect(computeStateTaxYearTotal(household(false, 60_000))).not.toBeCloseTo(readings.federalDeductionUntilThePermanentActIsLaw.single, 6)
    expect(computeStateTaxYearTotal(household(true, 120_000))).toBeCloseTo(accepted.joint, 6)
  })

  it('indexes the basic amount from 2027, rounded down to $50, and returns to the federal deduction from 2030', () => {
    const deduction = (year: number) =>
      statutorilyIndexedStandardDeduction(stateParamsFor('DC', year)!, { year, packYear: 2026, inflationScale: 1.025 ** (year - 2026) }).standardDeduction
    expect(deduction(2026)).toEqual({ single: 15_000, marriedFilingJointly: 30_000 })
    expect(deduction(2027)).toEqual({ single: 15_350, marriedFilingJointly: 30_750 })
    expect(deduction(2029).single).toBe(16_150)
    expect(stateParamsFor('DC', 2029)!.standardDeductionAge65AdditionConformity).toBe('federal')
    const from2030 = stateParamsFor('DC', 2030)!
    expect(from2030.standardDeductionConformity).toBe('federal')
    expect(from2030.standardDeductionStatutoryIndexing).toBeUndefined()
    expect(from2030.standardDeductionAge65AdditionConformity).toBeUndefined()
    // 2027 through the annual calculation: 60,000 - 15,350 = 44,650.
    expect(computeStateTaxYearTotal(household(false, 60_000, 2027, 1.025))).toBeCloseTo(400 + 1_800 + 4_650 * 0.065, 6)
  })

  // The indexing vintage, a stated limit: the engine scales the 2026 amount by
  // the plan's cumulative inflation from 2026, so 2027 carries the 2026-to-2027
  // change; the contrary reading measures a year earlier, so 2027 carries the
  // 2025-to-2026 change. On a declining path, 3% from 2025 to 2026, 2% to
  // 2027 and 1% a year after:
  //   engine    2027 15,000 x 1.02                = 15,300
  //             2028 15,000 x 1.02 x 1.01         = 15,453    -> 15,450
  //             2029 15,000 x 1.02 x 1.01^2       = 15,607.53 -> 15,600
  //   contrary  2027 15,000 x 1.03                = 15,450
  //             2028 15,000 x 1.03 x 1.02         = 15,759    -> 15,750
  //             2029 15,000 x 1.03 x 1.02 x 1.01  = 15,916.59 -> 15,900
  // A single filer with $60,000 is in the 6.5% band, so $150 of deduction is
  // $9.75 of tax for 2027 and $300 is $19.50 for 2028 and 2029.
  it('prices the indexing vintage on a declining-inflation path: the engine reads a year later than the contrary reading', () => {
    const pathFrom2025 = [0.03, 0.02, 0.01, 0.01]
    const scaleFrom2026 = (year: number) => pathFrom2025.slice(1, year - 2025).reduce((factor, rate) => factor * (1 + rate), 1)
    const lagged = (year: number) => pathFrom2025.slice(0, year - 2026).reduce((factor, rate) => factor * (1 + rate), 1)
    const floor50 = (amount: number) => Math.floor(amount / 50 + 1e-9) * 50
    const engine = (year: number) =>
      statutorilyIndexedStandardDeduction(stateParamsFor('DC', year)!, { year, packYear: 2026, inflationScale: scaleFrom2026(year) }).standardDeduction.single
    expect([2027, 2028, 2029].map(engine)).toEqual([15_300, 15_450, 15_600])
    const contrary = [2027, 2028, 2029].map((year) => floor50(15_000 * lagged(year)))
    expect(contrary).toEqual([15_450, 15_750, 15_900])
    // Under constant inflation the two readings agree.
    expect(floor50(15_000 * 1.025)).toBe(15_350)
    // Each reading's tax for a single filer with $60,000; the engine's through the annual calculation.
    const taxOn = (deduction: number) => 400 + 1_800 + (60_000 - deduction - 40_000) * 0.065
    const engineTax = [2027, 2028, 2029].map((year) => computeStateTaxYearTotal(household(false, 60_000, year, scaleFrom2026(year))))
    engineTax.forEach((tax, index) => expect(tax).toBeCloseTo(taxOn([15_300, 15_450, 15_600][index]!), 6))
    expect(engineTax.map((tax, index) => Math.round((tax - taxOn(contrary[index]!)) * 100) / 100)).toEqual([9.75, 19.5, 19.5])
  })
})

// Washington's deduction indexing (ESSB 6346 section 316): each October of an
// odd-numbered year from 2029, the deduction times one plus one year's
// inflation, rounded to the nearest $1,000, for that year's own tax year. At
// the plan's 2.5% a year (the cumulative factor from the 2026 pack year):
//   2029 and 2030  1,000,000 x 1.025 = 1,025,000
//   2031 and 2032  1,025,000 x 1.025 = 1,050,625 -> 1,051,000
//   2033 and 2034  1,051,000 x 1.025 = 1,077,275 -> 1,077,000
//   2035           1,077,000 x 1.025 = 1,103,925 -> 1,104,000
// A single filer with $1,500,000: 2029 (1,500,000 - 1,025,000) x 9.9% =
// 47,025 and 2031 44,451. The contrary reading starts in 2030, a year behind:
// 49,500 for 2029 and 47,025 for 2031, $2,475 and $2,574 more.
const WA_RATE = 0.025
const waScale = (year: number): number => Math.pow(1 + WA_RATE, year - 2026)
describeRule('wa-essb-6346-s316-standard-deduction-indexing', {
  note: 'the deduction indexed every second year from 2029 at the plan inflation',
  readings: {
    indexedFrom2029: { d2029: 1_025_000, d2030: 1_025_000, d2031: 1_051_000, d2032: 1_051_000, d2035: 1_104_000, tax2029: 475_000 * 0.099, tax2031: 449_000 * 0.099 },
    indexedFrom2030: { d2029: 1_000_000, d2030: 1_025_000, d2031: 1_025_000, d2032: 1_051_000, d2035: 1_077_000, tax2029: 500_000 * 0.099, tax2031: 475_000 * 0.099 },
    heldAtOneMillion: { d2029: 1_000_000, d2030: 1_000_000, d2031: 1_000_000, d2032: 1_000_000, d2035: 1_000_000, tax2029: 500_000 * 0.099, tax2031: 500_000 * 0.099 },
    indexedEveryYearByFullInflation: { d2029: 1_025_000, d2030: 1_050_625, d2031: 1_076_890.625, d2032: 1_103_812.890625, d2035: 1_188_686.017578125, tax2029: 475_000 * 0.099, tax2031: (1_500_000 - 1_076_890.625) * 0.099 },
  },
  accepted: 'indexedFrom2029',
}, ({ accepted, readings }) => {
  const deduction = (year: number, inflationScale = waScale(year)): number =>
    statutorilyIndexedStandardDeduction(stateParamsFor('WA', year)!, { year, packYear: 2026, inflationScale }).standardDeduction.single
  const single = (year: number, ordinaryIncome: number, inflationScale = waScale(year)): TaxYearInput => ({
    year,
    filingStatus: 'single',
    ordinaryIncome,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state: 'WA',
    agesAlive: [60],
    inflationScale,
  })

  it('adjusts the deduction for 2029 and every second year after, rounded to $1,000', () => {
    expect(deduction(2028)).toBe(1_000_000)
    expect(deduction(2029)).toBe(accepted.d2029)
    expect(deduction(2030)).toBe(accepted.d2030)
    expect(deduction(2031)).toBe(accepted.d2031)
    expect(deduction(2032)).toBe(accepted.d2032)
    expect(deduction(2035)).toBe(accepted.d2035)
    expect(deduction(2029)).not.toBe(readings.indexedFrom2030.d2029)
    expect(deduction(2031)).not.toBe(readings.indexedFrom2030.d2031)
    expect(deduction(2031)).not.toBe(readings.heldAtOneMillion.d2031)
    expect(deduction(2030)).not.toBe(readings.indexedEveryYearByFullInflation.d2030)
    // The same amount for a couple, who share one deduction.
    expect(statutorilyIndexedStandardDeduction(stateParamsFor('WA', 2031)!, { year: 2031, packYear: 2026, inflationScale: waScale(2031) }).standardDeduction.marriedFilingJointly).toBe(accepted.d2031)
  })

  it('prices the indexed deduction through the annual state calculation', () => {
    expect(computeStateTaxYearTotal(single(2029, 1_500_000))).toBeCloseTo(accepted.tax2029, 6)
    expect(computeStateTaxYearTotal(single(2029, 1_500_000))).not.toBeCloseTo(readings.indexedFrom2030.tax2029, 6)
    expect(computeStateTaxYearTotal(single(2031, 1_500_000))).toBeCloseTo(accepted.tax2031, 6)
    expect(computeStateTaxYearResult(single(2031, 1_500_000)).taxableIncome).toBeCloseTo(449_000, 6)
  })

  it('never reduces the deduction, and leaves it alone with no projected inflation', () => {
    expect(deduction(2031, 1)).toBe(1_000_000)
    expect(deduction(2031, Math.pow(0.98, 5))).toBe(1_000_000)
    expect(stateParamsFor('WA', 2031)!.standardDeductionStatutoryIndexing).toEqual({ firstIndexedYear: 2029, intervalYears: 2, roundToNearest: 1000 })
  })
})

// State figures a statute indexes are held at their latest published amounts
// in later years. Nebraska, single, $100,000 of taxable income in 2046, twenty
// years of 2.5% inflation after the 2026 pack (factor 1.025^20 = 1.63862):
//   held (engine)  2.46% to 4,130; 3.51% to 24,760; 3.99% above
//                  101.598 + 20,630 x 3.51% + 75,240 x 3.99% = 3,827.787
//   indexed by 77-2715.03(3), each bound x 1.63862 rounded to $10:
//                  4,130 -> 6,770; 24,760 -> 40,570
//                  166.542 + 33,800 x 3.51% + 59,430 x 3.99% = 3,724.179
// The engine overstates by 103.608, and the gap grows every year.
const NE_SCALE_2046 = Math.pow(1.025, 20)
const neIndexed = (bound: number): number => Math.round((bound * NE_SCALE_2046) / 10) * 10
describeRule('neb-rev-stat-77-2715-03-3-indexed-brackets-held-nominal', {
  note: 'a statutorily indexed state bracket held nominal for twenty years',
  readings: {
    bracketsIndexedAtThePlanInflation: {
      secondBand: neIndexed(4_130),
      thirdBand: neIndexed(24_760),
      tax: neIndexed(4_130) * 0.0246 + (neIndexed(24_760) - neIndexed(4_130)) * 0.0351 + (100_000 - neIndexed(24_760)) * 0.0399,
    },
    bracketsHeldAtTheir2026Amounts: {
      secondBand: 4_130,
      thirdBand: 24_760,
      tax: 4_130 * 0.0246 + (24_760 - 4_130) * 0.0351 + (100_000 - 24_760) * 0.0399,
    },
  },
  accepted: 'bracketsIndexedAtThePlanInflation',
  produced: 'bracketsHeldAtTheir2026Amounts',
}, ({ accepted, produced }) => {
  it('holds Nebraska’s 2046 brackets at the 2026 amounts, overstating the tax on $100,000', () => {
    expect(accepted.secondBand).toBe(6_770)
    expect(accepted.thirdBand).toBe(40_570)
    expect(accepted.tax).toBeCloseTo(3_724.179, 6)
    expect(produced.tax).toBeCloseTo(3_827.787, 6)
    const params = stateParamsFor('NE', 2046)!
    expect(params.brackets.single.map((band) => band.lowerBound)).toEqual([0, produced.secondBand, produced.thirdBand])
    const input: TaxYearInput = {
      ...joint('NE', 0, 100_000),
      year: 2046,
      filingStatus: 'single',
      agesAlive: [50],
      inflationScale: NE_SCALE_2046,
    }
    const charged = computeStateTaxYearResult(input, {
      standardDeductionAllowedOverride: 0,
      householdFacts: { stateFilingStatus: 'single' },
    }).amount
    expect(charged).toBeCloseTo(produced.tax, 6)
    expect(charged).not.toBeCloseTo(accepted.tax, 6)
  })
})

// Washington's direct-QCD policy from 2028 (ESSB 6346 section 301): a $10,000
// direct QCD the federal return excludes stays out of Washington taxable
// income, and the year is priced exactly rather than marked incomplete.
describeRule('wa-essb-6346-s301-direct-qcd-conformity', {
  note: 'the federal QCD exclusion carried into Washington from 2028',
  readings: { conformingExclusion: 0, denial: 10_000 },
  accepted: 'conformingExclusion',
}, ({ accepted, readings }) => {
  const waYear = (qcdEvents: readonly StateQcdEventFacts[]) => computeStateTaxYearResult({
    year: 2028,
    filingStatus: 'single',
    ordinaryIncome: 1_500_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 1,
    state: 'WA',
    agesAlive: [75],
  }, {
    retirementDistributions: [],
    hsaAccounts: [],
    qcdEvents,
    householdFacts: {
      stateFilingStatus: 'single', federalAgi: 1_500_000, federallyIncludedSocialSecurity: 0,
      householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
      exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 1,
      section63fQualificationCount: 1, federalExemptionCount: { known: true, value: 1 },
      claimedAsDependent: false,
    },
  })
  const qcd: StateQcdEventFacts = {
    eventId: 'qcd', accountId: 'ira', ownerPersonId: 'owner', grossIraDistribution: 10_000,
    directCharityTransfer: 10_000, federalExcludedAmount: 10_000, federalTaxableAmount: 0,
    federalBasisAllocated: 0, residency: 'fullYearResident', splitInterest: false, directTransfer: true,
  }

  it('keeps a direct QCD excluded and the year complete', () => {
    const without = waYear([])
    const withQcd = waYear([qcd])
    expect(withQcd.taxableIncome - without.taxableIncome).toBe(accepted)
    expect(withQcd.taxableIncome - without.taxableIncome).not.toBe(readings.denial)
    expect(withQcd.status).toBe('complete')
    expect(withQcd.warnings.map((warning) => warning.code)).not.toContain('state-qcd-policy-unknown')
    expect(stateParamsFor('WA', 2028)!.directQcdPolicy?.kind).toBe('conforms')
    expect(stateParamsFor('WA', 2027)!.directQcdPolicy).toBeUndefined()
  })
})
