/**
 * Pins for the four `approximated` state records — the gaps between what a
 * state's own law allows a retiree and what the "big levers" pack can express.
 *
 * All four have the same cause. `StateTaxParams` models a state's retirement
 * treatment as one exclusion with an optional integer `minAge` and an optional
 * per-person cap, and its capital-gain treatment as a single included
 * percentage. Four states do not fit through that shape:
 *
 *   - North Dakota excludes 40% of net long-term gain; the pack has no partial
 *     inclusion set, so the engine taxes 100%.
 *   - Pennsylvania conditions on the PLAN's age or service requirement; the
 *     pack substitutes a flat age 60.
 *   - New York conditions on attaining 59½; `minAge` is compared against an
 *     integer, so the pack rounds it down to 59.
 *   - South Carolina has a $3,000 tier below 65 and a $10,000 tier from 65; the
 *     pack holds one cap and one age, so only the upper tier survives.
 *
 * Each fixture drives the shipped pack to show the engine produces the
 * approximated figure, and prices the same scenario a second time through the
 * one field that would close the gap to show the statute's figure is reachable
 * and different. The day someone closes one of these, the first assertion fails
 * and names the record to reclassify — which is the entire reason `produced`
 * exists.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import { stateParamsFor } from '../../params/state/index.js'
import type { StateTaxParams } from '../../params/state/types.js'
import type { TaxYearInput } from '../../projection/types.js'
import { computeStateTax } from '../../tax/stateTax.js'

const TAX_YEAR = 2026

function input(over: Partial<TaxYearInput> = {}): TaxYearInput {
  return {
    year: TAX_YEAR,
    filingStatus: 'single',
    ordinaryIncome: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    ...over,
  }
}

/**
 * Guarded rather than asserted with `!`. These fixtures price a state against
 * its own law, so a mistyped code would hand the calculator undefined params
 * and fail downstream without naming the state that was actually wanted.
 */
function pack(code: string): StateTaxParams {
  const params = stateParamsFor(code, TAX_YEAR)
  if (params === undefined) throw new Error(`no ${TAX_YEAR} state pack for ${code}`)
  return params
}

function bandedTax(bands: readonly (readonly [number, number, number])[], taxable: number): number {
  return bands.reduce(
    (tax, [lower, upper, ratePct]) =>
      tax + Math.max(0, Math.min(taxable, upper) - lower) * (ratePct / 100),
    0,
  )
}

// ND single: 0% to 48,475, 1.95% to 244,825, 2.5% above. Deduction 16,100.
const northDakotaTax = (taxable: number) => bandedTax(
  [[0, 48_475, 0], [48_475, 244_825, 1.95], [244_825, Infinity, 2.5]],
  taxable,
)
const ND_ORDINARY = 120_000
const ND_LONG_TERM_GAIN = 100_000
const ND_DEDUCTION = 16_100

describeRule('ndcc-57-38-30-3-2-d-long-term-gain-exclusion', {
  readings: {
    sixtyPercentOfTheGainInTheBase:
      northDakotaTax(ND_ORDINARY + ND_LONG_TERM_GAIN * 0.6 - ND_DEDUCTION),
    theWholeGainInTheBase:
      northDakotaTax(ND_ORDINARY + ND_LONG_TERM_GAIN - ND_DEDUCTION),
  },
  accepted: 'sixtyPercentOfTheGainInTheBase',
  produced: 'theWholeGainInTheBase',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'ND',
    ordinaryIncome: ND_ORDINARY,
    capitalGains: ND_LONG_TERM_GAIN,
    agesAlive: [70],
  })

  it('taxes the whole long-term gain rather than the statute’s 60%', () => {
    expect(computeStateTax(pack('ND'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('ND'), scenario)).not.toBeCloseTo(accepted, 6)
  })

  it('reaches the statute’s figure once the included share is set to 60%', () => {
    // The one field that would close it. Not applied here: this file records
    // the gap, it does not fix the pack.
    const excluding = { ...pack('ND'), capitalGainsTaxablePct: 60 }
    expect(computeStateTax(excluding, scenario)).toBeCloseTo(accepted, 6)
  })
})

const PA_RATE = 0.0307
const PA_PENSION = 60_000

describeRule('pa-pit-retirement-benefits-not-compensation', {
  readings: {
    // Retired from service having met the plan's own service requirement, so
    // the distribution is not Pennsylvania compensation whatever the age.
    planAgeOrServiceRequirementMet: 0,
    flatAgeSixtyGate: PA_PENSION * PA_RATE,
  },
  accepted: 'planAgeOrServiceRequirementMet',
  produced: 'flatAgeSixtyGate',
}, ({ accepted, produced }) => {
  // Fifty-eight, retired after a stated period of employment: exempt under the
  // regulation, two years short under the pack.
  const scenario = input({
    state: 'PA',
    ordinaryIncome: PA_PENSION,
    privateRetirementIncome: PA_PENSION,
    agesAlive: [58],
  })

  it('charges a retired 58-year-old Pennsylvania tax the regulation does not', () => {
    expect(computeStateTax(pack('PA'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('PA'), scenario)).not.toBeCloseTo(accepted, 6)
  })

  it('exempts the same distribution once the gate reaches the retiree', () => {
    const reaching = {
      ...pack('PA'),
      retirementPrivate: { kind: 'full' as const, minAge: 55 },
      retirementPublic: { kind: 'full' as const, minAge: 55 },
    }
    expect(computeStateTax(reaching, scenario)).toBe(accepted)
  })

  it('still charges a Pennsylvanian who has not retired at all, in the other direction', () => {
    // `bothDirections` is not a hedge. Above the flat gate the proxy is loose
    // rather than tight: a 62-year-old still working and taking an in-service
    // IRA distribution has not "retired from service", so the regulation taxes
    // this and the pack does not.
    const stillWorking = input({
      state: 'PA',
      ordinaryIncome: PA_PENSION,
      privateRetirementIncome: PA_PENSION,
      agesAlive: [62],
    })
    expect(computeStateTax(pack('PA'), stillWorking)).toBe(0)
  })
})

// NY single: 3.9% to 8,500, 4.4% to 11,700, 5.15% to 13,900, 5.4% to 80,650,
// 5.9% to 215,400, and higher bands above. Deduction 8,000.
const newYorkTax = (taxable: number) => bandedTax(
  [
    [0, 8500, 3.9], [8500, 11_700, 4.4], [11_700, 13_900, 5.15],
    [13_900, 80_650, 5.4], [80_650, 215_400, 5.9],
  ],
  taxable,
)
const NY_PENSION = 80_000
const NY_DEDUCTION = 8000
const NY_EXCLUSION = 20_000

describeRule('ny-tax-612-c-3-a-pension-annuity-exclusion', {
  readings: {
    // Fifty-nine and not yet fifty-nine and a half: no exclusion.
    attainmentOfFiftyNineAndAHalfRequired: newYorkTax(NY_PENSION - NY_DEDUCTION),
    exclusionGrantedFromTheFiftyNinthBirthday:
      newYorkTax(NY_PENSION - NY_EXCLUSION - NY_DEDUCTION),
  },
  accepted: 'attainmentOfFiftyNineAndAHalfRequired',
  produced: 'exclusionGrantedFromTheFiftyNinthBirthday',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'NY',
    ordinaryIncome: NY_PENSION,
    privateRetirementIncome: NY_PENSION,
    agesAlive: [59],
  })

  it('grants a 59-year-old the $20,000 subtraction half a year early', () => {
    expect(computeStateTax(pack('NY'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('NY'), scenario)).toBeLessThan(accepted)
  })

  it('withholds it once the gate is raised past the incomplete year', () => {
    // The half-year cannot be written into `minAge` at all — this is the
    // nearest integer that excludes someone who has not yet attained 59½, and
    // it necessarily also excludes those who have.
    const raised = {
      ...pack('NY'),
      retirementPrivate: { kind: 'capped' as const, capPerPerson: NY_EXCLUSION, minAge: 60 },
    }
    expect(computeStateTax(raised, scenario)).toBeCloseTo(accepted, 6)
  })
})

// SC single: 1.99% to 30,000, 5.21% above. Deduction 15,000.
const southCarolinaTax = (taxable: number) => bandedTax(
  [[0, 30_000, 1.99], [30_000, Infinity, 5.21]],
  taxable,
)
const SC_RETIREMENT = 70_000
const SC_DEDUCTION = 15_000
const SC_LOWER_TIER = 3000

describeRule('sc-code-12-6-1170-retirement-income-deduction', {
  readings: {
    threeThousandDollarTierBelowSixtyFive:
      southCarolinaTax(SC_RETIREMENT - SC_LOWER_TIER - SC_DEDUCTION),
    onlyTheSixtyFiveTierModelled: southCarolinaTax(SC_RETIREMENT - SC_DEDUCTION),
  },
  accepted: 'threeThousandDollarTierBelowSixtyFive',
  produced: 'onlyTheSixtyFiveTierModelled',
}, ({ accepted, produced }) => {
  const scenario = input({
    state: 'SC',
    ordinaryIncome: SC_RETIREMENT,
    privateRetirementIncome: SC_RETIREMENT,
    agesAlive: [62],
  })

  it('gives a 62-year-old South Carolinian no deduction at all', () => {
    expect(computeStateTax(pack('SC'), scenario)).toBeCloseTo(produced, 6)
    expect(computeStateTax(pack('SC'), scenario)).toBeGreaterThan(accepted)
  })

  it('reaches the statute’s figure once the lower tier is modelled', () => {
    const lowerTier = {
      ...pack('SC'),
      retirementPrivate: { kind: 'capped' as const, capPerPerson: SC_LOWER_TIER },
    }
    expect(computeStateTax(lowerTier, scenario)).toBeCloseTo(accepted, 6)
  })
})
