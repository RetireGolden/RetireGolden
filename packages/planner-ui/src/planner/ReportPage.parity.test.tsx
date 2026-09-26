/** @vitest-environment jsdom */
/**
 * B2-P1 slice 1 parity, rendered: the printed plan report draws the engine's
 * figures.
 * - Its charts plot the same rows as the Results charts in nominal dollars:
 *   categories from `balancesByCategory` (so a split account counts once),
 *   spending from `spendingWithTaxAndPenalties`, and the unassigned cash band
 *   only for a plan that has some.
 * - The appendix Tax cell is `taxAndPenalties(row)`.
 * - The "Money lasts" KPI reads `moneyLasts(result)`: "through L" with "runs
 *   short in D" (it read "to D" / "portfolio depletes").
 */
import 'fake-indexeddb/auto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import type { Plan } from '@retiregolden/engine/model/plan'
import type { YearResult } from '@retiregolden/engine/projection/types'
import {
  BALANCE_CATEGORIES,
  balancesByCategory,
  spendingWithTaxAndPenalties,
  taxAndPenalties,
  unassignedCash,
} from '@retiregolden/engine/projection/yearFigures'
import { cashAccount, singlePersonPlan, traditionalAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { projectPlan } from '../projection'
import { waitFor } from '../testSupport/settle'
import { getExampleById } from './examples/registry'
import { fmtMoney } from './format'
import { ReportPage } from './ReportPage'
import type * as ResultsRowsModule from './resultsRows'

/** Every chart row set the report builds, captured as it is handed to the charts. */
const builtRows: { planId: string; mode: string; rows: ReturnType<typeof ResultsRowsModule.buildResultsRows> }[] = []

vi.mock('./resultsRows', async (importOriginal) => {
  const actual = await importOriginal<typeof ResultsRowsModule>()
  return {
    ...actual,
    buildResultsRows: (...args: Parameters<typeof actual.buildResultsRows>) => {
      const rows = actual.buildResultsRows(...args)
      builtRows.push({ planId: args[1].id, mode: args[2], rows })
      return rows
    },
  }
})

const START_YEAR = 2026

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-01T12:00:00Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
  builtRows.length = 0
})

interface Printed {
  kpis: Record<string, { value: string; sub: string }>
  legend: string[]
  appendix: { headers: string[]; rows: string[][] }
  rows: ReturnType<typeof ResultsRowsModule.buildResultsRows>
}

async function printReport(plan: Plan): Promise<Printed> {
  const saved = await savePlan(plan)
  if (!saved.ok) throw new Error('seed save failed')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${plan.id}/report`]}>
          <Routes>
            <Route path="/plan/:planId/report" element={<ReportPage />} />
          </Routes>
        </MemoryRouter>,
      )
    })
    await waitFor(() => Boolean(container.querySelector('.report-kpis')))
    const kpis: Printed['kpis'] = {}
    for (const kpi of container.querySelectorAll('.report-kpi')) {
      kpis[kpi.querySelector('.kpi-label')?.textContent ?? ''] = {
        value: kpi.querySelector('.kpi-value')?.textContent ?? '',
        sub: kpi.querySelector('.kpi-sub')?.textContent ?? '',
      }
    }
    const appendixTable = container.querySelector('.report-appendix table')!
    const appendix = {
      headers: [...appendixTable.querySelectorAll('thead th')].map((th) => th.textContent ?? ''),
      rows: [...appendixTable.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')),
    }
    const firstChart = container.querySelector('.report-chart')!
    const legend = [...firstChart.querySelectorAll('.recharts-legend-item-text')].map((item) => item.textContent ?? '')
    const report = builtRows.filter((entry) => entry.planId === plan.id)
    expect(report.length).toBeGreaterThan(0)
    expect(report.every((entry) => entry.mode === 'nominal')).toBe(true)
    return { kpis, legend, appendix, rows: report.at(-1)!.rows }
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}

function chartMismatches(plan: Plan, years: readonly YearResult[], rows: Printed['rows']): string[] {
  const out: string[] = []
  years.forEach((y, k) => {
    const row = rows[k]!
    const categories = balancesByCategory(plan, y)
    for (const c of BALANCE_CATEGORIES) if (!Object.is(row[c], categories[c])) out.push(`${y.year} ${c}`)
    if (!Object.is(row.spending, spendingWithTaxAndPenalties(y))) out.push(`${y.year} spending`)
    if (!Object.is(row.unassigned, unassignedCash(y) ?? 0)) out.push(`${y.year} unassigned`)
    if (!Object.is(row.income, y.incomes.total)) out.push(`${y.year} income`)
    if (!Object.is(row.tax, y.tax)) out.push(`${y.year} tax`)
    if (!Object.is(row.magi, y.magi)) out.push(`${y.year} magi`)
  })
  return out
}

describe('the printed report draws the engine figures', () => {
  it('under-saved-single: chart rows, appendix Tax, and Money lasts through 2045, runs short in 2046', async () => {
    const plan = getExampleById('under-saved-single')!.build()
    const view = projectPlan(plan, START_YEAR)
    const printed = await printReport(plan)

    expect(printed.kpis['Money lasts']).toEqual({ value: 'through 2045', sub: 'runs short in 2046' })
    expect(chartMismatches(plan, view.result.years, printed.rows)).toEqual([])
    const tax = printed.appendix.headers.indexOf('Tax')
    expect(printed.appendix.rows.map((cells) => cells[tax])).toEqual(view.result.years.map((y) => fmtMoney(taxAndPenalties(y))))
    expect(printed.legend).not.toContain('Unassigned cash')
  })

  it('example-couple: a full plan keeps "full plan / through E"', async () => {
    const plan = getExampleById('example-couple')!.build()
    const view = projectPlan(plan, START_YEAR)
    const printed = await printReport(plan)
    expect(printed.kpis['Money lasts']).toEqual({ value: 'full plan', sub: `through ${view.result.endYear}` })
    expect(chartMismatches(plan, view.result.years, printed.rows)).toEqual([])
  })

  it('coast-fire: the unassigned cash band is drawn and in the legend', async () => {
    const plan = getExampleById('coast-fire')!.build()
    const view = projectPlan(plan, START_YEAR)
    const printed = await printReport(plan)
    expect(chartMismatches(plan, view.result.years, printed.rows)).toEqual([])
    expect(printed.rows[0]!.unassigned).toBeGreaterThan(0.5)
    expect(printed.legend).toContain('Unassigned cash')
  })

  it('a traditional IRA split across two rows under one id plots $100,000, not $200,000', async () => {
    const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 95 })
    plan.accounts = [cashAccount('funding', 1_000), traditionalAccount('ira', 50_000), traditionalAccount('ira', 50_000)]
    const valid = validatePlan(plan)
    const view = projectPlan(valid, START_YEAR)
    const printed = await printReport(valid)
    expect(printed.rows[0]!.year).toBe(2026)
    expect(printed.rows[0]!.traditional).toBe(100_000)
    expect(chartMismatches(valid, view.result.years, printed.rows)).toEqual([])
  })

  it('a plan short from its first year does not print "through 2025"', async () => {
    const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 90 })
    plan.accounts = [cashAccount('cash', 1_000)]
    plan.expenses.baseAnnual = 60_000
    const printed = await printReport(validatePlan(plan))
    expect(printed.kpis['Money lasts']).toEqual({ value: 'short from 2026', sub: "the plan's first year" })
  })
})
