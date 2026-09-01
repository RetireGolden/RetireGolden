/** @vitest-environment jsdom */
/**
 * Compare-plans chrome (#384): Plan A/B reuse SelectField (for/id + .field),
 * the same-plan callout is a status live region, and empty-state copy stays
 * put. Projection math is out of scope — these assertions fail on main's
 * class-empty native <select> and silent callout.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { ComparePlansPage } from './ComparePlansPage'
import { settle, waitFor } from '../testSupport/settle'

function makeStore(plans: Plan[]) {
  const docs = new Map<string, Plan>(plans.map((p) => [p.id, structuredClone(p)]))
  const store: PlanStore = {
    async listPlans(): Promise<PlanSummary[]> {
      return [...docs.values()].map((p) => ({ id: p.id, name: p.name, updatedAtIso: p.updatedAtIso }))
    },
    async loadPlan(id: string) {
      return docs.get(id) ?? null
    },
    async savePlan(plan: Plan) {
      docs.set(plan.id, structuredClone(plan))
    },
    async deletePlan(id: string) {
      docs.delete(id)
    },
  }
  return store
}

function twoPlans(): [Plan, Plan] {
  const older = createEmptyPlan({ name: 'Alpha', now: () => new Date('2026-01-01T00:00:00.000Z') })
  const newer = createEmptyPlan({
    name: 'Copy of Home Navigation Demo',
    now: () => new Date('2026-01-02T00:00:00.000Z'),
  })
  return [older, newer]
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function mount(plans: Plan[]) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanStoreProvider store={makeStore(plans)}>
          <ComparePlansPage />
        </PlanStoreProvider>
      </MemoryRouter>,
    )
  })
  await settle()
}

function labeledSelect(labelText: string): { label: HTMLLabelElement; select: HTMLSelectElement } {
  const label = [...container.querySelectorAll('label')].find((el) => el.textContent?.trim() === labelText)
  expect(label, `${labelText} label`).toBeTruthy()
  expect(label!.htmlFor, `${labelText} htmlFor`).toBeTruthy()
  const select = document.getElementById(label!.htmlFor)
  expect(select, `${labelText} select`).toBeInstanceOf(HTMLSelectElement)
  return { label: label as HTMLLabelElement, select: select as HTMLSelectElement }
}

describe('ComparePlansPage chrome (#384)', () => {
  it('keeps empty-state copy when fewer than two plans exist', async () => {
    await mount([createEmptyPlan({ name: 'Only one' })])
    expect(container.querySelector('h2')?.textContent).toBe('Two plans are needed')
    expect(container.querySelector('select')).toBeNull()
  })

  it('associates Plan A / Plan B labels via for/id and skins the selects as fields', async () => {
    await mount(twoPlans())
    await waitFor(() => container.querySelectorAll('select').length === 2, { what: 'Plan A and Plan B selects' })

    expect(container.querySelector('h1')?.textContent).toBe('Compare plans')
    expect(container.textContent).toContain('Back to plans')

    for (const name of ['Plan A', 'Plan B'] as const) {
      const { label, select } = labeledSelect(name)
      expect(label.textContent?.trim()).toBe(name)
      expect(label.contains(select)).toBe(false)
      expect(select.closest('.field'), `${name} uses field classes`).not.toBeNull()
    }
  })

  it('announces the same-plan callout as a status live region', async () => {
    await mount(twoPlans())
    await waitFor(() => container.querySelector('.compare-table') !== null, { what: 'compares ready' })

    const live = container.querySelector('[role="status"]')
    expect(live, 'LiveStatus stays mounted while comparing').not.toBeNull()
    expect(live!.getAttribute('role')).toBe('status')
    expect(live!.getAttribute('aria-live')).toBe('polite')
    expect(live!.textContent).toBe('')
    expect(container.textContent).not.toContain('Choose two different plans to compare.')

    const planA = labeledSelect('Plan A').select
    const planB = labeledSelect('Plan B').select
    expect(planA.value).not.toBe(planB.value)
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!.call(planB, planA.value)
      planB.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await waitFor(
      () => container.querySelector('[role="status"]')?.textContent === 'Choose two different plans to compare.',
      { what: 'same-plan live message' },
    )

    const announced = container.querySelector('[role="status"]')!
    expect(announced.getAttribute('role')).toBe('status')
    expect(announced.getAttribute('aria-live')).toBe('polite')
    const callout = [...container.querySelectorAll('.callout.callout--info')].find((el) =>
      el.textContent?.includes('Choose two different plans to compare.'),
    )
    expect(callout, 'visible same-plan info callout').toBeTruthy()
    expect(callout).not.toBe(announced)
    expect(container.querySelector('.compare-table')).toBeNull()
  })

  it('renders user plan names in the compare-table headers', async () => {
    await mount(twoPlans())
    await waitFor(() => container.querySelector('.compare-table') !== null, { what: 'compare table' })
    const headers = [...container.querySelectorAll('.compare-table thead th')].map((th) => th.textContent)
    expect(headers).toEqual(['Metric', 'Copy of Home Navigation Demo', 'Alpha', 'Plan B − Plan A'])
    const planNames = [...container.querySelectorAll('.compare-table thead th.compare-table-plan-name')].map(
      (th) => th.textContent,
    )
    expect(planNames).toEqual(['Copy of Home Navigation Demo', 'Alpha'])
  })
})
