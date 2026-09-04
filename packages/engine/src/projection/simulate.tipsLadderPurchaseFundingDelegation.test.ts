/**
 * Seam guard for TIPS-ladder purchase funding.
 *
 * A byte-identical projection cannot distinguish real delegation from an
 * orphaned helper beside the old inline block. This file observes the call and
 * injects distinctive values into the second purchase row. Four downstream
 * seams then prove that `simulatePlan` applies the helper's positional result:
 * the next phase sees balance/basis, the ladder-flow phase sees scale, the
 * optimizer probe sees the debit, and the cash-flow recorder receives the
 * helper's own `record` object (`toBe`, not merely field equality).
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedTipsPurchase } from './annualCashFlowYearSites.js'
import { TIPS_LADDER_PURCHASE_SHORTFALL_WARNING } from './internal/tipsLadderPurchaseFunding.js'
import type {
  TipsLadderPurchaseFundingInput,
  TipsLadderPurchaseFundingRow,
} from './internal/tipsLadderPurchaseFunding.js'

interface BalanceSnapshot {
  readonly accountId: string
  readonly balance: number
  readonly costBasis: number
}

const hostile = vi.hoisted(() => ({
  postPurchaseBalances: [] as (readonly BalanceSnapshot[])[],
  annualFlowScales: [] as (readonly number[])[],
  recorded: [] as RecordedTipsPurchase[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      TipsLadderPurchaseFundingInput,
      readonly TipsLadderPurchaseFundingRow[],
      readonly BalanceSnapshot[]
    >(),
)

vi.mock('./internal/tipsLadderPurchaseFunding.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/tipsLadderPurchaseFunding.js')>(),
    'tipsLadderPurchaseFunding',
    (originalRows): readonly TipsLadderPurchaseFundingRow[] =>
      originalRows.map((row) => {
        if (row.kind !== 'purchase') return row
        if (row.debit === null) {
          throw new Error('the delegation fixture must fund all three ladders')
        }
        // Deliberately decouple these values from the helper's real arithmetic.
        // An inline duplicate, or a caller that recomputes any field, cannot
        // accidentally satisfy the downstream assertions.
        const injectedScale = [0.625, 0.375, 0.125][row.ladderIndex]!
        const injectedClosingBalance = [222.25, 33.5, 11.25][row.ladderIndex]!
        const injectedClosingCostBasis = [111.125, 22.25, 4.5][row.ladderIndex]!
        const injectedDebitDelta = [0.11, 0.17, 0.23][row.ladderIndex]!
        return {
          ...row,
          scale: injectedScale,
          warning:
            row.ladderIndex === 2
              ? TIPS_LADDER_PURCHASE_SHORTFALL_WARNING
              : row.warning,
          capitalGainOrLoss: INJECTED_GAINS[row.ladderIndex]!,
          closingBalance: injectedClosingBalance,
          closingCostBasis: injectedClosingCostBasis,
          debit: {
            ...row.debit,
            amountPlanDollars:
              row.debit.amountPlanDollars + injectedDebitDelta,
          },
        }
      }),
    {
      capture: (input) => input.balances.map((state) => ({
        accountId: state.account.id,
        balance: state.balance,
        costBasis: state.costBasis,
      })),
    },
  ),
)

// This is the first helper called after purchase funding that receives the
// balance array. Snapshot immediately: its state objects keep mutating later.
vi.mock('./internal/distributedTaxableYieldRows.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/distributedTaxableYieldRows.js')>()
  return {
    ...original,
    distributedTaxableYieldRows: (
      input: Parameters<typeof original.distributedTaxableYieldRows>[0],
    ) => {
      hostile.postPurchaseBalances.push(input.states.map((state) => ({
        accountId: state.account.id,
        balance: state.balance,
        costBasis: 'costBasis' in state ? Number(state.costBasis) : 0,
      })))
      return original.distributedTaxableYieldRows(input)
    },
  }
})

vi.mock('./internal/tipsLadderAnnualCashFlow.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/tipsLadderAnnualCashFlow.js')>()
  return {
    ...original,
    tipsLadderAnnualCashFlows: (
      input: Parameters<typeof original.tipsLadderAnnualCashFlows>[0],
    ) => {
      hostile.annualFlowScales.push(input.ladderStates.map((state) => state.scale))
      return original.tipsLadderAnnualCashFlows(input)
    },
  }
})

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordTipsLadderPurchase') {
            return (row: RecordedTipsPurchase) => {
              hostile.recorded.push(row)
              target.recordTipsLadderPurchase(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function'
            ? (value as (...args: never[]) => unknown).bind(target)
            : value
        },
      })
    },
  }
})

import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import {
  planDollarsToLedgerCents,
  signedLedgerCentTotalToPlanDollars,
} from '../actions/planBalanceAdapter.js'
import type { Account, Plan, TipsLadder } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './internal/types/optimizer.js'

const YEAR = 2026
const FUNDING_ID = 'taxable-funding'
const OPENING_FUNDING_BALANCE = 200_000
const OPENING_FUNDING_BASIS = 80_000
const ANNUITY_FUNDING_ID = 'annuity-funding'
const ANNUITY_FUNDING_BALANCE = 100_000
const ANNUITY_FUNDING_BASIS = 40_000
const ANNUITY_PREMIUM = 50_000
const PRIOR_REALIZED_GAIN =
  ANNUITY_PREMIUM *
  (1 - ANNUITY_FUNDING_BASIS / ANNUITY_FUNDING_BALANCE)
const INJECTED_GAINS = [1e16, -1e16, 1] as const

function ladder(id: string): TipsLadder {
  return {
    id,
    name: id,
    purpose: 'floor',
    startYear: YEAR + 1,
    endYear: YEAR + 5,
    annualRealAmount: 10_000,
    purchase: { year: YEAR, fundingAccountId: FUNDING_ID },
  }
}

function plan(): Plan {
  const value = singlePersonPlan({
    dob: '1970-01-01',
    retirementAge: 56,
    planningAge: 90,
  })
  value.assumptions.inflationPct = 0
  value.assumptions.defaultReturnPct = 0
  value.expenses.baseAnnual = 0
  value.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  value.accounts = [
    {
      type: 'cash',
      id: 'reserve',
      name: 'Reserve',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: 1_000,
      annualContribution: 0,
    },
    {
      type: 'taxable',
      id: FUNDING_ID,
      name: 'Funding',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: OPENING_FUNDING_BALANCE,
      costBasis: OPENING_FUNDING_BASIS,
      annualContribution: 0,
      interestYieldPct: 0,
      dividendYieldPct: 0,
      taxExemptInterestYieldPct: 0,
    },
    {
      type: 'taxable',
      id: ANNUITY_FUNDING_ID,
      name: 'Annuity funding',
      ownerPersonId: null,
      annualReturnPct: 0,
      balance: ANNUITY_FUNDING_BALANCE,
      costBasis: ANNUITY_FUNDING_BASIS,
      annualContribution: 0,
      interestYieldPct: 0,
      dividendYieldPct: 0,
      taxExemptInterestYieldPct: 0,
    },
    {
      type: 'annuity',
      id: 'deferred-annuity',
      name: 'Deferred annuity',
      ownerPersonId: value.household.people[0]!.id,
      annualReturnPct: null,
      startAge: 90,
      monthlyAmount: 0,
      colaPct: 0,
      taxablePct: 100,
      purchase: {
        year: YEAR,
        premium: ANNUITY_PREMIUM,
        fundingAccountId: ANNUITY_FUNDING_ID,
        taxQualification: 'nonQualified',
      },
    },
  ] as Account[]
  // Three fully funded purchases provide three ordered applications. The mock
  // perturbs the third row's warning and every row's gain/debit/application
  // values, so none of those guards depend on natural helper underproduction.
  value.incomeFloor = {
    ladders: [ladder('first'), ladder('second'), ladder('third')],
  }
  return validatePlan(value)
}

function run() {
  seam.reset()
  hostile.postPurchaseBalances.length = 0
  hostile.annualFlowScales.length = 0
  hostile.recorded.length = 0
  const probes: OptimizerYearProbe[] = []
  const result = simulatePlan(plan(), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: createFlatTaxCalculator(0),
    captureAnnualCashFlow: true,
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  return { result, probes }
}

function purchaseRows(
  rows: readonly TipsLadderPurchaseFundingRow[],
): Extract<TipsLadderPurchaseFundingRow, { kind: 'purchase' }>[] {
  return rows.filter(
    (row): row is Extract<TipsLadderPurchaseFundingRow, { kind: 'purchase' }> =>
      row.kind === 'purchase',
  )
}

describe('simulatePlan delegates TIPS-ladder purchase funding', () => {
  it('applies positional balance, basis, scale, warning, and gain from the returned rows', () => {
    const { result } = run()

    const phase = expectSeamRan(seam, 1)[0]!
    expect(phase.input.year).toBe(YEAR)
    expect(phase.input.ladderStates.map((state) => state.id)).toEqual([
      'first',
      'second',
      'third',
    ])
    expect(phase.captured).toEqual([
      { accountId: 'reserve', balance: 1_000, costBasis: 0 },
      {
        accountId: FUNDING_ID,
        balance: OPENING_FUNDING_BALANCE,
        costBasis: OPENING_FUNDING_BASIS,
      },
      {
        accountId: ANNUITY_FUNDING_ID,
        balance: ANNUITY_FUNDING_BALANCE - ANNUITY_PREMIUM,
        costBasis:
          ANNUITY_FUNDING_BASIS *
          (1 - ANNUITY_PREMIUM / ANNUITY_FUNDING_BALANCE),
      },
    ])

    // Fixture-derived underproduction guard: all three ladder positions must
    // yield purchase rows, resolving to balance position 1 in ladder order.
    const rows = purchaseRows(phase.injected)
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.ladderIndex)).toEqual([0, 1, 2])
    expect(rows.map((row) => row.fundingIndex)).toEqual([1, 1, 1])
    expect(phase.natural).toHaveLength(3)
    expect(rows[2]!.closingBalance).not.toBe(
      phase.natural[2]!.kind === 'purchase'
        ? phase.natural[2]!.closingBalance
        : Number.NaN,
    )

    expect(hostile.postPurchaseBalances).toHaveLength(1)
    expect(hostile.postPurchaseBalances[0]).toEqual([
      { accountId: 'reserve', balance: 1_000, costBasis: 0 },
      {
        accountId: FUNDING_ID,
        balance: rows[2]!.closingBalance,
        costBasis: rows[2]!.closingCostBasis,
      },
      {
        accountId: ANNUITY_FUNDING_ID,
        balance: ANNUITY_FUNDING_BALANCE - ANNUITY_PREMIUM,
        costBasis:
          ANNUITY_FUNDING_BASIS *
          (1 - ANNUITY_PREMIUM / ANNUITY_FUNDING_BALANCE),
      },
    ])

    expect(hostile.annualFlowScales).toHaveLength(1)
    expect(hostile.annualFlowScales[0]).toEqual([
      rows[0]!.scale ?? 1,
      rows[1]!.scale ?? 1,
      rows[2]!.scale ?? 1,
    ])
    expect(rows.map((row) => row.scale)).toEqual([0.625, 0.375, 0.125])

    const originalRows = purchaseRows(phase.natural)
    expect(originalRows[2]!.warning).toBeNull()
    expect(rows[2]!.warning).toBe(TIPS_LADDER_PURCHASE_SHORTFALL_WARNING)
    expect(result.warnings).toContain(
      TIPS_LADDER_PURCHASE_SHORTFALL_WARNING,
    )

    // The taxable annuity sale creates a genuine nonzero accumulator before
    // TIPS funding. These cancellation-sensitive values pin the caller's
    // left-to-right `+=` order; reversing or regrouping loses the final dollar.
    expect(PRIOR_REALIZED_GAIN).not.toBe(0)
    expect(rows.map((row) => row.capitalGainOrLoss)).toEqual(INJECTED_GAINS)
    let expectedGain = PRIOR_REALIZED_GAIN
    for (const row of rows) expectedGain += row.capitalGainOrLoss
    let reverseFold = PRIOR_REALIZED_GAIN
    for (const row of [...rows].reverse()) {
      reverseFold += row.capitalGainOrLoss
    }
    const regroupedFold =
      PRIOR_REALIZED_GAIN +
      (rows[0]!.capitalGainOrLoss +
        (rows[1]!.capitalGainOrLoss + rows[2]!.capitalGainOrLoss))
    expect(reverseFold).not.toBe(expectedGain)
    expect(regroupedFold).not.toBe(expectedGain)
    expect(result.years[0]!.realizedGains).toBe(expectedGain)
  })

  it('passes each row record by identity and books each injected debit', () => {
    const { probes } = run()
    const rows = purchaseRows(seam.calls[0]!.injected)

    expect(hostile.recorded).toHaveLength(3)
    for (const [index, row] of rows.entries()) {
      expectPublishedFromSeam(
        hostile.recorded[index],
        row.record,
        `the recorded TIPS purchase row ${index}`,
      )
    }

    expect(probes).toHaveLength(1)
    let expectedCents = 0n
    for (const row of rows) {
      expect(row.debit).not.toBeNull()
      expectedCents -= BigInt(
        planDollarsToLedgerCents(row.debit!.amountPlanDollars),
      )
    }
    expect(probes[0]!.exogenousStrategyAccountMovement).toContainEqual({
      accountId: FUNDING_ID,
      amount: signedLedgerCentTotalToPlanDollars(expectedCents),
    })
    for (const row of rows) {
      expect(row.debit!.amountPlanDollars).not.toBe(row.funded)
    }
  })
})
