/** @vitest-environment jsdom */
/**
 * Report header vs household table (#555): a Single plan that carries two
 * people prints the same one-line reading of that shape the Household screen
 * shows, right under "Single · <state>", so the header no longer contradicts
 * the two-person table beneath it. A joint plan prints nothing extra.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router'
import { IDBFactory } from 'fake-indexeddb'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { SINGLE_WITH_PARTNER_NOTE } from './filingStatusNotice'
import { removePartner } from './householdActions'
import { ReportPage } from './ReportPage'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function mountReport(plan: Plan) {
  const saved = await savePlan(plan)
  if (!saved.ok) throw new Error(`seed save failed: ${saved.issues.join('; ')}`)
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/plan/${plan.id}/report`]}>
        <Routes>
          <Route path="/plan/:planId/report" element={<ReportPage />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await waitFor(() => container.querySelector('.report-section') !== null)
}

const notice = () => container.querySelector('[data-testid="single-with-partner-notice"]')

describe('Report: Single filing status with two people (#555)', () => {
  it('prints the household reading under the "Single · state" line', async () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    // The shape is valid as far as the engine is concerned — the notice is a
    // reading of it, not a validation failure.
    expect(parsePlan(plan).ok).toBe(true)
    await mountReport(plan)
    const header = Array.from(container.querySelectorAll('.report-section')).find((s) => s.querySelector('h2')?.textContent === 'Household')!
    expect(header.textContent).toContain('Single ·')
    expect(header.querySelectorAll('tbody tr')).toHaveLength(2)
    const box = notice()
    expect(box).not.toBeNull()
    expect(box!.textContent).toContain('Two people on a Single-filing plan')
    expect(box!.textContent).toContain(SINGLE_WITH_PARTNER_NOTE)
  })

  it('prints nothing extra for a joint plan', async () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'marriedFilingJointly'
    await mountReport(plan)
    expect(container.textContent).toContain('Married filing jointly ·')
    expect(notice()).toBeNull()
  })

  it('prints nothing extra for a genuine one-person Single plan', async () => {
    const plan = createSamplePlan()
    plan.household.filingStatus = 'single'
    // Drop the partner the way the Household screen's Remove does, so the
    // plan is valid as a one-person household.
    removePartner(plan, plan.household.people[1]!.id)
    expect(plan.household.people).toHaveLength(1)
    const parsed = parsePlan(plan)
    expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('; ')).toBe(true)
    await mountReport(plan)
    const header = Array.from(container.querySelectorAll('.report-section')).find((s) => s.querySelector('h2')?.textContent === 'Household')!
    expect(header.textContent).toContain('Single ·')
    expect(header.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(notice()).toBeNull()
  })
})
