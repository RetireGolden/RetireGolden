/** @vitest-environment jsdom */
/**
 * The claim-age sweep's debounce backstop (SsAnalysisPage.tsx) absorbs any
 * throw from `sweepClaimingStrategies` into an error card. `sweep === null`
 * has exactly one cause — this catch — so the card no longer calls it a
 * plan-validation problem (that was only sometimes true; see #598 round 2).
 * This pins that a genuine exception is (a) logged to the console, the way
 * every other error boundary in this app already does, and (b) shown to the
 * household with its own message, not a guess about validation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { SsAnalysisPage } from './SsAnalysisPage'
import { PlanCtx, type PlanContextValue } from './planContextCore'

vi.mock('./ssAnalysis', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./ssAnalysis')>()
  return {
    ...actual,
    sweepClaimingStrategies: () => {
      throw new Error('boom: unexpected candidate shape')
    },
  }
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('SsAnalysisPage claim-age sweep failure', () => {
  it('logs the exception instead of swallowing it, and still shows the error card', async () => {
    const plan = createSamplePlan()
    const value: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }

    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={value}>
            <SsAnalysisPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    await waitFor(() => container.querySelector('.callout--warn') !== null, {
      what: 'the claim-age sweep error card',
      attempts: 600,
      intervalMs: 20,
      describe: () => container.textContent ?? '',
    })

    const card = container.querySelector('.callout--warn')?.textContent ?? ''
    expect(card).toContain('The claim-age comparison hit an error and could not run')
    // Neutral about the cause: never tells the household to go check the
    // plan for validation issues when the only path here is an exception.
    expect(card).not.toContain('check the plan for validation issues')
    // The caught error's own message reaches the household, not just the console.
    expect(card).toContain('boom: unexpected candidate shape')
    expect(console.error).toHaveBeenCalledWith('Claim-age sweep failed:', expect.any(Error))
  })
})
