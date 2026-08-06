import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import type {
  SimulatorAnnualPassStateBindings,
  SimulatorAnnualPassValueBinding,
} from '../projection/annualPassTransaction.js'
import { simulatePlan } from '../projection/simulate.js'
import type { YearExpenses, YearResult } from '../projection/types.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'

const { replayTransform } = vi.hoisted(() => ({
  replayTransform: {
    current: null as null | ((value: unknown) => unknown),
  },
}))

vi.mock('./ownedNonRothIraContiguousReplay.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./ownedNonRothIraContiguousReplay.js')
  >()
  return {
    ...original,
    replayOwnedNonRothIraContiguousYears: (
      ...args: Parameters<typeof original.replayOwnedNonRothIraContiguousYears>
    ) => {
      const result = original.replayOwnedNonRothIraContiguousYears(...args)
      return replayTransform.current?.(result) ?? result
    },
  }
})

import {
  captureOwnedNonRothIraAnnualAttemptStateEvidence,
  runOwnedNonRothIraAnnualSettlementAttempts,
  type OwnedNonRothIraAnnualSettlementEffect,
} from './ownedNonRothIraAnnualAttemptSettlement.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

afterEach(() => {
  replayTransform.current = null
})

function binding<T>(initial: T): SimulatorAnnualPassValueBinding<T> {
  let value = initial
  return {
    read: () => value,
    write: (next) => { value = next },
  }
}

function expenses(): YearExpenses {
  return {
    baseSpending: 0,
    oneTimeGoals: 0,
    debtService: 0,
    propertyCosts: 0,
    healthcare: 0,
    insurancePremiums: 0,
    careCost: 0,
    ltcBenefit: 0,
    requiredSpending: 0,
    targetSpending: 0,
    idealSpending: 0,
    excessSpending: 0,
    intendedSpending: 0,
    guardrailFactor: 1,
    total: 0,
  }
}

function state(plan?: Readonly<Plan>): SimulatorAnnualPassStateBindings {
  const balances = plan === undefined
    ? [{ account: { id: 'ira' }, balance: 100_000, costBasis: 0 }]
    : plan.accounts.flatMap((account) =>
      'balance' in account && typeof account.balance === 'number'
        ? [{
            account: { id: account.id },
            balance: account.balance,
            costBasis: 'costBasis' in account &&
              typeof account.costBasis === 'number'
              ? account.costBasis
              : 0,
          }]
        : [])
  return {
    balances,
    retirementRuntimeOccurrences: [],
    retirementRuntimeApplications: [],
    nextRetirementRuntimeMutationOrdinal: binding(1),
    iraProRata: new Map(),
    iraBasisByOwner: new Map(),
    rothBasis: new Map(),
    propertyValues: new Map(),
    hecmStates: new Map(),
    insuranceCashValues: new Map(),
    allocationTrack: new Map(),
    seppAmortAmount: new Map(),
    magiHistory: new Map(),
    namedQcdOffsetConsumedByDonor: new Map(),
    namedQcdOffsetHistoryUnprovable: new Set(),
    warnings: new Set(['baseline']),
    unassignedCash: binding(0),
    priorYearPortfolioReturnPct: binding(0),
    capitalLossPool: binding(0),
    hsaReimbursablePool: binding(0),
    depletionYear: binding<number | null>(null),
    conversionNontaxable: binding(0),
    healthcare: binding(0),
    qualifiedMedicalThisYear: binding(0),
    hsaQualifiedCap: binding(0),
    requiredSpendingBase: binding(0),
    targetSpendingBase: binding(0),
    expenses: expenses(),
  }
}

function stateBytes(value: SimulatorAnnualPassStateBindings): string {
  return JSON.stringify({
    balances: value.balances,
    retirementRuntimeOccurrences: value.retirementRuntimeOccurrences,
    retirementRuntimeApplications: value.retirementRuntimeApplications,
    nextRetirementRuntimeMutationOrdinal:
      value.nextRetirementRuntimeMutationOrdinal.read(),
    iraProRata: [...value.iraProRata],
    iraBasisByOwner: [...value.iraBasisByOwner],
    rothBasis: [...value.rothBasis],
    propertyValues: [...value.propertyValues],
    hecmStates: [...value.hecmStates],
    insuranceCashValues: [...value.insuranceCashValues],
    allocationTrack: [...value.allocationTrack],
    seppAmortAmount: [...value.seppAmortAmount],
    magiHistory: [...value.magiHistory],
    namedQcdOffsetConsumedByDonor: [...value.namedQcdOffsetConsumedByDonor],
    namedQcdOffsetHistoryUnprovable: [...value.namedQcdOffsetHistoryUnprovable],
    warnings: [...value.warnings],
    unassignedCash: value.unassignedCash.read(),
    priorYearPortfolioReturnPct: value.priorYearPortfolioReturnPct.read(),
    capitalLossPool: value.capitalLossPool.read(),
    hsaReimbursablePool: value.hsaReimbursablePool.read(),
    depletionYear: value.depletionYear.read(),
    conversionNontaxable: value.conversionNontaxable.read(),
    healthcare: value.healthcare.read(),
    qualifiedMedicalThisYear: value.qualifiedMedicalThisYear.read(),
    hsaQualifiedCap: value.hsaQualifiedCap.read(),
    requiredSpendingBase: value.requiredSpendingBase.read(),
    targetSpendingBase: value.targetSpendingBase.read(),
    expenses: value.expenses,
  })
}

function ira(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
  basis = 0,
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    ...(basis === 0 ? {} : { nondeductibleBasis: basis }),
  }
}

function roth(
  ownerPersonId = 'p1',
): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id: `roth-${ownerPersonId}`,
    name: 'Roth IRA',
    ownerPersonId,
    kind: 'ira',
    balance: 0,
    annualReturnPct: 0,
    annualContribution: 0,
  }
}

function rmdPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1950-01-01', planningAge: 76 })
  plan.id = 'attempt-rmd'
  plan.accounts = [ira('ira', 100_000, 'p1', 20_000)]
  return plan
}

function project(
  plan: Plan,
  endYear = TAX_YEAR,
  returnShockPct?: number,
): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: noTax,
    ...(returnShockPct === undefined
      ? {}
      : { market: { returnShockPct: [returnShockPct] } }),
  }).years
}

function cloneYears(years: readonly Readonly<YearResult>[]): YearResult[] {
  return structuredClone(years) as YearResult[]
}

function mutateAttemptState(
  simulatorState: SimulatorAnnualPassStateBindings,
  years: readonly Readonly<YearResult>[],
): void {
  if (years.length !== 1) throw new Error('attempt helper requires one year')
  const year = years[0]!
  simulatorState.retirementRuntimeOccurrences.push(
    ...year.retirementRuntimeSource!.runtimeOccurrences.map((value) => ({
      ...value,
    })),
  )
  simulatorState.retirementRuntimeApplications.push(
    ...year.retirementRuntimeApplicationSource!.applications.map((value) =>
      structuredClone(value)),
  )
  simulatorState.nextRetirementRuntimeMutationOrdinal.write(
    year.retirementRuntimeApplicationSource!.applications.length + 1,
  )
  for (const record of simulatorState.balances) {
    record.balance = year.balances[record.account.id]!
  }
}

describe('private owned-IRA annual attempt settlement', () => {
  it('reprobes from the exact checkpoint and queues one carryforward only on exact commit', () => {
    const plan = rmdPlan()
    const canonicalYears = project(plan)
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)
    const attempts: string[] = []

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        attempts.push(stateBytes(simulatorState))
        const years = cloneYears(canonicalYears)
        mutateAttemptState(simulatorState, years)
        return years
      },
    })

    expect(result.status).toBe('committed')
    if (result.status !== 'committed') return
    expect(result.attemptCount).toBe(2)
    expect(attempts).toEqual([before, before])
    expect(result.pendingSettlement).toMatchObject({
      status: 'pendingOwnedNonRothIraAnnualSettlement',
      settlement: 'exactEffectsMatched',
      planId: plan.id,
      projectionStartTaxYear: TAX_YEAR,
      endTaxYear: TAX_YEAR,
    })
    expect(result.pendingSettlement.observedEffects.length).toBeGreaterThan(0)
    expect(result.committedCarryforwards).toHaveLength(1)
    expect(result.committedCarryforwards[0]).toMatchObject({
      ownerPersonId: 'p1',
      fromTaxYear: TAX_YEAR,
      toTaxYear: TAX_YEAR + 1,
    })
    expect(result.committedCarryforwards).toBe(
      result.pendingSettlement.committedCarryforwards,
    )
    expect(simulatorState.balances[0]!.balance).toBe(
      canonicalYears[0]!.balances.ira,
    )
    expect(simulatorState.retirementRuntimeOccurrences).not.toHaveLength(0)
    expect(Object.isFrozen(result.pendingSettlement)).toBe(true)
  })

  it('commits only a complete current-attempt annual-tail state binding', () => {
    const plan = rmdPlan()
    const canonicalYears = project(plan)
    const simulatorState = state(plan)
    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        const years = cloneYears(canonicalYears)
        mutateAttemptState(simulatorState, years)
        simulatorState.balances[0]!.costBasis = 7
        simulatorState.warnings.add('bound-annual-warning')
        return years
      },
      captureAttemptStateEvidence: (context, year) =>
        captureOwnedNonRothIraAnnualAttemptStateEvidence({
          state: simulatorState,
          planId: context.stable.planId,
          taxYear: year.year,
          attemptNumber: context.attemptNumber,
        }),
    })

    expect(result.status).toBe('committed')
    expect(simulatorState.balances[0]!.costBasis).toBe(7)
    expect(simulatorState.warnings).toContain('bound-annual-warning')

    const staleState = state(plan)
    const before = stateBytes(staleState)
    const stale = runOwnedNonRothIraAnnualSettlementAttempts({
      state: staleState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        const years = cloneYears(canonicalYears)
        mutateAttemptState(staleState, years)
        return years
      },
      captureAttemptStateEvidence: (context, year) => {
        const evidence = captureOwnedNonRothIraAnnualAttemptStateEvidence({
          state: staleState,
          planId: context.stable.planId,
          taxYear: year.year,
          attemptNumber: context.attemptNumber,
        })
        staleState.warnings.add('mutation-after-evidence')
        return evidence
      },
    })
    expect(stale).toMatchObject({
      status: 'rolledBack',
      reason: 'attemptBindingMismatch',
    })
    expect(stateBytes(staleState)).toBe(before)
  })

  it.each([
    'qcd',
    'annuity',
    'mixedOwnerAggregate',
    'incompleteAggregate',
  ] as const)('rolls back %s replay blocks without a pending carryforward', (kind) => {
    let plan: Plan
    if (kind === 'qcd') {
      plan = rmdPlan()
      plan.id = 'attempt-qcd'
      plan.strategies.qcdAnnual = 1_000
    } else if (kind === 'annuity') {
      plan = singlePersonPlan({ planningAge: 60 })
      plan.id = 'attempt-annuity'
      plan.accounts = [
        ira('ira', 20_000, 'p1', 2_000),
        {
          type: 'annuity',
          id: 'annuity',
          name: 'Qualified annuity',
          ownerPersonId: 'p1',
          annualReturnPct: null,
          startAge: 60,
          monthlyAmount: 0,
          colaPct: 0,
          taxablePct: 100,
          purchase: {
            year: TAX_YEAR,
            premium: 5_000,
            fundingAccountId: 'ira',
            taxQualification: 'qualified',
          },
        },
      ]
    } else {
      plan = couplePlan()
      plan.id = `attempt-${kind}`
      plan.assumptions.inflationPct = 0
      plan.assumptions.defaultReturnPct = 0
      plan.accounts = [
        ira('ira-p1', 1_000, 'p1', 100),
        ira('ira-p2', 1_000, 'p2', 100),
        roth('p1'),
        roth('p2'),
      ]
      plan.strategies.rothConversion = {
        mode: 'manual',
        conversions: [{ year: TAX_YEAR, amount: 2_000 }],
      }
    }
    const blockedYears = cloneYears(project(plan))
    if (kind === 'mixedOwnerAggregate') {
      // The simulator no longer produces this shape, so the fixture builds it:
      // p2's conversion re-pointed at p1's Roth and folded into p1's credit,
      // which is precisely what the aggregate path published for every
      // household holding its Roth and traditional balances in different names.
      // IRC 408(d)(3)(A)(i) does not admit it, and the source-series stage now
      // refuses it before the settlement sees a replay at all.
      const occurrences = blockedYears[0]!.retirementRuntimeSource!.runtimeOccurrences
      const applications = blockedYears[0]!
        .retirementRuntimeApplicationSource!.applications
      const replacementKeys = new Map<string, string>()
      for (const occurrence of occurrences) {
        if (occurrence.kind !== 'legacyRothConversion' ||
            occurrence.sourceAccountId !== 'ira-p2') continue
        const tuple = JSON.parse(occurrence.producerOccurrenceKey) as unknown[]
        const replacement = JSON.stringify([tuple[0], tuple[1], 'roth-p1'])
        replacementKeys.set(occurrence.producerOccurrenceKey, replacement)
        ;(occurrence as { producerOccurrenceKey: string })
          .producerOccurrenceKey = replacement
      }
      const credits = applications.filter((application) =>
        application.applicationKind === 'aggregateRothDestinationCredit')
      if (credits.length !== 2) throw new Error('expected one credit per owner')
      const [first, second] = credits as [
        Extract<typeof credits[number], { applicationKind: 'aggregateRothDestinationCredit' }>,
        Extract<typeof credits[number], { applicationKind: 'aggregateRothDestinationCredit' }>,
      ]
      const merged = first as unknown as {
        producerOccurrenceKeys: string[]
        sourceOwnerPersonIds: (string | null)[]
        destinationCreditedAmountPlanDollars: number
        destinationBalanceAfterPlanDollars: number
      }
      merged.producerOccurrenceKeys = [
        ...first.producerOccurrenceKeys,
        ...second.producerOccurrenceKeys.map((key) => replacementKeys.get(key) ?? key),
      ]
      merged.sourceOwnerPersonIds = [
        ...first.sourceOwnerPersonIds,
        ...second.sourceOwnerPersonIds,
      ]
      merged.destinationCreditedAmountPlanDollars +=
        second.destinationCreditedAmountPlanDollars
      merged.destinationBalanceAfterPlanDollars +=
        second.destinationCreditedAmountPlanDollars
      ;(applications as unknown as unknown[]).splice(
        applications.indexOf(second), 1,
      )
      for (const application of applications) {
        if (application.applicationKind === 'aggregateRothDestinationCredit' ||
            application.applicationKind === 'namedRothDestinationCredit') continue
        ;(application as { producerOccurrenceKey: string }).producerOccurrenceKey =
          replacementKeys.get(application.producerOccurrenceKey) ??
          application.producerOccurrenceKey
      }
    }
    if (kind === 'incompleteAggregate') {
      const applications = blockedYears[0]!
        .retirementRuntimeApplicationSource!.applications
      // The LAST credit, so the surviving mutation ordinals stay contiguous and
      // the attempt fails on the missing credit rather than on a hole in the
      // ordinal chain. With one credit per converting owner there is now more
      // than one to choose from.
      ;(applications as unknown as unknown[]).splice(
        applications.findLastIndex((application) =>
          application.applicationKind === 'aggregateRothDestinationCredit'),
        1,
      )
    }
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        mutateAttemptState(simulatorState, blockedYears)
        return blockedYears
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'contiguousReplayBlocked',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it('restores state on callback throws and assumption cycles', () => {
    const plan = rmdPlan()
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)
    const thrown = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        mutateAttemptState(simulatorState, project(plan))
        throw new Error('attempt failed')
      },
    })
    expect(thrown).toMatchObject({
      status: 'rolledBack',
      reason: 'attemptCallbackThrew',
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)

    const low = project(plan, TAX_YEAR, -10)
    const high = project(plan, TAX_YEAR, 10)
    const cycled = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: (context) => {
        const years = cloneYears(context.attemptNumber % 2 === 1 ? low : high)
        mutateAttemptState(simulatorState, years)
        return years
      },
    })
    expect(cycled).toMatchObject({
      status: 'rolledBack',
      reason: 'assumptionCycle',
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it('rejects cached current-year results when the retry did not reproduce its journals', () => {
    const plan = rmdPlan()
    const cachedYears = cloneYears(project(plan))
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: (context) => {
        if (context.attemptNumber === 1) {
          mutateAttemptState(simulatorState, cachedYears)
        }
        return cachedYears
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'attemptBindingMismatch',
      attemptCount: 2,
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it('rejects a current-year result with no matching journal state', () => {
    const plan = rmdPlan()
    const years = cloneYears(project(plan))
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => years,
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'attemptBindingMismatch',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it('fails closed when a bound current-year result omits its runtime source', () => {
    const plan = rmdPlan()
    const years = cloneYears(project(plan))
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)
    delete years[0]!.retirementRuntimeSource

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        mutateAttemptState(simulatorState, project(plan))
        return years
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'attemptBindingMismatch',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it.each([
    'occurrenceJournal',
    'applicationJournal',
    'mutationOrdinal',
    'balanceMovement',
    'balanceInventory',
    'balanceBinding',
    'journalBinding',
    'mapBinding',
    'scalarBinding',
    'scalarWiring',
    'expensesBinding',
    'costBasis',
    'warning',
    'map',
    'scalar',
    'expenses',
  ] as const)('rejects forged or unrelated %s state', (kind) => {
    const plan = rmdPlan()
    const years = cloneYears(project(plan))
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)
    const originalCapitalLossPoolWrite =
      simulatorState.capitalLossPool.write

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        mutateAttemptState(simulatorState, years)
        if (kind === 'occurrenceJournal') {
          simulatorState.retirementRuntimeOccurrences[0]!
            .grossAmountPlanDollars += 0.01
        } else if (kind === 'applicationJournal') {
          const application = simulatorState.retirementRuntimeApplications[0]!
          if (application.applicationKind === 'aggregateRothDestinationCredit') {
            throw new Error('expected debit application')
          }
          ;(application as { producerOccurrenceKey: string })
            .producerOccurrenceKey = 'forged-occurrence'
        } else if (kind === 'mutationOrdinal') {
          simulatorState.nextRetirementRuntimeMutationOrdinal.write(
            simulatorState.nextRetirementRuntimeMutationOrdinal.read() + 1,
          )
        } else if (kind === 'balanceMovement') {
          simulatorState.balances[0]!.balance += 0.01
        } else if (kind === 'balanceInventory') {
          simulatorState.balances.splice(0, 1)
        } else if (kind === 'balanceBinding') {
          const original = simulatorState.balances[0]!
          simulatorState.balances[0] = {
            account: { id: original.account.id },
            balance: original.balance,
            costBasis: original.costBasis,
          }
        } else if (kind === 'journalBinding') {
          simulatorState.retirementRuntimeOccurrences = [
            ...simulatorState.retirementRuntimeOccurrences,
          ]
        } else if (kind === 'mapBinding') {
          simulatorState.iraBasisByOwner =
            new Map(simulatorState.iraBasisByOwner)
        } else if (kind === 'scalarBinding') {
          simulatorState.capitalLossPool = binding(
            simulatorState.capitalLossPool.read(),
          )
        } else if (kind === 'scalarWiring') {
          ;(simulatorState.capitalLossPool as {
            write: (value: number) => void
          }).write = () => {}
        } else if (kind === 'expensesBinding') {
          simulatorState.expenses = { ...simulatorState.expenses }
        } else if (kind === 'costBasis') {
          simulatorState.balances[0]!.costBasis += 1
        } else if (kind === 'warning') {
          simulatorState.warnings.add('forged-warning')
        } else if (kind === 'map') {
          simulatorState.iraBasisByOwner.set('p1', 123)
        } else if (kind === 'scalar') {
          simulatorState.capitalLossPool.write(123)
        } else {
          simulatorState.expenses.total += 123
        }
        return years
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'attemptBindingMismatch',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
    expect(simulatorState.capitalLossPool.write)
      .toBe(originalCapitalLossPoolWrite)
  })

  it('reports replay-effect canonicalization failures distinctly from aggregate ownership', () => {
    const plan = rmdPlan()
    const years = cloneYears(project(plan))
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)
    replayTransform.current = (value) => {
      const replay = structuredClone(value) as {
        status: string
        annualReplays: Array<{
          ownerReplays: Array<{
            line7AllocationEvidence: {
              allocations: Array<{ grossAmount: number }>
            }
          }>
        }>
      }
      expect(replay.status).toBe('ownedNonRothIraContiguousReplayComplete')
      replay.annualReplays[0]!.ownerReplays[0]!
        .line7AllocationEvidence.allocations[0]!.grossAmount += 1
      return replay
    }

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [],
      runAttempt: () => {
        mutateAttemptState(simulatorState, years)
        return years
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'replayEffectsInvalid',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
      issue: {
        kind: 'basisReplayInvalid',
        detail: 'Contiguous replay effects could not be canonicalized',
      },
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it('rejects a terminal year that cannot form a supported carryforward', () => {
    const plan = singlePersonPlan({ dob: '9923-01-01', planningAge: 76 })
    plan.id = 'attempt-terminal-year'
    plan.accounts = [ira('ira', 100_000, 'p1', 20_000)]
    const terminalYears = simulatePlan(validatePlan(plan), {
      startYear: 9999,
      horizonEndYear: 9999,
      taxCalculator: noTax,
    }).years
    const simulatorState = state(plan)
    const before = stateBytes(simulatorState)

    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: 9999,
      initialAssumedEffects: [],
      runAttempt: () => {
        mutateAttemptState(simulatorState, terminalYears)
        return terminalYears
      },
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'carryforwardYearUnsupported',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
      issue: { kind: 'yearSeriesInvalid', taxYear: 9999 },
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it.each(['laterYear', 'multiYear'] as const)(
    'rejects a %s result at the single-year transaction boundary',
    (kind) => {
      const plan = rmdPlan()
      const invalidYears = kind === 'laterYear'
        ? project(plan, TAX_YEAR + 1).slice(1)
        : project(plan, TAX_YEAR + 1)
      const simulatorState = state(plan)
      const result = runOwnedNonRothIraAnnualSettlementAttempts({
        state: simulatorState,
        plan,
        projectionStartTaxYear: TAX_YEAR,
        initialAssumedEffects: [] as OwnedNonRothIraAnnualSettlementEffect[],
        runAttempt: () => invalidYears,
      })

      expect(result).toMatchObject({
        status: 'rolledBack',
        reason: 'attemptBindingMismatch',
        pendingSettlement: null,
        committedCarryforwards: null,
        issue: null,
      })
    },
  )
})
