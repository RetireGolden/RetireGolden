import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'

import { AWI_BY_YEAR } from './ssaWageData.js'

const noTax = createFlatTaxCalculator(0)
let counter = 0
const testIds = () => `dis-char-${++counter}`

function awiLevelEarnings1986Through2018(): { year: number; amount: number }[] {
  return Array.from({ length: 33 }, (_, index) => {
    const year = 1986 + index
    const amount = AWI_BY_YEAR[year]
    if (amount === undefined) throw new Error(`expected published AWI for ${year}`)
    return { year, amount }
  })
}

describe('SSDI simulation characterization', () => {
  it('characterizes transport of the retirement-derived PIA into an onset-aware SSDI stream', () => {
    // Characterization regression only: 30,020.40 is the reviewed pre-change
    // 2026 simulation value, not a statutory 2019 or 2026 payable benefit.
    // computePiaFromEarnings uses the 2024 retirement index and ordinary
    // 35-year count; the annual path uses onset only to select SSDI payment behavior.
    const plan: Plan = createEmptyPlan({ newId: testIds, now: () => new Date('2026-06-11T00:00:00.000Z') })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1964-06-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 90, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.incomes = [{
      type: 'socialSecurity',
      id: testIds(),
      personId: 'p1',
      piaMonthly: null,
      earnings: awiLevelEarnings1986Through2018(),
      disability: { onsetAge: 55 },
      claimAge: { years: 62, months: 0 },
    }]
    plan.accounts = [{
      type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null,
      annualReturnPct: null, balance: 2_000_000, annualContribution: 0,
    }]

    const parsed = parsePlan(plan)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const observed = simulatePlan(parsed.plan, { startYear: 2026, taxCalculator: noTax })
      .years.find((y) => y.year === 2026)!.incomes.socialSecurity

    expect(observed).toBeCloseTo(30_020.40, 6)
  })
})
