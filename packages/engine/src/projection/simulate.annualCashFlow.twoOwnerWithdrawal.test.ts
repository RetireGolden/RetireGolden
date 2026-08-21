/**
 * Stage 6 two-owner withdrawal reference fixture.
 *
 * Couple, each with an owned traditional IRA, wages $0, sequential
 * need-based drain of both accounts in the same year after per-owner RMD.
 * Discriminates a merged `withdrawals.traditional` aggregate from
 * per-account need-based lines and per-owner owned-IRA RMD pools.
 *
 * RMD expected values are the Pub 590-B Uniform Lifetime worksheet used by
 * `rmd.golden.test.ts`: prior-year-end balance / pack divisor. Never taken
 * from `assembleYearCashFlow`.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '../model/plan.js'
import { packForYear, uniformLifetimeDivisor } from '../params/index.js'
import {
  cashAccount,
  couplePlan,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearCashFlowSourceLine, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026
const pack = packForYear(START_YEAR).pack

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function yearOf(years: readonly YearResult[], calendarYear: number): YearResult {
  const year = years.find((row) => row.year === calendarYear)
  if (year === undefined) throw new Error(`missing year ${calendarYear}`)
  return year
}

function sourceById(year: YearResult, id: string): YearCashFlowSourceLine {
  const line = year.cashFlow?.sourceLines.find((row) => row.id === id)
  if (line === undefined) throw new Error(`missing source line ${id}`)
  return line
}

describe('simulatePlan annual cash-flow two-owner withdrawal', () => {
  it('publishes per-account need-based lines and per-owner RMD pools, never a merged traditional line', () => {
    // Independent worksheet, year 2026, 0% growth, 0% inflation, $0 tax:
    //   both born 1953-01-01 → attained 73. SECURE 2.0 start age 73
    //   (same cohort rule as rmd.golden.test.ts).
    //   Uniform Lifetime divisor D from the 2026 pack (Pub 590-B).
    //   p1 IRA opening 100_000 → RMD1 = 100_000 / D
    //   p2 IRA opening  50_000 → RMD2 =  50_000 / D
    //   wages 0. requiredAnnual omitted → required lifestyle = baseAnnual 110_000.
    //   Medicare Part B standard (IRMAA tier 0, lookback MAGI 0) × 12 × 2 people.
    //   cash inflows = RMD1 + RMD2
    //   need-based total = 110_000 + healthcare − RMD1 − RMD2
    //   sequential drain (plan account order): cash-1 is empty, then traditional
    //   ira-p1 then ira-p2. p1 remaining after RMD is fully taken; remainder
    //   from p2. Design row lists two owned IRAs and no employer plan.
    const p1Opening = 100_000
    const p2Opening = 50_000
    const lifestyle = 110_000
    const ageAttained = 73
    const divisor = uniformLifetimeDivisor(pack, ageAttained)
    if (divisor === undefined || divisor <= 0) {
      throw new Error(`missing Uniform Lifetime divisor at age ${ageAttained}`)
    }
    const rmd1 = p1Opening / divisor
    const rmd2 = p2Opening / divisor
    const healthcare = pack.medicare.partBStandardMonthly * 12 * 2
    const needBasedTotal = lifestyle + healthcare - rmd1 - rmd2
    const p1NeedBased = p1Opening - rmd1
    const p2NeedBased = needBasedTotal - p1NeedBased

    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1953-01-01',
      p1PlanningAge: 80,
      p2PlanningAge: 80,
      p1RetirementAge: null,
      p2RetirementAge: null,
    })
    plan.accounts = [
      cashAccount('cash-1', 0),
      traditionalAccount('ira-p1', p1Opening, 'p1', 'ira'),
      traditionalAccount('ira-p2', p2Opening, 'p2', 'ira'),
    ]
    plan.expenses.baseAnnual = lifestyle

    const y2026 = yearOf(
      simulatePlan(validate(plan), {
        startYear: START_YEAR,
        taxCalculator: noTax,
        captureAnnualCashFlow: true,
        horizonEndYear: START_YEAR,
      }).years,
      START_YEAR,
    )

    expect(y2026.cashFlow).toBeDefined()
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')

    const p1Rmd = sourceById(y2026, 'source:requiredMinimumDistribution:ownedIraPool:p1')
    expect(p1Rmd.kind).toBe('requiredMinimumDistribution')
    expect(p1Rmd.role).toBe('portfolioFunding')
    expectMoney(p1Rmd.amountPlanDollars, rmd1)
    expect(p1Rmd.identities).toEqual([
      { entityKind: 'requiredDistributionPool', personId: 'p1' },
    ])

    const p2Rmd = sourceById(y2026, 'source:requiredMinimumDistribution:ownedIraPool:p2')
    expect(p2Rmd.kind).toBe('requiredMinimumDistribution')
    expect(p2Rmd.role).toBe('portfolioFunding')
    expectMoney(p2Rmd.amountPlanDollars, rmd2)
    expect(p2Rmd.identities).toEqual([
      { entityKind: 'requiredDistributionPool', personId: 'p2' },
    ])

    const p1Need = sourceById(y2026, 'source:needBasedPortfolioWithdrawal:ira-p1')
    expect(p1Need.kind).toBe('needBasedPortfolioWithdrawal')
    expect(p1Need.role).toBe('portfolioFunding')
    expectMoney(p1Need.amountPlanDollars, p1NeedBased)
    expect(p1Need.identities).toEqual([
      { entityKind: 'account', accountId: 'ira-p1' },
      { entityKind: 'person', personId: 'p1' },
    ])

    const p2Need = sourceById(y2026, 'source:needBasedPortfolioWithdrawal:ira-p2')
    expect(p2Need.kind).toBe('needBasedPortfolioWithdrawal')
    expect(p2Need.role).toBe('portfolioFunding')
    expectMoney(p2Need.amountPlanDollars, p2NeedBased)
    expect(p2Need.identities).toEqual([
      { entityKind: 'account', accountId: 'ira-p2' },
      { entityKind: 'person', personId: 'p2' },
    ])

    const needBased = y2026.cashFlow!.sourceLines.filter(
      (line) => line.kind === 'needBasedPortfolioWithdrawal',
    )
    expect(needBased.map((line) => line.id).sort()).toEqual([
      'source:needBasedPortfolioWithdrawal:ira-p1',
      'source:needBasedPortfolioWithdrawal:ira-p2',
    ])
    const rmdPools = y2026.cashFlow!.sourceLines.filter(
      (line) => line.id.startsWith('source:requiredMinimumDistribution:ownedIraPool:'),
    )
    expect(rmdPools.map((line) => line.id).sort()).toEqual([
      'source:requiredMinimumDistribution:ownedIraPool:p1',
      'source:requiredMinimumDistribution:ownedIraPool:p2',
    ])
    expect(y2026.cashFlow!.sourceLines.some((line) =>
      line.id === 'source:requiredMinimumDistribution:account:ira-p1' ||
      line.id === 'source:requiredMinimumDistribution:account:ira-p2',
    )).toBe(false)
    expect(y2026.cashFlow!.sourceLines.some((line) =>
      (line.kind as string) === 'traditional',
    )).toBe(false)
    expect(needBased.some((line) =>
      line.identities.filter((identity) => identity.entityKind === 'account').length !== 1,
    )).toBe(false)

    expectMoney(y2026.rmd, rmd1 + rmd2)
    expectMoney(y2026.expenses.healthcare, healthcare)
    expectMoney(
      y2026.withdrawals.traditional,
      rmd1 + rmd2 + p1NeedBased + p2NeedBased,
    )
    expectMoney(p1Need.amountPlanDollars + p2Need.amountPlanDollars, needBasedTotal)
    expect(p2NeedBased).toBeGreaterThan(0)
  })
})
