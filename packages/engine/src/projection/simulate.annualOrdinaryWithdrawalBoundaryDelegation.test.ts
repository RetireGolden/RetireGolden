/**
 * Hostile delegation guard for the exact-cent ordinary-withdrawal boundary.
 *
 * The mock returns fresh year/call-specific totals and positional writes that
 * the authored plan cannot produce. This distinguishes real delegation from
 * an orphaned helper, stale prior-year consumption, scalar recomputation, and
 * balance-operation underproduction. A linked conversion group forces
 * transactional re-entry, so the same guard also observes rollback and the
 * following year's committed balance/basis carry.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualOrdinaryWithdrawalBalanceOperation,
  AnnualOrdinaryWithdrawalBoundaryInput,
  AnnualOrdinaryWithdrawalBoundaryResult,
} from './internal/annualOrdinaryWithdrawalBoundary.js'

interface BoundaryPhase {
  readonly year: number
  readonly ordinal: number
  readonly input: AnnualOrdinaryWithdrawalBoundaryInput
  readonly original: AnnualOrdinaryWithdrawalBoundaryResult
  readonly output: AnnualOrdinaryWithdrawalBoundaryResult
  readonly openingTaxableBalance: number | null
  readonly openingTaxableCostBasis: number | null
  readonly injectedTraditionalBalance: number | null
  readonly injectedTaxableBalance: number | null
  readonly injectedTaxableCostBasis: number | null
}

const seam = vi.hoisted(() => ({
  mode: 'original' as 'original' | 'dynamic' | 'truncate' | 'wrongPosition',
  phases: [] as BoundaryPhase[],
  conversionInputs: [] as {
    readonly input: unknown
    readonly precedingPhase: BoundaryPhase | undefined
  }[],
}))

vi.mock('./internal/annualOrdinaryWithdrawalBoundary.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualOrdinaryWithdrawalBoundary.js')>()
  return {
    ...original,
    annualOrdinaryWithdrawalBoundary: (
      input: Parameters<typeof original.annualOrdinaryWithdrawalBoundary>[0],
    ) => {
      const production = original.annualOrdinaryWithdrawalBoundary(input)
      const ordinal = seam.phases.length
      const taxableState = input.balances.find(
        (state) => state.account.id === 'taxable',
      )
      const openingTaxableBalance = taxableState?.balance ?? null
      const openingTaxableCostBasis = taxableState?.costBasis ?? null
      let injectedTraditionalBalance: number | null = null
      let injectedTaxableBalance: number | null = null
      let injectedTaxableCostBasis: number | null = null
      let output = production
      if (seam.mode !== 'original') {
        const operations = production.balanceOperations.map(
          (operation, index): AnnualOrdinaryWithdrawalBalanceOperation => {
            const accountId = input.balances[index]?.account.id
            if (accountId === 'traditional') {
              injectedTraditionalBalance =
                10_000 + (input.year - 2025) * 100 + ordinal
              return {
                kind: 'write',
                accountId: 'traditional',
                closingBalance: injectedTraditionalBalance,
                closingCostBasis: null,
              }
            }
            if (accountId === 'taxable') {
              injectedTaxableBalance =
                20_000 + (input.year - 2025) * 100 + ordinal
              injectedTaxableCostBasis =
                7_000 + (input.year - 2025) * 100 + ordinal
              return {
                kind: 'write',
                accountId: 'taxable',
                closingBalance: injectedTaxableBalance,
                closingCostBasis: injectedTaxableCostBasis,
              }
            }
            return operation
          },
        )
        const balanceOperations =
          seam.mode === 'truncate'
            ? operations.slice(0, -1)
            : seam.mode === 'wrongPosition'
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
        output = {
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
      }
      seam.phases.push({
        year: input.year,
        ordinal,
        input,
        original: production,
        output,
        openingTaxableBalance,
        openingTaxableCostBasis,
        injectedTraditionalBalance,
        injectedTaxableBalance,
        injectedTaxableCostBasis,
      })
      return output
    },
  }
})

vi.mock('../actions/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../actions/index.js')>()
  return {
    ...original,
    executeRothConversions: (
      input: Parameters<typeof original.executeRothConversions>[0],
    ) => {
      seam.conversionInputs.push({
        input,
        precedingPhase: seam.phases.at(-1),
      })
      return original.executeRothConversions(input)
    },
  }
})

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
  return seam.phases.filter((phase) => phase.year === year)
}

function finalPhase(year: number): BoundaryPhase {
  const phase = phasesFor(year).at(-1)
  if (phase === undefined) throw new Error(`missing boundary phase for ${year}`)
  return phase
}

function run(mode: typeof seam.mode) {
  seam.mode = mode
  seam.phases.length = 0
  seam.conversionInputs.length = 0
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
        taxInputs.push({ input, precedingPhase: seam.phases.at(-1) })
        return 0
      },
    },
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  return { inputPlan, result, taxInputs, probes }
}

describe('simulatePlan delegates the annual ordinary-withdrawal boundary', () => {
  it('consumes each fresh current-year result, every scalar, and positional writes', () => {
    const { result, taxInputs, probes } = run('dynamic')

    expect(phasesFor(START_YEAR).length).toBeGreaterThan(1)
    expect(phasesFor(START_YEAR + 1).length).toBeGreaterThan(1)
    expect(seam.conversionInputs.length).toBeGreaterThan(1)

    for (const phase of seam.phases) {
      const actionIds = phase.input.executionRequests.map(
        (request) => request.actionId,
      )
      expect(actionIds).toEqual(
        actionIds.length === 0 ? [] : [`withdraw-${phase.year}`],
      )
      if (actionIds.length > 0) {
        expect(phase.input.ordinaryActions[0]).toBe(
          phase.input.executionRequests[0],
        )
      }
      expect(phase.output.execution).toBe(phase.original.execution)
      expect(phase.output.balanceOperations).toHaveLength(phase.input.balances.length)
    }

    for (const conversion of seam.conversionInputs) {
      const phase = conversion.precedingPhase
      expect(phase).toBeDefined()
      const conversionInput = conversion.input as {
        year: number
        openingBalances: readonly { accountId: string; openingBalance: number }[]
      }
      expect(conversionInput.year).toBe(phase!.year)
      expect(
        conversionInput.openingBalances.find(
          (snapshot) => snapshot.accountId === 'traditional',
        )?.openingBalance,
      ).toBe(phase!.injectedTraditionalBalance! * 100)
    }

    const firstYearFinal = finalPhase(START_YEAR)
    expect(phasesFor(START_YEAR).every(
      (phase) => phase.openingTaxableBalance === 50_000 &&
        phase.openingTaxableCostBasis === 25_000,
    )).toBe(true)
    for (const phase of phasesFor(START_YEAR + 1)) {
      expect(phase.openingTaxableBalance).toBe(
        firstYearFinal.injectedTaxableBalance,
      )
      expect(phase.openingTaxableCostBasis).toBe(
        firstYearFinal.injectedTaxableCostBasis,
      )
    }

    for (const yearResult of result.years) {
      const phase = finalPhase(yearResult.year)
      const totals = phase.output.totals
      expect(yearResult.retirementActionExecution).toBe(phase.output.execution)
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
      for (const taxInput of finalTaxInputs) {
        expect(taxInput.precedingPhase).toBeDefined()
        const phaseEquityCompensation =
          taxInput.precedingPhase!.output.totals.equityCompensation
        // The released linked conversion contributes one separate dollar of
        // ordinary income; counterfactual and refused passes contribute none.
        expect([
          phaseEquityCompensation,
          phaseEquityCompensation + 1,
        ]).toContain(taxInput.input.ordinaryIncome)
        expect(taxInput.input.capitalGains).toBe(
          taxInput.precedingPhase!.output.totals.capitalGainOrLoss,
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
