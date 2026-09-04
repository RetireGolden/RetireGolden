import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import type { InheritedAccountYearEvidence } from '@retiregolden/engine/projection/types'
import { projectPlan } from '../projection'
import { ACCOUNT_CATEGORIES } from './accountCategories'
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
    // A deterministic, always-different-from-identity transform (rather than
    // the view's own deflate, whose divergence from identity depends on
    // fixture-specific inflation compounding and can be near-zero for an
    // early year): every dollar-typed field, every year, must equal
    // `identity + 1000`, or the field skipped the adjuster entirely.
    const shiftedAdj = (_year: number, value: number) => {
      calls += 1
      return value + 1_000
    }
    const nominal = buildResultsRows(v, plan, identity)
    const shifted = buildResultsRows(v, plan, shiftedAdj)
    expect(calls).toBeGreaterThan(0)
    expect(shifted).toHaveLength(nominal.length)
    const DOLLAR_KEYS = [
      ...ACCOUNT_CATEGORIES,
      'income', 'spending', 'tax', 'magi', 'shortfall', 'investable', 'fiTarget',
    ] as const
    nominal.forEach((rawRow, i) => {
      const row = rawRow as unknown as Record<(typeof DOLLAR_KEYS)[number], number> & { year: number }
      const shiftedRow = shifted[i] as unknown as Record<(typeof DOLLAR_KEYS)[number], number>
      for (const key of DOLLAR_KEYS) {
        expect(shiftedRow[key], `${key} in year ${row.year}`).toBeCloseTo(row[key] + 1_000, 6)
      }
    })
  })

  it('computes spending as expenses.total + tax + penalties, not merely expenses.total', () => {
    const plan = buildExampleCouple()
    const v = view(plan)
    const rows = buildResultsRows(v, plan, identity)
    const years = v.result.years
    // At least one projected year owes tax or a penalty — otherwise a
    // `spending` that silently dropped both terms would still pass below.
    expect(years.some((y) => y.tax > 0 || y.penalties > 0)).toBe(true)
    years.forEach((y, i) => {
      expect(rows[i]!.spending, `year ${y.year}`).toBeCloseTo(y.expenses.total + y.tax + y.penalties, 6)
    })
  })

  it("runs fiTarget through the view's own inflation helper before the adjuster", () => {
    const plan = buildExampleCouple()
    const v = view(plan)
    const rows = buildResultsRows(v, plan, identity)
    // A zero fiNumber would make a broken inflate-then-adjust call read back
    // as 0 too, so this guard is what makes the loop below discriminating.
    expect(v.summary.fiNumber).toBeGreaterThan(0)
    v.result.years.forEach((y, i) => {
      expect(rows[i]!.fiTarget, `year ${y.year}`).toBeCloseTo(v.inflate(y.year, v.summary.fiNumber), 6)
    })
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

  it('nets the LTC benefit against care cost, never going below zero', () => {
    // buildExampleCouple carries both LTC insurance and a care event
    // (age 88, 3 years, $90,000/yr), so the projection has years with a
    // nonzero careCost and years where the LTC policy offsets some of it —
    // exercising both the subtraction and the floor.
    const plan = buildExampleCouple()
    const v = view(plan)
    const rows = buildExpenseRows(v, identity)
    expect(v.result.years.some((y) => y.expenses.careCost > 0)).toBe(true)
    v.result.years.forEach((y, i) => {
      expect(rows[i]!.care, `year ${y.year}`).toBeCloseTo(
        Math.max(0, y.expenses.careCost - y.expenses.ltcBenefit),
        6,
      )
    })
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
    const wagesCell = firstDataRow[2]
    expect(wagesCell).toBe(String(Math.round(v.result.years[0]!.incomes.wages)))
  })

  it('fills the inherited_* columns from the plan account and the year evidence', () => {
    const plan = buildExampleCouple()
    const inheritedId = plan.accounts.find((a) => a.type === 'traditional')!.id
    const inheritedIndex = plan.accounts.findIndex((a) => a.id === inheritedId)
    plan.accounts[inheritedIndex] = {
      ...plan.accounts[inheritedIndex],
      inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: true },
    } as Account
    const v = view(plan)
    const evidence: InheritedAccountYearEvidence = {
      accountId: inheritedId,
      ownerPersonId: plan.household.people[0]!.id,
      regime: 'legacy-planning-approximation',
      matrixRow: 'X1',
      requirementKind: 'legacy',
      requiredAmount: 12_345,
      executedRequiredAmount: 12_345,
      voluntaryAmount: 500,
      disclosures: [],
      citations: ['SECURE Act §401(b)(1)'],
    }
    const patchedView: typeof v = {
      ...v,
      result: {
        ...v.result,
        years: v.result.years.map((y, i) => (i === 0 ? { ...y, inheritedAccounts: [evidence] } : y)),
      },
    }
    const csv = buildLedgerCsv(plan, patchedView)
    const [header, firstRow] = csv.split('\n')
    const headerCols = header!.split(',')
    const dataCols = firstRow!.split(',')
    // `requirementKind: 'legacy'` makes `needsProfessionalConfirmation` true
    // (see `professionalConfirmation.ts`), so the confirm column reads 'yes'.
    const expected: Record<string, string> = {
      [`inherited_${inheritedId}_requiredAmount`]: '12345',
      [`inherited_${inheritedId}_executedRequiredAmount`]: '12345',
      [`inherited_${inheritedId}_voluntaryAmount`]: '500',
      [`inherited_${inheritedId}_requirementKind`]: 'legacy',
      [`inherited_${inheritedId}_confirmWithProfessional`]: 'yes',
    }
    for (const [column, value] of Object.entries(expected)) {
      const at = headerCols.indexOf(column)
      expect(at, column).toBeGreaterThanOrEqual(0)
      expect(dataCols[at], column).toBe(value)
    }
  })

  it('emits an empty inherited row for a year with no evidence for that account', () => {
    // The account is inherited (so its columns exist), but this year's
    // `inheritedAccounts` carries no row for it — the "not yet reached its
    // first evidence year" branch, distinct from "not inherited at all".
    // The plan is marked inherited so the columns are generated, but the
    // evidence for year 0 is explicitly cleared rather than left to
    // whatever the engine itself computes for that account/year, so this
    // test pins the CSV builder's own no-row branch, not engine timing.
    const plan = buildExampleCouple()
    const inheritedId = plan.accounts.find((a) => a.type === 'traditional')!.id
    const inheritedIndex = plan.accounts.findIndex((a) => a.id === inheritedId)
    plan.accounts[inheritedIndex] = {
      ...plan.accounts[inheritedIndex],
      inherited: { ownerDeathYear: 2020, decedentHadStartedRmds: true },
    } as Account
    const v = view(plan)
    const patchedView: typeof v = {
      ...v,
      result: {
        ...v.result,
        years: v.result.years.map((y, i) => (i === 0 ? { ...y, inheritedAccounts: [] } : y)),
      },
    }
    const csv = buildLedgerCsv(plan, patchedView)
    const [header, firstRow] = csv.split('\n')
    const at = header!.split(',').indexOf(`inherited_${inheritedId}_requiredAmount`)
    expect(at).toBeGreaterThanOrEqual(0)
    expect(firstRow!.split(',')[at]).toBe('')
  })
})
