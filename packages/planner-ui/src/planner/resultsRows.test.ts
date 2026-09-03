import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { projectPlan } from '../projection'
import { buildExampleCouple } from './examples/buildExampleCouple'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import {
  buildExpenseRows,
  buildIncomeRows,
  buildLedgerCsv,
  buildResultsRows,
  inheritedAccountIds,
} from './resultsRows'

const identity = (_year: number, value: number) => value

function view(plan: Plan) {
  return projectPlan(plan, { startYear: EXAMPLE_FIXED_YEAR })
}

describe('buildResultsRows', () => {
  it('carries one row per projected year with every stacked-chart key', () => {
    const plan = buildExampleCouple()
    const rows = buildResultsRows(view(plan), plan, identity)
    const result = view(plan).result
    expect(rows).toHaveLength(result.years.length)
    expect(rows[0]).toMatchObject({
      year: result.years[0]!.year,
      cash: expect.any(Number),
      taxable: expect.any(Number),
      equityComp: expect.any(Number),
      traditional: expect.any(Number),
      roth: expect.any(Number),
      hsa: expect.any(Number),
      income: expect.any(Number),
      spending: expect.any(Number),
      tax: expect.any(Number),
      magi: expect.any(Number),
      shortfall: expect.any(Number),
      investable: expect.any(Number),
      fiTarget: expect.any(Number),
    })
  })

  it('routes every dollar figure through the supplied adjuster', () => {
    const plan = buildExampleCouple()
    const v = view(plan)
    let calls = 0
    const countingAdj = (year: number, value: number) => {
      calls += 1
      return v.deflate(year, value)
    }
    const nominal = buildResultsRows(v, plan, identity)
    const deflated = buildResultsRows(v, plan, countingAdj)
    expect(calls).toBeGreaterThan(0)
    // Today's-dollar year-1 figures equal the nominal ones (no compounding
    // has happened yet); a later year diverges once inflation compounds.
    expect(deflated[0]!.income).toBeCloseTo(nominal[0]!.income, 6)
    const lastIndex = nominal.length - 1
    if (nominal[lastIndex]!.income > 0) {
      expect(deflated[lastIndex]!.income).not.toBeCloseTo(nominal[lastIndex]!.income, 2)
    }
  })
})

describe('buildIncomeRows / buildExpenseRows', () => {
  it('carries one row per projected year with the documented income keys', () => {
    const plan = buildExampleCouple()
    const rows = buildIncomeRows(view(plan), identity)
    expect(rows).toHaveLength(view(plan).result.years.length)
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        'year', 'wages', 'socialSecurity', 'pension', 'annuity', 'tipsLadder',
        'recurring', 'oneTime', 'taxableYield', 'taxExemptInterest',
      ].sort(),
    )
  })

  it('carries one row per projected year with the documented expense keys', () => {
    const plan = buildExampleCouple()
    const rows = buildExpenseRows(view(plan), identity)
    expect(rows).toHaveLength(view(plan).result.years.length)
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['year', 'base', 'healthcare', 'property', 'debt', 'insurance', 'care', 'goals', 'taxes'].sort(),
    )
  })
})

describe('inheritedAccountIds', () => {
  it('keeps only traditional/roth accounts carrying inherited facts', () => {
    const accounts = [
      { id: 'a-trad-inherited', type: 'traditional', inherited: {} },
      { id: 'a-roth-inherited', type: 'roth', inherited: {} },
      { id: 'a-trad-owned', type: 'traditional' },
      { id: 'a-taxable-inherited', type: 'taxable', inherited: {} },
    ] as unknown as Account[]
    expect(inheritedAccountIds({ accounts } as Plan)).toEqual(['a-trad-inherited', 'a-roth-inherited'])
  })

  it('returns [] for a plan with no inherited accounts', () => {
    const plan = buildExampleCouple()
    expect(inheritedAccountIds(plan)).toEqual([])
  })
})

describe('buildLedgerCsv', () => {
  it('emits the documented header row followed by one row per projected year', () => {
    const plan = buildExampleCouple()
    const v = view(plan)
    const csv = buildLedgerCsv(plan, v)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(v.result.years.length + 1)
    expect(lines[0]!.split(',').slice(0, 4)).toEqual(['year', 'filingStatus', 'wages', 'socialSecurity'])
    // No inherited accounts in this fixture, so no inherited_* columns.
    expect(lines[0]).not.toContain('inherited_')
    expect(lines[1]!.startsWith(`${v.result.years[0]!.year},`)).toBe(true)
  })

  it('rounds numeric cells to the nearest dollar the way the button always has', () => {
    const plan = buildExampleCouple()
    const v = view(plan)
    const csv = buildLedgerCsv(plan, v)
    const firstDataRow = csv.split('\n')[1]!.split(',')
    const wagesCell = firstDataRow[2]!
    expect(wagesCell).toBe(String(Math.round(v.result.years[0]!.incomes.wages)))
  })
})
