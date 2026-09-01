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
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
} from './simulate.js'

const START_YEAR = 2026

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
})
