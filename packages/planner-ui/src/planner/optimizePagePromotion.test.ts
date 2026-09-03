/**
 * The load-bearing half of the promoted-schedule surfaces: what the page reads
 * off a published promotion, and what Apply installs.
 *
 * THE ASSERTION THAT MATTERS is that applying a promotion installs NAMED
 * requests. The tournament publishes both a per-year schedule and a plan patch;
 * only the patch carries the people, source accounts and Roth destinations, and
 * installing the schedule instead would put back the aggregate strategy the
 * readiness veto exists to withhold. Every apply test below therefore parses
 * the installed plan and reads the identities back out of it.
 */
import { describe, expect, it } from 'vitest'

import { asPositiveUsdCents } from '@retiregolden/engine/actions/money'
import type { Account, Plan } from '@retiregolden/engine/model/plan'
import type { RetirementActionPromotion } from '@retiregolden/engine/projection/optimizePlan'
import { cashAccount, couplePlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'

import {
  promotedRecommendationPlan,
  promotionBlocksApply,
  promotionTrimmedOwners,
  publishedPromotion,
  readPromotedSchedule,
  scheduleConversionTotal,
  unclassifiedIraSourceAccounts,
  withheldPromotion,
} from './optimizePagePromotion'

const ALEX = 'p1'
const SAM = 'p2'

function traditionalIra(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function rothIra(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

/** Alex holds a traditional IRA and the household's only Roth IRA; Sam holds neither. */
function plan(classifiedSources: readonly string[] = ['alex-ira']): Plan {
  const built = couplePlan({ p1PlanningAge: 70, p2PlanningAge: 70 })
  built.household.people[0]!.name = 'Alex'
  built.household.people[1]!.name = 'Sam'
  built.accounts = [
    { ...cashAccount('household-cash', 50_000), ownerPersonId: ALEX },
    traditionalIra('alex-ira', 500_000, ALEX),
    rothIra('alex-roth', 10_000, ALEX),
  ]
  built.retirementActionEligibilityFacts = {
    iraClassifications: classifiedSources.map((sourceAccountId) => ({
      evidenceId: `${sourceAccountId}-classification`,
      provenance: { source: 'manual' as const },
      sourceAccountId,
      subtype: 'traditional' as const,
    })),
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  return validatePlan(built)
}

function conversionRequest(actionId: string, year: number, amountCents: number) {
  return {
    actionId,
    kind: 'rothConversion' as const,
    year,
    executionDate: `${year}-12-31`,
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(amountCents),
    provenance: { source: 'generator' as const, sourceId: 'roth-fill-to-target' },
    personId: ALEX,
    allocations: [{
      allocationId: `${actionId}-a`,
      sourceAccountId: 'alex-ira',
      requestedAmount: asPositiveUsdCents(amountCents),
    }],
    destinationRothAccountId: 'alex-roth',
    taxFunding: { kind: 'noneExpected' as const },
  }
}

const FIRST = conversionRequest('promoted-2026', 2026, 40_000_00)
const SECOND = conversionRequest('promoted-2027', 2027, 25_000_00)

function equivalentPromotion(): RetirementActionPromotion {
  return {
    outcome: 'equivalent',
    candidateId: 'promoted-candidate',
    label: 'Explicit schedule after exploring: Fill the 22% bracket',
    actionRequestIds: [FIRST.actionId, SECOND.actionId],
    planPatch: {
      strategies: {
        rothConversion: { mode: 'none' },
        retirementActions: [FIRST, SECOND],
      },
    },
    years: [
      {
        year: 2026,
        askedCents: 60_000_00,
        allocatedCents: 40_000_00,
        trims: [{ ownerPersonId: SAM, reason: 'ownerHoldsNoRothAccount', slicePlanDollars: 20_000 }],
      },
      {
        year: 2027,
        askedCents: 40_000_00,
        allocatedCents: 25_000_00,
        trims: [{ ownerPersonId: SAM, reason: 'ownerHoldsNoRothAccount', slicePlanDollars: 15_000 }],
      },
    ],
    evidence: { equality: 'exactMinorUnitByRequiredKey', quantization: 'nearestCentHalfUp' } as never,
    binding: null,
  }
}

describe('publishedPromotion / withheldPromotion', () => {
  it('splits the five verdicts into the ones that publish and the ones that do not', () => {
    const published = equivalentPromotion()
    expect(publishedPromotion(published)).toBe(published)
    expect(withheldPromotion(published)).toBeNull()

    const repriced = { ...published, outcome: 'repriced', aggregateConversions: [] } as never
    expect(publishedPromotion(repriced)).toBe(repriced)

    for (const outcome of ['notComparable', 'notPromoted', 'repricedNotRecommended'] as const) {
      const withheld = { ...published, outcome } as never
      expect(publishedPromotion(withheld)).toBeNull()
      expect(withheldPromotion(withheld)).toBe(withheld)
    }

    expect(publishedPromotion(null)).toBeNull()
    expect(withheldPromotion(null)).toBeNull()
    expect(publishedPromotion(undefined)).toBeNull()
    expect(withheldPromotion(undefined)).toBeNull()
  })
})

describe('readPromotedSchedule', () => {
  it('names the person, the source account and the Roth destination for every year', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const read = readPromotedSchedule(plan(), promotion)
    if (read.status !== 'read') throw new Error('expected a readable promoted schedule')

    expect(read.rows).toEqual([
      {
        actionId: 'promoted-2026',
        allocationId: 'promoted-2026-a',
        year: 2026,
        ownerName: 'Alex',
        sourceAccountName: 'alex-ira',
        destinationAccountName: 'alex-roth',
        amountCents: 40_000_00,
      },
      {
        actionId: 'promoted-2027',
        allocationId: 'promoted-2027-a',
        year: 2027,
        ownerName: 'Alex',
        sourceAccountName: 'alex-ira',
        destinationAccountName: 'alex-roth',
        amountCents: 25_000_00,
      },
    ])
  })

  it('refuses a patch that installs anything other than the requests it names', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const extraNamed = {
      ...promotion,
      actionRequestIds: [...promotion.actionRequestIds, 'promoted-2028'],
    }
    expect(readPromotedSchedule(plan(), extraNamed).status).toBe('unreadable')

    const notAConversion = {
      ...promotion,
      planPatch: {
        strategies: {
          rothConversion: { mode: 'none' },
          retirementActions: [
            {
              ...FIRST,
              kind: 'ordinaryWithdrawal',
              destinationRothAccountId: undefined,
              taxFunding: undefined,
              purpose: { kind: 'spending' },
            },
            SECOND,
          ],
        },
      },
    }
    expect(readPromotedSchedule(plan(), notAConversion).status).toBe('unreadable')
  })

  it('refuses a patch that leaves the aggregate strategy running beside the named requests', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const aggregateStillOn = {
      ...promotion,
      planPatch: {
        strategies: {
          rothConversion: { mode: 'manual', conversions: [{ year: 2026, amount: 65_000 }] },
          retirementActions: [FIRST, SECOND],
        },
      },
    }
    expect(readPromotedSchedule(plan(), aggregateStillOn).status).toBe('unreadable')
  })

  it('reports the plan schema’s own words when the patch does not parse', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const missingSource = {
      ...promotion,
      planPatch: {
        strategies: {
          rothConversion: { mode: 'none' },
          retirementActions: [
            { ...FIRST, allocations: [{ ...FIRST.allocations[0], sourceAccountId: 'no-such-account' }] },
            SECOND,
          ],
        },
      },
    }
    const read = readPromotedSchedule(plan(), missingSource)
    if (read.status !== 'unreadable') throw new Error('expected an unreadable promoted schedule')
    expect(read.issues.length).toBeGreaterThan(0)
  })
})

describe('promotedRecommendationPlan', () => {
  it('installs the named requests, not a re-aggregated conversion strategy', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const installed = promotedRecommendationPlan(plan(), { claimAge: null, promotion })
    if (installed.status !== 'read') throw new Error('expected an installable promoted schedule')

    // The applied plan parsed through the Plan schema, and it carries the
    // identities: person, source allocation, Roth destination, one per year.
    const actions = installed.plan.strategies.retirementActions
    expect(actions.map((action) => action.actionId)).toEqual(['promoted-2026', 'promoted-2027'])
    for (const action of actions) {
      if (action.kind !== 'rothConversion') throw new Error('expected a conversion request')
      expect(action.personId).toBe(ALEX)
      expect(action.destinationRothAccountId).toBe('alex-roth')
      expect(action.allocations.map((allocation) => allocation.sourceAccountId)).toEqual(['alex-ira'])
    }
    expect(actions.reduce((sum, action) => sum + action.requestedAmount, 0)).toBe(65_000_00)

    // And the aggregate arm is stood down, so nothing converts twice.
    expect(installed.plan.strategies.rothConversion).toEqual({ mode: 'none' })
  })

  it('installs the winning claim change alongside the named requests', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const base = plan()
    const claimAge = {
      winningClaimPatch: { incomes: [...base.incomes, {
        type: 'recurring' as const,
        id: 'extra-income',
        label: 'Part-time work',
        annualAmount: 1_000,
        startYear: 2030,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary' as const,
      }] },
    } as never
    const installed = promotedRecommendationPlan(base, { claimAge, promotion })
    if (installed.status !== 'read') throw new Error('expected an installable promoted schedule')

    expect(installed.plan.incomes.some((income) => income.id === 'extra-income')).toBe(true)
    expect(installed.plan.strategies.retirementActions).toHaveLength(2)
  })
})

describe('promotionBlocksApply', () => {
  it('offers no Apply for any verdict that published nothing', () => {
    const base = equivalentPromotion()
    for (const outcome of ['notComparable', 'notPromoted', 'repricedNotRecommended'] as const) {
      expect(promotionBlocksApply({ ...base, outcome } as never, null)).toBe(true)
    }
  })

  it('offers Apply for a published verdict whose patch reads back', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    const read = readPromotedSchedule(plan(), promotion)
    expect(promotionBlocksApply(promotion, read)).toBe(false)
  })

  it('withholds Apply when a published patch does not read back', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    expect(promotionBlocksApply(promotion, { status: 'unreadable', issues: [] })).toBe(true)
  })

  it('leaves a plan that never ran the loop to the page’s own tests', () => {
    expect(promotionBlocksApply(null, null)).toBe(false)
  })
})

describe('promotionTrimmedOwners', () => {
  it('reports each trimmed owner once, however many years it repeats in', () => {
    const promotion = publishedPromotion(equivalentPromotion())!
    expect(promotionTrimmedOwners(promotion.years)).toEqual([
      { ownerPersonId: SAM, reason: 'ownerHoldsNoRothAccount', slicePlanDollars: 20_000 },
    ])
    expect(promotionTrimmedOwners([])).toEqual([])
  })
})

describe('scheduleConversionTotal', () => {
  it('sums a per-year schedule', () => {
    expect(scheduleConversionTotal([{ year: 2026, amount: 10 }, { year: 2027, amount: 5 }])).toBe(15)
    expect(scheduleConversionTotal([])).toBe(0)
  })
})

describe('unclassifiedIraSourceAccounts', () => {
  it('lists the traditional IRAs this plan could classify and has not', () => {
    expect(unclassifiedIraSourceAccounts(plan(['alex-ira']))).toEqual([])
    expect(unclassifiedIraSourceAccounts(plan([]))).toEqual([{ id: 'alex-ira', name: 'alex-ira' }])
  })
})
