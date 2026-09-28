import { describe, expect, it } from 'vitest'

import type { Plan } from '../../model/plan.js'
import { couplePlan, productionTaxCalculator, runPlan, socialSecurityIncome, validatePlan } from '../../testing/planFixtures.js'
import { earningsTestReach } from './earningsTestReach.js'

/** Pat, born 1964-06-15, earns the given wages until the given age; Robin has a benefit and no wages. Both COLAs match 2.5% inflation. */
function workingCouple(claimYears = 67, annualGross = 85_000, retirementAge = 64): Plan {
  const plan = couplePlan({ p1Dob: '1964-06-15', p2Dob: '1965-02-01', p1RetirementAge: retirementAge, p1PlanningAge: 95, p2PlanningAge: 95 })
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.ssCola = { mode: 'matchInflation' }
  plan.incomes = [
    { type: 'wages', id: 'w1', personId: 'p1', annualGross, endAge: null, realGrowthPct: 0 } as Plan['incomes'][number],
    socialSecurityIncome('ss-1', 2_000, claimYears, 'p1'),
    socialSecurityIncome('ss-2', 1_200, 67, 'p2'),
  ]
  return validatePlan(plan)
}

const ages = [62, 63, 64, 65, 66, 67, 68, 69, 70]

describe('earningsTestReach', () => {
  it('names the working claimant at the claim ages whose benefit the earnings test would withhold: 62 and 63, while she works to 64', () => {
    expect(earningsTestReach(workingCouple(), { p1: ages, p2: ages }, 2026)).toEqual([{ personId: 'p1', claimAges: [62, 63] }])
  })

  it('agrees with the projection at every claim age: withholding happens in the plan exactly when the reach names the age', () => {
    const named = new Set(earningsTestReach(workingCouple(), { p1: ages }, 2026)[0]!.claimAges)
    for (const claimYears of ages) {
      const result = runPlan(workingCouple(claimYears), productionTaxCalculator())
      const withheld = result.years.some((year) => year.ssEarningsTestWithheld > 0)
      expect(withheld, `claim at ${claimYears}`).toBe(named.has(claimYears))
    }
  })

  it('reaches the full-retirement-age year by its higher exempt amount: $150,000 until 68 is named through 67, as the projection withholds', () => {
    const reach = earningsTestReach(workingCouple(67, 150_000, 68), { p1: ages }, 2026)
    expect(reach).toEqual([{ personId: 'p1', claimAges: [62, 63, 64, 65, 66, 67] }])
    for (const claimYears of [67, 68]) {
      const result = runPlan(workingCouple(claimYears, 150_000, 68), productionTaxCalculator())
      expect(result.years.some((year) => year.ssEarningsTestWithheld > 0), `claim at ${claimYears}`).toBe(claimYears === 67)
    }
  })

  it('leaves out a person with no claim ages asked about and a benefit paid as a disability benefit from its onset', () => {
    expect(earningsTestReach(workingCouple(), { p2: ages }, 2026)).toEqual([])
    const disabled = workingCouple()
    const stream = disabled.incomes[1]!
    if (stream.type !== 'socialSecurity') throw new Error('unexpected stream')
    disabled.incomes[1] = { ...stream, disability: { onsetAge: 55 } }
    expect(earningsTestReach(validatePlan(disabled), { p1: ages }, 2026)).toEqual([])
  })
})
