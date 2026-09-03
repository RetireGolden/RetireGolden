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

import { parsePlan, type Account, type Plan } from '@retiregolden/engine/model/plan'
import { packForYear } from '@retiregolden/engine/params'

import { createSamplePlan } from '../testSupport/samplePlan'
import { PlanCtx } from './planContextCore'
import { AccountFields } from './sections/AccountFields'
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
  it('notes a SALT figure above $1 million and leaves its sibling alone', async () => {
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

  it.each([
    [999_999_999_999, 'At or above $100 million, which is unusual. Kept as entered.'],
    [100_000_000, 'At or above $100 million, which is unusual. Kept as entered.'],
    [99_999_999, null],
    [90_000, null],
  ])('a cash balance of %s notes %s (#548)', async (balance, expected) => {
    const cash: Account = {
      type: 'cash',
      id: 'cash',
      name: 'Savings',
      ownerPersonId: null,
      annualReturnPct: null,
      balance,
      annualContribution: 0,
    }
    const host = await mount(
      validPlan((plan) => void (plan.accounts = [cash])),
      <AccountFields account={cash} index={0} />,
    )
    expect(warningOf(host, 'accounts.0.balance')?.textContent ?? null).toBe(expected)
  })
})

describe('D4 (#545, #524): a calendar year before the plan starts', () => {
  it('notes a goal year in the past at the field, and says nothing about a future one', async () => {
    // The band reads the current calendar year, which is what the projection
    // starts from (`currentStartYear` in projection.ts), so the fixture is
    // written relative to it rather than to a frozen year.
    const thisYear = new Date().getFullYear()
    const host = await mount(
      validPlan((plan) => {
        plan.expenses.oneTimeGoals = [
          { id: 'past', label: 'Kitchen', year: thisYear - 6, amount: 40_000, classification: 'target' },
          { id: 'ahead', label: 'Roof', year: thisYear + 4, amount: 20_000, classification: 'target' },
        ]
      }),
      <SpendingSection />,
    )
    expect(warningOf(host, 'expenses.oneTimeGoals.0.year')?.textContent).toBe(
      `Before this plan's first year (${thisYear}). Kept as entered.`,
    )
    expect(warningOf(host, 'expenses.oneTimeGoals.1.year')).toBeNull()
    // Still stored, still valid: the note is not a refusal (#495 D4).
    const input = host.querySelector<HTMLInputElement>('[data-path="expenses.oneTimeGoals.0.year"]')!
    expect(input.value).toBe(String(thisYear - 6))
    expect(input.getAttribute('aria-invalid')).toBeNull()
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

  it('offers the published rates below the open-ended top one, and omits the top one', async () => {
    const host = await mount(validPlan(fillToTarget), <StrategySection />)
    const select = host.querySelector<HTMLSelectElement>('select[data-path="strategies.rothConversion.targetValue"]')
    expect(select, 'the bracket control is a select').not.toBeNull()
    const rates = packForYear(2026).pack.federalTax.brackets.single.map((b) => b.ratePct)
    const top = rates[rates.length - 1]
    const labels = [...select!.options].filter((o) => !o.disabled).map((o) => o.textContent)
    expect(labels).toEqual(rates.slice(0, -1).map((rate) => `${rate}%`))
    expect(labels).not.toContain(`${top}%`)
    expect(select!.value).toBe('22')
  })

  it('every rate the select offers is a rate the engine accepts, so the two lists cannot drift', async () => {
    // `publishedBracketRatesPct` exists in the engine (inside parsePlan) and
    // again in bracketOptions.ts, because the engine helper is deliberately not
    // exported this release. This asserts the two agree end to end rather than
    // restating either implementation (review r1-9).
    const host = await mount(validPlan(fillToTarget), <StrategySection />)
    const select = host.querySelector<HTMLSelectElement>('select[data-path="strategies.rothConversion.targetValue"]')!
    const offered = [...select.options].filter((o) => !o.disabled).map((o) => Number(o.value))
    expect(offered.length).toBeGreaterThan(0)
    for (const rate of offered) {
      const plan = validPlan(fillToTarget)
      ;(plan.strategies.rothConversion as { targetValue: number }).targetValue = rate
      expect(parsePlan(plan).ok, `${rate}% is offered but the engine refuses it`).toBe(true)
    }
    // And a rate between two offered ones is refused by both sides.
    const between = validPlan(fillToTarget)
    ;(between.strategies.rothConversion as { targetValue: number }).targetValue = offered[0]! + 0.5
    expect(parsePlan(between).ok).toBe(false)
    expect(offered).not.toContain(offered[0]! + 0.5)
  })

  it.each([
    [37.5, '37.5% (not a published rate)'],
    // A plan saved before the top bracket was refused. It says which of the two
    // mistakes this is, because they are corrected differently.
    [37, '37% (top bracket — nothing above it to fill)'],
  ])('keeps a stored rate the select no longer offers visible and marked: %s', async (stored, label) => {
    // Parse refuses both now, so the fixture is built WITHOUT parsing: this is
    // the shape an older stored plan arrives in, and the workspace renders it
    // with the engine's issue beside the control rather than dropping it.
    const plan = validPlan(fillToTarget)
    ;(plan.strategies.rothConversion as { targetValue: number }).targetValue = stored
    const host = await mount(
      plan,
      <StrategySection />,
      ['strategies.rothConversion.targetValue: a bracket target must be one of the published rates below the top bracket (10, 12, 22, 24, 32, 35)'],
    )
    const select = host.querySelector<HTMLSelectElement>('select[data-path="strategies.rothConversion.targetValue"]')!
    expect(select.value).toBe(String(stored))
    expect([...select.options].map((o) => o.textContent)).toContain(label)
    expect(select.getAttribute('aria-invalid')).toBe('true')
    expect(select.closest('.field')!.querySelector('.field-error')?.textContent).toContain(
      'a bracket target must be one of the published rates below the top bracket',
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
