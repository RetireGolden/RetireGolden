/** @vitest-environment jsdom */
/**
 * The claim-age sweep's debounce backstop (SsAnalysisPage.tsx) absorbs any
 * throw from `sweepClaimingStrategies` into the same "could not run" card a
 * plan the engine refuses produces. Before this, the catch swallowed the
 * exception entirely — nothing reached the console, unlike every error
 * boundary in this app (ShellErrorBoundary, RouteErrorBoundary). This pins
 * that a genuine exception is still logged even though the card's wording
 * stays the validation-shaped one.
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
      throw new Error('boom: not a validation problem')
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

    expect(container.querySelector('.callout--warn')?.textContent).toContain('The claim-age comparison could not run')
    expect(console.error).toHaveBeenCalledWith('Claim-age sweep failed:', expect.any(Error))
  })
})
