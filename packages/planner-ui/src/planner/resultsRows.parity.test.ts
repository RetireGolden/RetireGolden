/**
 * B2-P1 slice 1 parity: the Results chart rows display the engine's published
 * figures, moved into the page's dollars by the engine's dollar basis.
 *
 * For every example plan projected from 2026, in both dollar modes, every row:
 * - each balance category is `nominalForDisplay(balancesByCategory(plan, row)[c])`
 *   (display-balance-by-category-annual, R1);
 * - `spending` is `nominalForDisplay(spendingWithTaxAndPenalties(row))`;
 * - `fiTarget` is `todayForDisplay(fiNumber)`, so exactly `fiNumber` in
 *   today's mode (display-fi-target-annual);
 * - the expense chart's `taxes` is `taxAndPenalties(row)` and `care` is
 *   `netCareCost(row)`, each through `nominalForDisplay`;
 * - `unassigned` is the engine's `unassignedCash(row)` (0 when absent).
 * The retired planner expressions for the verbatim families are kept below as
 * references and are bit-identical to the engine figures. The fixed family
 * (R1) is shown on a constructed plan whose traditional IRA is split across
 * two rows under one id, and the unassigned band on coast-fire, the one
 * example that carries unassigned cash.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import {
  nominalForDisplay,
  todayForDisplay,
  type DollarMode,
} from '@retiregolden/engine/projection/dollarBasis'
import type { YearResult } from '@retiregolden/engine/projection/types'
import {
  BALANCE_CATEGORIES,
  balancesByCategory,
  netCareCost,
  spendingWithTaxAndPenalties,
  taxAndPenalties,
  unassignedCash,
} from '@retiregolden/engine/projection/yearFigures'
import { cashAccount, singlePersonPlan, traditionalAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { projectPlan } from '../projection'
import { ACCOUNT_CATEGORIES, hasUnassignedCash } from './accountCategories'
import { EXAMPLE_PLANS, getExampleById } from './examples/registry'
import { buildExpenseRows, buildResultsRows } from './resultsRows'

const START_YEAR = 2026
const MODES: readonly DollarMode[] = ['today', 'nominal']

// --- The retired planner expressions (before slice 1), references only. ---

/** accountCategories.ts#categoryBalances: once per plan row. */
function retiredCategoryBalances(plan: Plan, year: YearResult): Record<string, number> {
  const out: Record<string, number> = { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0 }
  for (const account of plan.accounts) {
    if ((ACCOUNT_CATEGORIES as readonly string[]).includes(account.type)) out[account.type]! += year.balances[account.id] ?? 0
  }
  return out
}
const retiredSpending = (y: YearResult) => y.expenses.total + y.tax + y.penalties
const retiredTaxes = (y: YearResult) => y.tax + y.penalties
const retiredCare = (y: YearResult) => Math.max(0, y.expenses.careCost - y.expenses.ltcBenefit)

function relativeGap(a: number, b: number): number {
  if (a === b) return 0
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b))
}

describe('Results chart rows display the engine figures (every example, both modes)', () => {
  it.each(EXAMPLE_PLANS.map((example) => [example.id, example] as const))('%s', (_id, example) => {
    const plan = example.build()
    const view = projectPlan(plan, START_YEAR)
    const { basis, summary } = view
    const mismatches: string[] = []
    for (const mode of MODES) {
      const rows = buildResultsRows(view, plan, mode)
      const expenseRows = buildExpenseRows(view, mode)
      view.result.years.forEach((y, k) => {
        const row = rows[k]!
        const expenseRow = expenseRows[k]!
        const at = `${mode} ${y.year}`
        const categories = balancesByCategory(plan, y)
        for (const c of BALANCE_CATEGORIES) {
          if (!Object.is(row[c], nominalForDisplay(basis, mode, y.year, categories[c]))) mismatches.push(`${at} ${c}`)
        }
        if (!Object.is(row.unassigned, nominalForDisplay(basis, mode, y.year, unassignedCash(y) ?? 0))) mismatches.push(`${at} unassigned`)
        if (!Object.is(row.spending, nominalForDisplay(basis, mode, y.year, spendingWithTaxAndPenalties(y)))) mismatches.push(`${at} spending`)
        if (!Object.is(row.fiTarget, todayForDisplay(basis, mode, y.year, summary.fiNumber))) mismatches.push(`${at} fiTarget`)
        if (mode === 'today' && !Object.is(row.fiTarget, summary.fiNumber)) mismatches.push(`${at} fiTarget is not fiNumber`)
        if (!Object.is(expenseRow.taxes, nominalForDisplay(basis, mode, y.year, taxAndPenalties(y)))) mismatches.push(`${at} taxes`)
        if (!Object.is(expenseRow.care, nominalForDisplay(basis, mode, y.year, netCareCost(y)))) mismatches.push(`${at} care`)
      })
    }
    expect(mismatches).toEqual([])
  })

  it.each(EXAMPLE_PLANS.map((example) => [example.id, example] as const))(
    '%s: the retired expressions give the same figures (verbatim families bit for bit)',
    (_id, example) => {
      const plan = example.build()
      const view = projectPlan(plan, START_YEAR)
      const nominalRows = buildResultsRows(view, plan, 'nominal')
      const mismatches: string[] = []
      for (const y of view.result.years) {
        if (!Object.is(retiredSpending(y), spendingWithTaxAndPenalties(y))) mismatches.push(`${y.year} spending`)
        if (!Object.is(retiredTaxes(y), taxAndPenalties(y))) mismatches.push(`${y.year} taxes`)
        if (!Object.is(retiredCare(y), netCareCost(y))) mismatches.push(`${y.year} care`)
        // No example splits an account across rows, so the per-row loop and
        // the engine's per-logical-account sum agree on the whole library.
        const retired = retiredCategoryBalances(plan, y)
        const engine = balancesByCategory(plan, y)
        for (const c of BALANCE_CATEGORIES) if (!Object.is(retired[c], engine[c])) mismatches.push(`${y.year} ${c}`)
        // The FI line moves only in the last binary digit (R19).
        const retiredNominalFi = view.summary.fiNumber * Math.pow(1 + plan.assumptions.inflationPct / 100, y.year - START_YEAR)
        const nominalFi = nominalRows[y.year - START_YEAR]!.fiTarget
        if (relativeGap(retiredNominalFi, nominalFi) > 1e-12) mismatches.push(`${y.year} fiTarget`)
      }
      expect(mismatches).toEqual([])
    },
  )
})

describe('an account split across two rows under one id counts once (R1)', () => {
  function splitIraPlan(): Plan {
    const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
    plan.accounts = [cashAccount('funding', 1_000), traditionalAccount('ira', 50_000), traditionalAccount('ira', 50_000)]
    return validatePlan(plan)
  }

  it('shows $100,000 of traditional in 2026 where the retired per-row sum showed $200,000', () => {
    const plan = splitIraPlan()
    const view = projectPlan(plan, START_YEAR)
    const first = view.result.years[0]!
    expect(first.year).toBe(2026)

    for (const mode of MODES) {
      const row = buildResultsRows(view, plan, mode)[0]!
      expect(row.traditional).toBe(100_000)
      expect(row.cash).toBe(1_000)
    }
    expect(retiredCategoryBalances(plan, first).traditional).toBe(200_000)
  })

  it('stacks the six categories to the investable total every year', () => {
    const plan = splitIraPlan()
    const view = projectPlan(plan, START_YEAR)
    const rows = buildResultsRows(view, plan, 'nominal')
    const gaps = view.result.years.flatMap((y, k) => {
      const row = rows[k]!
      const stacked = BALANCE_CATEGORIES.reduce((sum, c) => sum + row[c], 0) + row.unassigned
      return relativeGap(stacked, y.investableTotal) > 1e-12 ? [`${y.year}: ${stacked} vs ${y.investableTotal}`] : []
    })
    expect(gaps).toEqual([])
  })
})

describe('the unassigned cash band (owner answer Q9)', () => {
  it('coast-fire: drawn, and the six categories plus it make the investable total', () => {
    const plan = getExampleById('coast-fire')!.build()
    const view = projectPlan(plan, START_YEAR)
    expect(hasUnassignedCash(view.result.years)).toBe(true)
    const rows = buildResultsRows(view, plan, 'nominal')
    const first = rows[0]!
    // From the first year: the plan has no cash or taxable account for its surplus.
    expect(first.unassigned).toBeGreaterThan(0.5)
    expect(first.unassigned).toBe(unassignedCash(view.result.years[0]!))

    const gaps = view.result.years.flatMap((y, k) => {
      const row = rows[k]!
      const categories = BALANCE_CATEGORIES.reduce((sum, c) => sum + row[c], 0)
      const withUnassigned = categories + row.unassigned
      const out: string[] = []
      if (relativeGap(withUnassigned, y.investableTotal) > 1e-6) out.push(`${y.year}: ${withUnassigned} vs ${y.investableTotal}`)
      return out
    })
    expect(gaps).toEqual([])
    // Without the band the stack falls short by the unassigned amount (about
    // 45% of investable in 2055, the check report's figure).
    const k2055 = 2055 - START_YEAR
    const y2055 = view.result.years[k2055]!
    expect(rows[k2055]!.unassigned / y2055.investableTotal).toBeGreaterThan(0.4)
  })

  it('example-couple: nothing to draw, so no band', () => {
    const plan = getExampleById('example-couple')!.build()
    const view = projectPlan(plan, START_YEAR)
    expect(hasUnassignedCash(view.result.years)).toBe(false)
    expect(buildResultsRows(view, plan, 'nominal').every((row) => row.unassigned === 0)).toBe(true)
  })
})
