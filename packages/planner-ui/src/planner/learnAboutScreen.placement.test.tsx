/** @vitest-environment jsdom */
/**
 * "Learn about this screen" is a section-level card (#446). It must sit
 * beside a screen's cards, never inside one: nested, it draws a second
 * border, shadow, and heading inside the host card, which is what the
 * Assumptions and Social Security screens did before the review of #488.
 */
import { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx } from './planContextCore'
import { AssumptionsSection, IncomeFloorSection, InsuranceSection, SpendingSection, StrategySection } from './sections'
import { SocialSecuritySection } from './SocialSecuritySection'

let root: Root | null = null
let host: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  host?.remove()
  root = null
  host = null
})

async function mount(Section: ComponentType, path: string) {
  const plan = createSamplePlan()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={[path]}>
        <PlanCtx.Provider
          value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}
        >
          <Section />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return host
}

const HOSTS: Array<[string, ComponentType, string]> = [
  ['Assumptions', AssumptionsSection, '/plan/x/assumptions'],
  ['Social Security', SocialSecuritySection, '/plan/x/social-security'],
  ['Income floor', IncomeFloorSection, '/plan/x/income-floor'],
  ['Insurance', InsuranceSection, '/plan/x/insurance'],
  ['Spending', SpendingSection, '/plan/x/spending'],
  ['Strategy', StrategySection, '/plan/x/strategy'],
]

describe('Learn-about-this-screen placement (#446)', () => {
  for (const [name, Section, path] of HOSTS) {
    it(`${name} renders the cluster as a sibling card, not inside one`, async () => {
      const el = await mount(Section, path)
      const cluster = el.querySelector('aside.learn-screen')
      expect(cluster, `${name} renders the cluster`).not.toBeNull()
      expect(cluster!.classList.contains('card')).toBe(true)
      expect(cluster!.parentElement?.closest('.card'), `${name}: cluster nested inside a card`).toBeNull()
      // One heading names it and it joins the outline.
      expect(cluster!.querySelector('h2')?.textContent).toBe('Learn about this screen')
    })
  }
})
