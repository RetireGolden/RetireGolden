/** @vitest-environment jsdom */
/**
 * Compare Plans left open across local midnight on 31 December runs again
 * from the new year, with no click and no remount (decision D-2027-ROLLOVER;
 * PR #768 review issue 3).
 *
 * The page read the clock once, in the effect that loads the two plans, keyed
 * only on the pickers, so a comparison of two user plans left open over New
 * Year kept 2026 headlines while Results moved to 2027 on its next render.
 * The page now re-reads the year at the local New Year (`useClockYear`) and
 * runs the comparison again. Two user plans ending in different years make
 * every dollar row say its start year ("(2026 $)"), which is what is read
 * here. Only `Date` is faked, so the page's timers stay real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import { PlanStoreProvider } from '../data/PlanStoreProvider'
import type { PlanStore, PlanSummary } from '../data/planStoreContext'
import { settle, sleep, waitFor } from '../testSupport/settle'
import { ComparePlansPage } from './ComparePlansPage'

// `process` is read off globalThis: the package tsconfig omits node types, and vitest runs in node.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env
const originalTz = env['TZ']

function store(plans: Plan[]): PlanStore {
  const docs = new Map<string, Plan>(plans.map((plan) => [plan.id, structuredClone(plan)]))
  return {
    async listPlans(): Promise<PlanSummary[]> {
      return [...docs.values()].map((plan) => ({ id: plan.id, name: plan.name, updatedAtIso: plan.updatedAtIso }))
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
}

/** Two user plans that end in different years, so the dollar rows are in the start year's dollars. */
function twoPlans(): [Plan, Plan] {
  const make = (name: string, planningAge: number, id: string): Plan => {
    const plan = createEmptyPlan({ name, now: () => new Date('2026-10-15T12:00:00.000Z'), newId: (() => { let i = 0; return () => `${id}-${i++}` })() })
    plan.household.people[0]!.longevity = { planningAge, source: 'manual' }
    plan.expenses.baseAnnual = 40_000
    return plan
  }
  return [make('Alpha', 90, 'alpha'), make('Beta', 95, 'beta')]
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
  vi.useRealTimers()
  if (originalTz === undefined) delete env['TZ']
  else env['TZ'] = originalTz
})

const tableText = (): string => container.querySelector('table')?.textContent ?? ''

describe('Compare Plans across New Year', () => {
  it('runs the comparison again from 2027 when local midnight passes, with no click', async () => {
    // 23:59:59 on 31 December 2026 in New York.
    env['TZ'] = 'America/New_York'
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2027-01-01T04:59:59.000Z'))
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanStoreProvider store={store(twoPlans())}>
            <ComparePlansPage />
          </PlanStoreProvider>
        </MemoryRouter>,
      )
    })
    await settle()
    await waitFor(() => tableText().includes('(2026 $)'), { what: 'the 2026 comparison' })
    expect(tableText()).not.toContain('(2027 $)')

    await act(async () => {
      vi.setSystemTime(new Date('2027-01-01T05:00:01.000Z'))
      await sleep(1_500)
    })
    await settle()
    await waitFor(() => tableText().includes('(2027 $)'), { what: 'the comparison from 2027' })
    expect(tableText()).not.toContain('(2026 $)')
  })
})
