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
  checkSpendingPhasesPerson,
  type PlanCrossFieldContext,
} from './planCrossFieldChecks.js'
import type { PlanDocument } from './plan.js'
import { packForYear } from '../params/index.js'
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

/**
 * Schema v7 (decision D-PEOPLE-ORDER): the rules that name a person where the
 * plan used to read list position. These are oracle tests of the new rules:
 * the owner rules follow IRC 408(a) and (b), IRC 72(c)(3)(A) and Treas. Reg.
 * 1.72-5(b)(1) and 1.401(a)(9)-6(q)(1) (see
 * DOCS/calculations/accounts-and-growth/guaranteed-income-owner.md).
 */
describe('v7: people named, never read by position', () => {
  it('requires an owner on every pension and annuity, in plain words', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.accounts = [
      { type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: null, annualReturnPct: 0, startAge: 65, monthlyAmount: 1_000, colaPct: 0, survivorPct: 50 },
      { type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: null, annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 100 },
    ]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      { code: 'custom', path: ['accounts', 0, 'ownerPersonId'], message: 'a pension must name its owner, the person who earned it' },
      { code: 'custom', path: ['accounts', 1, 'ownerPersonId'], message: 'an annuity must name its annuitant, the person whose age starts it and whose life it pays for' },
    ])
  })

  it('refuses a qualified annuity bought from one person\u2019s IRA but named for the other, and accepts the owner\u2019s own', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    const contract = (owner: string) => ({
      type: 'annuity' as const, id: 'ann', name: 'Contract', ownerPersonId: owner, annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 100,
      purchase: { year: 2027, premium: 50_000, fundingAccountId: 'ira-p2', taxQualification: 'qualified' as const },
    })
    plan.accounts = [traditionalAccount('ira-p2', 300_000, 'p2'), contract('p1')]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 1, 'ownerPersonId'],
        message: "an annuity bought from an IRA or 401(k) belongs to that account's owner: make Robin its annuitant, or buy it from one of Pat's own accounts",
      },
    ])
    plan.accounts = [traditionalAccount('ira-p2', 300_000, 'p2'), contract('p2')]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([])
  })

  it('refuses a qualified annuity bought from the other person\u2019s 401(k) while its owner lives, as from an IRA (review L4, E10)', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.accounts = [
      traditionalAccount('k-p2', 300_000, 'p2', 'employer'),
      {
        type: 'annuity', id: 'ann', name: 'Contract', ownerPersonId: 'p1', annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 100,
        purchase: { year: 2027, premium: 50_000, fundingAccountId: 'k-p2', taxQualification: 'qualified' },
      },
    ]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 1, 'ownerPersonId'],
        message: "an annuity bought from an IRA or 401(k) belongs to that account's owner: make Robin its annuitant, or buy it from one of Pat's own accounts",
      },
    ])
  })

  it('accepts a surviving spouse\u2019s qualified purchase from the dead owner\u2019s 401(k) or IRA, and refuses one named for the dead (review M2)', () => {
    // Robin's planning age 60 ends in 2026 (born 1966); the purchase is in
    // 2032. A distribution paid to the spouse after the employee's death is
    // treated as if the spouse were the employee (IRC 402(c)(9)), and a
    // spouse's IRA is not inherited (IRC 408(d)(3)(C)(ii)(II)), so Pat, alive,
    // may buy from what was Robin's account.
    for (const kind of ['employer', 'ira'] as const) {
      const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 60 })
      const contract = (owner: string) => ({
        type: 'annuity' as const, id: 'ann', name: 'Contract', ownerPersonId: owner, annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 100,
        purchase: { year: 2032, premium: 50_000, fundingAccountId: 'acct-p2', taxQualification: 'qualified' as const },
      })
      plan.accounts = [traditionalAccount('acct-p2', 300_000, 'p2', kind), contract('p1')]
      expect(issuesFrom(checkAccountCrossFieldRules, plan), kind).toEqual([])
      plan.accounts = [traditionalAccount('acct-p2', 300_000, 'p2', kind), contract('p2')]
      expect(issuesFrom(checkAccountCrossFieldRules, plan), kind).toEqual([
        {
          code: 'custom',
          path: ['accounts', 1, 'ownerPersonId'],
          message: "Robin's planning age ends in 2026, so an annuity bought in 2032 on Robin's life would never pay: name a person who is alive in 2032, or buy it in 2026 or earlier",
        },
      ])
    }
  })

  it('keeps the spouse exception to the years after the owner’s death: a purchase in the owner’s last year alive is still the owner’s (review N4, V05)', () => {
    // Robin (born 1966, planning age 70) is alive through 2036. Bought in 2036
    // from Robin's IRA, the contract is Robin's, and naming Pat is refused; in
    // 2037, after Robin's planning age, Pat may buy it as the surviving spouse.
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 70 })
    const contract = (year: number) => ({
      type: 'annuity' as const, id: 'ann', name: 'Contract', ownerPersonId: 'p1', annualReturnPct: null, startAge: 72, monthlyAmount: 500, colaPct: 0, taxablePct: 100,
      purchase: { year, premium: 50_000, fundingAccountId: 'ira-p2', taxQualification: 'qualified' as const },
    })
    plan.accounts = [traditionalAccount('ira-p2', 300_000, 'p2'), contract(2036)]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 1, 'ownerPersonId'],
        message: "an annuity bought from an IRA or 401(k) belongs to that account's owner: make Robin its annuitant, or buy it from one of Pat's own accounts",
      },
    ])
    plan.accounts = [traditionalAccount('ira-p2', 300_000, 'p2'), contract(2037)]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([])
  })

  it('refuses any annuity bought for a person whose planning age has ended by the purchase year, in plain words (review M2)', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 60 })
    plan.accounts = [
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 200_000, annualContribution: 0 },
      {
        type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: 'p2', annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 40,
        purchase: { year: 2027, premium: 50_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
      },
    ]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 1, 'ownerPersonId'],
        message: "Robin's planning age ends in 2026, so an annuity bought in 2027 on Robin's life would never pay: name a person who is alive in 2027, or buy it in 2026 or earlier",
      },
    ])
    plan.accounts[1] = { ...plan.accounts[1]!, purchase: { year: 2026, premium: 50_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' } } as never
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([])
  })

  it('accepts a non-qualified annuity bought from a joint account for either person', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.accounts = [
      { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 200_000, annualContribution: 0 },
      {
        type: 'annuity', id: 'ann', name: 'SPIA', ownerPersonId: 'p2', annualReturnPct: null, startAge: 70, monthlyAmount: 500, colaPct: 0, taxablePct: 40,
        purchase: { year: 2027, premium: 50_000, fundingAccountId: 'cash', taxQualification: 'nonQualified' },
      },
    ]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([])
  })

  it('refuses a pension lump sum rolled into the other person\u2019s IRA', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.updatedAtIso = '2026-06-01T00:00:00.000Z'
    plan.accounts = [
      traditionalAccount('ira-p1', 100_000, 'p1'),
      traditionalAccount('ira-p2', 100_000, 'p2'),
      {
        type: 'pension', id: 'pen', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0, startAge: 65, monthlyAmount: 1_000, colaPct: 0, survivorPct: 50,
        lumpSumOffer: { amount: 200_000, electionYear: 2027 }, lumpSumElection: { rolloverAccountId: 'ira-p2' },
      },
    ]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      {
        code: 'custom',
        path: ['accounts', 2, 'lumpSumElection', 'rolloverAccountId'],
        message: "a pension lump sum rolls over only into an IRA or 401(k) of the person who earned it: choose one of Pat's own traditional accounts",
      },
    ])
  })

  it('decides a QLAC\u2019s latest start on its annuitant\u2019s own birth month, whoever is listed first', () => {
    // A December birth gets one more start age (the first of the month after
    // the 85th birthday falls in the next calendar year).
    const plan = couplePlan({ p1Dob: '1960-12-10', p2Dob: '1962-03-10', p1PlanningAge: 95, p2PlanningAge: 95 })
    const qlac = (owner: string, funding: string) => ({
      type: 'annuity' as const, id: 'qlac', name: 'QLAC', ownerPersonId: owner, annualReturnPct: null, startAge: 86, monthlyAmount: 500, colaPct: 0, taxablePct: 100,
      purchase: { year: 2027, premium: 50_000, fundingAccountId: funding, taxQualification: 'qualified' as const, qlac: true as const },
    })
    for (const people of [plan.household.people, [...plan.household.people].reverse()]) {
      const december = { ...plan, household: { ...plan.household, people }, accounts: [traditionalAccount('ira-p1', 300_000, 'p1'), qlac('p1', 'ira-p1')] }
      expect(issuesFrom(checkAccountCrossFieldRules, december)).toEqual([])
      const march = { ...plan, household: { ...plan.household, people }, accounts: [traditionalAccount('ira-p2', 300_000, 'p2'), qlac('p2', 'ira-p2')] }
      expect(issuesFrom(checkAccountCrossFieldRules, march).map((issue) => issue.path)).toEqual([['accounts', 1, 'startAge']])
    }
  })

  it('names the person a joint schedule follows in a couple, and no one on an owned account', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    const brokerage = (owner: string | null, ageOf?: string) => ({
      type: 'taxable' as const, id: 'brk', name: 'Brokerage', ownerPersonId: owner, annualReturnPct: null, balance: 1_000, costBasis: 1_000, annualContribution: 0,
      contributionSchedule: [{ annualAmount: 5_000, fromAge: 55, toAge: 65, escalationPct: 0 }],
      ...(ageOf !== undefined ? { contributionScheduleAgeOf: ageOf } : {}),
    })
    plan.accounts = [brokerage(null)]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      { code: 'custom', path: ['accounts', 0, 'contributionScheduleAgeOf'], message: "a joint account's contribution schedule must name the person whose age it follows" },
    ])
    plan.accounts = [brokerage(null, 'p2')]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([])
    plan.accounts = [brokerage(null, 'ghost')]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      { code: 'custom', path: ['accounts', 0, 'contributionScheduleAgeOf'], message: 'unknown person id "ghost"' },
    ])
    plan.accounts = [brokerage('p1', 'p2')]
    expect(issuesFrom(checkAccountCrossFieldRules, plan)).toEqual([
      { code: 'custom', path: ['accounts', 0, 'contributionScheduleAgeOf'], message: "an account with an owner follows its owner's age: clear contributionScheduleAgeOf" },
    ])
    const single = singlePersonPlan()
    single.accounts = [brokerage(null)]
    expect(issuesFrom(checkAccountCrossFieldRules, single)).toEqual([])
  })

  it('requires a couple\u2019s spending phases to name a household person', () => {
    const plan = couplePlan({ p1PlanningAge: 90, p2PlanningAge: 90 })
    plan.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }]
    expect(issuesFrom(checkSpendingPhasesPerson, plan)).toEqual([
      { code: 'custom', path: ['expenses', 'phasesAgeOf'], message: 'spending phases must name the person whose age they follow' },
    ])
    plan.expenses.phasesAgeOf = 'ghost'
    expect(issuesFrom(checkSpendingPhasesPerson, plan)).toEqual([
      { code: 'custom', path: ['expenses', 'phasesAgeOf'], message: 'unknown person id "ghost"' },
    ])
    plan.expenses.phasesAgeOf = 'p2'
    expect(issuesFrom(checkSpendingPhasesPerson, plan)).toEqual([])
    const single = singlePersonPlan()
    single.expenses.phases = [{ fromAge: 75, multiplier: 0.9 }]
    expect(issuesFrom(checkSpendingPhasesPerson, single)).toEqual([])
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

  // N is the published pack's tier count — the same expression the check reads.
  // This pins the direct validation contract, not statute; plan.conversionWindow.test.ts
  // independently covers the five-step legal mapping via parsePlan and its
  // source-vs-pack coherence gate for 42 U.S.C. 1395r(i)(3).
  it('accepts IRMAA tier endpoints 1 and N and refuses targets outside 1..N', () => {
    const taxYear = 2026
    const tierCount = packForYear(taxYear).pack.medicare.irmaaTiers.length
    const message = `an IRMAA tier target must be a whole number from 1 to ${tierCount}`
    const expectedIssue = {
      code: 'custom',
      path: ['strategies', 'rothConversion', 'targetValue'],
      message,
    }

    const withIrmaaTarget = (targetValue: number | null): PlanDocument => {
      const plan = singlePersonPlan()
      plan.strategies.rothConversion = {
        mode: 'fillToTarget',
        target: 'irmaaTier',
        targetValue,
        startYear: taxYear,
        endYear: taxYear + 5,
      }
      return plan
    }

    for (const validTarget of [1, tierCount]) {
      expect(issuesFrom(checkRothConversionFillToTarget, withIrmaaTarget(validTarget))).toEqual([])
    }

    for (const invalidTarget of [0, -1, tierCount + 1, 1.5, null] as const) {
      expect(issuesFrom(checkRothConversionFillToTarget, withIrmaaTarget(invalidTarget))).toEqual([
        expectedIssue,
      ])
    }
  })
})
