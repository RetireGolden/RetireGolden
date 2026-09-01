/** @vitest-environment jsdom */
/**
 * Asset-class help parity (#424): every field in every asset-class block
 * carries the single ⓘ "More information" affordance, Expected return
 * included, and the Expected return help carries a Learn link.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { AssumptionsSection } from './AssumptionsSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

async function mount() {
  const plan = createSamplePlan()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () =>
    root!.render(
      <MemoryRouter initialEntries={['/plan/x/assumptions']}>
        <PlanCtx.Provider
          value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
        >
          <AssumptionsSection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    ),
  )
  return container
}

describe('AssumptionsSection asset-class help (#424)', () => {
  it('gives every field in every asset-class block a More information button', async () => {
    const host = await mount()
    const blocks = [...host.querySelectorAll<HTMLElement>('[data-testid^="asset-class-"]')]
    expect(blocks).toHaveLength(4)
    for (const block of blocks) {
      const fields = [...block.querySelectorAll('.field')]
      expect(fields.length).toBeGreaterThan(0)
      for (const field of fields) {
        const label = field.querySelector('.field-label')?.textContent
        expect(
          field.querySelectorAll('button[aria-label="More information"]').length,
          `${block.dataset.testid} / ${label}`,
        ).toBe(1)
      }
      const expectedReturn = fields.find((f) => f.querySelector('.field-label')?.textContent === 'Expected return')!
      expect(expectedReturn.querySelector('a.learn-link')?.getAttribute('href')).toMatch(/^\/learn\//)
    }
  })
})
