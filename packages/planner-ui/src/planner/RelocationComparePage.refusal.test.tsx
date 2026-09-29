/** @vitest-environment jsdom */
/**
 * PR #754: the relocation compare runs in a worker, where an engine refusal
 * loses its class. The worker posts the refusal as plain data, the runner
 * rebuilds it (WorkerRefusalError), and the page says it in plain words; an
 * error nothing recognises gets a plain sentence with its text as a detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { appExamplePlanById } from '../testSupport/appExamples'
import { settle, waitFor } from '../testSupport/settle'
import { WorkerRefusalError } from '../workers/refusal'
import { WORKER_UNAVAILABLE_MESSAGE, WorkerUnavailableError } from '../workers/spawn'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { PlanCtx, type PlanContextValue } from './planContextCore'

vi.mock('../relocation/runner', () => ({ runRelocationCompare: vi.fn() }))

import { runRelocationCompare } from '../relocation/runner'
import { buildLognormalModelConfigForPlan } from '@retiregolden/engine/montecarlo/marketModels'
import { RelocationComparePage } from './RelocationComparePage'

const BANNED = ['NaN', 'Infinity', 'YYYY-MM-DD', 'baseline', 'proposal', 'finite number', 'inflationScale']

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR}-07-01T12:00:00.000Z`))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

function contextFor(plan: Plan): PlanContextValue {
  return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
}

async function runCompare(): Promise<string> {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(appExamplePlanById('example-couple'))}>
          <RelocationComparePage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  const run = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Run compare')!
  await act(async () => run.click())
  await settle()
  const errorLine = () =>
    [...container.querySelectorAll('p')].find((p) => (p.textContent ?? '').startsWith("The states couldn't be compared"))
  await waitFor(() => errorLine() !== undefined, { what: 'the error line' })
  // The error line alone: the page's own copy elsewhere uses words such as
  // "baseline" in its legend.
  return errorLine()!.textContent ?? ''
}

describe('relocation compare errors in plain words (PR #754)', () => {
  for (const [role, sentence] of [
    ['baseline', "The states couldn't be compared: one of your plan's figures could not be computed. Check your plan's Results page, then compare again."],
    ['proposal', "The states couldn't be compared: one of a candidate state's figures could not be computed. Check that state's details, then compare again."],
    ['difference', "The states couldn't be compared: the difference between a state and your plan could not be computed. Check the states' details, then compare again."],
  ] as const) {
    it(`states a refused ${role} figure from the worker in plain words`, async () => {
      vi.mocked(runRelocationCompare).mockRejectedValueOnce(
        new WorkerRefusalError(`A compared figure must be a finite number; the ${role} is NaN`, {
          kind: 'non-finite-figure',
          role,
        }),
      )
      const text = await runCompare()
      expect(text).toBe(sentence)
      for (const banned of BANNED) expect(text, banned).not.toContain(banned)
    })
  }

  it('runs the success rates on the engine default seed with the headline model (D-MC-DEFAULT-SEED)', async () => {
    vi.mocked(runRelocationCompare).mockRejectedValueOnce(new Error('stop after the request'))
    await runCompare()
    const request = vi.mocked(runRelocationCompare).mock.calls.at(-1)![0]
    expect(request.monteCarlo?.seed).toBe(6_221_293)
    expect(request.monteCarlo?.model).toStrictEqual(buildLognormalModelConfigForPlan(appExamplePlanById('example-couple'), 12))
  })

  it('states any other failure in a plain sentence that keeps its text as a detail', async () => {
    vi.mocked(runRelocationCompare).mockRejectedValueOnce(new Error('Relocation compare worker failed'))
    const text = await runCompare()
    expect(text).toBe(
      "The states couldn't be compared. Compare again. If it fails again, this detail helps us fix it: Relocation compare worker failed",
    )
    expect(container.textContent).not.toContain('Compare error:')
  })

  it('states the no-Worker reason alone, with no "compare again"', async () => {
    vi.mocked(runRelocationCompare).mockRejectedValueOnce(new WorkerUnavailableError())
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(appExamplePlanById('example-couple'))}>
            <RelocationComparePage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    const run = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Run compare')!
    await act(async () => run.click())
    await settle()
    const line = () => [...container.querySelectorAll('p')].find((p) => p.textContent === WORKER_UNAVAILABLE_MESSAGE)
    await waitFor(() => line() !== undefined, { what: 'the no-Worker line' })
    expect(container.textContent).not.toMatch(/compare again/i)
  })
})
