/**
 * Pins irc-223-f-8-B-estate-predeath-expense-reduction: the after-tax estate
 * metric uses ending HSA gross as the terminal inclusion base for a designated
 * non-spouse destination and does not apply the 223(f)(8)(B)(ii)(I) reduction.
 *
 * Independent worksheet (latent; the Plan cannot express these facts — they
 * are not entered as healthcare spending or reimburseLater, which would debit
 * a different household cost):
 *   designated natural person (not the estate, not a spouse, not charity)
 *   death 2027-01-01; fair-market value unchanged at 50,000
 *   qualified unreimbursed medical expense 10,000 incurred 2026-12-20
 *   paid 2027-06-30 by the beneficiary from outside funds (within 1 year)
 *   no relevant estate tax, so IRC 691(c) = 0
 *   statute: inclusion 50,000 − 10,000 = 40,000; tax at 25% = 10,000
 *   engine: inclusion 50,000; tax at 25% = 12,500
 *   wrong reading that excludes the whole balance: 0 / 0
 *
 * Observed produced values (public e92 main, not guessed): 2026 single person
 * DOB 1966-01-01, planningAge 60, no income/spending/healthcare/contributions,
 * no conversion, inflation/returns 0, 50,000 HSA with explicit
 * estateBeneficiary.nonSpouse, heir 25%, flat tax 0 → ending HSA 50,000,
 * annual tax/penalty 0, terminal base 50,000, haircut 12,500.
 */

import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import { parsePlan, type Plan } from '../../model/plan.js'
import { summarizeProjection } from '../../projection/compare.js'
import { simulatePlan } from '../../projection/simulate.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { singlePersonPlan } from '../../testing/planFixtures.js'

const noTax = createFlatTaxCalculator(0)

const HSA_BALANCE = 50_000
const HEIR_RATE_PCT = 25
const QUALIFYING_PREDEATH_EXPENSE = 10_000

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function nonSpouseHsaPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
  plan.assumptions.heirTaxRatePct = HEIR_RATE_PCT
  plan.accounts = [{
    type: 'hsa',
    id: 'hsa',
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: HSA_BALANCE,
    annualContribution: 0,
    estateBeneficiary: { destination: 'nonSpouse' },
  }]
  return validate(plan)
}

describeRule('irc-223-f-8-B-estate-predeath-expense-reduction', {
  readings: {
    statutePredeathExpenseReduction: {
      taxablePretaxBase: HSA_BALANCE - QUALIFYING_PREDEATH_EXPENSE,
      heirTax: (HSA_BALANCE - QUALIFYING_PREDEATH_EXPENSE) * (HEIR_RATE_PCT / 100),
    },
    omittedExpenseReduction: {
      taxablePretaxBase: HSA_BALANCE,
      heirTax: HSA_BALANCE * (HEIR_RATE_PCT / 100),
    },
    wholeBalanceExcluded: {
      taxablePretaxBase: 0,
      heirTax: 0,
    },
  },
  accepted: 'statutePredeathExpenseReduction',
  produced: 'omittedExpenseReduction',
}, ({ accepted, produced, readings }) => {
  it('taxes ending HSA gross at the heir rate and omits the predeath-expense reduction', () => {
    const plan = nonSpouseHsaPlan()
    const result = simulatePlan(plan, { startYear: 2026, taxCalculator: noTax })
    const summary = summarizeProjection(plan, result)
    const last = result.years[result.years.length - 1]
    const hsaRow = summary.estateBreakdown.find((row) => row.accountId === 'hsa')

    expect(result.years).toHaveLength(1)
    expect(last?.year).toBe(2026)
    expect(last?.tax).toBe(0)
    expect(last?.penalties).toBe(0)
    expect(last?.balances.hsa).toBe(HSA_BALANCE)
    expect(summary.endingByCategory.hsa).toBe(HSA_BALANCE)

    expect(hsaRow).toEqual(expect.objectContaining({
      accountId: 'hsa',
      category: 'hsa',
      destination: 'nonSpouse',
      grossBalance: HSA_BALANCE,
      taxablePretaxBase: produced.taxablePretaxBase,
      heirTax: produced.heirTax,
    }))
    expect(summary.endingEstateHeirTax).toBe(produced.heirTax)
    expect(hsaRow?.taxablePretaxBase).not.toBe(accepted.taxablePretaxBase)
    expect(hsaRow?.heirTax).not.toBe(accepted.heirTax)
    expect(hsaRow?.taxablePretaxBase).not.toBe(readings.wholeBalanceExcluded.taxablePretaxBase)
    expect(hsaRow?.heirTax).not.toBe(readings.wholeBalanceExcluded.heirTax)
  })
})
