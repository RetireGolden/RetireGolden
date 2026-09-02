/** @vitest-environment jsdom */
/**
 * Design-QA cluster E, rendered: the Duplicate prompt's cap and long-name tab
 * title (#533), the Learn search live region and clear button (#534), the
 * divorced-ex card while a partner is on the plan (#535), the plan-scoped
 * /compare and /import escape (#536), the How-tested nav token (#537), care
 * event ordinals (#541), account ordinals (#549), and policy grouping (#550).
 * Stylesheet pins for the same cluster are in designQa.clusterE.test.ts.
 */
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { IncomeStream, Plan } from '@retiregolden/engine/model/plan'
import { App } from '../App.tsx'
import type { PlanStore } from '../data/planStoreContext'
import { LearningCenterPage, SEARCH_ANNOUNCE_DELAY_MS } from '../learn/LearningCenterPage'
import { createSamplePlan } from '../testSupport/samplePlan'
import { LAZY_ROUTE_PRELOAD_TIMEOUT_MS, preloadLazyRoutes } from '../testSupport/lazyRoutes'
import { advanceBy, waitFor, waitForText } from '../testSupport/settle'
import { PromptDialog } from './dialogViews'
import { PlanCtx } from './planContextCore'
import { PLAN_NAME_MAX_LENGTH, PLAN_NAME_TITLE_MAX_LENGTH } from './planName'
import { AccountsSection, InsuranceSection } from './sections'
import { FormerSpousesEditor } from './SocialSecuritySection'

beforeAll(async () => {
  await preloadLazyRoutes('plan')
}, LAZY_ROUTE_PRELOAD_TIMEOUT_MS)

async function mount(node: ReactNode) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(node)
  })
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    },
  }
}

function storeFor(plan: Plan): PlanStore {
  return {
    listPlans: async () => [{ id: plan.id, name: plan.name, updatedAtIso: plan.updatedAtIso }],
    loadPlan: async (id) => (id === plan.id ? plan : null),
    savePlan: async () => undefined,
    deletePlan: async () => undefined,
  }
}

function mountApp(path: string, store: PlanStore, props: { importEnabled?: boolean } = {}) {
  return mount(
    <MemoryRouter initialEntries={[path]}>
      <App planStore={store} {...props} />
    </MemoryRouter>,
  )
}

/**
 * A section under a plan context whose `update` applies the mutator to a
 * clone and keeps it, so a test can see what a Remove button would remove
 * without a store.
 */
function mountSection(Section: () => ReactNode, plan: Plan, path: string) {
  const drafts: Plan[] = []
  const update = (mutator: (draft: Plan) => void) => {
    const draft = structuredClone(plan)
    mutator(draft)
    drafts.push(draft)
  }
  return {
    drafts,
    mounted: mount(
      <MemoryRouter initialEntries={[path]}>
        <PlanCtx.Provider value={{ plan, update, discardPendingSave: () => undefined, saveState: 'saved', issues: [] }}>
          <Section />
        </PlanCtx.Provider>
      </MemoryRouter>,
    ),
  }
}

async function typeInto(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const rowTitles = (container: HTMLElement, selector: string) =>
  [...container.querySelectorAll<HTMLElement>(selector)].map((row) => row.querySelector('.item-row-title')!.textContent)
const removeLabels = (container: HTMLElement, selector: string) =>
  [...container.querySelectorAll<HTMLElement>(selector)].map((row) =>
    [...row.querySelectorAll('button')].find((b) => b.textContent === 'Remove')!.getAttribute('aria-label'),
  )

describe('Duplicate prompt and long plan names (#533)', () => {
  it('caps the prompt input at the plan-name limit', async () => {
    const onResult = vi.fn()
    const { container, unmount } = await mount(
      <PromptDialog
        opts={{ title: 'Duplicate plan', label: 'Name', defaultValue: 'Copy of X', maxLength: PLAN_NAME_MAX_LENGTH }}
        onResult={onResult}
      />,
    )
    const input = document.querySelector<HTMLInputElement>('.modal-panel input[type="text"]')!
    expect(input.getAttribute('maxlength')).toBe(String(PLAN_NAME_MAX_LENGTH))
    expect(input.value).toBe('Copy of X')
    // Emptying the box and confirming hands back '' (the handlers turn that
    // into the clamped default, see duplicateNameFor); it is not a cancel.
    await typeInto(input, '')
    await act(async () => {
      container.querySelector('form')!.requestSubmit()
    })
    expect(onResult).toHaveBeenCalledWith('')
    await unmount()
  })

  it('shortens a long plan name in the tab title; a stored name past the cap can be edited but not lengthened', async () => {
    const plan = createSamplePlan()
    plan.name = `${'Long name '.repeat(19)}end`
    expect(plan.name.length).toBeGreaterThan(PLAN_NAME_MAX_LENGTH)
    const { container, unmount } = await mountApp(`/plan/${plan.id}/household`, storeFor(plan))
    await waitFor(() => document.title.startsWith('Household · '), { what: 'the workspace title' })
    expect(document.title).toBe(`Household · ${plan.name.slice(0, PLAN_NAME_TITLE_MAX_LENGTH).trimEnd()}… · RetireGolden`)
    const nameInput = container.querySelector<HTMLInputElement>('.plan-name-input')!
    // A name already past the cap is not capped at 120 (the first keystroke
    // must not persist it truncated) but at its own length, so it can be
    // edited or shortened and never grow. The stored name is untouched: the
    // breadcrumb crumb and the input carry it whole (its truncation is
    // cluster A's #501 rule, pinned in designQa.clusterA.test.ts).
    expect(nameInput.getAttribute('maxlength')).toBe(String(plan.name.length))
    expect(nameInput.value).toBe(plan.name)
    expect(container.querySelector('.workspace-breadcrumb [aria-current="page"]')!.textContent).toBe(plan.name)
    await unmount()
  })

  it('caps the header name input for a name within the cap', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountApp(`/plan/${plan.id}/household`, storeFor(plan))
    await waitFor(() => document.title.startsWith('Household · '), { what: 'the workspace title' })
    expect(container.querySelector('.plan-name-input')!.getAttribute('maxlength')).toBe(String(PLAN_NAME_MAX_LENGTH))
    await unmount()
  })
})

describe('Learn search (#534)', () => {
  it('announces the result count, names the controlled region, and clears from a real button', async () => {
    const { container, unmount } = await mount(
      <MemoryRouter initialEntries={['/learn']}>
        <LearningCenterPage />
      </MemoryRouter>,
    )
    const input = container.querySelector<HTMLInputElement>('.learn-search-input')!
    const status = container.querySelector<HTMLElement>('[role="status"]')!
    const settle = () => advanceBy(SEARCH_ANNOUNCE_DELAY_MS + 50)
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toBe('')
    // The controlled region exists whether or not a query is typed.
    const controlled = document.getElementById(input.getAttribute('aria-controls')!)!
    expect(controlled).not.toBeNull()
    expect(container.contains(controlled)).toBe(true)
    expect(container.querySelector('.learn-search-clear')).toBeNull()
    // Idle: no button, and no modifier reserving room for one.
    const box = container.querySelector('.learn-search')!
    expect(box.classList.contains('learn-search--has-query')).toBe(false)

    // Spaces alone are not a query: no results, no button, no reserved room.
    await typeInto(input, '   ')
    expect(box.classList.contains('learn-search--has-query')).toBe(false)
    expect(container.querySelector('.learn-search-clear')).toBeNull()
    expect(controlled.querySelector('section[aria-label="Browse by category"]')).not.toBeNull()
    await settle()
    expect(status.textContent).toBe('')

    await typeInto(input, 'zzzz-no-such-topic')
    // The heading follows at once; the live region waits for the query to rest.
    expect(controlled.querySelector('h2')!.textContent).toBe('0 results for “zzzz-no-such-topic”')
    expect(status.textContent).toBe('')
    await settle()
    expect(status.textContent).toBe('0 results for “zzzz-no-such-topic”')

    // Mid-word values are never spoken: 'ro' is replaced before it rests.
    await typeInto(input, 'ro')
    await typeInto(input, 'roth')
    await settle()
    expect(status.textContent).toMatch(/^\d+ results? for “roth”$/)
    expect(controlled.querySelector('section[aria-label="Search results"]')).not.toBeNull()

    expect(box.classList.contains('learn-search--has-query')).toBe(true)
    const clear = container.querySelector<HTMLButtonElement>('button.learn-search-clear')!
    expect(clear.getAttribute('aria-label')).toBe('Clear search')
    expect(clear.getAttribute('type')).toBe('button')
    await act(async () => clear.click())
    expect(input.value).toBe('')
    await settle()
    expect(status.textContent).toBe('')
    expect(document.activeElement).toBe(input)
    expect(container.querySelector('.learn-search-clear')).toBeNull()
    expect(box.classList.contains('learn-search--has-query')).toBe(false)
    expect(controlled.querySelector('section[aria-label="Browse by category"]')).not.toBeNull()
    await unmount()
  })
})

describe('Former spouses (#535)', () => {
  type SsStream = Extract<IncomeStream, { type: 'socialSecurity' }>
  function streamWith(records: NonNullable<SsStream['formerSpouses']>): SsStream {
    const plan = createSamplePlan()
    const stream = structuredClone(plan.incomes.find((s): s is SsStream => s.type === 'socialSecurity')!)
    stream.formerSpouses = records
    return stream
  }
  const divorced = (id: string, marriageYears = 12) => ({
    id,
    relationship: 'divorced' as const,
    dob: '1960-01-01',
    piaMonthly: 2_000,
    marriageYears,
    remarriedAtAge: null,
  })

  it('marks a divorced-ex record not applied while a partner is on the plan and disables its amounts', async () => {
    const stream = streamWith([divorced('ex-1')])
    const { container, unmount } = await mount(
      <FormerSpousesEditor stream={stream} setStream={() => undefined} householdIsSingle={false} />,
    )
    const row = container.querySelector<HTMLElement>('.item-row')!
    expect(row.querySelector('.item-row-title')!.textContent).toContain('Not applied')
    const note = row.querySelector<HTMLElement>('#former-spouse-ex-1-partner-note')!
    expect(note.textContent).toContain("it won't apply")
    // Twelve years married: the ten-year note has no reason to show.
    expect(row.querySelector('#former-spouse-ex-1-years-note')).toBeNull()
    const byLabel = (label: string) =>
      [...row.querySelectorAll('label')].find((l) => l.textContent === label)!.control as HTMLInputElement | HTMLSelectElement
    for (const label of ['Their date of birth', 'Their PIA (monthly at FRA)', 'Years married']) {
      const control = byLabel(label)
      expect(control.disabled, `${label} disabled`).toBe(true)
      expect(control.getAttribute('aria-describedby'), `${label} described by the note`).toContain(note.id)
    }
    // The type select stays live so the record can be changed, and it is
    // described by the same note; the card can still be removed.
    const type = byLabel('Type')
    expect(type.disabled).toBe(false)
    expect(type.getAttribute('aria-describedby')).toContain(note.id)
    expect([...row.querySelectorAll('button')].some((b) => b.textContent === 'Remove')).toBe(true)
    await unmount()
  })

  it('keeps the record live on a single plan and discloses a marriage under the ten-year floor', async () => {
    const stream = streamWith([divorced('ex-1', 1)])
    const { container, unmount } = await mount(
      <FormerSpousesEditor stream={stream} setStream={() => undefined} householdIsSingle />,
    )
    const row = container.querySelector<HTMLElement>('.item-row')!
    expect(row.querySelector('.item-row-title')!.textContent).not.toContain('Not applied')
    const years = [...row.querySelectorAll('label')].find((l) => l.textContent === 'Years married')!.control as HTMLInputElement
    expect(years.disabled).toBe(false)
    const note = row.querySelector<HTMLElement>('#former-spouse-ex-1-years-note')!
    expect(note.textContent).toContain('10 or more years')
    expect(years.getAttribute('aria-describedby')).toContain(note.id)
    expect(row.querySelector('#former-spouse-ex-1-partner-note')).toBeNull()
    await unmount()
  })

  it('shows both notes, and describes the fields by both, when a partnered record is also under the floor', async () => {
    const stream = streamWith([divorced('ex-1', 4)])
    const { container, unmount } = await mount(
      <FormerSpousesEditor stream={stream} setStream={() => undefined} householdIsSingle={false} />,
    )
    const row = container.querySelector<HTMLElement>('.item-row')!
    const partner = row.querySelector<HTMLElement>('#former-spouse-ex-1-partner-note')!
    const floor = row.querySelector<HTMLElement>('#former-spouse-ex-1-years-note')!
    expect(partner.textContent).toContain("it won't apply")
    expect(floor.textContent).toContain('10 or more years')
    const years = [...row.querySelectorAll('label')].find((l) => l.textContent === 'Years married')!.control as HTMLInputElement
    expect(years.disabled).toBe(true)
    expect(years.getAttribute('aria-describedby')!.split(' ')).toEqual([partner.id, floor.id])
    await unmount()
  })

  it('numbers two records of the same kind', async () => {
    const stream = streamWith([divorced('ex-1'), divorced('ex-2')])
    const { container, unmount } = await mount(
      <FormerSpousesEditor stream={stream} setStream={() => undefined} householdIsSingle />,
    )
    expect(rowTitles(container, '.item-row')).toEqual(['Divorced ex(1)', 'Divorced ex(2)'])
    expect(removeLabels(container, '.item-row')).toEqual(['Remove divorced ex record (1)', 'Remove divorced ex record (2)'])
    await unmount()
  })
})

describe('Plan-scoped site-level paths (#536)', () => {
  it('offers the site-level destination from /plan/:id/compare and /plan/:id/import', async () => {
    const plan = createSamplePlan()
    for (const [segment, label, to] of [
      ['compare', 'Compare plans', '/compare'],
      ['import', 'Import & migrate', '/import'],
    ] as const) {
      const { container, unmount } = await mountApp(`/plan/${plan.id}/${segment}`, storeFor(plan))
      await waitForText(container, 'This plan has no such section')
      const escape = [...container.querySelectorAll('a')].find((a) => a.textContent === `Go to ${label}`)!
      expect(escape.getAttribute('href')).toBe(to)
      expect(escape.className).toContain('btn-primary')
      expect(container.textContent).toContain(`${label} is not a section of this plan`)
      // The way back into the plan is still offered.
      const household = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Go to Household')!
      expect(household.getAttribute('href')).toBe(`/plan/${plan.id}/household`)
      await unmount()
    }
  })

  it('withholds the import escape while the host has import switched off', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountApp(`/plan/${plan.id}/import`, storeFor(plan), { importEnabled: false })
    await waitForText(container, 'This plan has no such section')
    expect([...container.querySelectorAll('a')].some((a) => a.textContent === 'Go to Import & migrate')).toBe(false)
    expect(container.textContent).not.toContain('is not a section of this plan')
    const household = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Go to Household')!
    expect(household.className).toContain('btn-primary')
    await unmount()
  })

  it('keeps the plain not-found copy for a segment with no site-level twin', async () => {
    const plan = createSamplePlan()
    const { container, unmount } = await mountApp(`/plan/${plan.id}/healthcare`, storeFor(plan))
    await waitForText(container, 'This plan has no such section')
    expect([...container.querySelectorAll('a')].some((a) => a.textContent?.startsWith('Go to Compare'))).toBe(false)
    const household = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Go to Household')!
    expect(household.className).toContain('btn-primary')
    await unmount()
  })
})

describe('Primary nav on /how-tested and /disclaimer (#537)', () => {
  it('uses aria-current=location on How-tested and page on Disclaimer itself', async () => {
    const plan = createSamplePlan()
    for (const [path, token] of [
      ['/how-tested', 'location'],
      ['/disclaimer', 'page'],
    ] as const) {
      const { container, unmount } = await mountApp(path, storeFor(plan))
      const links = [...container.querySelectorAll('nav[aria-label="Primary"] a')]
      const current = links.filter((a) => a.hasAttribute('aria-current'))
      expect(current.map((a) => [a.textContent, a.getAttribute('aria-current')])).toEqual([['Disclaimer', token]])
      expect(current[0]!.className).toContain('nav-link--active')
      await unmount()
    }
  })
})

describe('Insurance cards (#541, #550)', () => {
  it('groups policies by kind in the add-button order while edits and Remove keep their stored index', async () => {
    const plan = createSamplePlan()
    const perm = (id: string, name: string) =>
      ({ kind: 'permanentLife', id, name, insured: plan.household.people[0]!.id, beneficiary: 'estate', annualPremium: 0, premiumMode: 'lifetime', deathBenefit: 0, cashValue: 0, cashValueMode: 'flatRate', cashValueGrowthPct: 4 }) as const
    plan.insurance = [
      perm('perm-a', 'Whole life A'),
      { kind: 'ltc', id: 'ltc-b', name: 'LTC policy', owner: plan.household.people[0]!.id, annualPremium: 0, premiumMode: 'lifetime', benefitMonthly: 0, benefitPeriodYears: 3, eliminationPeriodDays: 90 },
      perm('perm-c', 'Whole life C'),
    ]
    const { drafts, mounted } = mountSection(InsuranceSection, plan, '/plan/x/insurance')
    const { container, unmount } = await mounted
    const rows = [...container.querySelectorAll<HTMLElement>('[data-testid="insurance-row"]')]
    expect(rows.map((r) => r.dataset.insuranceKind)).toEqual(['permanentLife', 'permanentLife', 'ltc'])
    expect(rowTitles(container, '[data-testid="insurance-row"]')).toEqual([
      'Permanent lifeWhole life A',
      'Permanent lifeWhole life C',
      'Long-term careLTC policy',
    ])
    // Remove on the displayed third card removes the LTC policy, stored second.
    const remove = [...rows[2]!.querySelectorAll('button')].find((b) => b.textContent === 'Remove')!
    await act(async () => remove.click())
    expect(drafts.at(-1)!.insurance.map((p) => p.id)).toEqual(['perm-a', 'perm-c'])
    await unmount()
  })

  it('numbers care events that share a person and start age, in the title and the Remove name', async () => {
    const plan = createSamplePlan()
    const personId = plan.household.people[0]!.id
    const personName = plan.household.people[0]!.name
    plan.careEvents = [
      { id: 'care-1', personId, startAge: 85, durationYears: 3, annualCost: 90_000 },
      { id: 'care-2', personId, startAge: 85, durationYears: 2, annualCost: 60_000 },
      { id: 'care-3', personId, startAge: 80, durationYears: 2, annualCost: 60_000 },
    ]
    const { mounted } = mountSection(InsuranceSection, plan, '/plan/x/insurance')
    const { container, unmount } = await mounted
    expect(rowTitles(container, '[data-testid="care-event-row"]')).toEqual([
      `Care${personName} · age 85 (1)`,
      `Care${personName} · age 85 (2)`,
      `Care${personName} · age 80`,
    ])
    expect(
      [...container.querySelectorAll('[data-testid="care-event-row"] .item-row-title > :last-child')].map((el) => el.textContent),
    ).toEqual([`${personName} · age 85 (1)`, `${personName} · age 85 (2)`, `${personName} · age 80`])
    expect(removeLabels(container, '[data-testid="care-event-row"]')).toEqual([
      `Remove care event ${personName} · age 85 (1)`,
      `Remove care event ${personName} · age 85 (2)`,
      `Remove care event ${personName} · age 80`,
    ])
    await unmount()
  })
})

describe('Account cards (#549)', () => {
  it('numbers sibling accounts that share a type and name, in the title and the Remove name', async () => {
    const plan = createSamplePlan()
    plan.accounts = [
      { type: 'debt', id: 'debt-1', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 1, interestPct: 5, monthlyPayment: 0 },
      { type: 'property', id: 'home-1', name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 1, plannedSaleYear: null, expectedNetProceeds: null },
      { type: 'debt', id: 'debt-2', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 1, interestPct: 5, monthlyPayment: 0 },
    ]
    const { drafts, mounted } = mountSection(AccountsSection, plan, '/plan/x/accounts')
    const { container, unmount } = await mounted
    expect(rowTitles(container, '[data-testid="account-row"]')).toEqual(['DebtMortgage (1)', 'PropertyHome', 'DebtMortgage (2)'])
    // The name and its ordinal are one inline box after the chip, not two
    // flex items with a gap between them.
    expect(
      [...container.querySelectorAll('[data-testid="account-row"] .item-row-title > :last-child')].map((el) => el.textContent),
    ).toEqual(['Mortgage (1)', 'Home', 'Mortgage (2)'])
    expect(removeLabels(container, '[data-testid="account-row"]')).toEqual([
      'Remove Debt Mortgage (1)',
      'Remove Property Home',
      'Remove Debt Mortgage (2)',
    ])
    // The stored names are untouched, and Remove on the second Mortgage removes that one.
    expect(plan.accounts.map((a) => a.name)).toEqual(['Mortgage', 'Home', 'Mortgage'])
    const rows = [...container.querySelectorAll<HTMLElement>('[data-testid="account-row"]')]
    const remove = [...rows[2]!.querySelectorAll('button')].find((b) => b.textContent === 'Remove')!
    await act(async () => remove.click())
    expect(drafts.at(-1)!.accounts.map((a) => a.id)).toEqual(['debt-1', 'home-1'])
    await unmount()
  })
})
