/** @vitest-environment jsdom */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { IDBFactory } from 'fake-indexeddb'

import { _resetPlanStoreForTests, loadPlan, savePlan } from '../data/planStore'
import { parsePlan } from '../engine/model/plan'
import { applyScenarioPatch } from '../engine/scenarios/scenarios'
import { PlanProvider } from './PlanContext'
import { PlanWorkspace } from './PlanWorkspace'
import { PlanCtx, usePlan } from './planContextCore'
import { fmtMoneyCompact, parseAmount } from './format'
import { createSamplePlan } from '../testSupport/samplePlan'
import { removePartner } from './householdActions'
import { projectPlan } from './useProjection'
import { AccountsSection, AssumptionsSection, HouseholdSection, InsuranceSection, SpendingSection, StrategySection } from './sections'
import { InsightsPage } from './insights/InsightsPage'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetPlanStoreForTests()
  localStorage.clear()
})

/** Waits past the 600 ms autosave debounce. */
const settle = () => new Promise((r) => setTimeout(r, 750))

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
  throw new Error('Timed out waiting for expected render')
}

describe('removePartner', () => {
  it('drops the removed partner’s policies and re-homes a beneficiary, staying valid', () => {
    const plan = createSamplePlan()
    const [primary, partner] = plan.household.people
    // Give the partner a policy and point a life beneficiary at them.
    plan.insurance = [
      { kind: 'ltc', id: 'ltc-partner', name: 'Partner LTC', owner: partner!.id, annualPremium: 2_000, premiumMode: 'lifetime', benefitMonthly: 5_000, benefitPeriodYears: 3, eliminationPeriodDays: 90 },
      { kind: 'permanentLife', id: 'life-primary', name: 'Primary life', insured: primary!.id, beneficiary: partner!.id, annualPremium: 1_000, premiumMode: 'lifetime', deathBenefit: 100_000, cashValue: 0, cashValueMode: 'flatRate', cashValueGrowthPct: 0 },
    ]
    plan.careEvents = [{ id: 'care-partner', personId: partner!.id, startAge: 85, durationYears: 3, annualCost: 90_000 }]

    removePartner(plan, partner!.id)

    // The partner's own policy is gone; the surviving policy's beneficiary falls back to the estate.
    expect(plan.insurance.map((p) => p.id)).toEqual(['life-primary'])
    const life = plan.insurance[0]!
    expect(life.kind === 'permanentLife' && life.beneficiary).toBe('estate')
    // The partner's care event is dropped too.
    expect(plan.careEvents).toEqual([])
    // No dangling references — the plan still parses.
    expect(parsePlan(plan).ok).toBe(true)
  })
})

describe('format helpers', () => {
  it('formats compact money and parses shorthand', () => {
    expect(fmtMoneyCompact(1_240_000)).toBe('$1.24M')
    expect(fmtMoneyCompact(45_200)).toBe('$45k')
    expect(parseAmount('$450k')).toBe(450_000)
    expect(parseAmount('1,200,000')).toBe(1_200_000)
    expect(parseAmount('1.5m')).toBe(1_500_000)
    expect(parseAmount('nope')).toBeNull()
  })
})

describe('sample plan', () => {
  it('is schema-valid, projects, and its scenarios apply cleanly', () => {
    const plan = createSamplePlan()
    expect(parsePlan(plan).ok).toBe(true)
    const view = projectPlan(plan, 2026)
    expect(view.result.years.length).toBeGreaterThan(20)
    for (const s of plan.scenarios) {
      expect(applyScenarioPatch(plan, s.patch).ok).toBe(true)
    }
  })
})

describe('AccountsSection', () => {
  it('does not offer Joint ownership for 401(k), IRA/Roth, or HSA accounts', async () => {
    const plan = createSamplePlan()
    plan.accounts = [
      { type: 'traditional', id: 'trad', name: '401(k)', ownerPersonId: plan.household.people[0]!.id, annualReturnPct: null, kind: 'employer', balance: 1, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: plan.household.people[0]!.id, annualReturnPct: null, kind: 'ira', balance: 1, annualContribution: 0 },
      { type: 'hsa', id: 'hsa', name: 'HSA', ownerPersonId: plan.household.people[0]!.id, annualReturnPct: null, balance: 1, annualContribution: 0 },
      { type: 'taxable', id: 'tax', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 1, costBasis: 1, annualContribution: 0 },
    ]
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/plan/x/accounts']}>
          <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <AccountsSection />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })

    const ownerSelects = Array.from(container.querySelectorAll('select')).filter((select) => {
      const label = container.querySelector(`label[for="${select.id}"]`)
      return label?.textContent === 'Owner'
    })
    expect(ownerSelects).toHaveLength(4)
    expect(ownerSelects.slice(0, 3).every((select) => Array.from(select.options).every((option) => option.textContent !== 'Joint'))).toBe(true)
    expect(Array.from(ownerSelects[3]!.options).some((option) => option.textContent === 'Joint')).toBe(true)

    await act(async () => root.unmount())
    container.remove()
  })
})

describe('planner learn links', () => {
  async function mountSection(Section: ComponentType, path: string) {
    const errors: string[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map(String).join(' '))
    })
    const plan = createSamplePlan()
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <PlanCtx.Provider value={{ plan, update: () => undefined, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
            <Section />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    return { container, root, errors, spy }
  }

  const unknownSlug = (errors: string[]) => errors.filter((e) => e.includes('LearnLink: unknown article slug'))

  it('Strategy renders valid learn links with no unknown-slug errors', async () => {
    const { container, root, errors, spy } = await mountSection(StrategySection, '/plan/x/strategy')
    const links = Array.from(container.querySelectorAll('a.learn-link')) as HTMLAnchorElement[]
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((a) => (a.getAttribute('href') ?? '').startsWith('/learn/'))).toBe(true)
    expect(unknownSlug(errors)).toEqual([])
    await act(async () => root.unmount())
    container.remove()
    spy.mockRestore()
  })

  it('Spending renders contextual learn links and the screen cluster', async () => {
    const { container, root, errors, spy } = await mountSection(SpendingSection, '/plan/x/spending')
    const hrefs = Array.from(container.querySelectorAll('a.learn-link')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/learn/building-a-retirement-spending-budget')
    expect(hrefs).toContain('/learn/healthcare-before-65')
    expect(hrefs).toContain('/learn/healthcare-after-65')
    expect(hrefs).toContain('/learn/aca-premium-tax-credits-and-magi')
    expect(container.querySelector('.learn-screen')?.textContent).toContain('Learn about this screen')
    expect(unknownSlug(errors)).toEqual([])
    await act(async () => root.unmount())
    container.remove()
    spy.mockRestore()
  })

  it('Insurance renders contextual learn links and the screen cluster', async () => {
    const { container, root, errors, spy } = await mountSection(InsuranceSection, '/plan/x/insurance')
    const hrefs = Array.from(container.querySelectorAll('a.learn-link')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/learn/insurance-in-your-retirement-plan')
    expect(hrefs).toContain('/learn/permanent-life-insurance-in-a-plan')
    expect(hrefs).toContain('/learn/long-term-care-insurance-as-risk-transfer')
    expect(hrefs).toContain('/learn/long-term-care-costs-and-insurance')
    expect(container.querySelector('.learn-screen')?.textContent).toContain('Learn about this screen')
    expect(unknownSlug(errors)).toEqual([])
    await act(async () => root.unmount())
    container.remove()
    spy.mockRestore()
  })

  it('Assumptions renders valid learn links with no unknown-slug errors', async () => {
    const { container, root, errors, spy } = await mountSection(AssumptionsSection, '/plan/x/assumptions')
    expect(container.querySelectorAll('a.learn-link').length).toBeGreaterThan(0)
    expect(unknownSlug(errors)).toEqual([])
    await act(async () => root.unmount())
    container.remove()
    spy.mockRestore()
  })

  it('Household exposes the longevity planning-age learn link', async () => {
    const { container, root, errors, spy } = await mountSection(HouseholdSection, '/plan/x/household')
    const hrefs = Array.from(container.querySelectorAll('a.learn-link')).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/learn/assumption-longevity-planning-age')
    expect(unknownSlug(errors)).toEqual([])
    await act(async () => root.unmount())
    container.remove()
    spy.mockRestore()
  })
})

describe('PlanWorkspace information architecture', () => {
  it('renders Insights in the reorganized Optimize rail group without duplicate Social Security labels', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${sample.id}/insights`]}>
          <Routes>
            <Route path="/plan/:planId/*" element={<PlanWorkspace />}>
              <Route path="insights" element={<InsightsPage />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    })

    await waitFor(() => container.textContent?.includes('Insights & Recommendations') ?? false)

    const rail = container.querySelector('.workspace-rail')
    if (!rail) throw new Error('rail not rendered')
    const labels = Array.from(rail.querySelectorAll('a, .rail-group')).map((el) => el.textContent?.trim() ?? '')

    expect(labels).toContain('Enter')
    expect(labels).toContain('Optimize')
    expect(labels).toContain('Explore')
    expect(labels).toContain('Insights')
    expect(labels).toContain('Roth & Tax Optimizer')
    expect(labels).toContain('Social Security Optimizer')
    expect(labels.filter((label) => label === 'Social Security')).toHaveLength(1)
    // Exactly one h1 per plan page: the workspace's sr-only section heading.
    const h1s = Array.from(container.querySelectorAll('h1'))
    expect(h1s).toHaveLength(1)
    expect(h1s[0]!.textContent).toBe('Insights — Example couple')
    expect(h1s[0]!.classList.contains('sr-only')).toBe(true)
    expect(container.textContent).toContain('Insights & Recommendations')

    await act(async () => root.unmount())
    container.remove()
  })
})

describe('PlanProvider', () => {
  let container: HTMLDivElement
  let root: Root

  function Probe() {
    const { plan, update, saveState } = usePlan()
    return (
      <div>
        <span data-testid="name">{plan.name}</span>
        <span data-testid="state">{saveState}</span>
        <button
          data-testid="rename"
          onClick={() =>
            update((d) => {
              d.name = 'Renamed'
            })
          }
        />
        <button
          data-testid="break"
          onClick={() =>
            update((d) => {
              // invalid: filing status MFJ with one person
              d.household.filingStatus = 'marriedFilingJointly'
            })
          }
        />
      </div>
    )
  }

  async function mount(planId: string) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/plan/${planId}`]}>
          <Routes>
            <Route
              path="/plan/:planId"
              element={
                <PlanProvider planId={planId}>
                  <Probe />
                </PlanProvider>
              }
            />
          </Routes>
        </MemoryRouter>,
      )
    })
    await act(async () => {})
  }

  it('loads, edits, autosaves, and survives reload', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')
    await mount(sample.id)
    expect(container.querySelector('[data-testid="name"]')!.textContent).toBe('Example couple')

    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
      await settle()
    })
    expect(container.querySelector('[data-testid="state"]')!.textContent).toBe('saved')

    const reloaded = await loadPlan(sample.id)
    expect(reloaded.ok && reloaded.plan.name).toBe('Renamed')
    await act(async () => root.unmount())
  })

  it('flushes a pending edit to storage on pagehide (tab close)', async () => {
    const sample = createSamplePlan()
    const saved = await savePlan(sample)
    if (!saved.ok) throw new Error('seed save failed')
    await mount(sample.id)

    await act(async () => {
      ;(container.querySelector('[data-testid="rename"]') as HTMLButtonElement).click()
    })
    // Still inside the 600 ms debounce window: nothing persisted yet.
    let reloaded = await loadPlan(sample.id)
    expect(reloaded.ok && reloaded.plan.name).toBe('Example couple')

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
      await new Promise((r) => setTimeout(r, 50))
    })
    reloaded = await loadPlan(sample.id)
    expect(reloaded.ok && reloaded.plan.name).toBe('Renamed')
    expect(container.querySelector('[data-testid="state"]')!.textContent).toBe('saved')
    await act(async () => root.unmount())
  })

  it('keeps invalid edits on screen but does not persist them', async () => {
    const sample = createSamplePlan()
    // make it a single-person plan so the broken edit is reachable (via the real
    // remove-partner logic, which re-homes accounts/incomes/insurance)
    removePartner(sample, sample.household.people[1]!.id)
    const parsed = parsePlan(sample)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    await savePlan(parsed.plan)
    await mount(parsed.plan.id)

    await act(async () => {
      ;(container.querySelector('[data-testid="break"]') as HTMLButtonElement).click()
      await settle()
    })
    expect(container.querySelector('[data-testid="state"]')!.textContent).toBe('invalid')

    const reloaded = await loadPlan(parsed.plan.id)
    expect(reloaded.ok && reloaded.plan.household.filingStatus).toBe('single')
    await act(async () => root.unmount())
  })

  it('auto-seeds an example deep link that was never opened in this browser', async () => {
    // No prior seeding: a shared/bookmarked example URL must not dead-end.
    await mount('example:example-couple')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(container.querySelector('[data-testid="name"]')!.textContent).toBe('Example couple')
    const seeded = await loadPlan('example:example-couple')
    expect(seeded.ok && seeded.plan.origin).toBe('example')
    await act(async () => root.unmount())
  })

  it('shows a recoverable error state, not a raw enum, for a truly unknown plan', async () => {
    await mount('no-such-plan')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(container.textContent).toContain('Plan not found')
    // The enum reason is demoted to a technical-details disclosure, never headline copy.
    expect(container.querySelector('.empty-state > p')?.textContent ?? '').not.toContain('not_object')
    expect(container.querySelector('details')?.textContent).toContain('not_object')
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.textContent)
    expect(links).toContain('Your plans')
    expect(links).toContain('Browse examples')
    await act(async () => root.unmount())
  })
})
