/** @vitest-environment jsdom */
/**
 * Markup half of the #495 decisions: what actually renders. The stylesheet and
 * source pins are in designQa.decisions.test.ts, the bands in warnings.test.ts,
 * and the engine rules in packages/engine/src/model/plan.conversionWindow.test.ts.
 */
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { packForYear } from '@retiregolden/engine/params'

import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx } from './planContextCore'
import { AssumptionsSection } from './sections/AssumptionsSection'
import { SpendingSection } from './sections/SpendingSection'
import { StrategySection } from './sections/StrategySection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function validPlan(mutate?: (plan: Plan) => void): Plan {
  const plan = createSamplePlan()
  mutate?.(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

async function mount(initialPlan: Plan, child: ReactNode, issues: string[] = []) {
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
          saveState: 'saved',
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

const warningOf = (host: HTMLElement, path: string): HTMLElement | null => {
  const control = host.querySelector<HTMLElement>(`[data-path="${path}"]`)
  expect(control, `the field for ${path} rendered`).not.toBeNull()
  return control!.closest('.field')!.querySelector<HTMLElement>('.field-warning')
}

describe('D1 (#495, #500, #502, #550, #572): a rate the engine accepts but nobody meant', () => {
  it('notes an inflation assumption beyond ±30% without refusing it', async () => {
    const host = await mount(validPlan((plan) => void (plan.assumptions.inflationPct = 999)), <AssumptionsSection />)
    const note = warningOf(host, 'assumptions.inflationPct')
    expect(note?.textContent).toBe('Outside the −30% to 30% range most plans use. Kept as entered.')
    expect(note?.getAttribute('role')).toBe('status')
    // The plan holds the value: nothing is refused and nothing is invalid.
    const input = host.querySelector<HTMLInputElement>('[data-path="assumptions.inflationPct"]')!
    expect(input.value).toBe('999')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(input.getAttribute('aria-describedby')).toContain(`${input.id}-warning`)
    expect(input.closest('.field')!.className).not.toContain('field--invalid')
  })

  it('says nothing about an ordinary assumption', async () => {
    const host = await mount(validPlan((plan) => void (plan.assumptions.inflationPct = 2.5)), <AssumptionsSection />)
    expect(warningOf(host, 'assumptions.inflationPct')).toBeNull()
  })
})

describe('D7 (#545): a spending phase that spends nothing', () => {
  it('notes a multiplier of 0 at the field', async () => {
    const host = await mount(
      validPlan((plan) => {
        plan.expenses.phases = [{ fromAge: 75, multiplier: 0 }]
      }),
      <SpendingSection />,
    )
    expect(warningOf(host, 'expenses.phases.0.multiplier')?.textContent).toBe(
      'A multiplier of 0 means this phase spends nothing. Kept as entered.',
    )
  })
})

describe('D3 (#548, #524, #553): magnitudes', () => {
  it('notes a balance at or above $100 million and a SALT figure above $1 million', async () => {
    const host = await mount(
      validPlan((plan) => {
        plan.strategies.itemizedDeductions = { stateAndLocalTaxes: 99_999_999, mortgageInterest: 0, charitable: 0 }
      }),
      <StrategySection />,
    )
    expect(warningOf(host, 'strategies.itemizedDeductions.stateAndLocalTaxes')?.textContent).toBe(
      'Above $1 million, which is unusual for a deduction. Kept as entered.',
    )
    expect(warningOf(host, 'strategies.itemizedDeductions.mortgageInterest')).toBeNull()
  })
})

describe('an engine issue still wins over a warning', () => {
  it('a field the engine refused shows the error, stays aria-invalid, and hides the note', async () => {
    const host = await mount(
      validPlan((plan) => void (plan.assumptions.inflationPct = 999)),
      <AssumptionsSection />,
      ['assumptions.inflationPct: Too big: expected number to be <1000'],
    )
    const input = host.querySelector<HTMLInputElement>('[data-path="assumptions.inflationPct"]')!
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.closest('.field')!.querySelector('.field-error')?.textContent).toBe('Must be less than 1000')
    expect(warningOf(host, 'assumptions.inflationPct')).toBeNull()
  })
})

describe('D6 (#508): the fill-to-target bracket is chosen, not typed', () => {
  const fillToTarget = (plan: Plan) => {
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 22,
      startYear: 2026,
      endYear: 2036,
    }
  }

  it('offers exactly the rates the pack publishes for the window year', async () => {
    const host = await mount(validPlan(fillToTarget), <StrategySection />)
    const select = host.querySelector<HTMLSelectElement>('select[data-path="strategies.rothConversion.targetValue"]')
    expect(select, 'the bracket control is a select').not.toBeNull()
    const published = packForYear(2026).pack.federalTax.brackets.single.map((b) => `${b.ratePct}%`)
    expect([...select!.options].filter((o) => !o.disabled).map((o) => o.textContent)).toEqual(published)
    expect(select!.value).toBe('22')
  })

  it('keeps a stored rate the pack does not publish visible, marked, beside the engine message', async () => {
    // Parse refuses 37.5 now, so the fixture is built WITHOUT parsing: this is
    // the shape an older stored plan arrives in, and the workspace renders it
    // with the engine's issue beside the control rather than dropping it.
    const stored = validPlan(fillToTarget)
    ;(stored.strategies.rothConversion as { targetValue: number }).targetValue = 37.5
    const host = await mount(
      stored,
      <StrategySection />,
      ['strategies.rothConversion.targetValue: a bracket target must be one of the published 2026 rates (10, 12, 22, 24, 32, 35, 37)'],
    )
    const select = host.querySelector<HTMLSelectElement>('select[data-path="strategies.rothConversion.targetValue"]')!
    expect(select.value).toBe('37.5')
    expect([...select.options].map((o) => o.textContent)).toContain('37.5% (not a published rate)')
    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect(select.closest('.field')!.querySelector('.field-error')?.textContent).toContain(
      'a bracket target must be one of the published 2026 rates',
    )
  })

  it('the IRMAA tier and fixed-MAGI targets stay typed numbers', async () => {
    const host = await mount(
      validPlan((plan) => {
        plan.strategies.rothConversion = {
          mode: 'fillToTarget',
          target: 'irmaaTier',
          targetValue: 1,
          startYear: 2026,
          endYear: 2036,
        }
      }),
      <StrategySection />,
    )
    const control = host.querySelector('[data-path="strategies.rothConversion.targetValue"]')!
    expect(control.tagName).toBe('INPUT')
  })
})
