import { beforeEach, describe, expect, it, vi } from 'vitest'

const controller = vi.hoisted(() => ({
  reason: 'assumptionCycle' as
    | 'assumptionCycle'
    | 'attemptCallbackThrew'
    | 'contiguousReplayBlocked',
  issue: null as Readonly<{
    kind: string
    detail: string
    taxYear?: number
    ownerPersonId?: string
  }> | null,
  /** Tax years the controller forces a rollback in; null forces every year. */
  rollbackYears: null as readonly number[] | null,
  calls: vi.fn(),
}))

vi.mock('../internal/ownedNonRothIraAnnualAttemptSettlement.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../internal/ownedNonRothIraAnnualAttemptSettlement.js')
  >()
  const { beginSimulatorAnnualPassTransaction } = await import(
    './annualPassTransaction.js'
  )
  const { asPlanId } = await import('../actions/identity.js')
  return {
    ...original,
    runOwnedNonRothIraAnnualSettlementAttempts: (
      input: Parameters<
        typeof original.runOwnedNonRothIraAnnualSettlementAttempts
      >[0],
    ) => {
      const seededBasis = input.plan.accounts.flatMap((account) =>
        account.type === 'traditional' && account.inherited === undefined
          ? [[
            account.ownerPersonId ?? null,
            account.nondeductibleBasis ?? 0,
          ] as const]
          : [])
      if (controller.rollbackYears !== null &&
          !controller.rollbackYears.includes(input.projectionStartTaxYear)) {
        const delegated =
          original.runOwnedNonRothIraAnnualSettlementAttempts(input)
        controller.calls(input.projectionStartTaxYear, delegated, seededBasis)
        return delegated
      }
      const transaction = beginSimulatorAnnualPassTransaction(input.state)
      try {
        input.runAttempt({
          attemptNumber: 1,
          stable: {
            planId: asPlanId(input.plan.id),
            projectionStartTaxYear: input.projectionStartTaxYear,
          },
          assumedEffects: [],
        })
        if (controller.reason === 'attemptCallbackThrew') {
          throw new Error('synthetic callback failure after annual mutation')
        }
      } catch {
        // The mocked controller reports the same fail-closed outcome as C.
      } finally {
        transaction.rollback()
      }
      const rolledBack = Object.freeze({
        status: 'rolledBack' as const,
        reason: controller.reason,
        attemptCount: 1,
        pendingSettlement: null,
        committedCarryforwards: null,
        issue: controller.issue,
      })
      controller.calls(input.projectionStartTaxYear, rolledBack, seededBasis)
      return rolledBack
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './types.js'

const TAX_YEAR = 2026

function ira(
  id = 'ira',
  balance = 100,
  basis = 10,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    nondeductibleBasis: basis,
  }
}

/** Two owners, each with their own aggregated-IRA basis pool. */
function twoOwnerPlan(planId: string): Plan {
  const plan = singlePersonPlan({ planningAge: 61 })
  plan.id = planId
  plan.household.people.push({
    ...plan.household.people[0]!,
    id: 'p2',
    name: 'Spouse',
  })
  plan.assumptions.inflationPct = 0
  // A draw whose pro-rata basis return does not land on a whole cent: the
  // legacy float pass and the exact-cent replay carry different figures
  // forward, which is what makes "was this owner reseeded?" observable.
  plan.expenses.baseAnnual = 33.33
  plan.accounts = [
    ira('ira-p1', 100, 10, 'p1'),
    ira('ira-p2', 100, 10, 'p2'),
  ]
  return plan
}

function settledYears(): number[] {
  return controller.calls.mock.calls.map((call) => call[0] as number)
}

/** The committed carryforward this owner would be reseeded from, in dollars. */
function committedCarryforwardDollars(
  taxYear: number,
  ownerPersonId: string,
): number {
  const call = controller.calls.mock.calls.find((entry) =>
    entry[0] === taxYear)
  if (call === undefined) throw new Error(`no settlement in ${taxYear}`)
  const result = call[1] as Readonly<{
    status: string
    committedCarryforwards: readonly Readonly<{
      ownerPersonId: string
      openingBasisAmount: number
    }>[] | null
  }>
  if (result.status !== 'committed' || result.committedCarryforwards === null) {
    throw new Error(`settlement in ${taxYear} did not commit`)
  }
  const carryforward = result.committedCarryforwards.find((entry) =>
    entry.ownerPersonId === ownerPersonId)
  if (carryforward === undefined) {
    throw new Error(`no ${ownerPersonId} carryforward in ${taxYear}`)
  }
  return carryforward.openingBasisAmount / 100
}

/** The basis the next year's settlement plan actually seeded this owner with. */
function seededBasisDollars(taxYear: number, ownerPersonId: string): number {
  const call = controller.calls.mock.calls.find((entry) =>
    entry[0] === taxYear)
  if (call === undefined) throw new Error(`no settlement in ${taxYear}`)
  const seeds = call[2] as readonly (readonly [string | null, number])[]
  const seed = seeds.find(([owner]) => owner === ownerPersonId)
  if (seed === undefined) {
    throw new Error(`no ${ownerPersonId} seed in ${taxYear}`)
  }
  return seed[1]
}

describe('simulator owned-IRA settlement rollback integration', () => {
  beforeEach(() => {
    controller.calls.mockClear()
    controller.issue = null
    controller.rollbackYears = null
  })

  it.each([
    'assumptionCycle',
    'attemptCallbackThrew',
  ] as const)('restores the attempt after %s and disables the household', (
    reason,
  ) => {
    // Neither reason is raised by the owner-keyed replay, so neither is
    // evidence about which owner failed: the fail-closed disposition stays
    // household-wide and the settlement never runs again.
    controller.reason = reason
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.id = 'settlement-rollback-plan'
    const contributingIra = ira()
    contributingIra.annualContribution = 10
    plan.accounts = [contributingIra]
    plan.incomes = [{
      id: 'settlement-rollback-wages',
      type: 'wages',
      personId: 'p1',
      annualGross: 100,
      endAge: null,
      realGrowthPct: 0,
    }]
    plan.expenses.baseAnnual = 0
    const optimizerProbes: OptimizerYearProbe[] = []

    const result = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
      captureOptimizerInputs: (probe) => optimizerProbes.push(probe),
    })

    expect(controller.calls).toHaveBeenCalledTimes(1)
    expect(optimizerProbes).toHaveLength(2)
    expect(result.years.every((year) =>
      !Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
    expect(result.years.map((year) => year.contributions)).toEqual([10, 10])
    expect(result.years.map((year) => year.balances.ira)).toEqual([110, 120])
    expect(result.years.map((year) => year.retirementRuntimeSource!
      .runtimeOccurrences.filter((row) => row.kind === 'ownedIraContribution')
      .length)).toEqual([1, 1])
    expect(result.years.map((year) => year.cashFlow!.transferLines
      .filter((row) => row.kind === 'employeeContribution').length))
      .toEqual([1, 1])
    expect(JSON.stringify(result)).not.toMatch(
      /pendingOwnedNonRothIraAnnualSettlement|assumptionCycle|attemptCallbackThrew/,
    )
  })

  it('keeps a household-wide rollback global even with two owners', () => {
    // The same non-attributable reason in a two-owner household: the unnamed
    // failure disqualifies both owners, so the settlement stops for good.
    controller.reason = 'assumptionCycle'
    const plan = twoOwnerPlan('settlement-rollback-two-owner-global')

    const result = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(settledYears()).toEqual([TAX_YEAR])
    expect(result.years.every((year) =>
      !Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
  })

  it('never reseeds the owner a rollback names, and publishes nothing for them', () => {
    // The per-owner re-expression of the household "never reseeds" property:
    // the named owner is disqualified once and stays disqualified, so no later
    // year may state a settled basis figure for them. Reseeding p1 from a
    // replay that opened on their stale numerator is exactly what this bars.
    controller.reason = 'contiguousReplayBlocked'
    controller.issue = {
      kind: 'sourceCoverageInvalid',
      detail: 'synthetic owner-attributable replay block',
      taxYear: TAX_YEAR,
      ownerPersonId: 'p1',
    }
    controller.rollbackYears = [TAX_YEAR]
    const plan = twoOwnerPlan('settlement-rollback-owner-scoped')

    const result = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    // p1 is disqualified in TAX_YEAR and is still an owner in every later
    // household replay, so no year may publish one.
    expect(result.years.every((year) =>
      !Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
    // TAX_YEAR + 1 settles and commits a carryforward for both owners, so
    // TAX_YEAR + 2's plan seed is the discriminating observation: p1 must
    // still carry the legacy figure their own annual pass produced, not the
    // exact-cent carryforward the replay derived from their stale numerator.
    expect(settledYears())
      .toEqual([TAX_YEAR, TAX_YEAR + 1, TAX_YEAR + 2])
    const p1Carryforward = committedCarryforwardDollars(TAX_YEAR + 1, 'p1')
    const p1Seed = seededBasisDollars(TAX_YEAR + 2, 'p1')
    expect(p1Carryforward).toBeGreaterThan(0)
    expect(p1Seed).not.toBe(p1Carryforward)
    expect(p1Seed).toBeCloseTo(3.334, 12)
    expect(JSON.stringify(result)).not.toMatch(
      /pendingOwnedNonRothIraAnnualSettlement|contiguousReplayBlocked/,
    )
  })

  it('leaves an unaffected owner settling and reseeding in later years', () => {
    // The counterpart property, on the same fixture with the attribution
    // mirrored: p2 is the named owner and p1 is the one whose pool the
    // household actually draws from. Under the former global latch the
    // settlement was never attempted again and p1 was collateral damage.
    controller.reason = 'contiguousReplayBlocked'
    controller.issue = {
      kind: 'sourceCoverageInvalid',
      detail: 'synthetic owner-attributable replay block',
      taxYear: TAX_YEAR,
      ownerPersonId: 'p2',
    }
    controller.rollbackYears = [TAX_YEAR]
    const plan = twoOwnerPlan('settlement-rollback-unaffected-owner')

    simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(settledYears()).toEqual([TAX_YEAR, TAX_YEAR + 1, TAX_YEAR + 2])
    // p1 is reseeded from the exact-cent carryforward, which is the whole
    // point of keeping settlement alive for them.
    const p1Carryforward = committedCarryforwardDollars(TAX_YEAR + 1, 'p1')
    expect(p1Carryforward).toBeGreaterThan(0)
    expect(seededBasisDollars(TAX_YEAR + 2, 'p1')).toBe(p1Carryforward)
  })

  it('scopes a household stage-required refusal to the year that raised it', () => {
    // No owner named, so the disposition is household-wide -- but the refusal
    // is a statement about TAX_YEAR's event inventory, not about anyone's
    // numerator, so the horizon is one year. TAX_YEAR + 1 attempts settlement
    // again and both owners are reseeded from its exact-cent carryforward.
    controller.reason = 'contiguousReplayBlocked'
    controller.issue = {
      kind: 'annuityStageRequired',
      detail: 'synthetic household stage-required refusal',
      taxYear: TAX_YEAR,
    }
    controller.rollbackYears = [TAX_YEAR]
    const plan = twoOwnerPlan('settlement-rollback-year-scoped-household')

    simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(settledYears()).toEqual([TAX_YEAR, TAX_YEAR + 1, TAX_YEAR + 2])
    for (const owner of ['p1', 'p2']) {
      const carryforward = committedCarryforwardDollars(TAX_YEAR + 1, owner)
      expect(carryforward).toBeGreaterThan(0)
      expect(seededBasisDollars(TAX_YEAR + 2, owner)).toBe(carryforward)
    }
  })

  it.each([
    'annuityStageRequired',
    'exactActionStageRequired',
    'qcdStageRequired',
  ] as const)('scopes an owner-named %s refusal to that owner-year', (kind) => {
    // Both axes at once: the issue names p1, so only p1 is disqualified, and the
    // kind is stage-required, so only TAX_YEAR is. p1 is reseeded from
    // TAX_YEAR + 1's own carryforward, which the permanent latch would have
    // refused to apply for the rest of the projection.
    controller.reason = 'contiguousReplayBlocked'
    controller.issue = {
      kind,
      detail: `synthetic owner-named ${kind} refusal`,
      taxYear: TAX_YEAR,
      ownerPersonId: 'p1',
    }
    controller.rollbackYears = [TAX_YEAR]
    const plan = twoOwnerPlan(`settlement-rollback-year-scoped-${kind}`)

    const result = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(settledYears()).toEqual([TAX_YEAR, TAX_YEAR + 1, TAX_YEAR + 2])
    const p1Carryforward = committedCarryforwardDollars(TAX_YEAR + 1, 'p1')
    expect(p1Carryforward).toBeGreaterThan(0)
    expect(seededBasisDollars(TAX_YEAR + 2, 'p1')).toBe(p1Carryforward)
    // The withheld-publication window is one year wide: TAX_YEAR rolled back and
    // publishes nothing, and every later year publishes the joined replay again.
    expect(Object.hasOwn(result.years[0]!, 'ownedNonRothIraAnnualReplay'))
      .toBe(false)
    expect(result.years.slice(1).every((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay'))).toBe(true)
  })

  it.each([
    'qcdReconciliationInvalid',
    'balanceChainInvalid',
    'basisReplayInvalid',
    'carryforwardYearUnsupported',
  ] as const)('keeps %s permanent for the owner it names', (kind) => {
    // The counterpart to the year-scoped cases above, and the reason the
    // allow-list is three names rather than "anything the replay raised".
    // `qcdReconciliationInvalid` is the charitable arm's exact-cent invariant --
    // the overlay and the replay disagreeing about a figure -- and it sits
    // beside the arithmetic failures rather than beside `qcdStageRequired`.
    controller.reason = 'contiguousReplayBlocked'
    controller.issue = {
      kind,
      detail: `synthetic owner-named ${kind}`,
      taxYear: TAX_YEAR,
      ownerPersonId: 'p1',
    }
    controller.rollbackYears = [TAX_YEAR]
    const plan = twoOwnerPlan(`settlement-rollback-permanent-${kind}`)

    simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    // p1 is disqualified for good: TAX_YEAR + 1 commits a carryforward for them
    // that TAX_YEAR + 2 must not be seeded from.
    expect(settledYears()).toEqual([TAX_YEAR, TAX_YEAR + 1, TAX_YEAR + 2])
    const p1Carryforward = committedCarryforwardDollars(TAX_YEAR + 1, 'p1')
    expect(p1Carryforward).toBeGreaterThan(0)
    expect(seededBasisDollars(TAX_YEAR + 2, 'p1')).not.toBe(p1Carryforward)
  })

  it('stays household-wide when the named owner is not a basis owner', () => {
    // An issue that names someone the projection holds no basis pool for is
    // not evidence about a real owner, so it must not narrow the disposition.
    controller.reason = 'contiguousReplayBlocked'
    controller.issue = {
      kind: 'sourceCoverageInvalid',
      detail: 'synthetic unrecognized-owner replay block',
      taxYear: TAX_YEAR,
      ownerPersonId: 'not-a-plan-person',
    }
    controller.rollbackYears = [TAX_YEAR]
    const plan = twoOwnerPlan('settlement-rollback-unknown-owner')

    simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(settledYears()).toEqual([TAX_YEAR])
  })
})
