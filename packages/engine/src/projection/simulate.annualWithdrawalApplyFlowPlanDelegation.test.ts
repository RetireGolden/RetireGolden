/** Hostile delegation and counterfactual re-entry guard for apply flows. */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualWithdrawalApplyFlowPlanInput,
  AnnualWithdrawalApplyFlowPlanResult,
} from './internal/annualWithdrawalApplyFlowPlan.js'

interface Phase {
  readonly year: number
  readonly openingByAccountId: ReadonlyMap<string, number>
  readonly natural: AnnualWithdrawalApplyFlowPlanResult
  readonly output: AnnualWithdrawalApplyFlowPlanResult
}

const seam = vi.hoisted(() => ({
  mode: 'dynamic' as
    | 'dynamic'
    | 'wrongBalancePosition'
    | 'wrongSourceBalance'
    | 'wrongEvidencePosition'
    | 'missingTaxableSale',
  phases: [] as Phase[],
  snapshots: [] as {
    readonly phase: Phase | undefined
    readonly balances: ReadonlyMap<string, number>
  }[],
}))

vi.mock('./internal/annualWithdrawalApplyFlowPlan.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualWithdrawalApplyFlowPlan.js')
  >()
  return {
    ...original,
    annualWithdrawalApplyFlowPlan: (
      input: AnnualWithdrawalApplyFlowPlanInput,
    ) => {
      const natural = original.annualWithdrawalApplyFlowPlan(input)
      const ordinal = seam.phases.length
      const balanceOperations = natural.balanceOperations.map(
        (operation, operationOrdinal) => {
          const taken = 10 + operationOrdinal * 10 + ordinal / 100
          return {
            ...operation,
            balanceIndex: seam.mode === 'wrongBalancePosition'
              ? 0
              : operation.balanceIndex,
            sourceBalanceBefore: seam.mode === 'wrongSourceBalance'
              ? operation.sourceBalanceBefore + 1
              : operation.sourceBalanceBefore,
            taxableSaleMissing: seam.mode === 'missingTaxableSale'
              ? operationOrdinal === 0
              : operation.taxableSaleMissing,
            taken,
            sourceBalanceAfter: operation.sourceBalanceBefore - taken,
          }
        },
      )
      const evidenceWrites = natural.evidenceWrites.map((write) => ({
        ...write,
        evidenceIndex: seam.mode === 'wrongEvidencePosition'
          ? write.evidenceIndex + 1
          : write.evidenceIndex,
        voluntaryAmount: 700 + ordinal,
      }))
      const output = { evidenceWrites, balanceOperations }
      const phase = {
        year: input.year,
        openingByAccountId: new Map(input.balances.map(
          (state) => [state.account.id, state.balance] as const,
        )),
        natural,
        output,
      }
      seam.phases.push(phase)
      return output
    },
  }
})

vi.mock('./internal/annualSnapshot.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualSnapshot.js')
  >()
  return {
    ...original,
    annualSnapshot: (input: Parameters<typeof original.annualSnapshot>[0]) => {
      seam.snapshots.push({
        phase: seam.phases.at(-1),
        balances: new Map(input.balances.map(
          (state) => [state.account.id, state.balance] as const,
        )),
      })
      return original.annualSnapshot(input)
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { parseRetirementActionRequest } from '../actions/index.js'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '../actions/planBalanceAdapter.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'

const START_YEAR = 2026
const NAMED_CASH_OPENING_PLAN_DOLLARS = 1_000
const NAMED_ORDINARY_AMOUNT_PLAN_DOLLARS = 100
const AGGREGATE_CONVERSION_PLAN_DOLLARS = 200

function parseAction(value: unknown) {
  const parsed = parseRetirementActionRequest(value)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function traditional(
  id: string,
  balance: number,
  inherited: boolean,
): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    ...(inherited
      ? {
          inherited: {
            ownerDeathYear: 2024,
            decedentHadStartedRmds: true,
          },
        }
      : {}),
  }
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })
  value.accounts = [
    traditional('inherited', 10_000, true),
    traditional('owned', 100_000, false),
  ]
  value.expenses.baseAnnual = 50_000
  return validatePlan(value)
}

function crossBoundaryPlan(): Plan {
  const value = singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })
  value.accounts = [
    {
      type: 'cash',
      id: 'named-cash',
      name: 'named-cash',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: NAMED_CASH_OPENING_PLAN_DOLLARS,
      annualContribution: 0,
    },
    traditional('inherited', 10_000, true),
    traditional('owned', 100_000, false),
    {
      type: 'roth',
      kind: 'ira',
      id: 'roth',
      name: 'roth',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      balance: 0,
      annualContribution: 0,
    },
  ]
  value.expenses.baseAnnual = 50_000
  value.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'owned-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'owned',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  value.strategies.retirementActions = [parseAction({
    actionId: 'named-ordinary-before-aggregate',
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: START_YEAR,
    executionDate: `${START_YEAR}-01-15`,
    executionSequence: 1,
    requestedAmount: planDollarsToLedgerCents(
      NAMED_ORDINARY_AMOUNT_PLAN_DOLLARS,
    ),
    allocations: [{
      allocationId: 'named-ordinary-cash-allocation',
      sourceAccountId: 'named-cash',
      requestedAmount: planDollarsToLedgerCents(
        NAMED_ORDINARY_AMOUNT_PLAN_DOLLARS,
      ),
    }],
    purpose: { kind: 'spending' },
    provenance: { source: 'manual' },
  })]
  value.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{
      year: START_YEAR,
      amount: AGGREGATE_CONVERSION_PLAN_DOLLARS,
    }],
  }
  return validatePlan(value)
}

function phasesFor(year: number): readonly Phase[] {
  return seam.phases.filter((phase) => phase.year === year)
}

function run(mode: typeof seam.mode) {
  seam.mode = mode
  seam.phases.length = 0
  seam.snapshots.length = 0
  const counterfactualReads: unknown[] = []
  const annualCounterfactual: SimulateAnnualCounterfactualRequest = {
    omitActionIds: [],
    taxUnitId: 'apply-flow-delegation-tax-unit',
    nonGroupTaxInputs: [{
      inputId: 'federalFilingStatus',
      value: { representation: 'declaredTerm', term: 'single' },
    }],
    capture: (reading) => counterfactualReads.push(reading),
  }
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: START_YEAR + 1,
    taxCalculator: { compute: () => 0 },
    annualCounterfactual,
  })
  return { result, counterfactualReads }
}

describe('simulatePlan delegates voluntary withdrawal apply-flow planning', () => {
  it('applies fresh hostile operations at the live commit point on every pass', () => {
    const { result, counterfactualReads } = run('dynamic')
    expect(phasesFor(START_YEAR).length).toBeGreaterThan(1)
    expect(phasesFor(START_YEAR + 1).length).toBeGreaterThan(1)
    expect(counterfactualReads).toHaveLength(2)
    expect(new Set(seam.phases.map((phase) => phase.output)).size)
      .toBe(seam.phases.length)
    expect(new Set(seam.phases.map((phase) => phase.output.balanceOperations)).size)
      .toBe(seam.phases.length)

    for (const year of [START_YEAR, START_YEAR + 1]) {
      const phases = phasesFor(year)
      const firstOpenings = [...phases[0]!.openingByAccountId]
      expect(phases.every(
        (phase) => JSON.stringify([...phase.openingByAccountId]) ===
          JSON.stringify(firstOpenings),
      )).toBe(true)
    }
    const final2026 = phasesFor(START_YEAR).at(-1)!
    const owned2026 = final2026.output.balanceOperations.find(
      (operation) => operation.accountId === 'owned',
    )!
    expect(phasesFor(START_YEAR + 1).every(
      (phase) => phase.openingByAccountId.get('owned') ===
        owned2026.sourceBalanceAfter,
    )).toBe(true)

    expect(seam.snapshots).toHaveLength(seam.phases.length)
    for (const snapshot of seam.snapshots) {
      for (const operation of snapshot.phase!.output.balanceOperations) {
        expect(snapshot.balances.get(operation.accountId))
          .toBe(operation.sourceBalanceAfter)
      }
    }

    result.years.forEach((year) => {
      const phase = phasesFor(year.year).at(-1)!
      expect(year.inheritedAccounts?.[0]?.voluntaryAmount).toBe(
        phase.output.evidenceWrites[0]!.voluntaryAmount,
      )
      const runtime = year.retirementRuntimeSource?.runtimeOccurrences ?? []
      const needBased = runtime.filter(
        (occurrence) => occurrence.kind === 'legacyNeedBasedWithdrawal',
      )
      expect(needBased.map((occurrence) => ({
        accountId: occurrence.sourceAccountId,
        amount: occurrence.grossAmountPlanDollars,
      })).sort((left, right) => left.accountId!.localeCompare(right.accountId!)))
        .toEqual(phase.output.balanceOperations.map((operation) => ({
          accountId: operation.accountId,
          amount: operation.taken,
        })).sort((left, right) => left.accountId.localeCompare(right.accountId)))
      const applications =
        year.retirementRuntimeApplicationSource?.applications.filter(
          (candidate) => candidate.simulatorPhase === 'legacyNeedBasedWithdrawal',
        ) ?? []
      const owned = phase.output.balanceOperations.find(
        (operation) => operation.accountId === 'owned',
      )!
      expect(applications).toHaveLength(1)
      expect(applications[0]).toMatchObject({
        mutationOrdinal: 1,
        sourceAccountId: 'owned',
        sourceBalanceBeforePlanDollars: owned.sourceBalanceBefore,
        appliedAmountPlanDollars: owned.taken,
        sourceBalanceAfterPlanDollars: owned.sourceBalanceAfter,
      })
    })
  })

  it('rejects hostile balance and evidence positions', () => {
    expect(() => run('wrongBalancePosition')).toThrow(
      'Withdrawal apply-flow operation lost its balance position',
    )
    expect(() => run('wrongSourceBalance')).toThrow(
      'Withdrawal apply-flow operation lost its balance position',
    )
    expect(() => run('wrongEvidencePosition')).toThrow(
      'Withdrawal apply-flow evidence operation lost its row position',
    )
    expect(() => run('missingTaxableSale')).toThrow(
      'Planned taxable sale disappeared before commit',
    )
  })

  it('plans from the live post-ordinary and post-conversion state', () => {
    seam.mode = 'dynamic'
    seam.phases.length = 0
    seam.snapshots.length = 0
    const result = simulatePlan(crossBoundaryPlan(), {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: { compute: () => 0 },
    })

    const phases = phasesFor(START_YEAR)
    expect(phases).toHaveLength(1)
    const execution = result.years[0]!.retirementActionExecution
    const executionCash = execution?.balances.find(
      (balance) => balance.accountId === 'named-cash',
    )
    expect(execution).toMatchObject({
      committed: true,
      balances: [{
        accountId: 'named-cash',
        openingBalance: planDollarsToLedgerCents(
          NAMED_CASH_OPENING_PLAN_DOLLARS,
        ),
        closingBalance: planDollarsToLedgerCents(
          NAMED_CASH_OPENING_PLAN_DOLLARS -
            NAMED_ORDINARY_AMOUNT_PLAN_DOLLARS,
        ),
      }],
    })
    if (executionCash === undefined) throw new Error('expected named cash execution')
    const cashAfterOrdinary = ledgerCentsToPlanDollars(
      executionCash.closingBalance,
    )
    expect(phases[0]!.openingByAccountId.get('named-cash'))
      .toBe(cashAfterOrdinary)

    const applications =
      result.years[0]!.retirementRuntimeApplicationSource?.applications ?? []
    const conversionDebit = applications.find(
      (application) =>
        application.applicationKind === 'debit' &&
        application.simulatorPhase === 'legacyRothConversion' &&
        application.sourceAccountId === 'owned',
    )
    const conversionCredit = applications.find(
      (application) =>
        application.applicationKind === 'aggregateRothDestinationCredit' &&
        application.destinationRothAccountId === 'roth',
    )
    const needBased = applications.find(
      (application) =>
        application.applicationKind === 'debit' &&
        application.simulatorPhase === 'legacyNeedBasedWithdrawal' &&
        application.sourceAccountId === 'owned',
    )
    if (conversionDebit?.applicationKind !== 'debit') {
      throw new Error('expected aggregate conversion debit')
    }
    if (conversionCredit?.applicationKind !== 'aggregateRothDestinationCredit') {
      throw new Error('expected aggregate conversion destination credit')
    }
    if (needBased?.applicationKind !== 'debit') {
      throw new Error('expected owned need-based debit')
    }
    expect(conversionDebit).toMatchObject({
      mutationOrdinal: 1,
      sourceBalanceBeforePlanDollars: 100_000,
      appliedAmountPlanDollars: AGGREGATE_CONVERSION_PLAN_DOLLARS,
      sourceBalanceAfterPlanDollars:
        100_000 - AGGREGATE_CONVERSION_PLAN_DOLLARS,
    })
    expect(conversionCredit).toMatchObject({
      mutationOrdinal: 2,
      destinationBalanceBeforePlanDollars: 0,
      destinationCreditedAmountPlanDollars:
        AGGREGATE_CONVERSION_PLAN_DOLLARS,
      destinationBalanceAfterPlanDollars:
        AGGREGATE_CONVERSION_PLAN_DOLLARS,
    })

    expect(phases[0]!.openingByAccountId.get('owned'))
      .toBe(conversionDebit.sourceBalanceAfterPlanDollars)
    expect(phases[0]!.openingByAccountId.get('roth'))
      .toBe(conversionCredit.destinationBalanceAfterPlanDollars)
    const cashOperation = phases[0]!.output.balanceOperations.find(
      (operation) => operation.accountId === 'named-cash',
    )
    const ownedOperation = phases[0]!.output.balanceOperations.find(
      (operation) => operation.accountId === 'owned',
    )
    expect(cashOperation?.sourceBalanceBefore).toBe(cashAfterOrdinary)
    expect(ownedOperation?.sourceBalanceBefore)
      .toBe(conversionDebit.sourceBalanceAfterPlanDollars)
    expect(needBased).toMatchObject({
      mutationOrdinal: 3,
      sourceBalanceBeforePlanDollars: ownedOperation?.sourceBalanceBefore,
      appliedAmountPlanDollars: ownedOperation?.taken,
      sourceBalanceAfterPlanDollars: ownedOperation?.sourceBalanceAfter,
    })
  })
})
