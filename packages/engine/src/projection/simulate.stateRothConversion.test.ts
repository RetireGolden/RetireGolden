/**
 * Roth conversions in the state retirement rows of actual simulatePlan years.
 *
 * Both conversion paths mark the conversion on the row without splitting the
 * event: the conversion strategy's own `conversion` events are conversion in
 * full, and a named request shares its account's `forced` event with that
 * year's RMD. The part converted at 59 and a half or older is read on the
 * request's execution date when the plan gives one, otherwise on January 1.
 * Michigan and New York count a conversion only at that age, and the fixtures
 * below price their subtraction from the rows the year actually produced.
 */
import { describe, expect, it } from 'vitest'
import { parseRetirementActionRequest } from '../actions/index.js'
import type { Account, Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createStateTaxCalculator, type StateTaxComputationResult } from '../tax/stateTax.js'
import { productionTaxCalculator, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput, YearResult } from './types.js'

const TAX_YEAR = 2026
const stateDetail: { computeResult(input: TaxYearInput): StateTaxComputationResult } = createStateTaxCalculator()

function account(type: 'traditional' | 'roth', id: string, balance: number): Account {
  return { type, id, name: id, ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance, annualContribution: 0 } as Account
}
function cash(balance: number): Account {
  return { type: 'cash', id: 'cash', name: 'cash', ownerPersonId: 'p1', annualReturnPct: 0, balance, annualContribution: 0 }
}

/** One owner converting through the conversion strategy, no date. */
function strategyConversionPlan(state: string, dob: string, amount: number): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 95, state })
  plan.accounts = [cash(500_000), account('traditional', 'ira-a', 200_000), account('roth', 'roth-a', 0)]
  plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: TAX_YEAR, amount }] }
  return plan
}

/** One owner converting through a named request on `executionDate`. */
function namedConversionPlan(state: string, dob: string, amount: number, executionDate: string): Plan {
  const plan = singlePersonPlan({ dob, planningAge: 95, state })
  plan.accounts = [cash(500_000), account('traditional', 'ira-a', 200_000), account('roth', 'roth-a', 0)]
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'ira-a-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'ira-a',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  const parsed = parseRetirementActionRequest({
    actionId: 'named-conversion',
    kind: 'rothConversion',
    personId: 'p1',
    year: TAX_YEAR,
    executionDate,
    executionSequence: 1,
    requestedAmount: amount * 100,
    allocations: [{ allocationId: 'named-conversion-allocation', sourceAccountId: 'ira-a', requestedAmount: amount * 100 }],
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'noneExpected' },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  plan.strategies.retirementActions = [parsed.request]
  return plan
}

function year(plan: Plan): YearResult {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: productionTaxCalculator(),
  }).years[0]!
}

function rows(result: YearResult) {
  const input = result.acceptedTaxInput
  if (input?.stateRetirementDistributions === undefined) throw new Error('state retirement rows missing')
  return input.stateRetirementDistributions.filter((row) => row.accountId === 'ira-a')
}

/** The drop in state taxable income the year's rows produce, against the same year with none. */
function stateSubtraction(result: YearResult): number {
  const input = result.acceptedTaxInput
  if (input === undefined) throw new Error('acceptedTaxInput missing')
  return stateDetail.computeResult({ ...input, stateRetirementDistributions: [] }).taxableIncome -
    stateDetail.computeResult(input).taxableIncome
}

describe('state retirement rows mark Roth conversions', () => {
  it('marks a strategy conversion in full, at 59 and a half by January 1 or not', () => {
    // Born 1960-01-01: 66 on January 1, 2026. Born 1966-08-01: 59 and five
    // months on January 1, so not yet 59 and a half then.
    const older = rows(year(strategyConversionPlan('KY', '1960-01-01', 30_000)))
    expect(older).toEqual([expect.objectContaining({ federallyIncludedAmount: 30_000, rothConversionAmount: 30_000, rothConversionAmountAtAge59HalfOrOlder: 30_000 })])
    const crossing = rows(year(strategyConversionPlan('KY', '1966-08-01', 30_000)))
    expect(crossing).toEqual([expect.objectContaining({ federallyIncludedAmount: 30_000, rothConversionAmount: 30_000, rothConversionAmountAtAge59HalfOrOlder: 0 })])
  })

  it('reads a named conversion’s age on its execution date', () => {
    // Born 1966-08-01: 59 and a half on 2026-02-01.
    const after = rows(year(namedConversionPlan('KY', '1966-08-01', 10_000, '2026-10-15')))
    expect(after).toEqual([expect.objectContaining({ federallyIncludedAmount: 10_000, rothConversionAmount: 10_000, rothConversionAmountAtAge59HalfOrOlder: 10_000 })])
    const before = rows(year(namedConversionPlan('KY', '1966-08-01', 10_000, '2026-01-15')))
    expect(before).toEqual([expect.objectContaining({ rothConversionAmount: 10_000, rothConversionAmountAtAge59HalfOrOlder: 0 })])
  })

  it('marks a named conversion inside the account’s RMD event without splitting it', () => {
    // Born 1951-01-01: 75 in 2026, so the IRA also pays its RMD. One forced
    // row carries both; the conversion is $10,000 of its included amount.
    const result = year(namedConversionPlan('KY', '1951-01-01', 10_000, '2026-06-15'))
    const forced = rows(result).filter((row) => row.eventId?.startsWith('forced:'))
    expect(forced).toHaveLength(1)
    expect(result.rmd).toBeGreaterThan(0)
    expect(forced[0]!.federallyIncludedAmount).toBeCloseTo(result.rmd + 10_000, 6)
    expect(forced[0]!.rothConversionAmount).toBeCloseTo(10_000, 6)
    expect(forced[0]!.rothConversionAmountAtAge59HalfOrOlder).toBeCloseTo(10_000, 6)
  })
})

describe('Pennsylvania, a conversion before 60 through the projection', () => {
  it('leaves a $40,000 IRA conversion at 50 untaxed', () => {
    // Born 1976-01-01, 50. The conversion is the year's only income, so
    // Pennsylvania's base is $40,000 and the 2025 PA-40 instructions take all
    // of it off: $0 of tax, where the engine charged 3.07%, $1,228.00.
    const result = year(strategyConversionPlan('PA', '1976-01-01', 40_000))
    const input = result.acceptedTaxInput!
    expect(input.ordinaryIncome).toBeCloseTo(40_000, 6)
    expect(stateDetail.computeResult(input).amount).toBeCloseTo(0, 6)
    expect(stateDetail.computeResult({ ...input, stateRetirementDistributions: [] }).amount).toBeCloseTo(1_228, 6)
  })
})

describe('Connecticut, a conversion through the projection', () => {
  it('keeps the conversion on the traditional account inside the IRA schedule', () => {
    // Born 1960-01-01. The $30,000 conversion is the year's only income, so
    // federal AGI is under $75,000 and (xxviii) subtracts 100%. The row is the
    // traditional IRA's, not the Roth's, so the Roth exception leaves it in.
    const result = year(strategyConversionPlan('CT', '1960-01-01', 30_000))
    expect(rows(result)).toEqual([expect.objectContaining({ accountTaxTreatment: 'traditional', rothConversionAmount: 30_000 })])
    expect(stateSubtraction(result)).toBeCloseTo(30_000, 6)
  })
})

describeRule('mi-treasury-roth-conversion-at-59-and-a-half', {
  readings: {
    // Born 1966-08-01, 59 and a half on 2026-02-01, converting $30,000
    // through the conversion strategy, which gives no date. Michigan counts
    // it if made on or after February 1, all $30,000 under the $67,610 limit.
    conversionAfterTheHalfBirthday: 30_000,
    // The engine reads January 1 without a date, when the owner is not yet
    // 59 and a half, and subtracts nothing.
    readOnJanuaryFirst: 0,
  },
  accepted: 'conversionAfterTheHalfBirthday',
  produced: 'readOnJanuaryFirst',
}, ({ accepted, produced }) => {
  it('gives an undated conversion in the half-birthday year no subtraction', () => {
    const subtraction = stateSubtraction(year(strategyConversionPlan('MI', '1966-08-01', 30_000)))
    expect(subtraction).toBe(produced)
    expect(subtraction).not.toBe(accepted)
  })
  it('subtracts a conversion at 59 and a half, dated or by January 1, and none before', () => {
    expect(stateSubtraction(year(namedConversionPlan('MI', '1966-08-01', 30_000, '2026-10-15')))).toBe(30_000)
    expect(stateSubtraction(year(strategyConversionPlan('MI', '1960-01-01', 30_000)))).toBe(30_000)
    // Born 1971, 55: the engine used to subtract all of it.
    expect(stateSubtraction(year(strategyConversionPlan('MI', '1971-01-01', 30_000)))).toBe(0)
  })
})

describeRule('ny-tsb-m-98-7-i-roth-conversion-at-59-and-a-half', {
  readings: {
    // The same owner and conversion in New York: $20,000 of the $30,000 is
    // excluded if it was made at 59 and a half.
    conversionAfterTheHalfBirthday: 20_000,
    readOnJanuaryFirst: 0,
  },
  accepted: 'conversionAfterTheHalfBirthday',
  produced: 'readOnJanuaryFirst',
}, ({ accepted, produced }) => {
  it('gives an undated conversion in the half-birthday year no exclusion', () => {
    // 60 at the end of 2026, so the pack's age-59 gate is met; before
    // 2026-10-06 the engine excluded $20,000.
    const subtraction = stateSubtraction(year(strategyConversionPlan('NY', '1966-08-01', 30_000)))
    expect(subtraction).toBe(produced)
    expect(subtraction).not.toBe(accepted)
  })
  it('excludes $20,000 of a conversion at 59 and a half, dated or by January 1', () => {
    expect(stateSubtraction(year(namedConversionPlan('NY', '1966-08-01', 30_000, '2026-10-15')))).toBe(20_000)
    expect(stateSubtraction(year(strategyConversionPlan('NY', '1960-01-01', 30_000)))).toBe(20_000)
  })
})
