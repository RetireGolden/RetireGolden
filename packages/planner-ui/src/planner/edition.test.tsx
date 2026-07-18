/** @vitest-environment jsdom */
/**
 * Edition content seam (`PlannerEditionProvider`): the route-group content pages
 * must render today's free-web copy by default (no provider) and let a host
 * override just the planner-home label and the two host-specific Disclaimer
 * sections. These are the guarantees that keep `<PlannerApp/>` byte-identical
 * while a differently-licensed, account-backed host stays factually correct.
 */
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, savePlan } from '../data/planStore'
import { plannerWorkspaceRoutes } from '../routes/groups'
import { createSamplePlan } from '../testSupport/samplePlan'
import { DisclaimerPage } from './DisclaimerPage'
import { ExamplesPage } from './examples/ExamplesPage'
import { PlannerEditionProvider } from './PlannerEditionProvider'

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

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/']}>{node}</MemoryRouter>)
  })
}

/** Bare workspace-group host at a deep link, like groups.test.tsx. */
function WorkspaceHost() {
  return useRoutes(plannerWorkspaceRoutes)
}

async function renderWorkspace(planId: string, node: (host: React.ReactNode) => React.ReactNode) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/plan/${planId}/household`]}>{node(<WorkspaceHost />)}</MemoryRouter>,
    )
  })
  // The workspace section chunk is lazy — poll until the rail mounts.
  for (let attempt = 0; attempt < 200 && !container.querySelector('.workspace-rail'); attempt++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
}

describe('PlannerEdition defaults (no provider)', () => {
  it("ExamplesPage back link and lede read 'Your plans'", async () => {
    await render(<ExamplesPage />)
    const back = container.querySelector('.examples-back a')
    expect(back?.textContent).toBe('← Your plans')
    expect(container.querySelector('.lede')?.textContent).toContain('stay out of Your plans')
  })

  it('DisclaimerPage shows the browser-storage and AGPL sections', async () => {
    await render(<DisclaimerPage />)
    const text = container.textContent!
    expect(text).toContain('Your data stays with you')
    expect(text).toContain('no server-side storage and no accounts')
    expect(text).toContain('Software license & third-party notices')
    expect(text).toContain('AGPL-3.0')
    expect(container.querySelector('a[href="https://www.gnu.org/licenses/agpl-3.0.html"]')).not.toBeNull()
  })
})

describe('PlannerEditionProvider overrides', () => {
  it("ExamplesPage back link uses the host's home label", async () => {
    await render(
      <PlannerEditionProvider edition={{ homeLabel: 'Client library' }}>
        <ExamplesPage />
      </PlannerEditionProvider>,
    )
    const back = container.querySelector('.examples-back a')
    expect(back?.textContent).toBe('← Client library')
    expect(container.querySelector('.lede')?.textContent).toContain('stay out of Client library')
  })

  it('DisclaimerPage replaces the two host-specific sections and keeps the shared substance', async () => {
    await render(
      <PlannerEditionProvider
        edition={{
          disclaimerDataSection: (
            <>
              <h2>Your data lives in your account</h2>
              <p data-testid="edition-data">Encrypted local library, synced to your account.</p>
            </>
          ),
          disclaimerLicenseSection: (
            <>
              <h2>License</h2>
              <p data-testid="edition-license">Licensed under the RetireGolden Pro EULA.</p>
            </>
          ),
        }}
      >
        <DisclaimerPage />
      </PlannerEditionProvider>,
    )
    const text = container.textContent!
    // Overrides replace the whole default block, heading included.
    expect(container.querySelector('[data-testid="edition-data"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="edition-license"]')).not.toBeNull()
    expect(text).not.toContain('Your data stays with you')
    expect(text).not.toContain('no server-side storage and no accounts')
    expect(text).not.toContain('free and open-source software')
    expect(container.querySelector('a[href="https://www.gnu.org/licenses/agpl-3.0.html"]')).toBeNull()
    // Shared substance stays single-sourced and untouched.
    expect(text).toContain('Educational use only')
    expect(text).toContain('No warranty')
    expect(text).toContain('Where the numbers come from')
  })

  it('normalizes an empty or whitespace homeLabel back to the default', async () => {
    await render(
      <PlannerEditionProvider edition={{ homeLabel: '   ' }}>
        <ExamplesPage />
      </PlannerEditionProvider>,
    )
    expect(container.querySelector('.examples-back a')?.textContent).toBe('← Your plans')
  })
})

describe('PlannerEdition in the plan workspace (route-group host)', () => {
  it('defaults: breadcrumb, rail back link, and save tooltip carry the web copy', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')

    await renderWorkspace(sample.id, (host) => host)
    expect(container.querySelector('.workspace-breadcrumb a')?.textContent).toBe('Your plans')
    expect(container.querySelector('.rail-link--back')?.textContent).toContain('Your plans')
    expect(container.querySelector('.save-state')?.getAttribute('title')).toContain('only in this browser')
  })

  it("overrides: homeLabel reaches the workspace links and storageTooltip replaces the browser claim", async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')

    await renderWorkspace(sample.id, (host) => (
      <PlannerEditionProvider
        edition={{
          homeLabel: 'Client library',
          storageTooltip: 'Plans live in your encrypted local library — nothing is sent to a server.',
        }}
      >
        {host}
      </PlannerEditionProvider>
    ))
    expect(container.querySelector('.workspace-breadcrumb a')?.textContent).toBe('Client library')
    expect(container.querySelector('.rail-link--back')?.textContent).toContain('Client library')
    const tooltip = container.querySelector('.save-state')?.getAttribute('title')
    expect(tooltip).toContain('encrypted local library')
    expect(tooltip).not.toContain('only in this browser')
  })
})
