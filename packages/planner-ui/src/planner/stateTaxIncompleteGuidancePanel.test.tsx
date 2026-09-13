/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createEmptyPlan } from '@retiregolden/engine/model/plan'
import { StateTaxIncompleteGuidancePanel } from './stateTaxIncompleteGuidance'

describe('incomplete computation recovery links', () => {
  it.each([
    { name: 'candidate-only unavailable details', evidence: undefined },
    { name: 'HECM-only evidence', evidence: [{ year: 2026, hecmIssues: ['Servicing history is incomplete.'] }] },
    { name: 'non-state tax evidence', evidence: [{ year: 2026, taxIssues: [{ code: 'missing-ira-basis', message: 'Basis is unknown.' }] }] },
  ])('shows no unrelated state or pension link for $name', async ({ evidence }) => {
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      await act(async () => root.render(<MemoryRouter>
        <StateTaxIncompleteGuidancePanel plan={createEmptyPlan()} incompleteYears={[2026]} evidence={evidence} />
      </MemoryRouter>))
      expect(host.textContent).toContain('No exact conversion comparison can be published')
      expect(host.querySelector('a')).toBeNull()
    } finally {
      await act(async () => root.unmount())
    }
  })
})
