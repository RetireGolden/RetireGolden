import { describe, expect, it } from 'vitest'

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
import {
  runOwnedNonRothIraAnnualSettlementAttempts,
  type OwnedNonRothIraAnnualSettlementEffect,
} from './ownedNonRothIraAnnualAttemptSettlement.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

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

function state(): SimulatorAnnualPassStateBindings {
  return {
    balances: [{ account: { id: 'ira' }, balance: 100_000, costBasis: 0 }],
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
    warnings: [...value.warnings],
    unassignedCash: value.unassignedCash.read(),
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
  const year = years[0]!
  simulatorState.balances[0]!.balance -= 1
  simulatorState.warnings.add('attempt-tail')
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
    simulatorState.nextRetirementRuntimeMutationOrdinal.read() +
      year.retirementRuntimeApplicationSource!.applications.length,
  )
}

describe('private owned-IRA annual attempt settlement', () => {
  it('reprobes from the exact checkpoint and queues one carryforward only on exact commit', () => {
    const plan = rmdPlan()
    const canonicalYears = project(plan, TAX_YEAR + 1)
    const simulatorState = state()
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
      endTaxYear: TAX_YEAR + 1,
    })
    expect(result.pendingSettlement.observedEffects.length).toBeGreaterThan(0)
    expect(result.committedCarryforwards).toHaveLength(1)
    expect(result.committedCarryforwards[0]).toMatchObject({
      ownerPersonId: 'p1',
      fromTaxYear: TAX_YEAR + 1,
      toTaxYear: TAX_YEAR + 2,
    })
    expect(result.committedCarryforwards).toBe(
      result.pendingSettlement.committedCarryforwards,
    )
    expect(simulatorState.balances[0]!.balance).toBe(99_999)
    expect(simulatorState.retirementRuntimeOccurrences).not.toHaveLength(0)
    expect(Object.isFrozen(result.pendingSettlement)).toBe(true)
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
      ]
      plan.strategies.rothConversion = {
        mode: 'manual',
        conversions: [{ year: TAX_YEAR, amount: 2_000 }],
      }
    }
    const blockedYears = cloneYears(project(plan))
    if (kind === 'incompleteAggregate') {
      const applications = blockedYears[0]!
        .retirementRuntimeApplicationSource!.applications
      ;(applications as unknown as unknown[]).splice(
        applications.findIndex((application) =>
          application.applicationKind === 'aggregateRothDestinationCredit'),
        1,
      )
    }
    const simulatorState = state()
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
      reason: kind === 'mixedOwnerAggregate'
        ? 'aggregateOwnerBindingIncomplete'
        : 'contiguousReplayBlocked',
      attemptCount: 1,
      pendingSettlement: null,
      committedCarryforwards: null,
    })
    expect(stateBytes(simulatorState)).toBe(before)
  })

  it('restores state on callback throws and assumption cycles', () => {
    const plan = rmdPlan()
    const simulatorState = state()
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

  it('cannot reseed a later suffix after the projection-start chain is absent', () => {
    const plan = rmdPlan()
    const suffix = project(plan, TAX_YEAR + 1).slice(1)
    const simulatorState = state()
    const result = runOwnedNonRothIraAnnualSettlementAttempts({
      state: simulatorState,
      plan,
      projectionStartTaxYear: TAX_YEAR,
      initialAssumedEffects: [] as OwnedNonRothIraAnnualSettlementEffect[],
      runAttempt: () => suffix,
    })

    expect(result).toMatchObject({
      status: 'rolledBack',
      reason: 'contiguousReplayBlocked',
      pendingSettlement: null,
      committedCarryforwards: null,
      issue: { kind: 'yearSeriesInvalid' },
    })
  })
})
