/** @vitest-environment jsdom */

/**
 * The spending card's field invariants (D1-D9, #584).
 *
 * Three things this pins:
 *
 * 1. The five dynamic-spending percents advertise the ENGINE's range. They
 *    used to hand-write one — `upperGuardrailPct` stopped at 200 against a
 *    schema of `z.number().positive()` with no ceiling — so the control refused
 *    a value the engine accepts and dropped it with nothing said.
 * 2. A success band whose cut edge is not below its raise edge is KEPT and
 *    explained. It used to be reordered on commit, which stored a percent the
 *    household never typed.
 * 3. A required floor above the baseline is KEPT, and the engine's own refusal
 *    ("required annual spending cannot exceed baseline") shows on that field.
 *    It used to be silently pulled down to the baseline.
 *
 * The expected ranges are the schema's, read from `plan.ts` (spendingPolicy):
 * positive / min 0 / 1–99 / 1–100 / 0–100. Nothing here invents a bound.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import { parsePlan, type Plan, type SpendingPolicy } from '@retiregolden/engine/model/plan'

import { PlanCtx } from '../planContextCore'
import { createSamplePlan } from '../../testSupport/samplePlan'
import { SpendingSection } from './SpendingSection'

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function mount(mutate: (plan: Plan) => void): HTMLDivElement {
  const plan = createSamplePlan()
  mutate(plan)
  // The real parse, so an issue shown beside a field is one the engine
  // reported rather than a string written here.
  const parsed = parsePlan(plan)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter>
        <PlanCtx.Provider
          value={{
            plan,
            update: () => undefined,
            discardPendingSave: () => undefined,
            saveState: 'saved',
            issues: parsed.ok ? [] : parsed.issues,
          }}
        >
          <SpendingSection />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  return container
}

/** The number input a label names, and the field box around it. */
function field(host: HTMLElement, label: string): { input: HTMLInputElement; box: HTMLElement } {
  const found = Array.from(host.querySelectorAll('label')).find((l) => l.textContent?.trim() === label)
  if (!found) throw new Error(`no field labelled ${label}`)
  const id = found.getAttribute('for')!
  const input = host.querySelector<HTMLInputElement>(`[id="${id.replace(/"/g, '\\"')}"]`)
  if (!input) throw new Error(`no control for ${label}`)
  return { input, box: input.closest('.field') as HTMLElement }
}

const policy = (extra: Partial<SpendingPolicy>): SpendingPolicy => ({
  mode: 'riskBasedGuardrails',
  ...extra,
})

describe('dynamic-spending percents carry the engine’s own range', () => {
  it('leaves the upper guardrail unbounded above, as the schema does', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', upperGuardrailPct: 130 }
    })
    const { input } = field(host, 'Upper guardrail')
    // `z.number().positive()` states an exclusive floor and no ceiling, and an
    // exclusive bound has no HTML equivalent, so the control advertises neither.
    expect(input.min).toBe('')
    expect(input.max).toBe('')
    expect(input.dataset.path).toBe('expenses.spendingPolicy.upperGuardrailPct')
  })

  it('takes the lower guardrail’s floor of 0 and the adjustment’s 0–100 from the schema', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', lowerGuardrailPct: 80, adjustmentPct: 10 }
    })
    const lower = field(host, 'Lower guardrail').input
    expect(lower.min).toBe('0')
    expect(lower.max).toBe('')
    const adjustment = field(host, 'Adjustment size').input
    expect(adjustment.min).toBe('0')
    expect(adjustment.max).toBe('100')
  })

  it('takes the success band’s 1–99 and 1–100 from the schema', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = policy({ targetSuccessLowerPct: 70, targetSuccessUpperPct: 95 })
    })
    const cut = field(host, 'Cut when success falls below').input
    expect([cut.min, cut.max]).toEqual(['1', '99'])
    const raise = field(host, 'Raise when success rises above').input
    expect([raise.min, raise.max]).toEqual(['1', '100'])
  })
})

describe('an inverted success band is kept and explained, not reordered', () => {
  it('warns under both edges without marking either control invalid', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = policy({ targetSuccessLowerPct: 90, targetSuccessUpperPct: 80 })
    })
    for (const label of ['Cut when success falls below', 'Raise when success rises above']) {
      const { input, box } = field(host, label)
      const warning = box.querySelector('.field-warning')
      expect(warning?.textContent, label).toContain('The cut edge is not below the raise edge')
      expect(warning?.getAttribute('role'), label).toBe('status')
      // The plan holds the value, so it is a status and never a fault.
      expect(input.getAttribute('aria-invalid'), label).toBeNull()
      expect(box.querySelector('.field-error'), label).toBeNull()
    }
    // Both percents are still exactly what was entered.
    const cut = field(host, 'Cut when success falls below').input
    const raise = field(host, 'Raise when success rises above').input
    expect([cut.value, raise.value]).toEqual(['90', '80'])
  })

  it('says nothing when the band is ordered', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = policy({ targetSuccessLowerPct: 70, targetSuccessUpperPct: 95 })
    })
    expect(field(host, 'Cut when success falls below').box.querySelector('.field-warning')).toBeNull()
  })
})

describe('a required floor above the baseline is kept, and the engine says so', () => {
  it('shows the engine’s refusal on the floor field and keeps the entered amount', () => {
    const host = mount((plan) => {
      plan.expenses.baseAnnual = 60_000
      plan.expenses.requiredAnnual = 90_000
    })
    const { input, box } = field(host, "Required floor (today's $)")
    // Not pulled down to the baseline: the box still shows what was entered.
    expect(input.value).toBe('90,000')
    const error = box.querySelector('.field-error')
    expect(error?.textContent).toContain('cannot exceed')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })
})

describe('an inverted withdrawal-rate guardrail pair is kept and explained, not reordered', () => {
  it('warns under both edges without marking either control invalid', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', lowerGuardrailPct: 90, upperGuardrailPct: 80 }
    })
    for (const label of ['Upper guardrail', 'Lower guardrail']) {
      const { input, box } = field(host, label)
      const warning = box.querySelector('.field-warning')
      expect(warning?.textContent, label).toContain('lower guardrail is not below the upper guardrail')
      expect(warning?.getAttribute('role'), label).toBe('status')
      // The plan holds the value, so it is a status and never a fault.
      expect(input.getAttribute('aria-invalid'), label).toBeNull()
      expect(box.querySelector('.field-error'), label).toBeNull()
    }
    // Both percents are still exactly what was entered — no reordering (D5),
    // the same invariant the success band above pins.
    const upper = field(host, 'Upper guardrail').input
    const lower = field(host, 'Lower guardrail').input
    expect([upper.value, lower.value]).toEqual(['80', '90'])
  })

  it('says nothing when the pair is ordered', () => {
    const host = mount((plan) => {
      plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails', lowerGuardrailPct: 80, upperGuardrailPct: 120 }
    })
    expect(field(host, 'Upper guardrail').box.querySelector('.field-warning')).toBeNull()
    expect(field(host, 'Lower guardrail').box.querySelector('.field-warning')).toBeNull()
  })
})

describe('a flexible goal’s funding window is kept and explained, not reordered (#598)', () => {
  it('shows the engine’s refusal on Latest year when the goal year moves past it', () => {
    // `oneTimeGoals[i].year = Math.round(v ?? g.year)` used to
    // `Math.max`/`Math.min` the window's other side along with it (D5); that
    // rewrite is gone, so a goal year moved past `latestYear` is a pair the
    // engine's superRefine refuses ("latestYear cannot be before the goal
    // year", plan.ts) rather than one the UI silently widens to fit.
    const host = mount((plan) => {
      // Replaces the example's own goal (also "Year"-labelled) so the DOM
      // carries exactly one Year field, not two.
      plan.expenses.oneTimeGoals = [
        {
          id: 'goal-1',
          label: 'Trip',
          year: 2040,
          amount: 10_000,
          flexibility: 'movable',
          earliestYear: 2035,
          latestYear: 2035,
        },
      ]
    })
    const { input, box } = field(host, 'Latest year')
    // Not pulled forward with the goal year: the box still shows what was set.
    expect(input.value).toBe('2035')
    const error = box.querySelector('.field-error')
    expect(error?.textContent).toContain('cannot be before the goal year')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    // The goal year itself is untouched too.
    expect(field(host, 'Year').input.value).toBe('2040')
  })

  it('shows the engine’s refusal on Earliest year when the goal year moves before it', () => {
    const host = mount((plan) => {
      plan.expenses.oneTimeGoals = [
        {
          id: 'goal-1',
          label: 'Trip',
          year: 2028,
          amount: 10_000,
          flexibility: 'movable',
          earliestYear: 2032,
          latestYear: 2032,
        },
      ]
    })
    const { input, box } = field(host, 'Earliest year')
    expect(input.value).toBe('2032')
    const error = box.querySelector('.field-error')
    expect(error?.textContent).toContain('cannot be after the goal year')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(field(host, 'Year').input.value).toBe('2028')
  })
})

describe('a goal’s minimum funding percent is kept and explained, not clamped to 95 (review r1-2)', () => {
  // `Math.min(95, Math.max(0, v ?? 50))` used to rewrite whatever was typed
  // before it reached the plan. The field now reads the schema's own 0-100
  // (oneTimeGoalSchema, plan.ts) and stores what was entered; 100 with
  // partial funding on is the engine's own refusal
  // (planCrossFieldChecks.ts: "partial funding requires a minimum funding
  // percent below 100"), surfaced here rather than silently rewritten.
  const goalWithMinFunding = (minFundingPct: number) => ({
    id: 'goal-1',
    label: 'Trip',
    year: 2040,
    amount: 10_000,
    flexibility: 'movable' as const,
    earliestYear: 2035,
    latestYear: 2045,
    allowPartialFunding: true,
    minFundingPct,
  })

  it('shows the engine’s refusal on Minimum funding at 100, and keeps the 100 entered', () => {
    const host = mount((plan) => {
      plan.expenses.oneTimeGoals = [goalWithMinFunding(100)]
    })
    const { input, box } = field(host, 'Minimum funding')
    expect(input.value).toBe('100')
    const error = box.querySelector('.field-error')
    expect(error?.textContent).toContain('minimum funding percent below 100')
    expect(input.getAttribute('aria-invalid')).toBe('true')
  })

  it('keeps 96–99, schema-legal but above the old invented 95 ceiling, with no error', () => {
    const host = mount((plan) => {
      plan.expenses.oneTimeGoals = [goalWithMinFunding(97)]
    })
    const { input, box } = field(host, 'Minimum funding')
    expect(input.value).toBe('97')
    expect(box.querySelector('.field-error')).toBeNull()
    expect(input.getAttribute('aria-invalid')).toBeNull()
  })
})
