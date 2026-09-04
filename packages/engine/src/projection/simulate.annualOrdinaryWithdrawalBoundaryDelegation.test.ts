/**
 * Hostile delegation guard for the exact-cent ordinary-withdrawal boundary.
 *
 * The mock returns fresh year/call-specific totals and positional writes that
 * the authored plan cannot produce. This distinguishes real delegation from
 * an orphaned helper, stale prior-year consumption, scalar recomputation, and
 * balance-operation underproduction. A linked conversion group forces
 * transactional re-entry, so the same guard also observes rollback and the
 * following year's committed balance/basis carry.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualOrdinaryWithdrawalBalanceOperation,
  AnnualOrdinaryWithdrawalBoundaryInput,
  AnnualOrdinaryWithdrawalBoundaryResult,
} from './internal/annualOrdinaryWithdrawalBoundary.js'
import type { SeamCall } from './simulate.seamGuard.test-support.js'

/**
 * The taxable line's opening state, snapshotted before the real helper runs so
 * a later mutation of the live balance array cannot rewrite what this pass saw.
 */
interface BoundaryOpening {
  readonly openingTaxableBalance: number | null
  readonly openingTaxableCostBasis: number | null
}

type BoundaryPhase = SeamCall<
  AnnualOrdinaryWithdrawalBoundaryInput,
  AnnualOrdinaryWithdrawalBoundaryResult,
  BoundaryOpening
>

const hostile = vi.hoisted(() => ({
  mode: 'original' as 'original' | 'dynamic' | 'truncate' | 'wrongPosition',
  conversionInputs: [] as {
    readonly input: unknown
    readonly precedingPhase: BoundaryPhase | undefined
  }[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualOrdinaryWithdrawalBoundaryInput,
      AnnualOrdinaryWithdrawalBoundaryResult,
      BoundaryOpening
    >(),
)

vi.mock('./internal/annualOrdinaryWithdrawalBoundary.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualOrdinaryWithdrawalBoundary.js')
    >(),
    'annualOrdinaryWithdrawalBoundary',
    (
      production,
      { input, ordinal },
    ): AnnualOrdinaryWithdrawalBoundaryResult => {
      if (hostile.mode === 'original') return production
      const operations = production.balanceOperations.map(
        (operation, index): AnnualOrdinaryWithdrawalBalanceOperation => {
          const accountId = input.balances[index]?.account.id
          if (accountId === 'traditional') {
            return {
              kind: 'write',
              accountId: 'traditional',
              closingBalance: 10_000 + (input.year - 2025) * 100 + ordinal,
              closingCostBasis: null,
            }
          }
          if (accountId === 'taxable') {
            return {
              kind: 'write',
              accountId: 'taxable',
              closingBalance: 20_000 + (input.year - 2025) * 100 + ordinal,
              closingCostBasis: 7_000 + (input.year - 2025) * 100 + ordinal,
            }
          }
          return operation
        },
      )
      const balanceOperations =
        hostile.mode === 'truncate'
          ? operations.slice(0, -1)
          : hostile.mode === 'wrongPosition'
            ? operations.map((operation, index) =>
                index === 0
                  ? {
                      kind: 'write' as const,
                      accountId: 'not-the-first-balance',
                      closingBalance: 12_345,
                      closingCostBasis: null,
                    }
                  : operation)
            : operations
      const base = (input.year - 2025) * 100 + ordinal * 10
      return {
        execution: production.execution,
        totals: {
          cash: base + 1,
          equityCompensation: base + 2,
          taxableProceeds: base + 4,
          proceeds: base + 8,
          capitalGainOrLoss: base + 16,
        },
        balanceOperations,
      }
    },
    {
      capture: (input): BoundaryOpening => {
        const taxableState = input.balances.find(
          (state) => state.account.id === 'taxable',
        )
        return {
          openingTaxableBalance: taxableState?.balance ?? null,
          openingTaxableCostBasis: taxableState?.costBasis ?? null,
        }
      },
    },
  ),
)

vi.mock('../actions/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../actions/index.js')>()
  return {
    ...original,
    executeRothConversions: (
      input: Parameters<typeof original.executeRothConversions>[0],
    ) => {
      hostile.conversionInputs.push({
        input,
        precedingPhase: seam.calls.at(-1),
      })
      return original.executeRothConversions(input)
    },
  }
})

import { expectPublishedFromSeam } from './simulate.seamGuard.test-support.js'
import type { Account, Plan } from '../model/plan.js'
import { parseRetirementActionRequest } from '../actions/index.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe, TaxYearInput } from './types.js'

const START_YEAR = 2026

function parseAction(value: unknown) {
  const parsed = parseRetirementActionRequest(value)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function cash(id: string, balance: number): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function traditional(id: string, balance: number): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function taxable(id: string, balance: number, costBasis: number): Account {
  return {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    costBasis,
    annualContribution: 0,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0,
    reinvestDividends: true,
  }
}

function roth(id: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })
  value.accounts = [
    cash('cash', 1_000_000),
    traditional('traditional', 100_000),
    taxable('taxable', 50_000, 25_000),
    roth('roth'),
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [{
      evidenceId: 'traditional-classification',
      provenance: { source: 'manual' },
      sourceAccountId: 'traditional',
      subtype: 'traditional',
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  value.strategies.retirementActions = [START_YEAR, START_YEAR + 1].flatMap(
    (year) => [
      parseAction({
        actionId: `withdraw-${year}`,
        kind: 'ordinaryWithdrawal',
        personId: 'p1',
        year,
        executionDate: `${year}-01-15`,
        executionSequence: 1,
        requestedAmount: 100,
        allocations: [{
          allocationId: `withdraw-${year}-allocation`,
          sourceAccountId: 'cash',
          requestedAmount: 100,
        }],
        purpose: { kind: 'taxPayment', referenceId: `convert-${year}` },
        provenance: { source: 'manual' },
      }),
      parseAction({
        actionId: `convert-${year}`,
        kind: 'rothConversion',
        personId: 'p1',
        year,
        executionDate: `${year}-06-15`,
        executionSequence: 2,
        requestedAmount: 100,
        allocations: [{
          allocationId: `convert-${year}-allocation`,
          sourceAccountId: 'traditional',
          requestedAmount: 100,
        }],
        destinationRothAccountId: 'roth',
        taxFunding: {
          kind: 'linkedWithdrawal',
          withdrawalActionId: `withdraw-${year}`,
        },
        provenance: { source: 'manual' },
      }),
    ],
  )
  return validatePlan(value)
}

function phasesFor(year: number): readonly BoundaryPhase[] {
  return seam.calls.filter((phase) => phase.input.year === year)
}

function finalPhase(year: number): BoundaryPhase {
  const phase = phasesFor(year).at(-1)
  if (phase === undefined) throw new Error(`missing boundary phase for ${year}`)
  return phase
}

/**
 * The closing write this pass injected for one account, read back off the
 * object the seam returned. `undefined` when the seam left the pass untouched.
 */
function injectedWrite(
  phase: BoundaryPhase,
  accountId: string,
): Extract<AnnualOrdinaryWithdrawalBalanceOperation, { kind: 'write' }> | undefined {
  return phase.injected.balanceOperations.find(
    (
      operation,
    ): operation is Extract<
      AnnualOrdinaryWithdrawalBalanceOperation,
      { kind: 'write' }
    > => operation.kind === 'write' && operation.accountId === accountId,
  )
}

function run(mode: typeof hostile.mode) {
  hostile.mode = mode
  seam.reset()
  hostile.conversionInputs.length = 0
  const taxInputs: {
    readonly input: TaxYearInput
    readonly precedingPhase: BoundaryPhase | undefined
  }[] = []
  const probes: OptimizerYearProbe[] = []
  const inputPlan = plan()
  const result = simulatePlan(inputPlan, {
    startYear: START_YEAR,
    horizonEndYear: START_YEAR + 1,
    taxCalculator: {
      compute(input) {
        taxInputs.push({ input, precedingPhase: seam.calls.at(-1) })
        return 0
      },
    },
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  return { inputPlan, result, taxInputs, probes }
}

describe('simulatePlan delegates the annual ordinary-withdrawal boundary', () => {
  it('retains the dominant no-action fast path outside the helper', () => {
    hostile.mode = 'dynamic'
    seam.reset()
    hostile.conversionInputs.length = 0
    const probes: OptimizerYearProbe[] = []

    const result = simulatePlan(
      validatePlan(singlePersonPlan({ dob: '1970-01-01', planningAge: 90 })),
      {
        startYear: START_YEAR,
        horizonEndYear: START_YEAR + 1,
        taxCalculator: { compute: () => 0 },
        captureOptimizerInputs: (probe) => probes.push(probe),
      },
    )

    expect(seam.calls).toEqual([])
    for (const year of result.years) {
      expect(year.retirementActionExecution).toBeUndefined()
      expect(year.withdrawals.cash).toBe(0)
      expect(year.withdrawals.taxable).toBe(0)
      expect(year.withdrawals.total).toBe(0)
      expect(year.realizedGains).toBe(0)
    }
    expect(probes.every((probe) => probe.committedActionProceeds === 0)).toBe(true)
  })

  it('consumes each fresh current-year result, every scalar, and positional writes', () => {
    const { result, taxInputs, probes } = run('dynamic')

    expect(phasesFor(START_YEAR).length).toBeGreaterThan(1)
    expect(phasesFor(START_YEAR + 1).length).toBeGreaterThan(1)
    expect(hostile.conversionInputs.length).toBeGreaterThan(1)

    for (const phase of seam.calls) {
      const actionIds = phase.input.executionRequests.map(
        (request) => request.actionId,
      )
      expect(actionIds).toEqual(
        actionIds.length === 0 ? [] : [`withdraw-${phase.input.year}`],
      )
      if (actionIds.length > 0) {
        expect(phase.input.ordinaryActions[0]).toBe(
          phase.input.executionRequests[0],
        )
      }
      expect(phase.injected.execution).toBe(phase.natural.execution)
      expect(phase.injected.balanceOperations).toHaveLength(phase.input.balances.length)
    }

    for (const conversion of hostile.conversionInputs) {
      const phase = conversion.precedingPhase
      expect(phase).toBeDefined()
      const injectedTraditionalBalance =
        phase === undefined
          ? undefined
          : injectedWrite(phase, 'traditional')?.closingBalance
      expect(injectedTraditionalBalance).toBeTypeOf('number')
      if (phase === undefined || typeof injectedTraditionalBalance !== 'number') {
        throw new Error('missing injected traditional balance for conversion')
      }
      const conversionInput = conversion.input as {
        year: number
        openingBalances: readonly { accountId: string; openingBalance: number }[]
      }
      expect(conversionInput.year).toBe(phase.input.year)
      expect(
        conversionInput.openingBalances.find(
          (snapshot) => snapshot.accountId === 'traditional',
        )?.openingBalance,
      ).toBe(injectedTraditionalBalance * 100)
    }

    const firstYearFinal = finalPhase(START_YEAR)
    const firstYearTaxableWrite = injectedWrite(firstYearFinal, 'taxable')
    expect(phasesFor(START_YEAR).every(
      (phase) => phase.captured.openingTaxableBalance === 50_000 &&
        phase.captured.openingTaxableCostBasis === 25_000,
    )).toBe(true)
    for (const phase of phasesFor(START_YEAR + 1)) {
      expect(phase.captured.openingTaxableBalance).toBe(
        firstYearTaxableWrite?.closingBalance,
      )
      expect(phase.captured.openingTaxableCostBasis).toBe(
        firstYearTaxableWrite?.closingCostBasis,
      )
    }

    for (const yearResult of result.years) {
      const phase = finalPhase(yearResult.year)
      const totals = phase.injected.totals
      expectPublishedFromSeam(
        yearResult.retirementActionExecution,
        phase.injected.execution,
        `the ${yearResult.year} retirement-action execution`,
      )
      expect(yearResult.withdrawals.cash).toBe(totals.cash)
      expect(yearResult.withdrawals.taxable).toBe(
        totals.equityCompensation + totals.taxableProceeds,
      )
      expect(yearResult.withdrawals.total).toBe(totals.proceeds)
      expect(yearResult.realizedGains).toBe(totals.capitalGainOrLoss)
      expect(
        probes.find((probe) => probe.year === yearResult.year)
          ?.committedActionProceeds,
      ).toBe(totals.proceeds)

      const finalTaxInputs = taxInputs.filter(
        ({ input }) => input.year === yearResult.year,
      )
      expect(finalTaxInputs.length).toBeGreaterThan(0)
      const boundaryTaxInputs = finalTaxInputs.filter(
        (taxInput): taxInput is typeof taxInput & {
          readonly precedingPhase: BoundaryPhase
        } => taxInput.precedingPhase?.input.year === yearResult.year,
      )
      expect(boundaryTaxInputs.length).toBeGreaterThan(0)
      for (const taxInput of boundaryTaxInputs) {
        const phaseEquityCompensation =
          taxInput.precedingPhase.injected.totals.equityCompensation
        // The released linked conversion contributes one separate dollar of
        // ordinary income; counterfactual and refused passes contribute none.
        expect([
          phaseEquityCompensation,
          phaseEquityCompensation + 1,
        ]).toContain(taxInput.input.ordinaryIncome)
        expect(taxInput.input.capitalGains).toBe(
          taxInput.precedingPhase.injected.totals.capitalGainOrLoss,
        )
      }
    }
  })

  it('rejects an underproduced positional operation list', () => {
    expect(() => run('truncate')).toThrow(
      'Ordinary-withdrawal balance operations lost cardinality',
    )
  })

  it('rejects a same-cardinality operation whose account id lost its position', () => {
    expect(() => run('wrongPosition')).toThrow(
      'Ordinary-withdrawal balance operation lost its position',
    )
  })
})
