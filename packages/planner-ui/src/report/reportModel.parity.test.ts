/**
 * B2-P1 slice 1 parity: the report model carries the engine's figures,
 * rounded to whole dollars by the report's own `roundDollar`.
 * - `chart-data` rows: each category is `balancesByCategory(plan, row)[c]`
 *   (a split account counts once) and `spendingPlusTax` is
 *   `spendingWithTaxAndPenalties(row)`.
 * - `year-ledger` rows: `taxAndPenalties` is `taxAndPenalties(row)`.
 * - `unassignedCash` (the engine's `unassignedCash`) appears on the chart rows,
 *   and as a trailing chart CSV column, only for a plan that has unassigned
 *   cash in some year (coast-fire); every other model, the five committed
 *   report goldens included, is unchanged byte for byte (reportGoldens.test.ts
 *   holds those bytes).
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import {
  BALANCE_CATEGORIES,
  balancesByCategory,
  spendingWithTaxAndPenalties,
  taxAndPenalties,
  unassignedCash,
} from '@retiregolden/engine/projection/yearFigures'
import { cashAccount, singlePersonPlan, traditionalAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { EXAMPLE_PLANS, getExampleById } from '../planner/examples/registry'
import { projectPlan } from '../projection'
import { buildReportModel, chartDataCsv } from './reportModel'

const START_YEAR = 2026

/** The report's rounding: whole dollars, half away from zero (reportModel.ts#roundDollar). */
function roundDollar(value: number): number {
  return value >= 0 ? Math.round(value) : -Math.round(-value)
}

function modelOf(plan: Plan) {
  const { result, summary } = projectPlan(plan, START_YEAR)
  return {
    result,
    model: buildReportModel({ plan, result, summary, startYear: START_YEAR, generatedAtIso: '2026-07-01T00:00:00.000Z' }),
  }
}

describe('report chart-data and year-ledger rows are the engine figures', () => {
  it.each(EXAMPLE_PLANS.map((example) => [example.id, example] as const))('%s', (id, example) => {
    const plan = example.build()
    const { result, model } = modelOf(plan)
    const chartRows = model.blocks['chart-data'].rows
    const ledgerRows = model.blocks['year-ledger'].rows
    const mismatches: string[] = []
    result.years.forEach((y, k) => {
      const chart = chartRows[k]!
      const categories = balancesByCategory(plan, y)
      for (const c of BALANCE_CATEGORIES) if (chart[c] !== roundDollar(categories[c])) mismatches.push(`${y.year} ${c}`)
      if (chart.spendingPlusTax !== roundDollar(spendingWithTaxAndPenalties(y))) mismatches.push(`${y.year} spendingPlusTax`)
      if (ledgerRows[k]!.taxAndPenalties !== roundDollar(taxAndPenalties(y))) mismatches.push(`${y.year} taxAndPenalties`)
      const expectedUnassigned = id === 'coast-fire' ? roundDollar(unassignedCash(y) ?? 0) : undefined
      if (chart.unassignedCash !== expectedUnassigned) mismatches.push(`${y.year} unassignedCash ${chart.unassignedCash}`)
      if (id !== 'coast-fire' && 'unassignedCash' in chart) mismatches.push(`${y.year} carries an unassignedCash key`)
    })
    expect(mismatches).toEqual([])
  })

  it('coast-fire: the chart CSV gains a trailing unassignedCash column; example-couple keeps the old header', () => {
    const coast = modelOf(getExampleById('coast-fire')!.build())
    const coastCsv = chartDataCsv(coast.model.blocks['chart-data']).split('\n')
    expect(coastCsv[0]).toBe('year,cash,taxable,equityComp,traditional,roth,hsa,income,spendingPlusTax,unassignedCash')
    expect(Number(coastCsv[1]!.split(',').at(-1))).toBe(roundDollar(unassignedCash(coast.result.years[0]!)!))
    expect(Number(coastCsv[1]!.split(',').at(-1))).toBeGreaterThan(0)

    const couple = modelOf(getExampleById('example-couple')!.build())
    const coupleCsv = chartDataCsv(couple.model.blocks['chart-data']).split('\n')
    expect(coupleCsv[0]).toBe('year,cash,taxable,equityComp,traditional,roth,hsa,income,spendingPlusTax')
  })

  it('a traditional IRA split across two rows under one id reads $100,000, not $200,000', () => {
    const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
    plan.accounts = [cashAccount('funding', 1_000), traditionalAccount('ira', 50_000), traditionalAccount('ira', 50_000)]
    const { model } = modelOf(validatePlan(plan))
    const first = model.blocks['chart-data'].rows[0]!
    expect(first.year).toBe(2026)
    expect(first.traditional).toBe(100_000)
    expect(first.cash).toBe(1_000)
  })
})
