/** @vitest-environment jsdom */
/**
 * B2-P1 slice 1 parity, rendered: the Results verdict speaks the engine's
 * `moneyLasts(result)` (family display-years-before-plan-end, owner decision
 * R15). "Through" names the last funded year L = D - 1, "in" names the first
 * short year D, and the count is N = E - L years short of the plan's end in
 * E, so a plan short only in its final year reads 1, never 0. The floor-year
 * income and gap, and a full plan's ending net worth, are in today's dollars
 * by the run's own published inflation factor.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { toTodayDollars } from '@retiregolden/engine/projection/dollarBasis'
import { moneyLasts } from '@retiregolden/engine/projection/moneyLasts'
import { cashAccount, singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { projectPlan } from '../projection'
import { mountPlanPage } from '../testSupport/resultsPageMount'
import { getExampleById } from './examples/registry'
import { fmtMoneyCompact } from './format'
import { ResultsPage } from './ResultsPage'

vi.mock('./useMcSuccessRate', () => ({
  useMcSuccessRateState: () => ({ rate: null, status: 'running', pathCount: 1_000 }),
}))

const START_YEAR = 2026

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

async function verdictOf(plan: Plan): Promise<string> {
  const page = await mountPlanPage(plan, <ResultsPage />)
  try {
    return page.container.querySelector('.results-verdict p')?.textContent ?? ''
  } finally {
    await page.unmount()
  }
}

/** under-saved-single, shortened so the plan ends in its depletion year (D = E = 2046). */
function shortOnlyInFinalYear(): Plan {
  const plan = getExampleById('under-saved-single')!.build()
  plan.household.people[0]!.longevity.planningAge = 84
  return validatePlan(plan)
}

/** A plan with $1,000 of cash, no income and $60,000 of spending: short from its first year. */
function shortFromFirstYear(): Plan {
  const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
  plan.accounts = [cashAccount('cash', 1_000)]
  plan.expenses.baseAnnual = 60_000
  return validatePlan(plan)
}

describe('the depletion sentence renders moneyLasts(result)', () => {
  const cases = [
    {
      name: 'under-saved-single',
      plan: () => getExampleById('under-saved-single')!.build(),
      // It used to say "depletes 6 years before the end of the plan".
      sentence: "Money lasts through 2045, 7 years short of the plan's end in 2052.",
      lasts: { depletionYear: 2046, lastFundedYear: 2045, endYear: 2052, yearsShortOfPlanEnd: 7 },
    },
    {
      name: 'ltc-shock',
      plan: () => getExampleById('ltc-shock')!.build(),
      sentence: "Money lasts through 2032, 24 years short of the plan's end in 2056.",
      lasts: { depletionYear: 2033, lastFundedYear: 2032, endYear: 2056, yearsShortOfPlanEnd: 24 },
    },
    {
      name: 'guardrails-flex-goals',
      plan: () => getExampleById('guardrails-flex-goals')!.build(),
      sentence: "Money lasts through 2040, 15 years short of the plan's end in 2055.",
      lasts: { depletionYear: 2041, lastFundedYear: 2040, endYear: 2055, yearsShortOfPlanEnd: 15 },
    },
    {
      name: 'a plan short only in its final year',
      plan: shortOnlyInFinalYear,
      // The retired count, E - D, read 0 here.
      sentence: "Money lasts through 2045, 1 year short of the plan's end in 2046.",
      lasts: { depletionYear: 2046, lastFundedYear: 2045, endYear: 2046, yearsShortOfPlanEnd: 1 },
    },
  ]

  it.each(cases)('$name', async ({ plan: build, sentence, lasts }) => {
    const plan = build()
    const view = projectPlan(plan, START_YEAR)
    expect(moneyLasts(view.result)).toEqual(lasts)
    const verdict = await verdictOf(plan)
    expect(verdict.startsWith(sentence)).toBe(true)
    expect(verdict).not.toMatch(/depletes \d+ years? before/)
  })

  it('a plan short from its first year names the start year, never the year before it', async () => {
    const plan = shortFromFirstYear()
    const view = projectPlan(plan, START_YEAR)
    const lasts = moneyLasts(view.result)
    expect(lasts.depletionYear).toBe(2026)
    expect(lasts.lastFundedYear).toBe(2025)
    const verdict = await verdictOf(plan)
    expect(verdict.startsWith('The plan is short of money from its first year, 2026.')).toBe(true)
    expect(verdict).not.toContain('through 2025')
  })
})

describe("the verdict's today's-dollar figures use the run's own factor", () => {
  it('under-saved-single: the floor year after depletion prints its income and gap in today dollars', async () => {
    const plan = getExampleById('under-saved-single')!.build()
    const view = projectPlan(plan, START_YEAR)
    const floorYear = view.result.years.find((y) => y.year > view.result.depletionYear!)!
    expect(floorYear.incomes.total).toBeGreaterThan(0.5)
    expect(floorYear.shortfall).toBeGreaterThan(0.5)
    const income = fmtMoneyCompact(toTodayDollars(view.basis, floorYear.year, floorYear.incomes.total))
    const gap = fmtMoneyCompact(toTodayDollars(view.basis, floorYear.year, floorYear.shortfall))
    const verdict = await verdictOf(plan)
    expect(verdict).toContain(`Income doesn't stop: about ${income}/yr (today's dollars)`)
    expect(verdict).toContain(`leaving an uncovered spending gap of about ${gap}/yr.`)
  })

  it('example-couple: a full plan prints its ending net worth in today dollars', async () => {
    const plan = getExampleById('example-couple')!.build()
    const view = projectPlan(plan, START_YEAR)
    expect(view.result.depletionYear).toBeNull()
    const nominal = fmtMoneyCompact(view.result.endingNetWorth)
    const today = fmtMoneyCompact(toTodayDollars(view.basis, view.result.endYear, view.result.endingNetWorth))
    expect(await verdictOf(plan)).toContain(`In steady markets, ending net worth is ${nominal} (${today} in today's dollars).`)
  })
})
