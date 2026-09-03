/**
 * CHARACTERIZATION tests, not oracle tests (DOCS/testing.md, "Two kinds of
 * tests"). Every expected path and message below was read off the code these
 * checks were moved from — the single `superRefine` body that used to sit on
 * `planSchema` in plan.ts — so they prove only that the pure move did not alter
 * known behavior. They do not prove any of these rules is correct; the rules
 * themselves are unchanged and their correctness is argued where they are
 * documented, not here.
 *
 * What they are for: the extraction is only safe if each check still emits the
 * same issue at the same path with the same words, because planner-ui reads
 * those paths and messages to place field-level validation chrome.
 */

import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import {
  checkAccountCrossFieldRules,
  checkCareEventPersonReferences,
  checkFilingStatusPersonCount,
  checkIncomePersonReferences,
  checkOneTimeGoalWindows,
  checkRecurringIncomeWindows,
  checkRequiredSpendingFloor,
  checkRothConversionFillToTarget,
  type PlanCrossFieldContext,
} from './planCrossFieldChecks.js'
import type { PlanDocument } from './plan.js'
import {
  couplePlan,
  recurringOrdinaryIncome,
  singlePersonPlan,
  socialSecurityIncome,
  traditionalAccount,
} from '../testing/planFixtures.js'

interface CapturedIssue {
  readonly code: unknown
  readonly path: readonly PropertyKey[]
  readonly message: unknown
}

/**
 * Collects what a check hands to Zod. The order of the array is the order the
 * check called `ctx.addIssue`, which is part of what these tests pin.
 */
function issuesFrom(
  check: (plan: PlanDocument, ctx: z.RefinementCtx, context?: PlanCrossFieldContext) => unknown,
  plan: PlanDocument,
): CapturedIssue[] {
  const captured: CapturedIssue[] = []
  const ctx = {
    addIssue: (issue: { code?: unknown; path?: readonly PropertyKey[]; message?: unknown }) => {
      captured.push({ code: issue.code, path: issue.path ?? [], message: issue.message })
    },
  } as unknown as z.RefinementCtx
  check(plan, ctx)
  return captured
}

describe('checkRequiredSpendingFloor', () => {
  it('refuses a required floor above the baseline lifestyle', () => {
    const plan = singlePersonPlan()
    plan.expenses.baseAnnual = 60_000
    plan.expenses.requiredAnnual = 60_001
    expect(issuesFrom(checkRequiredSpendingFloor, plan)).toEqual([
      {
        code: 'custom',
        path: ['expenses', 'requiredAnnual'],
        message: 'required annual spending cannot exceed baseline (target) annual spending',
      },
    ])
  })

  it('allows a required floor equal to the baseline, and an absent one', () => {
    const plan = singlePersonPlan()
    plan.expenses.baseAnnual = 60_000
    plan.expenses.requiredAnnual = 60_000
    expect(issuesFrom(checkRequiredSpendingFloor, plan)).toEqual([])
    delete plan.expenses.requiredAnnual
    expect(issuesFrom(checkRequiredSpendingFloor, plan)).toEqual([])
  })
})

describe('checkFilingStatusPersonCount', () => {
  it('refuses marriedFilingJointly with one person', () => {
    const plan = singlePersonPlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    expect(issuesFrom(checkFilingStatusPersonCount, plan)).toEqual([
      {
        code: 'custom',
        path: ['household', 'filingStatus'],
        message: 'marriedFilingJointly requires exactly two people',
      },
    ])
  })

  it('accepts marriedFilingJointly with two people', () => {
    const plan = couplePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    expect(issuesFrom(checkFilingStatusPersonCount, plan)).toEqual([])
  })
})

describe('checkOneTimeGoalWindows', () => {
  it('reports the window, goal-year, and partial-funding refusals in source order', () => {
    const plan = singlePersonPlan()
    plan.expenses.oneTimeGoals = [
      {
        id: 'g1',
        label: 'Roof',
        year: 2030,
        amount: 20_000,
        earliestYear: 2032,
        latestYear: 2029,
        allowPartialFunding: true,
        minFundingPct: 100,
      },
    ]
    expect(issuesFrom(checkOneTimeGoalWindows, plan)).toEqual([
      {
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', 0, 'earliestYear'],
        message: 'earliestYear cannot be after latestYear',
      },
      {
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', 0, 'earliestYear'],
        message: 'earliestYear cannot be after the goal year',
      },
      {
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', 0, 'latestYear'],
        message: 'latestYear cannot be before the goal year',
      },
      {
        code: 'custom',
        path: ['expenses', 'oneTimeGoals', 0, 'minFundingPct'],
        message: 'partial funding requires a minimum funding percent below 100',
      },
    ])
  })

  it('accepts a window that brackets the goal year', () => {
    const plan = singlePersonPlan()
    plan.expenses.oneTimeGoals = [
      { id: 'g1', label: 'Roof', year: 2030, amount: 20_000, earliestYear: 2029, latestYear: 2031 },
    ]
    expect(issuesFrom(checkOneTimeGoalWindows, plan)).toEqual([])
  })
})

describe('checkRecurringIncomeWindows', () => {
  it('refuses a recurring stream that ends before it starts', () => {
    const plan = singlePersonPlan()
    const income = recurringOrdinaryIncome('i1', 12_000, 2035)
    plan.incomes = [{ ...income, endYear: 2034 } as typeof income]
    expect(issuesFrom(checkRecurringIncomeWindows, plan)).toEqual([
      {
        code: 'custom',
        path: ['incomes', 0, 'endYear'],
        message: 'a recurring income must end in or after the year it starts',
      },
    ])
  })

  it('leaves an open-ended stream alone', () => {
    const plan = singlePersonPlan()
    plan.incomes = [recurringOrdinaryIncome('i1', 12_000, 2035)]
    expect(issuesFrom(checkRecurringIncomeWindows, plan)).toEqual([])
  })
})

describe('checkIncomePersonReferences', () => {
  it('refuses a Social Security stream naming an unknown person', () => {
    const plan = singlePersonPlan()
    plan.incomes = [socialSecurityIncome('ss1', 2_000, 67, 'ghost')]
    expect(issuesFrom(checkIncomePersonReferences, plan)).toEqual([
      {
        code: 'custom',
        path: ['incomes', 0, 'personId'],
        message: 'unknown person id "ghost"',
      },
    ])
  })
})

describe('checkCareEventPersonReferences', () => {
  it('refuses a care episode naming an unknown person', () => {
    const plan = singlePersonPlan()
    plan.careEvents = [
      { id: 'c1', personId: 'ghost', startAge: 85, durationYears: 3, annualCost: 90_000 },
    ]
    expect(issuesFrom(checkCareEventPersonReferences, plan)).toEqual([
      {
        code: 'custom',
        path: ['careEvents', 0, 'personId'],
        message: 'unknown person id "ghost"',
      },
    ])
  })
})

describe('checkAccountCrossFieldRules', () => {
  it('requires an individual owner on a traditional account', () => {
    const plan = singlePersonPlan()
    plan.accounts = [{ ...traditionalAccount('t1', 100_000), ownerPersonId: null }]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 0, 'ownerPersonId'],
        message: 'traditional accounts must have an individual owner',
      },
    ])
  })

  it('refuses an owner id no person in the household carries', () => {
    const plan = singlePersonPlan()
    plan.accounts = [traditionalAccount('t1', 100_000, 'ghost')]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 0, 'ownerPersonId'],
        message: 'unknown person id "ghost"',
      },
    ])
  })
})

describe('checkRothConversionFillToTarget', () => {
  it('refuses a conversion window that ends before it starts, and a zero MAGI target', () => {
    const plan = singlePersonPlan()
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'fixedMagi',
      targetValue: 0,
      startYear: 2030,
      endYear: 2029,
    }
    expect(issuesFrom(checkRothConversionFillToTarget, plan)).toEqual([
      {
        code: 'custom',
        path: ['strategies', 'rothConversion', 'endYear'],
        message: 'a conversion window must end in or after the year it starts',
      },
      {
        code: 'custom',
        path: ['strategies', 'rothConversion', 'targetValue'],
        message: 'a fixed MAGI target must be above 0',
      },
    ])
  })

  it('refuses a bracket target the pack does not publish below the top bracket', () => {
    const plan = singlePersonPlan()
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 37,
      startYear: 2030,
      endYear: 2035,
    }
    const issues = issuesFrom(checkRothConversionFillToTarget, plan)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe('custom')
    expect(issues[0]!.path).toEqual(['strategies', 'rothConversion', 'targetValue'])
    // The list itself is read from the parameter pack, so only the sentence
    // shape is pinned here; the rates are the pack's to publish.
    expect(issues[0]!.message).toMatch(
      /^a bracket target must be one of the published rates below the top bracket \([\d, ]+\)$/u,
    )
  })

  it('leaves a plan with no fill-to-target window alone', () => {
    const plan = singlePersonPlan()
    plan.strategies.rothConversion = { mode: 'none' }
    expect(issuesFrom(checkRothConversionFillToTarget, plan)).toEqual([])
  })
})
