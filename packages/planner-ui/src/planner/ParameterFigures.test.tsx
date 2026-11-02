/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { PARAMETER_PROVENANCE } from '@retiregolden/engine/params'
import { AssumptionsCardPage } from './AssumptionsCardPage'
import { ProvenancePanel } from './ProvenancePanel'
import { ParameterFigures } from './ParameterFigures'
import { PlanCtx } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { assumptionsExportJson, assumptionsExportText, buildAssumptionsSnapshot } from './assumptionsExport'

let root: Root
let container: HTMLDivElement
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('parameter source presentation (#783)', () => {
  for (const surface of ['assumptions', 'disclaimer'] as const) {
    it(`keeps readable citations and collapses state detail on ${surface}`, () => {
      container = document.createElement('div')
      document.body.append(container)
      root = createRoot(container)
      const plan = createSamplePlan()
      act(() => root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={{ plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }}>
            {surface === 'assumptions' ? <AssumptionsCardPage /> : <ProvenancePanel />}
          </PlanCtx.Provider>
        </MemoryRouter>,
      ))
      const row = container.querySelector('.provenance-details')!.closest('tr')!
      const details = row.querySelector('details')!
      expect(details.open).toBe(false)
      expect(details.querySelector('summary')!.textContent).toBe('State details and limitations')
      expect(row.textContent).not.toMatch(/`|https?:\/\//u)
      expect(row.textContent).not.toContain('la-ldr-it540es')
      expect(row.textContent).not.toContain('ut-code-59-10')
      // A future catalog citation format must fail here instead of leaking
      // audit IDs or bare URLs silently on either surface.
      expect([...container.querySelectorAll('.provenance-figures')].map((e) => e.textContent).join(' ')).not.toMatch(/`|https?:\/\//u)
      // These qualifications survive the presentation cleanup.
      expect(details.textContent).toContain('without SS/RRB offset, M-3 phaseout, or plan qualification')
      expect(details.textContent).toContain('§59-10-1042 Social Security')
      const link = details.querySelector('a')!
      expect(link.textContent).toBe('Maine Form 1040ES-ME')
      expect(link.href).toBe('https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/26_1040es_fillable.pdf')
      expect(link.rel).toContain('noopener')
      expect(row.querySelector('td a')!.getAttribute('href')).toContain('/DOCS/domain/state-tax-research')

      const snapshot = buildAssumptionsSnapshot(plan, 2026)
      const original = PARAMETER_PROVENANCE.find((s) => s.id === 'state-income-tax')!.figures
      expect(assumptionsExportText(snapshot)).toContain(original)
      expect(JSON.parse(assumptionsExportJson(snapshot)).groups.find((g: { id: string }) => g.id === 'tax-parameters').rows.find((r: { id: string }) => r.id === 'state-income-tax').value).toBe(original)
    })
  }

  it('keeps abbreviations and nested qualifications intact instead of splitting prose at a period', () => {
    container = document.createElement('div')
    root = createRoot(container)
    const figures = 'U.S. figures. A limitation (including (nested) text) remains. Source (`audit-only-id`).'
    act(() => root.render(<ParameterFigures id="state-income-tax" figures={figures} />))
    expect(container.querySelector('details > div')!.textContent).toBe('U.S. figures. A limitation (including (nested) text) remains. Source.')
  })
})
