/**
 * Delegation guard for the distributed taxable-yield extraction.
 *
 * The helper unit tests prove the row producer in isolation. These tests prove
 * that simulatePlan calls it at the annual boundary, passes the live state and
 * maps, folds the returned rows in order, and forwards each row's own ledger
 * record object. The replacement-row case is intentionally impossible for an
 * inlined duplicate to reproduce, so an orphaned helper cannot pass by merely
 * agreeing with the production implementation.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  recurringOrdinaryIncome,
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import type { RecordedDistributedYield } from './annualCashFlowYearSites.js'
import type {
  DistributedTaxableYieldInput,
  DistributedTaxableYieldResultRow,
} from './internal/distributedTaxableYieldRows.js'

type SyntheticYieldScalars = Omit<
  Extract<DistributedTaxableYieldResultRow, { kind: 'yield' }>,
  'kind' | 'record'
>

/**
 * The live positional state read at each pass, plus the recorded-row watermark
 * that separates one year's ledger publications from the next year's.
 */
interface YieldPhaseCapture {
  readonly stateIds: readonly string[]
  readonly stateBalances: readonly number[]
  readonly startBalances: readonly number[]
  readonly recordedCount: number
}

// Every numeric channel is independently non-zero. For each folded channel,
// the two middle values are half-ULP ties at a load-bearing large operand's
// scale: one order loses both while the other retains one ULP. The
// final tax-a row also differs materially from the first, making the
// per-account map's last-write contract visible in growth and reinvestment.
const SYNTHETIC_ROWS: readonly SyntheticYieldScalars[] = [
  {
    balanceIndex: 0,
    accountId: 'tax-a',
    interest: 3_000,
    ordinaryDividends: 5_000,
    qualified: 6_000,
    taxableGross: 7_000,
    exempt: 9_000,
    gross: 11,
    distributedYieldPct: 7,
    reinvest: false,
  },
  {
    balanceIndex: 1,
    accountId: 'tax-b',
    interest: 2 ** -42,
    ordinaryDividends: 2 ** -41,
    qualified: 2 ** -41,
    taxableGross: 2 ** -41,
    exempt: 2 ** -40,
    gross: 2 ** -34,
    distributedYieldPct: 2 ** -51,
    reinvest: true,
  },
  {
    balanceIndex: 2,
    accountId: 'tax-c',
    interest: 2 ** -42,
    ordinaryDividends: 2 ** -41,
    qualified: 2 ** -41,
    taxableGross: 2 ** -41,
    exempt: 2 ** -40,
    gross: 2 ** -34,
    distributedYieldPct: 2 ** -51,
    reinvest: true,
  },
  {
    balanceIndex: 3,
    accountId: 'tax-a',
    interest: 1 / 7,
    ordinaryDividends: 1 / 7,
    qualified: 600,
    taxableGross: 700,
    exempt: 900,
    gross: 1_000_000,
    distributedYieldPct: 0.7,
    reinvest: true,
  },
]

function syntheticRow(scalars: SyntheticYieldScalars): DistributedTaxableYieldResultRow {
  const record: RecordedDistributedYield = {
    accountId: scalars.accountId,
    taxableGross: scalars.taxableGross,
    interest: scalars.interest,
    ordinaryDividends: scalars.ordinaryDividends,
    qualified: scalars.qualified,
    exempt: scalars.exempt,
    reinvest: scalars.reinvest,
  }
  return {
    kind: 'yield',
    ...scalars,
    record,
  }
}

const hostile = vi.hoisted(() => ({
  replaceRows: false,
  recorded: [] as RecordedDistributedYield[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      DistributedTaxableYieldInput,
      readonly DistributedTaxableYieldResultRow[],
      YieldPhaseCapture
    >(),
)

vi.mock('./internal/distributedTaxableYieldRows.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/distributedTaxableYieldRows.js')
    >(),
    'distributedTaxableYieldRows',
    (natural): readonly DistributedTaxableYieldResultRow[] =>
      hostile.replaceRows ? SYNTHETIC_ROWS.map(syntheticRow) : natural,
    {
      capture: (input): YieldPhaseCapture => ({
        stateIds: input.states.map((state) => state.account.id),
        stateBalances: input.states.map((state) => state.balance),
        startBalances: [...input.startOfYearBalances],
        recordedCount: hostile.recorded.length,
      }),
    },
  ),
)

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordDistributedYield') {
            return (row: RecordedDistributedYield) => {
              hostile.recorded.push(row)
              target.recordDistributedYield(row)
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

import { expectPublishedFromSeam } from './simulate.seamGuard.test-support.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe, TaxCalculator } from './types.js'

const START_YEAR = 2026
const END_YEAR = 2028
const BUFFER_INCOME = 1_100_000
const zeroTax: TaxCalculator = { compute: () => 0 }

function yieldingAccount(
  id: string,
  balance: number,
  interestYieldPct: number,
  dividendYieldPct: number,
  qualifiedRatio: number,
  taxExemptInterestYieldPct = 0,
): Extract<Account, { type: 'taxable' }> {
  const base = taxableAccount(id, balance, balance / 2) as Extract<Account, { type: 'taxable' }>
  return {
    ...base,
    interestYieldPct,
    dividendYieldPct,
    qualifiedRatio,
    taxExemptInterestYieldPct,
    reinvestDividends: false,
  }
}

function plan(): Plan {
  const p = singlePersonPlan({ dob: '2000-01-01', planningAge: 60 })
  const allocated = {
    ...yieldingAccount('tax-a', 1_000, 1, 2, 0.25, 0.5),
    allocation: {
      mode: 'static',
      rebalancing: 'none',
      weights: { usStocks: 100, intlStocks: 0, bonds: 0, cash: 0 },
    },
  } as Account
  p.accounts = [
    cashAccount('cash', 500),
    allocated,
    yieldingAccount('tax-b', 2_000, 0.25, 1.5, 0.8),
    yieldingAccount('tax-c', 3_000, 0.1, 0.2, 0.5, 0.3),
  ]
  // Keeps the deliberately large synthetic reinvestment funded without
  // withdrawals or gains. Tax-free treatment leaves the ordinary-income
  // channel under test exclusively controlled by the injected yield rows.
  const bufferIncome = recurringOrdinaryIncome('cash-buffer', BUFFER_INCOME)
  if (bufferIncome.type !== 'recurring') throw new Error('expected recurring buffer fixture')
  p.incomes = [{
    ...bufferIncome,
    taxTreatment: 'none',
  }]
  return validatePlan(p)
}

function run(options: { replaceRows?: boolean } = {}) {
  seam.reset()
  hostile.recorded.length = 0
  hostile.replaceRows = options.replaceRows === true
  const probes: OptimizerYearProbe[] = []
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: zeroTax,
    captureAnnualCashFlow: true,
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  return { result, phases: seam.calls, probes }
}

function foldRows(
  rows: readonly Extract<DistributedTaxableYieldResultRow, { kind: 'yield' }>[],
  valueOf: (row: Extract<DistributedTaxableYieldResultRow, { kind: 'yield' }>) => number,
): number {
  let total = 0
  for (const row of rows) total += valueOf(row)
  return total
}

describe('simulatePlan delegates distributed taxable yields', () => {
  it('calls once per projected year with the live balance array and annual maps', () => {
    const { result, phases } = run()

    expect(phases).toHaveLength(result.years.length)
    expect(phases).toHaveLength(END_YEAR - START_YEAR + 1)
    for (const phase of phases) {
      expect(phase.captured.stateIds).toEqual(['cash', 'tax-a', 'tax-b', 'tax-c'])
      expect(phase.injected).toHaveLength(phase.captured.stateIds.length)
      expect(phase.captured.startBalances).toEqual(phase.captured.stateBalances)
      expect(phase.input.allocationTrack.has('1')).toBe(true)
    }

    // balances and allocationTrack are the long-lived simulation objects;
    // startOfYearBalances is a fresh positional snapshot at each annual boundary.
    expect(phases.every((phase) => phase.input.states === phases[0]!.input.states)).toBe(true)
    expect(phases.every((phase) => phase.input.allocationTrack === phases[0]!.input.allocationTrack)).toBe(true)
    expect(new Set(phases.map((phase) => phase.input.startOfYearBalances)).size).toBe(phases.length)
    expect(phases[1]!.captured.stateBalances).not.toEqual(phases[0]!.captured.stateBalances)
  })

  it('retains fixture-derived first-year totals, guarding against under-production', () => {
    const { result } = run()
    const first = result.years[0]!
    if (first.advisoryFederalTax === undefined) throw new Error('missing advisory federal-tax detail')

    // Derived only from the authored balances and yield fields, not from the
    // helper's returned rows: interest 10+5+3, dividends 20+30+6, exempt 5+0+9.
    expect(first.taxableYield).toBe(74)
    expect(first.taxExemptInterest).toBe(14)
    expect(first.advisoryFederalTax.input.taxableInterestIncome).toBe(18)
    expect(first.advisoryFederalTax.input.ordinaryDividends).toBe(24)
    expect(first.advisoryFederalTax.input.qualifiedDividends).toBe(32)
  })

  it('folds every injected channel in order and propagates duplicate-id map effects', () => {
    const { result, phases, probes } = run({ replaceRows: true })
    expect(probes).toHaveLength(result.years.length)
    let identityChecks = 0
    let orderDiscriminatingChecks = 0

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i]!
      const year = result.years[i]!
      if (year.advisoryFederalTax === undefined) throw new Error(`missing advisory federal-tax detail for ${year.year}`)
      if (year.cashFlow === undefined) throw new Error(`missing annual cash-flow detail for ${year.year}`)
      const yieldRows = phase.injected.filter(
        (row): row is Extract<DistributedTaxableYieldResultRow, { kind: 'yield' }> => row.kind === 'yield',
      )
      expect(yieldRows.map((row) => row.accountId)).toEqual(['tax-a', 'tax-b', 'tax-c', 'tax-a'])

      const fields = [
        'interest',
        'ordinaryDividends',
        'qualified',
        'taxableGross',
        'exempt',
        'gross',
      ] as const
      const totals = Object.fromEntries(fields.map((field) => [
        field,
        foldRows(yieldRows, (row) => row[field]),
      ])) as Record<(typeof fields)[number], number>
      for (const field of fields) {
        const reversed = foldRows([...yieldRows].reverse(), (row) => row[field])
        expect(Object.is(totals[field], reversed), `${field} must detect row reordering`).toBe(false)
        orderDiscriminatingChecks++
      }

      const ordinaryIncome = foldRows(yieldRows, (row) => row.interest + row.ordinaryDividends)
      const reversedOrdinaryIncome = foldRows(
        [...yieldRows].reverse(),
        (row) => row.interest + row.ordinaryDividends,
      )
      expect(
        Object.is(ordinaryIncome, reversedOrdinaryIncome),
        'combined ordinary-income fold must detect row reordering',
      ).toBe(false)

      const reinvestedGross = foldRows(
        yieldRows.filter((row) => row.reinvest),
        (row) => row.gross,
      )
      const reversedReinvestedGross = foldRows(
        yieldRows.filter((row) => row.reinvest).reverse(),
        (row) => row.gross,
      )
      expect(yieldRows.filter((row) => row.reinvest)).toHaveLength(3)
      expect(
        Object.is(reinvestedGross, reversedReinvestedGross),
        'reinvested-gross fold must detect row reordering',
      ).toBe(false)
      const expectedMagi = Math.max(0, (((ordinaryIncome + 0) + totals.qualified) + 0) + totals.exempt)
      const expectedIncomeTotal = BUFFER_INCOME + totals.taxableGross + totals.exempt

      expect(year.incomes.recurring, `buffer income ${year.year}`).toBe(BUFFER_INCOME)
      expect(year.incomes.taxableInterest, `income interest ${year.year}`).toBe(totals.interest)
      expect(year.incomes.ordinaryDividends, `income ordinary dividends ${year.year}`).toBe(totals.ordinaryDividends)
      expect(year.incomes.qualifiedDividends, `income qualified dividends ${year.year}`).toBe(totals.qualified)
      expect(year.incomes.taxableYield, `income taxable yield ${year.year}`).toBe(totals.taxableGross)
      expect(year.incomes.taxExemptInterest, `income exempt interest ${year.year}`).toBe(totals.exempt)
      expect(year.incomes.total, `income total ${year.year}`).toBe(expectedIncomeTotal)
      expect(year.taxableYield, `published taxable yield ${year.year}`).toBe(totals.taxableGross)
      expect(year.taxExemptInterest, `published exempt interest ${year.year}`).toBe(totals.exempt)
      expect(year.magi, `MAGI ${year.year}`).toBe(expectedMagi)

      const advisory = year.advisoryFederalTax
      expect(advisory.input.ordinaryIncome, `advisory ordinary income ${year.year}`).toBe(ordinaryIncome)
      expect(advisory.input.taxableInterestIncome, `advisory interest ${year.year}`).toBe(totals.interest)
      expect(advisory.input.ordinaryDividends, `advisory ordinary dividends ${year.year}`).toBe(totals.ordinaryDividends)
      expect(advisory.input.qualifiedDividends, `advisory qualified dividends ${year.year}`).toBe(totals.qualified)
      expect(advisory.input.taxExemptInterest, `advisory exempt interest ${year.year}`).toBe(totals.exempt)
      expect(advisory.detail.agiBeforeFloor, `advisory AGI ${year.year}`).toBe((ordinaryIncome + 0) + totals.qualified)
      expect(probes[i]!.exogenousCash, `optimizer exogenous cash ${year.year}`).toBe(
        year.incomes.total - reinvestedGross,
      )
      expect(probes[i]!.exogenousCash, `optimizer must retain reinvest fold order ${year.year}`).not.toBe(
        year.incomes.total - reversedReinvestedGross,
      )

      // Growth and reinvestment consume the row at the same physical balance
      // index. The mocked account ID is deliberately unrelated, so an ID join
      // would apply the final tax-a row here instead.
      const physicalTaxA = yieldRows[1]!
      const taxAStart = phase.captured.stateBalances[1]!
      const usStockReturnPct = phase.input.classParams.usStocks.returnPct
      const expectedTaxABalance = taxAStart * Math.max(
        0,
        1 + (usStockReturnPct - physicalTaxA.distributedYieldPct) / 100,
      ) + physicalTaxA.gross
      expect(year.balances['tax-a'], `tax-a positional growth/reinvest ${year.year}`).toBe(expectedTaxABalance)

      const reinvested = year.cashFlow.transferLines.filter((line) => line.kind === 'reinvestedYield')
      expect(reinvested.map((line) => [line.destination.entityKind === 'account' ? line.destination.accountId : null, line.debitPlanDollars])).toEqual([
        ['tax-a', yieldRows[3]!.gross],
        ['tax-b', yieldRows[1]!.gross],
        ['tax-c', yieldRows[2]!.gross],
      ])
      expect(reinvested[0]?.taxCharacter).toEqual([
        { kind: 'ordinaryIncome', amountPlanDollars: yieldRows[3]!.interest + yieldRows[3]!.ordinaryDividends },
        { kind: 'qualifiedDividend', amountPlanDollars: yieldRows[3]!.qualified },
        { kind: 'taxExemptIncome', amountPlanDollars: yieldRows[3]!.exempt },
      ])

      const spendableYield = year.cashFlow.sourceLines.filter((line) =>
        line.kind === 'taxableAccountYield' || line.kind === 'taxExemptInterest',
      )
      expect(spendableYield.map((line) => [
        line.kind,
        line.identities[0]?.entityKind === 'account' ? line.identities[0].accountId : null,
        line.amountPlanDollars,
      ])).toEqual([
        ['taxExemptInterest', 'tax-a', yieldRows[0]!.exempt],
        ['taxableAccountYield', 'tax-a', yieldRows[0]!.taxableGross],
      ])

      // Rows published between this pass through the seam and the next one.
      const recorded = hostile.recorded.slice(
        phase.captured.recordedCount,
        phases[i + 1]?.captured.recordedCount ?? hostile.recorded.length,
      )
      expect(recorded).toHaveLength(yieldRows.length)
      for (let j = 0; j < yieldRows.length; j++) {
        expectPublishedFromSeam(
          recorded[j],
          yieldRows[j]!.record,
          `${year.year} record ${j}`,
        )
        expect(recorded[j]).toEqual(yieldRows[j]!.record)
        identityChecks++
      }
    }

    expect(orderDiscriminatingChecks).toBe(phases.length * 6)
    expect(identityChecks).toBe(phases.length * SYNTHETIC_ROWS.length)
  })
})
