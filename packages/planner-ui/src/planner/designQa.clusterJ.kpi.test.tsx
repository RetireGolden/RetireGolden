/** @vitest-environment jsdom */
/**
 * Design-QA cluster J, the rendered half of #572: the KPI bar under the exact
 * repro the walk filed — a debt account at 999% interest against a $500,000
 * balance — must still read as money, not as engineering notation.
 *
 * The formatter pin lives beside the cluster F ladder in
 * designQa.clusterF.test.ts; this one proves the bar the walk photographed
 * actually goes through it, for the value AND the "today's $" sub-line, which
 * were two different strings in the shot.
 *
 * Only the *label* is bounded here. Whether a 999% debt rate is a plan a user
 * should be able to save is a product-range decision, collected on #495 — the
 * engine's `pct` schema (> -100, < 1000) accepts 999 today, and this test
 * deliberately builds a plan the engine parses so the KPI is exercised.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanWorkspace } from './PlanWorkspace'
import { waitFor } from '../testSupport/settle'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

/** Raw JS exponential notation — "1.18e+37", "8.489e-5". Never a KPI. */
const EXPONENTIAL = /\d[eE][+-]?\d/

/**
 * A KPI cell is one grid track of the auto-fit bar (10rem minimum). The
 * formatter's widest form is "−$999.99T" at 9 characters; the ceiling label is
 * shorter still. 12 leaves room for a longer *caption* while catching the
 * 20-plus-character raw numbers that overpainted MONEY LASTS in the shot.
 */
const KPI_VALUE_MAX_CHARS = 12

/** The filed repro: mortgage at 999% against $500,000 owed. */
function planWithAbsurdDebt(): Plan {
  const sample = createSamplePlan()
  sample.accounts.push({
    id: 'debt-999-repro-0000-0000-000000000000'.slice(0, 36),
    type: 'debt',
    name: 'Mortgage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 500_000,
    // 999 is what the walk typed. The engine's own bound is `< 1000`, so this
    // parses; do not read it as a UI-invented limit.
    interestPct: 999,
    monthlyPayment: 0,
  })
  const parsed = parsePlan(sample)
  if (!parsed.ok) throw new Error(`repro plan must be engine-valid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}

describe('cluster J: the KPI bar never paints raw exponentials (#572)', () => {
  it('a 999% debt on $500k leaves every KPI value and caption readable', async () => {
    const plan = planWithAbsurdDebt()
    const saved = await savePlan(plan)
    if (!saved.ok) throw new Error('seed save failed')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${plan.id}/household`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="household" element={<div>Household section</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })
    await waitFor(() => {
      const bar = container.querySelector('[aria-label="Plan headline results"]')
      return Boolean(bar && !bar.classList.contains('kpi-bar--incomplete') && bar.querySelector('.kpi-label'))
    })

    const bar = container.querySelector('[aria-label="Plan headline results"]')
    if (!bar) throw new Error('headline KPI bar not rendered')

    const ending = [...bar.querySelectorAll('.kpi')].find(
      (kpi) => kpi.querySelector('.kpi-label')?.textContent === 'Ending net worth',
    )
    if (!ending) throw new Error('Ending net worth KPI not rendered')

    const value = ending.querySelector('.kpi-value')?.textContent ?? ''
    const sub = ending.querySelector('.kpi-sub')?.textContent ?? ''
    // The shot: value "−$1.36109750…e+36", sub "−$5.87…8e+35M today's $".
    expect(value).not.toMatch(EXPONENTIAL)
    expect(sub).not.toMatch(EXPONENTIAL)
    // This plan really is past the ladder — otherwise the assertions above
    // would pass on any ordinary plan and prove nothing.
    expect(value).toBe('−$999T+')
    expect(sub.startsWith('−$999T+ today')).toBe(true)

    // No KPI value in the bar carries an exponent or a run-on number.
    for (const v of bar.querySelectorAll('.kpi-value')) {
      const text = v.textContent ?? ''
      expect(text, text).not.toMatch(EXPONENTIAL)
      expect(text.length, text).toBeLessThanOrEqual(KPI_VALUE_MAX_CHARS)
    }
    for (const s of bar.querySelectorAll('.kpi-sub')) {
      expect(s.textContent ?? '', s.textContent ?? '').not.toMatch(EXPONENTIAL)
    }

    await act(async () => root.unmount())
    container.remove()
  })
})
