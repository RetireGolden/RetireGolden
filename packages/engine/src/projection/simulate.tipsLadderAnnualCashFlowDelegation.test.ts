/**
 * The seam itself: `simulatePlan` must actually DELEGATE the TIPS-ladder annual
 * cash-flow phase to `internal/tipsLadderAnnualCashFlow.ts`, and must publish
 * exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a byte-for-byte
 * differential oracle, and identical output is that oracle's PASS condition —
 * so a `simulate.ts` reverted to the inlined arithmetic, leaving the helper
 * orphaned but present, passes it, and passes every other suite in the
 * repository too. Nothing else here observes the call. This file does, using
 * the same wrapped-module pattern as
 * `simulate.ownedNonRothIraAnnualSettlement.test.ts`: the real implementation
 * still runs, so no number changes; only the fact of the call is asserted.
 *
 * The fold is checked as well as the call. Summing the helper's rows in the
 * order it returned them must reproduce `YearResult.incomes.tipsLadder` and
 * `YearResult.ladderValue` EXACTLY (`toBe`, not `toBeCloseTo`): the caller
 * folds row by row precisely so that IEEE-754 addition order is preserved, and
 * an exact match is what shows it still does.
 */
import { describe, expect, it, vi } from 'vitest'

const helper = vi.hoisted(() => ({ calls: vi.fn() }))

vi.mock('./internal/tipsLadderAnnualCashFlow.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/tipsLadderAnnualCashFlow.js')>()
  return {
    ...original,
    tipsLadderAnnualCashFlows: (input: Parameters<typeof original.tipsLadderAnnualCashFlows>[0]) => {
      const rows = original.tipsLadderAnnualCashFlows(input)
      helper.calls(input, rows)
      return rows
    },
  }
})

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import type { TipsLadderYearRow } from './internal/tipsLadderAnnualCashFlow.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const START_YEAR = 2026
const END_YEAR = 2034

function plan(): Plan {
  const p = createEmptyPlan({ newId: () => `delegation-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 95, source: 'manual' },
  }
  p.assumptions.inflationPct = 2.5
  p.assumptions.defaultReturnPct = 0
  p.assumptions.healthcareExtraInflationPct = 0
  const cash: Account = { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 400_000, annualContribution: 0 }
  p.accounts = [cash]
  p.incomes = []
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  // Two ladders, overlapping from 2029: the year's published totals are then a
  // fold of more than one row, so a caller that dropped or reordered the fold
  // could not still match exactly.
  p.incomeFloor = {
    ladders: [
      { id: 'ladA', name: 'Floor A', purpose: 'floor', startYear: 2027, endYear: 2032, annualRealAmount: 12_000 },
      { id: 'ladB', name: 'Floor B', purpose: 'floor', startYear: 2029, endYear: 2033, annualRealAmount: 9_000, purchase: { year: 2028, fundingAccountId: 'cash1' } },
    ],
  }
  const parsed = parsePlan(p)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run() {
  helper.calls.mockClear()
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: createFlatTaxCalculator(15),
  })
  const byYear = new Map<number, readonly TipsLadderYearRow[]>()
  for (const [input, rows] of helper.calls.mock.calls as Array<[{ year: number }, readonly TipsLadderYearRow[]]>) {
    // A year can be evaluated more than once (the annual pass is re-entrant);
    // the last evaluation is the one whose numbers were published.
    byYear.set(input.year, rows)
  }
  return { result, byYear }
}

describe('simulatePlan delegates the TIPS-ladder annual cash-flow phase', () => {
  it('calls the extracted helper for every projected year', () => {
    const { result, byYear } = run()
    expect(helper.calls).toHaveBeenCalled()
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect([...byYear.keys()].sort((a, b) => a - b)).toEqual(result.years.map((y) => y.year))
  })

  it('passes the year’s ladder states and scalars, not a re-derived copy', () => {
    run()
    const [input] = helper.calls.mock.calls[0]! as [{
      ladderStates: ReadonlyArray<{ id: string }>
      year: number
      startYear: number
      anyAlive: boolean
      inflFactor: number
      inflFactorFrom: unknown
      ladderLastAliveYear: number
    }]
    expect(input.ladderStates.map((ls) => ls.id)).toEqual(['ladA', 'ladB'])
    expect(input.year).toBe(START_YEAR)
    expect(input.startYear).toBe(START_YEAR)
    expect(input.anyAlive).toBe(true)
    expect(input.inflFactor).toBe(1)
    expect(typeof input.inflFactorFrom).toBe('function')
    expect(input.ladderLastAliveYear).toBeGreaterThan(START_YEAR)
  })

  it('publishes exactly the rows the helper returned, folded in row order', () => {
    const { result, byYear } = run()
    let yearsWithLadderCash = 0
    let yearsWithTwoRows = 0
    for (const year of result.years) {
      const rows = byYear.get(year.year)
      expect(rows, `no helper call recorded for ${year.year}`).toBeDefined()
      let cash = 0
      let value = 0
      let flowRows = 0
      for (const row of rows!) {
        if (row.kind === 'none') continue
        if (row.kind === 'flow') {
          cash += row.cash
          flowRows++
        }
        value += row.ladderValue
      }
      expect(year.incomes.tipsLadder, `tipsLadder ${year.year}`).toBe(cash)
      expect(year.ladderValue, `ladderValue ${year.year}`).toBe(value)
      if (cash > 0) yearsWithLadderCash++
      if (flowRows >= 2) yearsWithTwoRows++
    }
    // The fixture has to actually exercise the phase for the equalities above
    // to mean anything, including years folding two flow rows at once.
    expect(yearsWithLadderCash).toBeGreaterThan(4)
    expect(yearsWithTwoRows).toBeGreaterThan(2)
  })

  // The fold above never touches `row.record`, and the default run never emits
  // it (`yearSites` is null unless the ledger is being captured). This is the
  // only assertion that the caller still hands each row's record to the
  // recorder, and it is checked on the payload rather than the emission order —
  // `annualCashFlowCapture` sorts every line list by line id before publishing,
  // so order is not observable from a `ProjectionResult` at all.
  it('hands each flow row’s ledger record to the cash-flow capture sites', () => {
    helper.calls.mockClear()
    const result = simulatePlan(plan(), {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: createFlatTaxCalculator(15),
      captureAnnualCashFlow: true,
    })
    const byYear = new Map<number, readonly TipsLadderYearRow[]>()
    for (const [input, rows] of helper.calls.mock.calls as Array<[{ year: number }, readonly TipsLadderYearRow[]]>) {
      byYear.set(input.year, rows)
    }

    let checkedYears = 0
    for (const year of result.years) {
      const expected = (byYear.get(year.year) ?? [])
        .filter((row) => row.kind === 'flow' && row.record.cash > 0)
        .map((row) => (row.kind === 'flow' ? row.record : null))
      const published = (year.cashFlow?.sourceLines ?? []).filter((line) => line.kind === 'tipsLadderCash')
      expect(published.map((line) => line.id).sort(), `line ids ${year.year}`).toEqual(
        expected.map((record) => `source:tipsLadderCash:${record!.ladderId}`).sort(),
      )
      for (const record of expected) {
        const line = published.find((candidate) => candidate.id === `source:tipsLadderCash:${record!.ladderId}`)
        expect(line?.amountPlanDollars, `${record!.ladderId} ${year.year}`).toBe(record!.cash)
      }
      if (expected.length > 0) checkedYears++
    }
    expect(checkedYears).toBeGreaterThan(4)
  })
})
