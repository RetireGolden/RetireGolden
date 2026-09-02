/** @vitest-environment jsdom */
/**
 * Markup half of Design-QA cluster C. The CSS pins live in
 * designQa.clusterC.test.ts; these cover what a stylesheet pin cannot: which
 * container a field sits in (#465, #477), which row still carries a Remove
 * (#462), that a checkbox field has the two-child shape the form-grid
 * subgrids (#467, #473), that two surfaces share one label (#511), and that a
 * derived panel pauses instead of going stale while the entries it prices are
 * invalid (#489, #512, #517).
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'

import { createSamplePlan } from '../testSupport/samplePlan'
import { MonteCarloPage } from './MonteCarloPage'
import { PlanCtx } from './planContextCore'
import { SocialSecuritySection } from './SocialSecuritySection'
import { HouseholdSection } from './sections/HouseholdSection'
import { IncomeFloorSection } from './sections/IncomeFloorSection'
import { IncomeSection } from './sections/IncomeSection'
import { InsuranceSection } from './sections/InsuranceSection'
import { SpendingSection } from './sections/SpendingSection'
import { StrategySection } from './sections/StrategySection'

// Monte Carlo auto-runs after a debounce; keep that run tiny (the existing
// downside-copy test's arrangement) so the page mounts fast.
vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return { ...original, runMonteCarlo: vi.fn(original.runMonteCarlo) }
})
import * as pool from '../mc/pool'
const actualPool = await vi.importActual<typeof import('../mc/pool')>('../mc/pool')

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
  vi.restoreAllMocks()
})

function validPlan(mutate?: (plan: Plan) => void): Plan {
  const plan = createSamplePlan()
  mutate?.(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

/** Mounts `child` under a live plan context whose `update` re-renders, like the workspace does. */
async function mount(initialPlan: Plan, child: React.ReactNode, issues: string[] = []) {
  function Harness() {
    const [plan, setPlan] = useState(initialPlan)
    return (
      <PlanCtx.Provider
        value={{
          plan,
          update: (mutator) =>
            setPlan((previous) => {
              const next = structuredClone(previous)
              mutator(next)
              return next
            }),
          discardPendingSave: () => undefined,
          saveState: issues.length > 0 ? 'invalid' : 'saved',
          issues,
        }}
      >
        {child}
      </PlanCtx.Provider>
    )
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root!.render(<MemoryRouter><Harness /></MemoryRouter>))
  return container
}

function fieldLabelled(host: HTMLElement, text: string): HTMLElement {
  const label = [...host.querySelectorAll<HTMLElement>('.field-label')].find((l) => l.textContent?.trim() === text)
  if (!label) throw new Error(`no field labelled "${text}"`)
  const field = label.closest<HTMLElement>('.field')
  if (!field) throw new Error(`"${text}" is not inside a .field`)
  return field
}

function itemRowTitled(host: HTMLElement, chip: string, title: string): HTMLElement {
  const row = [...host.querySelectorAll<HTMLElement>('.item-row')].find((r) => {
    const t = r.querySelector('.item-row-title')
    return t?.querySelector('.type-chip')?.textContent === chip && t?.textContent?.includes(title)
  })
  if (!row) throw new Error(`no ${chip} row titled "${title}"`)
  return row
}

describe('Spending (#465)', () => {
  it('the custom-shape percent field is a form-grid cell, with its action in an add-row below', async () => {
    const host = await mount(validPlan(), <SpendingSection />)
    const field = fieldLabelled(host, 'Custom real change per year')
    expect(field.parentElement?.classList.contains('form-grid'), 'field sits in a form-grid').toBe(true)
    expect(field.closest('.add-row'), 'no longer an intrinsic-width flex child').toBeNull()
    const apply = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Apply custom shape')!
    expect(apply.parentElement?.classList.contains('add-row')).toBe(true)
    // Every field on the page is a form-grid cell now: no .field is a direct
    // child of a flex add-row.
    expect(host.querySelectorAll('.add-row > .field')).toHaveLength(0)
  })
})

describe('Strategy (#477)', () => {
  it('the Roth conversion Mode select takes the full form row, like the Spending policy select', async () => {
    const host = await mount(validPlan(), <StrategySection />)
    const mode = [...host.querySelectorAll<HTMLElement>('label.field-label')].find((l) => l.textContent === 'Mode')!
    const field = mode.closest<HTMLElement>('.field')!
    expect(field.parentElement?.classList.contains('field-span-full')).toBe(true)
    expect(field.parentElement?.parentElement?.classList.contains('form-grid')).toBe(true)
    const select = field.querySelector('select')!
    expect(select.title).toBe([...select.options].find((o) => o.selected)?.label)
  })
})

describe('Income (#462)', () => {
  it('Social Security rows carry no Remove; wage rows keep theirs', async () => {
    const plan = validPlan()
    const host = await mount(plan, <IncomeSection />)
    const ssRows = [...host.querySelectorAll<HTMLElement>('.item-row')].filter(
      (r) => r.querySelector('.type-chip')?.textContent === 'Social Security',
    )
    expect(ssRows.length).toBeGreaterThan(0)
    for (const row of ssRows) {
      expect([...row.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Remove')
      // The copy that names where the stream is managed stays with the row.
      expect(row.textContent).toContain('managed on the')
    }
    const wageRows = [...host.querySelectorAll<HTMLElement>('.item-row')].filter(
      (r) => r.querySelector('.type-chip')?.textContent === 'Wages',
    )
    expect(wageRows.length).toBeGreaterThan(0)
    for (const row of wageRows) {
      expect([...row.querySelectorAll('button')].map((b) => b.textContent)).toContain('Remove')
    }
  })
})

describe('Household MFJ (#467)', () => {
  it('the survivor-dependent checkbox is a two-child checkbox field in the Filing status row', async () => {
    const plan = validPlan((p) => {
      p.household.filingStatus = 'marriedFilingJointly'
    })
    expect(plan.household.people).toHaveLength(2)
    const host = await mount(plan, <HouseholdSection />)
    const field = fieldLabelled(host, 'Survivor has a dependent')
    expect(field.classList.contains('field--checkbox')).toBe(true)
    // Label row + control, nothing else: the shape the form-grid subgrids so
    // the box shares the row's control track with the two selects.
    expect(field.children).toHaveLength(2)
    expect(field.children[0]!.classList.contains('field-label-row')).toBe(true)
    expect(field.children[1]).toBeInstanceOf(HTMLInputElement)
    expect((field.children[1] as HTMLInputElement).type).toBe('checkbox')
    const grid = field.parentElement!
    expect(grid.classList.contains('form-grid')).toBe(true)
    expect(fieldLabelled(host, 'Filing status').parentElement).toBe(grid)
    expect(fieldLabelled(host, 'State (starting residence)').parentElement).toBe(grid)
  })
})

describe('Monte Carlo model controls (#473)', () => {
  it('Model longevity and Model an LTC shock are shared checkbox fields in the model-controls grid', async () => {
    vi.mocked(pool.runMonteCarlo).mockImplementation((plan, opts) =>
      actualPool.runMonteCarlo(plan, { ...opts, pathCount: 8 }),
    )
    const host = await mount(validPlan(), <MonteCarloPage />)
    const grid = fieldLabelled(host, 'Market draw').parentElement!
    expect(grid.classList.contains('form-grid')).toBe(true)
    for (const text of ['Model longevity', 'Model an LTC shock']) {
      const field = fieldLabelled(host, text)
      expect(field.parentElement, `${text} shares the model-controls grid`).toBe(grid)
      expect(field.classList.contains('field--checkbox')).toBe(true)
      expect(field.children).toHaveLength(2)
      const box = field.children[1] as HTMLInputElement
      expect(box.type).toBe('checkbox')
      // The label is a real <label for>, so the text still toggles the box.
      const label = field.querySelector<HTMLLabelElement>('label.field-label')!
      expect(label.htmlFor).toBe(box.id)
      // No helper paragraph under the box; the one-liner rides in the ⓘ bubble.
      expect(field.querySelector('.field-hint')).toBeNull()
      expect(field.querySelector('.help-tip-hint')).not.toBeNull()
    }
    expect(grid.querySelector('.radio-option')).toBeNull()
  })
})

describe('Social Security (#511)', () => {
  it('the quick PIA field carries the same label as the Income summary card', async () => {
    const plan = validPlan()
    const ssHost = await mount(plan, <SocialSecuritySection />)
    const piaLabels = [...ssHost.querySelectorAll<HTMLElement>('label.field-label')]
      .map((l) => l.textContent?.trim())
      .filter((t) => t?.startsWith('PIA'))
    expect(piaLabels.length).toBeGreaterThan(0)
    for (const text of piaLabels) expect(text).toBe('PIA (monthly at FRA)')
    await act(async () => root!.unmount())
    root = null
    container?.remove()
    const incomeHost = await mount(plan, <IncomeSection />)
    const summaryLabels = [...incomeHost.querySelectorAll<HTMLElement>('.field-label')]
      .map((l) => l.textContent?.trim())
      .filter((t) => t?.startsWith('PIA'))
    expect(summaryLabels.length).toBeGreaterThan(0)
    for (const text of summaryLabels) expect(text).toBe('PIA (monthly at FRA)')
  })
})

describe('Insurance care events (#489)', () => {
  it('a second + Care event lands on the partner, and repeats are named', async () => {
    const plan = validPlan()
    const [primary, partner] = plan.household.people
    const host = await mount(plan, <InsuranceSection />)
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(0)
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Care event')!
    await act(async () => add.click())
    // One Care row per person, no duplicate warning.
    expect(itemRowTitled(host, 'Care', `${partner!.name} · age 85`)).toBeTruthy()
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(0)
    // Everyone has one now, so the third lands on the primary again. The
    // example couple's own event starts at 88, so an 85 is a second episode,
    // not a repeat...
    await act(async () => add.click())
    expect(itemRowTitled(host, 'Care', `${primary!.name} · age 85`)).toBeTruthy()
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(0)
    // ...and a fourth repeats that 85: name it, once.
    await act(async () => add.click())
    const warnings = [...host.querySelectorAll('.callout--warn')]
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.textContent).toContain(`${primary!.name} has more than one care event starting at age 85`)
  })

  it('the stress copy pluralises with two care events', async () => {
    const one = await mount(validPlan(), <InsuranceSection />)
    expect(one.textContent).toContain('if the care episode happens')
    expect(one.textContent).toContain('Unprotected, the care episode would cost')
    await act(async () => root!.unmount())
    root = null
    container?.remove()
    const two = await mount(
      validPlan((p) => {
        p.careEvents.push({ ...p.careEvents[0]!, id: 'second-care', personId: p.household.people[1]!.id })
      }),
      <InsuranceSection />,
    )
    expect(two.textContent).toContain('if the care episodes happen')
    expect(two.textContent).toContain('Unprotected, the care episodes would cost')
    // The example couple holds two LTC policies, so the offset sentence is plural too.
    expect(two.textContent).toMatch(/Your LTC policies improve|policies' lifetime premiums outweigh their/)
  })

  it('a new illustration-schedule row opens at the next age, and repeats are named', async () => {
    const plan = validPlan((p) => {
      const life = p.insurance.find((i) => i.kind === 'permanentLife')!
      if (life.kind === 'permanentLife') {
        life.cashValueMode = 'schedule'
        life.cashValueSchedule = [{ age: 65, value: 90_000 }]
      }
    })
    const host = await mount(plan, <InsuranceSection />)
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Schedule row')!
    await act(async () => add.click())
    const ages = [...host.querySelectorAll<HTMLLabelElement>('label.field-label')]
      .filter((l) => l.textContent === 'Age')
      .map((l) => host.querySelector<HTMLInputElement>(`[id="${l.htmlFor}"]`)!.value)
    expect(ages).toEqual(['65', '66'])
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(0)
  })

  it('names a repeated schedule age', async () => {
    const plan = validPlan((p) => {
      const life = p.insurance.find((i) => i.kind === 'permanentLife')!
      if (life.kind === 'permanentLife') {
        life.cashValueMode = 'schedule'
        life.cashValueSchedule = [{ age: 65, value: 0 }, { age: 65, value: 0 }]
      }
    })
    const host = await mount(plan, <InsuranceSection />)
    const warnings = [...host.querySelectorAll('.callout--warn')]
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.textContent).toContain('Age 65 appears more than once')
  })
})

describe('Insurance LTC stress (#517)', () => {
  it('pauses while a care event or policy entry is invalid, instead of showing the last table', async () => {
    const plan = validPlan()
    const live = await mount(plan, <InsuranceSection />)
    expect(live.querySelector('table.compare-table')).not.toBeNull()
    await act(async () => root!.unmount())
    root = null
    container?.remove()
    const paused = await mount(plan, <InsuranceSection />, ['careEvents.0.durationYears: Invalid input'])
    expect(paused.querySelector('table.compare-table')).toBeNull()
    expect(paused.textContent).toContain('LTC stress test')
    expect(paused.textContent).toContain('Paused: a care event or policy entry above is invalid')
    expect(paused.textContent).not.toContain('Unprotected, the care episode')
  })

  it('keeps running under an issue elsewhere in the plan', async () => {
    const host = await mount(validPlan(), <InsuranceSection />, ['expenses.baseAnnual: Invalid input'])
    expect(host.querySelector('table.compare-table')).not.toBeNull()
  })
})

describe('Income floor (#512)', () => {
  function ladderPlan(): Plan {
    return validPlan((p) => {
      p.incomeFloor = {
        ladders: [
          {
            id: 'ladder-c',
            name: 'Floor ladder',
            purpose: 'floor',
            startYear: new Date().getFullYear() + 1,
            endYear: new Date().getFullYear() + 10,
            annualRealAmount: 12_000,
          },
        ],
      }
    })
  }

  it('quotes a valid ladder and shows the funded ratio', async () => {
    const host = await mount(ladderPlan(), <IncomeFloorSection />)
    expect(host.textContent).toContain('Quoted cost')
    expect(host.querySelector('.stat-grid')).not.toBeNull()
    expect(host.textContent).not.toContain('Paused')
  })

  it('pauses the quote and the funded ratio while the ladder is invalid, not the empty-state hint', async () => {
    const host = await mount(ladderPlan(), <IncomeFloorSection />, [
      'incomeFloor.ladders.0.endYear: a ladder must end in or after its first payout year',
    ])
    expect(host.textContent).toContain('Quote paused')
    expect(host.textContent).not.toContain('Quoted cost')
    expect(host.textContent).not.toContain('Set an amount and a payout window')
    expect(host.textContent).toContain('Paused: a TIPS ladder entry is invalid')
    expect(host.querySelector('.stat-grid')).toBeNull()
    // The card and its explanation stay; only the readout pauses.
    expect(host.textContent).toContain('Funded ratio')
  })

  it('a different ladder\'s issue leaves this ladder quoted', async () => {
    const host = await mount(ladderPlan(), <IncomeFloorSection />, [
      'incomeFloor.ladders.1.endYear: a ladder must end in or after its first payout year',
    ])
    expect(host.textContent).toContain('Quoted cost')
    // The ratio prices every ladder, so it pauses on any ladder issue.
    expect(host.querySelector('.stat-grid')).toBeNull()
  })
})
