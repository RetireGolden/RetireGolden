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

// The funded-ratio pause must not depend on the projection at all: one test
// makes the projection hook throw, the way an invalid draft can.
const projectionThrows = { on: false }
vi.mock('./useProjection', async (importOriginal) => {
  const original = await importOriginal<typeof import('./useProjection')>()
  return {
    ...original,
    useProjection: (...args: Parameters<typeof original.useProjection>) => {
      if (projectionThrows.on) throw new Error('simulatePlan refused the draft')
      return original.useProjection(...args)
    },
  }
})

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
    const field = fieldLabelled(host, 'Qualifying surviving spouse')
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
    // Scoped to this test: restored in its own finally, not only by afterEach.
    const mocked = vi.mocked(pool.runMonteCarlo)
    mocked.mockImplementation((plan, opts) => actualPool.runMonteCarlo(plan, { ...opts, pathCount: 8 }))
    try {
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
    } finally {
      mocked.mockRestore()
    }
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
  it('+ Care event never repeats a person + age: partner first, then the primary at a free age', async () => {
    const plan = validPlan()
    const [primary, partner] = plan.household.people
    const host = await mount(plan, <InsuranceSection />)
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(0)
    const add = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Care event')!
    await act(async () => add.click())
    expect(itemRowTitled(host, 'Care', `${partner!.name} · age 85`)).toBeTruthy()
    // Everyone has one now, so the next lands on the primary again. Their
    // example event starts at 88, so 85 is free...
    await act(async () => add.click())
    expect(itemRowTitled(host, 'Care', `${primary!.name} · age 85`)).toBeTruthy()
    // ...and the one after opens past their latest (88), not at 85 again.
    await act(async () => add.click())
    expect(itemRowTitled(host, 'Care', `${primary!.name} · age 89`)).toBeTruthy()
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(0)
  })

  it('names repeated events with their count, without promising a live stress test', async () => {
    const two = await mount(
      validPlan((p) => {
        const first = p.careEvents[0]!
        p.careEvents.push({ ...first, id: 'dupe-1' })
      }),
      <InsuranceSection />,
    )
    const primaryName = createSamplePlan().household.people[0]!.name
    const warnings = [...two.querySelectorAll('.callout--warn')]
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.textContent).toContain(`${primaryName} has 2 care events starting at age 88`)
    expect(warnings[0]!.textContent).toContain('All 2 count toward the care cost the stress test prices when it runs')
    await act(async () => root!.unmount())
    root = null
    container?.remove()
    const three = await mount(
      validPlan((p) => {
        const first = p.careEvents[0]!
        p.careEvents.push({ ...first, id: 'dupe-1' }, { ...first, id: 'dupe-2' })
      }),
      <InsuranceSection />,
    )
    const again = [...three.querySelectorAll('.callout--warn')]
    expect(again).toHaveLength(1)
    expect(again[0]!.textContent).toContain(`${primaryName} has 3 care events starting at age 88`)
    expect(again[0]!.textContent).toContain('All 3 count toward')
    expect(again[0]!.textContent).toContain('remove the extras if they were added by mistake')
  })

  it('warns once per person even when two people share a name', async () => {
    const plan = validPlan((p) => {
      const [primary, partner] = p.household.people
      partner!.name = primary!.name
      const first = p.careEvents[0]!
      p.careEvents.push(
        { ...first, id: 'p-dupe' },
        { ...first, id: 'q-1', personId: partner!.id },
        { ...first, id: 'q-2', personId: partner!.id },
      )
    })
    const host = await mount(plan, <InsuranceSection />)
    expect(host.querySelectorAll('.callout--warn')).toHaveLength(2)
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

  function schedulePlan(rows: { age: number; value: number }[]): Plan {
    return validPlan((p) => {
      const life = p.insurance.find((i) => i.kind === 'permanentLife')!
      if (life.kind === 'permanentLife') {
        life.cashValueMode = 'schedule'
        life.cashValueSchedule = rows
      }
    })
  }

  it('names a repeated schedule age, and several with plural wording', async () => {
    const one = await mount(schedulePlan([{ age: 65, value: 0 }, { age: 65, value: 0 }]), <InsuranceSection />)
    const warnings = [...one.querySelectorAll('.callout--warn')]
    expect(warnings).toHaveLength(1)
    expect(warnings[0]!.textContent).toContain('Age 65 appears more than once')
    await act(async () => root!.unmount())
    root = null
    container?.remove()
    const two = await mount(
      schedulePlan([{ age: 65, value: 0 }, { age: 70, value: 0 }, { age: 65, value: 0 }, { age: 70, value: 0 }]),
      <InsuranceSection />,
    )
    expect(two.querySelector('.callout--warn')!.textContent).toContain('Ages 65 and 70 each appear more than once')
  })

  it('with a ceiling row present, a new row fills the gap above the earliest row; with no gap the control disables', async () => {
    const gap = await mount(schedulePlan([{ age: 65, value: 0 }, { age: 120, value: 0 }]), <InsuranceSection />)
    const add = [...gap.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Schedule row')!
    expect(add.disabled).toBe(false)
    await act(async () => add.click())
    const ages = [...gap.querySelectorAll<HTMLLabelElement>('label.field-label')]
      .filter((l) => l.textContent === 'Age')
      .map((l) => gap.querySelector<HTMLInputElement>(`[id="${l.htmlFor}"]`)!.value)
    expect(ages).toEqual(['65', '120', '66'])
    expect(gap.querySelectorAll('.callout--warn')).toHaveLength(0)
    await act(async () => root!.unmount())
    root = null
    container?.remove()
    const noGap = await mount(schedulePlan([{ age: 120, value: 0 }]), <InsuranceSection />)
    const addNoGap = [...noGap.querySelectorAll('button')].find((b) => b.textContent?.trim() === '+ Schedule row')!
    expect(addNoGap.disabled).toBe(true)
    expect(addNoGap.title).toContain('Every age up to 120')
    await act(async () => addNoGap.click())
    expect([...noGap.querySelectorAll<HTMLLabelElement>('label.field-label')].filter((l) => l.textContent === 'Age')).toHaveLength(1)
  })
})

describe('Insurance LTC stress (#517)', () => {
  it('renders nothing when the only care events belong to people who left the household', async () => {
    const plan = createSamplePlan()
    plan.careEvents = [{ ...plan.careEvents[0]!, personId: 'no-such-person' }]
    const host = await mount(plan, <InsuranceSection />, ['careEvents.0.personId: unknown person id "no-such-person"'])
    expect(host.textContent).not.toContain('LTC stress test')
  })

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
    expect(paused.textContent).toContain('Paused while the plan has an issue to fix')
    expect(paused.textContent).not.toContain('Unprotected, the care episode')
  })

  it('pauses under an issue anywhere in the plan, since the scenarios are full projections of it', async () => {
    const host = await mount(validPlan(), <InsuranceSection />, [
      'expenses.baseAnnual: Invalid input',
      'accounts.0.balance: Invalid input',
    ])
    expect(host.querySelector('table.compare-table')).toBeNull()
    expect(host.textContent).toContain('Paused while the plan has 2 issues to fix')
    expect(host.textContent).toContain('The issue lists on Accounts and Spending name the fields.')
  })
})

describe('Income orphaned Social Security row (#462 review)', () => {
  it('a stream whose person left the household keeps a Remove and says why; a healthy one does not', async () => {
    // Not run through parsePlan: the orphan is exactly what fails validation.
    const plan = createSamplePlan()
    const orphan = plan.incomes.find((s) => s.type === 'socialSecurity')!
    if (orphan.type === 'socialSecurity') orphan.personId = 'no-such-person'
    const host = await mount(plan, <IncomeSection />, ['incomes.2.personId: unknown person id "no-such-person"'])
    const ssRows = [...host.querySelectorAll<HTMLElement>('.item-row')].filter(
      (r) => r.querySelector('.type-chip')?.textContent === 'Social Security',
    )
    expect(ssRows).toHaveLength(2)
    const orphanRow = ssRows.find((r) => r.querySelector('.callout--warn') !== null)!
    expect(orphanRow.textContent).toContain('no longer in the household')
    expect([...orphanRow.querySelectorAll('button')].map((b) => b.textContent)).toContain('Remove')
    // The Social Security step cannot show this stream, so the row does not
    // send the reader there; it links Household, where the person can return.
    expect(orphanRow.textContent).not.toContain('managed on the')
    expect([...orphanRow.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toContain('/household')
    const healthyRow = ssRows.find((r) => r !== orphanRow)!
    expect([...healthyRow.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Remove')
    expect(healthyRow.textContent).toContain('managed on the')
    // Removing it drops the row.
    const remove = [...orphanRow.querySelectorAll('button')].find((b) => b.textContent === 'Remove')!
    await act(async () => remove.click())
    expect(
      [...host.querySelectorAll<HTMLElement>('.item-row')].filter((r) => r.querySelector('.type-chip')?.textContent === 'Social Security'),
    ).toHaveLength(1)
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
    expect(host.textContent).toContain('Quote paused: an entry on this ladder is invalid')
    // Issues render once, at the end of the section, after every ladder and
    // the add control: the copy says so instead of "below".
    expect(host.textContent).toContain('The issue list at the end of this section names the field')
    expect(host.textContent).not.toContain('Quoted cost')
    expect(host.textContent).not.toContain('Set an amount and a payout window')
    expect(host.textContent).toContain('Paused while the plan has an issue to fix')
    expect(host.querySelector('.stat-grid')).toBeNull()
    // The card and its explanation stay; the readout and the footer that
    // reads the same projection pause together.
    expect(host.textContent).toContain('Funded ratio')
    expect(host.textContent).not.toMatch(/Counted from \d{4} through|the ratio reads low/)
    // The pause names and links the section the entry lives on, which is
    // what makes it actionable where no issue list renders (Results).
    const fundedCard = [...host.querySelectorAll('.card')].find((c) => c.querySelector('h2')?.textContent === 'Funded ratio')!
    expect(fundedCard.textContent).toContain('The issue list on Income floor names the field.')
    expect([...fundedCard.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toContain('/income-floor')
  })

  it('an issue on the ladder list itself pauses every ladder quote', async () => {
    const host = await mount(ladderPlan(), <IncomeFloorSection />, ['incomeFloor.ladders: at most one ladder per purpose'])
    // Named as a list-level issue, not blamed on this ladder's entries.
    expect(host.textContent).toContain('Quote paused: the ladder list itself has an issue to fix')
    expect(host.textContent).not.toContain('an entry on this ladder is invalid')
    expect(host.textContent).not.toContain('Quoted cost')
  })

  it('the paused card never projects, so a draft the engine would throw on cannot crash or empty it', async () => {
    // The projection hook throws (an invalid draft can); the paused card is
    // untouched because it does not mount the readout that owns the hook.
    projectionThrows.on = true
    try {
      const guarded = await mount(ladderPlan(), <IncomeFloorSection />, ['accounts.0.balance: Invalid input'])
      expect(guarded.textContent).toContain('Funded ratio')
      expect(guarded.textContent).toContain('Paused while the plan has an issue to fix')
      expect(guarded.querySelector('.stat-grid')).toBeNull()
    } finally {
      projectionThrows.on = false
    }
  })

  it('an issue elsewhere in the plan pauses the ratio (a full projection) but not this ladder\'s quote (its own rungs)', async () => {
    const host = await mount(ladderPlan(), <IncomeFloorSection />, [
      'expenses.baseAnnual: Invalid input',
      'accounts.0.balance: Invalid input',
    ])
    expect(host.textContent).toContain('Quoted cost')
    expect(host.textContent).not.toContain('Quote paused')
    expect(host.querySelector('.stat-grid')).toBeNull()
    expect(host.textContent).toContain('Paused while the plan has 2 issues to fix')
    expect(host.textContent).toContain('The issue lists on Accounts and Spending name the fields.')
    const hrefs = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/accounts')
    expect(hrefs).toContain('/spending')
  })
})
