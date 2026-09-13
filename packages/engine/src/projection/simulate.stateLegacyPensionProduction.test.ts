import { expect, it } from 'vitest'
import type { Account } from '../model/plan.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { createStateTaxCalculator } from '../tax/stateTax.js'
import { simulatePlan } from './simulate.js'

function run(dob: string, startAge: number) {
  const plan = singlePersonPlan({ dob, planningAge: 90, state: 'DE' })
  plan.accounts = [{
    type: 'pension',
    id: 'legacy-private-pension',
    name: 'Legacy private pension',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge,
    monthlyAmount: 1_000,
    colaPct: 0,
    survivorPct: 0,
    source: 'private',
  } satisfies Extract<Account, { type: 'pension' }>]
  return simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2026,
    taxCalculator: createStateTaxCalculator(),
  }).years[0]!
}

it('carries a legacy private pension through Delaware exclusion with an independent crossing control', () => {
  // Delaware Code tit. 30 §1106(b)(3) permits age-60 retirement-income
  // exclusion (2026 cap $12,500). A $12,000 private pension is therefore
  // excluded when the Jan-1 age proof is 60; a crossing-year recipient cannot
  // establish the early-distribution gate for the same annual payment.
  const known = run('1966-01-01', 60)
  const crossing = run('1967-01-01', 59)

  expect(known.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'legacy-private-pension',
    sourceKind: 'ordinaryPrivatePension',
    federallyIncludedAmount: 12_000,
    recipientAgeYears: 60,
    recipientAgeKnown: true,
    minimumAgeAtDistributionYears: 60,
    earlyDistributionDisqualifier: 'false',
  }))
  expect(known.tax).toBe(0)
  expect(known.taxComputation?.status).toBe('complete')

  expect(crossing.acceptedTaxInput?.stateRetirementDistributions).toContainEqual(expect.objectContaining({
    accountId: 'legacy-private-pension',
    sourceKind: 'ordinaryPrivatePension',
    federallyIncludedAmount: 12_000,
    recipientAgeYears: 59,
    recipientAgeKnown: true,
    minimumAgeAtDistributionYears: 59,
    earlyDistributionDisqualifier: 'unknown',
  }))
  expect(crossing.taxComputation?.status).toBe('incomplete')
})
