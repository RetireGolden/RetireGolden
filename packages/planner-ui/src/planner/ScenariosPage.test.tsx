/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { TRUSTEES_DEFAULT_SS_HAIRCUT } from '@retiregolden/engine/params'
import type { ScenarioPlanComparison } from '@retiregolden/engine/scenarios/comparison'
import type { ScenarioComparison } from '@retiregolden/engine/scenarios/scenarios'
import { NonFiniteComparisonError } from '@retiregolden/engine/scenarios/scalarComparison'
import type { SpendingSolveResult } from '../optimize/spendingMessages'
import { WorkspaceReadOnlyContext } from '../data/workspaceReadOnly'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import { taxCalculatorFor } from './useProjection'

vi.mock('@retiregolden/engine/scenarios/comparison', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retiregolden/engine/scenarios/comparison')>()
  return {
    ...original,
    compareScenarioPlans: vi.fn(original.compareScenarioPlans),
    compareScenarioSpendingCapacityResults: vi.fn(original.compareScenarioSpendingCapacityResults),
  }
})

vi.mock('@retiregolden/engine/scenarios/scenarios', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retiregolden/engine/scenarios/scenarios')>()
  return {
    ...original,
    compareScenarios: vi.fn(original.compareScenarios),
  }
})

vi.mock('@retiregolden/engine/scenarios/patch', async (importOriginal) => {
  const original = await importOriginal<typeof import('@retiregolden/engine/scenarios/patch')>()
  return {
    ...original,
    scenarioPlanSnapshotHash: vi.fn(original.scenarioPlanSnapshotHash),
  }
})

vi.mock('../scenarioLevers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../scenarioLevers')>()
  return {
    ...original,
    buildScenarioLever: vi.fn(original.buildScenarioLever),
  }
})

vi.mock('../optimize/spendingRunner', () => ({ runSpendingSolve: vi.fn() }))

import * as comparisonModule from '@retiregolden/engine/scenarios/comparison'
import * as scenarioPatchModule from '@retiregolden/engine/scenarios/patch'
import * as scenariosModule from '@retiregolden/engine/scenarios/scenarios'
import { runSpendingSolve } from '../optimize/spendingRunner'
import * as scenarioLeverModule from '../scenarioLevers'
import { WORKER_UNAVAILABLE_MESSAGE, WorkerUnavailableError } from '../workers/spawn'
import { MetricTable, ScenariosPage } from './ScenariosPage'
import { scenarioPatchSignature, uniqueScenarioName, withDistinctNames } from './scenarioNames'
import {
  formatMetricValue,
  formatScenarioDelta,
  isScenarioComparisonCurrent,
  scenarioOverviewRequestKey,
  currentBaseVerdict,
  spendingCapacityStatus,
} from './scenarioComparisonView'

const actualComparison = await vi.importActual<typeof import('@retiregolden/engine/scenarios/comparison')>(
  '@retiregolden/engine/scenarios/comparison',
)
const mockedComparePlans = vi.mocked(comparisonModule.compareScenarioPlans)
const mockedCompareCapacity = vi.mocked(comparisonModule.compareScenarioSpendingCapacityResults)
const mockedCompareScenarios = vi.mocked(scenariosModule.compareScenarios)
const mockedSnapshotHash = vi.mocked(scenarioPatchModule.scenarioPlanSnapshotHash)
const mockedRunSpendingSolve = vi.mocked(runSpendingSolve)
const mockedBuildScenarioLever = vi.mocked(scenarioLeverModule.buildScenarioLever)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill
  })
  return { promise, resolve }
}

describe('scenario row names (#480)', () => {
  it('suffixes a repeated name until it is unique, and leaves a free name alone', () => {
    expect(uniqueScenarioName('15% spending cut', [])).toBe('15% spending cut')
    expect(uniqueScenarioName('15% spending cut', ['15% spending cut'])).toBe('15% spending cut (2)')
    expect(uniqueScenarioName('15% spending cut', ['15% spending cut', '15% spending cut (2)'])).toBe(
      '15% spending cut (3)',
    )
    expect(uniqueScenarioName('Other', ['15% spending cut'])).toBe('Other')
  })

  it('makes legacy same-named rows distinct at render without touching unique ones', () => {
    const rows = withDistinctNames([{ name: 'A' }, { name: 'B' }, { name: 'A' }, { name: 'A' }])
    expect(rows.map((r) => r.name)).toEqual(['A', 'B', 'A (2)', 'A (3)'])
  })

  it('signs a patch by what it does, ignoring stamps, generated ids, before evidence, and key order', () => {
    const op = (extra: Record<string, unknown>) => ({
      op: 'set',
      path: '/expenses/baseAnnual',
      value: 110_400,
      ...extra,
    })
    const a = { createdAtIso: '2026-01-01T00:00:00Z', operations: [op({ before: { present: true, value: 96_000 } })] }
    const b = { createdAtIso: '2026-02-02T00:00:00Z', operations: [op({ before: { present: true, value: 99_000 } })] }
    expect(scenarioPatchSignature(a)).toBe(scenarioPatchSignature(b))
    // A care request carries a generated event id in its value; two adds still match.
    const care = (id: string) => ({
      operations: [{ op: 'add', path: '/careEvents/-', value: { id, kind: 'home-care', startAge: 82 } }],
    })
    expect(scenarioPatchSignature(care('evt-1'))).toBe(scenarioPatchSignature(care('evt-2')))
    // Key order does not matter; a different value does.
    const reordered = { operations: [{ value: 110_400, path: '/expenses/baseAnnual', op: 'set' }] }
    expect(scenarioPatchSignature(reordered)).toBe(scenarioPatchSignature(a))
    expect(scenarioPatchSignature({ operations: [op({ value: 120_000 })] })).not.toBe(scenarioPatchSignature(a))
  })
})

describe('scenario comparison presentation', () => {
  it('formats proposal-minus-baseline changes with an explicit sign and stable zero', () => {
    expect(formatScenarioDelta(12_500, 'money')).toMatch(/^\+\$/)
    expect(formatScenarioDelta(-0.025, 'percent')).toBe('−2.5 pp')
    expect(formatScenarioDelta(1, 'year')).toBe('+1 year')
    expect(formatScenarioDelta(-1, 'year')).toBe('−1 year')
    expect(formatScenarioDelta(1.2, 'year')).toBe('+1 year')
    expect(formatScenarioDelta(2, 'year')).toBe('+2 years')
    expect(formatScenarioDelta(0, 'money')).toBe('$0')
    expect(formatScenarioDelta(null, 'money')).toBe('—')
  })

  it('renders a non-depleting plan as never instead of unavailable', () => {
    expect(formatMetricValue(null, 'depletionYear')).toBe('never')
    expect(formatMetricValue(2045, 'depletionYear')).toBe('2045')
    expect(formatScenarioDelta(null, 'depletionYear')).toBe('—')
  })

  it('distinguishes converged, feasible lower-bound, and unavailable capacity results', () => {
    expect(spendingCapacityStatus(75_000, true)).toBe('Converged maximum')
    expect(spendingCapacityStatus(75_000, false)).toBe('Feasible lower bound')
    expect(spendingCapacityStatus(null, false)).toBe('Unavailable')
  })

  it("reads each side's current base spending from its solve's verdict, never from the slack's sign", () => {
    expect(currentBaseVerdict(true)).toBe('Sustained')
    expect(currentBaseVerdict(false)).toBe('Not sustained')
    expect(currentBaseVerdict(null)).toBe('Not judged')
    expect(currentBaseVerdict(undefined)).toBe('Not judged')
  })

  it('renders basis labels and accessible metric table semantics', () => {
    const html = renderToStaticMarkup(
      <MetricTable
        caption="Headline outcomes"
        basis="nominal dollars; proposal minus baseline"
        rows={[
          {
            label: 'Ending net worth',
            metric: { baseline: 100_000, proposal: 125_000, delta: 25_000 },
            format: 'money',
          },
        ]}
      />,
    )
    expect(html).toContain('Headline outcomes')
    expect(html).toContain('nominal dollars')
    expect(html).toContain('proposal minus baseline')
    expect(html).toContain('scope="col"')
    expect(html).toContain('scope="row"')
  })

  it('suppresses a comparison whose hashes or start year no longer match the request', () => {
    const comparison = {
      provenance: {
        baselineSnapshotHash: 'fnv1a64:1111111111111111',
        proposalSnapshotHash: 'fnv1a64:2222222222222222',
        startYear: 2026,
      },
    } as ScenarioPlanComparison
    expect(
      isScenarioComparisonCurrent(
        comparison,
        'fnv1a64:1111111111111111',
        'fnv1a64:2222222222222222',
        2026,
      ),
    ).toBe(true)
    expect(
      isScenarioComparisonCurrent(
        comparison,
        'fnv1a64:1111111111111111',
        'fnv1a64:3333333333333333',
        2026,
      ),
    ).toBe(false)
    expect(
      isScenarioComparisonCurrent(
        comparison,
        'fnv1a64:1111111111111111',
        'fnv1a64:2222222222222222',
        2027,
      ),
    ).toBe(false)
  })

  it('invalidates the overview when only a scenario document changes', () => {
    const before = scenarioOverviewRequestKey(
      'fnv1a64:1111111111111111',
      [{ id: 's1', name: 'Spend more', patch: { expenses: { baseAnnual: 50_000 } } }],
      2026,
    )
    const after = scenarioOverviewRequestKey(
      'fnv1a64:1111111111111111',
      [{ id: 's1', name: 'Spend more', patch: { expenses: { baseAnnual: 60_000 } } }],
      2026,
    )
    expect(after).not.toBe(before)
  })
})

describe('ScenariosPage comparison lifecycle', () => {
  let container: HTMLDivElement
  let root: Root

  const solved: SpendingSolveResult = {
    maxBaseAnnual: 100_000,
    spendingSlackDollars: 4_000,
    currentBaseAnnual: 96_000,
    estateFloorTodayDollars: 0,
    converged: true,
    limitingConstraint: 'depletion',
    simulationCount: 12,
    acaGrossPremiumYears: [],
    acaGrossPremiumReasons: [],
    acaGrossPremiumDirection: null,
    zeroSpendingDepletes: false,
    diagnostics: [],
    evidence: null,
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockedCompareScenarios.mockReturnValue({ rows: [] })
    mockedComparePlans.mockImplementation((baseline, proposal, options) =>
      actualComparison.compareScenarioPlans(baseline, proposal, {
        ...options,
        // Component tests exercise request lifecycle, not the Monte Carlo
        // implementation. Keeping the deterministic result makes them fast.
        stochastic: undefined,
      }),
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.useRealTimers()
  })

  function contextFor(
    plan: Plan,
    issues: string[] = [],
    update: PlanContextValue['update'] = () => undefined,
  ): PlanContextValue {
    return {
      plan,
      update,
      discardPendingSave: () => undefined,
      saveState: 'saved',
      issues,
    }
  }

  async function mount(
    plan = createSamplePlan(),
    issues: string[] = [],
    readOnly = false,
    update?: PlanContextValue['update'],
    settlePreview = true,
  ) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WorkspaceReadOnlyContext.Provider value={readOnly}>
            <PlanCtx.Provider value={contextFor(plan, issues, update)}>
              <ScenariosPage />
            </PlanCtx.Provider>
          </WorkspaceReadOnlyContext.Provider>
        </MemoryRouter>,
      )
    })
    if (settlePreview) await advanceLeverPreview()
    return plan
  }

  async function rerenderWithPlan(plan: Plan) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WorkspaceReadOnlyContext.Provider value={false}>
            <PlanCtx.Provider value={contextFor(plan)}>
              <ScenariosPage />
            </PlanCtx.Provider>
          </WorkspaceReadOnlyContext.Provider>
        </MemoryRouter>,
      )
    })
    await advanceLeverPreview()
  }

  function planWithoutPerson(plan: Plan, personId: string): Plan {
    const next = structuredClone(plan)
    next.household.people = next.household.people.filter((person) => person.id !== personId)
    next.accounts = next.accounts.filter(
      (account) => account.ownerPersonId === null || account.ownerPersonId !== personId,
    )
    next.incomes = next.incomes.filter(
      (income) => !('personId' in income) || income.personId !== personId,
    )
    next.insurance = next.insurance.filter((policy) =>
      policy.kind === 'ltc' ? policy.owner !== personId : policy.insured !== personId,
    )
    next.careEvents = next.careEvents.filter((event) => event.personId !== personId)
    return next
  }

  async function advanceComparison() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
  }

  async function advanceLeverPreview() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50)
    })
  }

  it('shows the exact canonical fields for a fast lever and disables unavailable choices', async () => {
    await mount()
    const select = container.querySelector<HTMLSelectElement>('select')
    expect(select).toBeTruthy()
    expect(select!.options).toHaveLength(16)
    expect(container.textContent).toContain('Fields this scenario changes:')
    expect(container.textContent).toContain('Household: People')

    await act(async () => {
      select!.value = 'pension'
      select!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await advanceLeverPreview()

    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )
    const unavailableStatus = Array.from(container.querySelectorAll('[role="status"]')).find(
      (status) => status.textContent?.includes('Add an existing pension'),
    )
    expect(add?.disabled).toBe(true)
    expect(unavailableStatus?.textContent).toContain('Add an existing pension')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(unavailableStatus?.getAttribute('aria-live')).toBe('polite')
  })

  it('defers previews, discards stale work, and revalidates the latest request on save', async () => {
    const plan = createSamplePlan()
    let updatedPlan: Plan | null = null
    await mount(
      plan,
      [],
      false,
      (mutator) => {
        const next = structuredClone(plan)
        mutator(next)
        updatedPlan = next
      },
      false,
    )
    const select = container.querySelector<HTMLSelectElement>('select')!
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )!

    expect(mockedBuildScenarioLever).not.toHaveBeenCalled()
    expect(add.disabled).toBe(true)
    expect(container.textContent).toContain('Checking this scenario against the projection')

    await act(async () => {
      select.value = 'pension'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25)
    })
    await act(async () => {
      select.value = 'spending'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25)
    })
    expect(mockedBuildScenarioLever).not.toHaveBeenCalled()
    expect(add.disabled).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25)
    })
    expect(mockedBuildScenarioLever).toHaveBeenCalledTimes(1)
    expect(mockedBuildScenarioLever.mock.calls[0]![1]).toEqual({
      id: 'spending',
      percentChange: 15,
    })
    expect(mockedBuildScenarioLever.mock.calls[0]![2].taxCalculatorForPlan).toBe(
      taxCalculatorFor,
    )
    expect(add.disabled).toBe(false)
    expect(container.textContent).toContain('Spending: Baseline annual spending')

    await act(async () => add.click())

    expect(mockedBuildScenarioLever).toHaveBeenCalledTimes(2)
    expect(mockedBuildScenarioLever.mock.calls[1]![1]).toEqual({
      id: 'spending',
      percentChange: 15,
    })
    const savedPlan = updatedPlan as Plan | null
    expect(savedPlan).not.toBeNull()
    const applied = scenariosModule.applyScenarioPatch(
      plan,
      savedPlan!.scenarios.at(-1)!.patch,
    )
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.plan.expenses.baseAnnual).toBe(110_400)
  })

  it('refuses to add a scenario whose patch is already in the list (#480)', async () => {
    const plan = createSamplePlan()
    let updatedPlan: Plan | null = null
    const track = (mutator: (draft: Plan) => void) => {
      const next = structuredClone(plan)
      mutator(next)
      updatedPlan = next
    }
    await mount(plan, [], false, track, false)
    // Re-selecting the default lever fires no change event, so step through
    // another lever first, as the preview-lifecycle test above does.
    const pickSpending = async () => {
      const select = container.querySelector<HTMLSelectElement>('select')!
      for (const lever of ['pension', 'spending']) {
        await act(async () => {
          select.value = lever
          select.dispatchEvent(new Event('change', { bubbles: true }))
        })
        await act(async () => {
          await vi.advanceTimersByTimeAsync(25)
        })
      }
      await act(async () => {
        await vi.advanceTimersByTimeAsync(25)
      })
      const add = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent?.includes('Add scenario'),
      )!
      expect(add.disabled).toBe(false)
      return add
    }
    const addOnce = await pickSpending()
    await act(async () => addOnce.click())
    const once = updatedPlan as Plan | null
    // The sample plan already carries scenarios; the lever adds exactly one more.
    expect(once?.scenarios).toHaveLength(plan.scenarios.length + 1)

    // The same lever again, against the plan that now holds it: refused, explained, nothing saved.
    updatedPlan = null
    const withOne = once!
    await mount(withOne, [], false, (mutator) => {
      const next = structuredClone(withOne)
      mutator(next)
      updatedPlan = next
    }, false)
    const addAgain = await pickSpending()
    await act(async () => addAgain.click())
    expect(updatedPlan).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      `already in the list as "${withOne.scenarios.at(-1)!.name}"`,
    )
  })

  it('keeps lever explanations visible while native controls are read-only', async () => {
    await mount(createSamplePlan(), [], true)
    const fieldset = container.querySelector('fieldset.editable-region')
    expect(fieldset?.hasAttribute('disabled')).toBe(true)
    expect(container.textContent).toContain('Fields this scenario changes:')
    expect(container.textContent).toContain('Household: People')
  })

  it('requires a care recipient for couples and exposes modeled relocation states as options', async () => {
    const plan = await mount()
    const leverSelect = container.querySelector<HTMLSelectElement>('select')

    await act(async () => {
      leverSelect!.value = 'care'
      leverSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await advanceLeverPreview()

    const recipientLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Care recipient',
    )
    const recipient = document.getElementById(recipientLabel!.htmlFor) as HTMLSelectElement
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )
    expect(recipient.options).toHaveLength(plan.household.people.length + 1)
    expect(add?.disabled).toBe(true)
    expect(container.textContent).toContain('Choose which household member receives care')

    await act(async () => {
      recipient.value = plan.household.people[1]!.id
      recipient.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await advanceLeverPreview()
    expect(add?.disabled).toBe(false)
    expect(container.textContent).toContain('Care events')

    await act(async () => {
      leverSelect!.value = 'relocation'
      leverSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const stateLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Destination state',
    )
    const states = document.getElementById(stateLabel!.htmlFor) as HTMLSelectElement
    expect(states.options).toHaveLength(51)
    expect(Array.from(states.options).some((option) => option.value === 'DC')).toBe(true)
    const moveMonthLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent?.startsWith('Move month'),
    )
    const moveMonth = document.getElementById(moveMonthLabel!.htmlFor) as HTMLInputElement
    expect(moveMonthLabel!.textContent).toBe('Move month (1-12)')
    expect(moveMonth.value).toBe('7')

    await act(async () => {
      leverSelect!.value = 'rothTarget'
      leverSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const bracketLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Top of federal tax bracket',
    )
    const brackets = document.getElementById(bracketLabel!.htmlFor) as HTMLSelectElement
    expect(Array.from(brackets.options).map((option) => option.value)).toEqual([
      '10',
      '12',
      '22',
      '24',
      '32',
      '35',
    ])
  })

  it('omits a retained care recipient when route reuse navigates to a one-person plan', async () => {
    const original = await mount()
    const leverSelect = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      leverSelect.value = 'care'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const recipientLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Care recipient',
    )!
    const recipient = document.getElementById(recipientLabel.htmlFor) as HTMLSelectElement
    await act(async () => {
      recipient.value = original.household.people[1]!.id
      recipient.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const onePerson = planWithoutPerson(original, original.household.people[1]!.id)
    onePerson.id = 'one-person-route-plan'
    onePerson.household.filingStatus = 'single'
    await rerenderWithPlan(onePerson)

    expect(
      Array.from(container.querySelectorAll('label')).some(
        (label) => label.textContent === 'Care recipient',
      ),
    ).toBe(false)
    expect(container.textContent).toContain('Care events')
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )
    expect(add?.disabled).toBe(false)
    expect(container.textContent).not.toContain(original.household.people[1]!.id)
  })

  it('clears a retained care recipient when route reuse navigates to a different couple', async () => {
    const original = await mount()
    const leverSelect = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      leverSelect.value = 'care'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const recipientLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Care recipient',
    )!
    const recipient = document.getElementById(recipientLabel.htmlFor) as HTMLSelectElement
    const removedPerson = original.household.people[1]
    await act(async () => {
      recipient.value = removedPerson!.id
      recipient.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const differentCouple = planWithoutPerson(original, removedPerson!.id)
    differentCouple.id = 'different-couple-route-plan'
    differentCouple.household.people.push({
      ...removedPerson!,
      id: 'replacement-household-member',
      name: 'Replacement household member',
    })
    await rerenderWithPlan(differentCouple)

    const nextRecipientLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Care recipient',
    )!
    const nextRecipient = document.getElementById(nextRecipientLabel.htmlFor) as HTMLSelectElement
    expect(nextRecipient.value).toBe('')
    expect(Array.from(nextRecipient.options).some((option) => option.value === removedPerson!.id)).toBe(
      false,
    )
    expect(container.textContent).toContain('Choose which household member receives care')
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )
    expect(add?.disabled).toBe(true)
  })

  it('shows the reset care recipient on the same render as the plan swap (render-phase, not an effect behind it)', async () => {
    const original = await mount()
    const leverSelect = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      leverSelect.value = 'care'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const recipientLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Care recipient',
    )!
    const recipient = document.getElementById(recipientLabel.htmlFor) as HTMLSelectElement
    const removedPerson = original.household.people[1]
    await act(async () => {
      recipient.value = removedPerson!.id
      recipient.dispatchEvent(new Event('change', { bubbles: true }))
    })

    // A DIFFERENT plan that happens to reuse `removedPerson.id` for an
    // unrelated person — the "cloned plan shares ids" scenario
    // `UpdateBalancesPanel.test.tsx`'s analogous reset test describes.
    // Because the id still resolves to a real household member,
    // `recipientStillValid` alone would NOT force a clear; only
    // `planChanged` does. That makes this the scenario the render-phase
    // reset actually has to win a race against: if the clear landed one
    // commit late, the stale id would not read back as blank (no matching
    // option — the easy, already-covered case above) but as the WRONG
    // person silently selected, which is the case a delayed lever click
    // could act on.
    const differentPlanSameIds = structuredClone(original)
    differentPlanSameIds.id = 'different-plan-same-ids-sync-check'
    differentPlanSameIds.household.people[1] = {
      ...removedPerson!,
      name: 'Unrelated person reusing the same id',
    }

    // `flushSync`, not `act()`, on purpose: `act()` — sync or async — also
    // flushes React's passive effects before returning control, so an
    // `act()`-wrapped render cannot tell a render-phase reset apart from a
    // `useEffect` that reaches the same end state one commit later; both
    // read back as already-corrected by the time `act()` returns (this is
    // why an earlier version of this test, wrapped in `act(() => {...})`,
    // could not have caught the regression it described — nor can a bare,
    // unwrapped `root.render()`, since `createRoot`'s updates are themselves
    // scheduled through React's own async work loop and may not have
    // committed AT ALL by the time an unwrapped call returns). `flushSync`
    // forces the render and commit to complete synchronously — DOM mutations
    // included — but deliberately leaves passive effects (`useEffect`) on
    // their normal, later, scheduled pass. The render-phase `seenPlanId`
    // pattern in `AddScenario` (documented above it) never commits the stale
    // recipient at all, so this synchronous read already shows it cleared. A
    // `useEffect`-based reset would commit the id-colliding, WRONG-person
    // recipient on this same synchronous flush and only clear it on the
    // effect's follow-up commit, which has not happened yet — so this
    // assertion would fail if the reset regressed back into an effect.
    flushSync(() => {
      root.render(
        <MemoryRouter>
          <WorkspaceReadOnlyContext.Provider value={false}>
            <PlanCtx.Provider value={contextFor(differentPlanSameIds)}>
              <ScenariosPage />
            </PlanCtx.Provider>
          </WorkspaceReadOnlyContext.Provider>
        </MemoryRouter>,
      )
    })

    const nextRecipientLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Care recipient',
    )!
    const nextRecipient = document.getElementById(nextRecipientLabel.htmlFor) as HTMLSelectElement
    expect(nextRecipient.value).toBe('')

    // Settle the (no-op, in the correct implementation) passive-effect pass
    // this render scheduled, so the test doesn't leave pending React work
    // for `afterEach`'s unmount to absorb.
    await act(async () => {})
  })

  it('sanitizes retained property choices across plan switches, deletion, and a single-property view', async () => {
    const original = createSamplePlan()
    const originalHome = original.accounts.find((account) => account.type === 'property')!
    original.accounts.push({
      ...originalHome,
      id: 'original-second-property',
      name: 'Original second property',
    })
    await mount(original)
    const leverSelect = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      leverSelect.value = 'homeSale'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const propertyLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Property to sell',
    )!
    const propertySelect = document.getElementById(propertyLabel.htmlFor) as HTMLSelectElement
    await act(async () => {
      propertySelect.value = 'original-second-property'
      propertySelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const differentPlan = createSamplePlan()
    differentPlan.id = 'different-property-plan'
    const differentHome = differentPlan.accounts.find((account) => account.type === 'property')!
    differentPlan.accounts.push(
      { ...differentHome, id: 'different-second-property', name: 'Different second property' },
      { ...differentHome, id: 'different-third-property', name: 'Different third property' },
    )
    await rerenderWithPlan(differentPlan)

    let currentPropertyLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Property to sell',
    )!
    let currentPropertySelect = document.getElementById(
      currentPropertyLabel.htmlFor,
    ) as HTMLSelectElement
    expect(currentPropertySelect.value).toBe('')
    expect(container.textContent).toContain('Choose a property before modeling a sale')

    await act(async () => {
      currentPropertySelect.value = 'different-third-property'
      currentPropertySelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const afterDeletion = structuredClone(differentPlan)
    afterDeletion.accounts = afterDeletion.accounts.filter(
      (account) => account.id !== 'different-third-property',
    )
    await rerenderWithPlan(afterDeletion)

    currentPropertyLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent === 'Property to sell',
    )!
    currentPropertySelect = document.getElementById(
      currentPropertyLabel.htmlFor,
    ) as HTMLSelectElement
    expect(currentPropertySelect.value).toBe('')
    expect(container.textContent).toContain('Choose a property before modeling a sale')

    await act(async () => {
      currentPropertySelect.value = 'different-second-property'
      currentPropertySelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const singleProperty = structuredClone(afterDeletion)
    singleProperty.accounts = singleProperty.accounts.filter(
      (account) => account.id !== 'different-second-property',
    )
    await rerenderWithPlan(singleProperty)

    expect(
      Array.from(container.querySelectorAll('label')).some(
        (label) => label.textContent === 'Property to sell',
      ),
    ).toBe(false)
    expect(container.textContent).toContain('Accounts')
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )
    expect(add?.disabled).toBe(false)
  })

  it('writes the selected relocation month into the scenario request', async () => {
    const plan = createSamplePlan()
    let updatedPlan: Plan | null = null
    await mount(plan, [], false, (mutator) => {
      const next = structuredClone(plan)
      mutator(next)
      updatedPlan = next
    })
    const leverSelect = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      leverSelect.value = 'relocation'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const moveMonthLabel = Array.from(container.querySelectorAll('label')).find(
      (label) => label.textContent?.startsWith('Move month'),
    )!
    const moveMonth = document.getElementById(moveMonthLabel.htmlFor) as HTMLInputElement
    const inputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    await act(async () => {
      inputValueSetter.call(moveMonth, '10')
      moveMonth.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await advanceLeverPreview()
    const add = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Add scenario'),
    )!
    await act(async () => add.click())

    expect(updatedPlan).not.toBeNull()
    const scenario = updatedPlan!.scenarios.at(-1)!
    const applied = scenariosModule.applyScenarioPatch(plan, scenario.patch)
    expect(applied.ok).toBe(true)
    if (applied.ok) {
      expect(applied.plan.household.stateMoves).toEqual([
        expect.objectContaining({ fromMonth: 10 }),
      ])
    }
  })

  it('shows recalculating and error states without ever labeling a failed detail comparison current', async () => {
    mockedComparePlans.mockImplementationOnce(() => {
      throw new Error('detail comparison failed')
    })

    await mount()
    expect(container.textContent).toContain('Deterministic comparison · Recalculating…')
    expect(container.textContent).toContain('Stochastic comparison · Recalculating…')
    expect(container.textContent).not.toContain('Deterministic comparison · Current')

    await advanceComparison()

    expect(container.textContent).toContain('Deterministic comparison · Error')
    expect(container.textContent).toContain('Stochastic comparison · Error')
    expect(container.textContent).not.toContain('comparison · Current')
    const alerts = container.querySelectorAll('[role="alert"][aria-live="assertive"]')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.classList).toContain('sr-only')
    expect(alerts[0]!.textContent).toBe('detail comparison failed')
    const visibleError = Array.from(container.querySelectorAll('p')).find(
      (paragraph) => paragraph.textContent === 'detail comparison failed',
    )
    expect(visibleError).toBeTruthy()
    expect(visibleError!.hasAttribute('role')).toBe(false)
  })

  // PR #754 finding 6: compareScalars refuses a figure that is not finite.
  // The detail view says which side and what to check, in plain words.
  it('states a detail comparison refused for a figure that is not finite in plain words', async () => {
    mockedComparePlans.mockImplementationOnce(() => {
      throw new NonFiniteComparisonError('proposal', Number.NaN)
    })
    await mount()
    await advanceComparison()
    const sentence =
      "This scenario can't be compared with your plan: one of the scenario's figures could not be computed. Check the scenario's changes, then compare again."
    expect(container.textContent).toContain('Deterministic comparison · Error')
    const visibleError = Array.from(container.querySelectorAll('p')).find((paragraph) => paragraph.textContent === sentence)
    expect(visibleError).toBeTruthy()
    expect(container.textContent).not.toContain('NaN')
    expect(container.textContent).not.toContain('finite number')
  })

  // PR #754 finding 6: a side-by-side run that throws inside its timer used to
  // leave the overview's placeholder up for good.
  it('states a failed overview run in plain words instead of leaving its placeholder up', async () => {
    mockedCompareScenarios.mockImplementationOnce(() => {
      throw new NonFiniteComparisonError('baseline', Number.POSITIVE_INFINITY)
    })
    await mount()
    await advanceComparison()
    expect(container.querySelector('[aria-label="Comparing scenarios"]')).toBeNull()
    expect(container.textContent).toContain(
      "The scenarios can't be compared right now: one of the figures could not be computed. Check each scenario's changes, then open this page again.",
    )
    expect(container.textContent).not.toContain('Infinity')
  })

  it('starts a fresh comparison with the new calendar year after a rerender', async () => {
    vi.setSystemTime(new Date('2026-12-31T17:00:00Z'))
    const plan = await mount()
    const leverSelect = container.querySelector<HTMLSelectElement>('select')!
    await act(async () => {
      leverSelect.value = 'rothSchedule'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const inputFor = (labelText: string) => {
      const label = Array.from(container.querySelectorAll('label')).find(
        (candidate) => candidate.textContent === labelText,
      )!
      return document.getElementById(label.htmlFor) as HTMLInputElement
    }
    expect(inputFor('Start year').value).toBe('2026')
    expect(inputFor('End year').value).toBe('2030')
    const inputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    await act(async () => {
      inputValueSetter.call(inputFor('End year'), '2029')
      inputFor('End year').dispatchEvent(new Event('input', { bubbles: true }))
    })
    await advanceComparison()
    expect(mockedComparePlans.mock.calls.at(-1)![2].startYear).toBe(2026)

    vi.setSystemTime(new Date('2027-01-02T17:00:00Z'))
    await rerenderWithPlan(plan)
    await advanceComparison()

    expect(mockedComparePlans.mock.calls.at(-1)![2].startYear).toBe(2027)
    expect(mockedCompareScenarios.mock.calls.at(-1)![1].startYear).toBe(2027)
    expect(inputFor('Start year').value).toBe('2027')
    expect(inputFor('End year').value).toBe('2030')

    await act(async () => {
      leverSelect.value = 'relocation'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(inputFor('Move year').value).toBe('2028')

    await act(async () => {
      leverSelect.value = 'homeSale'
      leverSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(inputFor('Property sale year').value).toBe('2032')
  })

  it('does not inspect or compare a draft that PlanContext marks invalid', async () => {
    const invalidPlan = {
      ...createSamplePlan(),
      scenarios: undefined,
    } as unknown as Plan

    await mount(invalidPlan, ['scenarios: Required'])
    await advanceComparison()

    expect(container.textContent).toContain('Scenario comparison unavailable')
    expect(container.querySelector('[aria-label="Comparing scenarios"]')).toBeNull()
    expect(container.querySelector('[aria-label="Comparing selected scenario"]')).toBeNull()
    expect(mockedSnapshotHash).not.toHaveBeenCalled()
    expect(mockedCompareScenarios).not.toHaveBeenCalled()
    expect(mockedComparePlans).not.toHaveBeenCalled()
    expect(container.querySelectorAll('[role="alert"][aria-live="assertive"]')).toHaveLength(1)
  })

  it('surfaces a fingerprint failure without running comparisons or leaving a skeleton', async () => {
    mockedSnapshotHash.mockImplementationOnce(() => {
      throw new Error('fingerprint failed')
    })

    await mount()
    await advanceComparison()

    expect(container.textContent).toContain('baseline plan could not be prepared for comparison')
    expect(container.querySelector('[aria-label="Comparing scenarios"]')).toBeNull()
    expect(container.querySelector('[aria-label="Comparing selected scenario"]')).toBeNull()
    expect(mockedCompareScenarios).not.toHaveBeenCalled()
    expect(mockedComparePlans).not.toHaveBeenCalled()
    expect(container.querySelectorAll('[role="alert"][aria-live="assertive"]')).toHaveLength(1)
  })

  it('rejects a detail result whose provenance no longer matches the active request', async () => {
    mockedComparePlans.mockImplementationOnce((baseline, proposal, options) => {
      const stale = actualComparison.compareScenarioPlans(baseline, proposal, {
        ...options,
        stochastic: undefined,
      })
      return {
        ...stale,
        provenance: {
          ...stale.provenance,
          proposalSnapshotHash: 'fnv1a64:stale00000000000',
        },
      }
    })

    await mount()
    await advanceComparison()

    expect(container.textContent).toContain('Deterministic comparison · Recalculating…')
    expect(container.textContent).not.toContain('Deterministic comparison · Current')
    expect(container.textContent).not.toContain('Headline outcomes')
  })

  it('keeps a capacity failure visible with only one assertive announcement', async () => {
    mockedRunSpendingSolve
      .mockRejectedValueOnce(new Error('capacity comparison failed'))
      .mockResolvedValueOnce(solved)
    await mount()
    await advanceComparison()

    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    await act(async () => {
      calculate!.click()
      await Promise.resolve()
    })

    const alerts = container.querySelectorAll('[role="alert"][aria-live="assertive"]')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.textContent).toBe('capacity comparison failed')
    const visibleError = Array.from(container.querySelectorAll('p')).find(
      (paragraph) => paragraph.textContent === 'capacity comparison failed',
    )
    expect(visibleError).toBeTruthy()
    expect(visibleError!.hasAttribute('role')).toBe(false)
  })

  it('shows the no-Worker reason when the capacity solves cannot start', async () => {
    mockedRunSpendingSolve.mockRejectedValue(new WorkerUnavailableError())
    await mount()
    await advanceComparison()
    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    await act(async () => {
      calculate!.click()
      await Promise.resolve()
    })
    const alerts = container.querySelectorAll('[role="alert"][aria-live="assertive"]')
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.textContent).toBe(WORKER_UNAVAILABLE_MESSAGE)
    expect(Array.from(container.querySelectorAll('p')).some((p) => p.textContent === WORKER_UNAVAILABLE_MESSAGE)).toBe(true)
  })

  it("names each side's unpriced credit years in plain words instead of the raw engine sentence", async () => {
    const unpriced: SpendingSolveResult = {
      ...solved,
      acaGrossPremiumYears: [2028, 2029, 2030],
      acaGrossPremiumReasons: ['tax-year-parameters-unsupported'],
      acaGrossPremiumDirection: 'uncertain',
      diagnostics: [
        'The ACA premium tax credit is not priced in 2028, 2029, 2030 (tax-year-parameters-unsupported); the ledger budgets the full Marketplace premium in those years, and a credit there could move this answer up or down because the spending guardrails respond to healthcare costs.',
      ],
    }
    mockedRunSpendingSolve.mockResolvedValueOnce(solved).mockResolvedValueOnce(unpriced)
    await mount()
    await advanceComparison()

    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    await act(async () => {
      calculate!.click()
      await Promise.resolve()
    })

    expect(container.textContent).toContain(
      "Proposal: The premium tax credit isn't counted in 2028 to 2030: RetireGolden doesn't have the credit's figures for those years yet. " +
        'The projection pays the full Marketplace premium in those years; a credit then could move this answer up or down, ' +
        'because your spending guardrails respond to what healthcare costs.',
    )
    expect(container.textContent).not.toContain('tax-year-parameters-unsupported')
    expect(container.textContent).not.toContain('Baseline: The premium tax credit')
  })

  it('says a sustained $72,030 base with a −$30 slack is sustained, beside a side that is not', async () => {
    // The proposal's base passes and is the answer: published $72,000 (rounded
    // down to $100), slack −$30, sustained. The baseline is above its frontier.
    const sustained: SpendingSolveResult = {
      ...solved,
      maxBaseAnnual: 72_000,
      feasibleBaseAnnual: 72_030,
      maxBaseAnnualRounding: 'down-to-hundred',
      spendingSlackDollars: -30,
      currentBaseAnnual: 72_030,
      sustainsCurrentBase: true,
    }
    const short: SpendingSolveResult = {
      ...solved,
      maxBaseAnnual: 90_000,
      feasibleBaseAnnual: 90_050,
      maxBaseAnnualRounding: 'down-to-hundred',
      spendingSlackDollars: -6_000,
      sustainsCurrentBase: false,
    }
    mockedRunSpendingSolve.mockResolvedValueOnce(short).mockResolvedValueOnce(sustained)
    await mount()
    await advanceComparison()

    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    await act(async () => {
      calculate!.click()
      await Promise.resolve()
    })

    const status = Array.from(container.querySelectorAll('table')).find(
      (table) => table.querySelector('caption')?.textContent === 'Capacity solve status',
    )!
    const header = Array.from(status.querySelectorAll('thead th')).map((cell) => cell.textContent)
    expect(header).toEqual(['Plan', 'Status', 'Simulations', 'Limiting constraint', 'Current base spending'])
    const rows = Array.from(status.querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.querySelectorAll('th, td')).map((cell) => cell.textContent),
    )
    expect(rows.map((row) => [row[0], row[4]])).toEqual([
      ['Baseline', 'Not sustained'],
      ['Proposal', 'Sustained'],
    ])
    const capacityTable = Array.from(container.querySelectorAll('table')).find(
      (table) => table.querySelector('caption')?.textContent?.startsWith('Sustainable spending capacity') === true,
    )!
    const slackRow = Array.from(capacityTable.querySelectorAll('tbody tr')).find((row) =>
      row.textContent?.startsWith('Slack vs. current base spending'),
    )!
    expect(slackRow.textContent).toContain('−$30')
    expect(container.textContent).toContain(
      "the status table says whether each plan's current base spending is sustained.",
    )
  })

  it('says a note both sides share once, for both', async () => {
    const unpriced: SpendingSolveResult = {
      ...solved,
      acaGrossPremiumYears: [2027, 2028],
      acaGrossPremiumReasons: ['missing-year-contract'],
      acaGrossPremiumDirection: 'conservative',
      diagnostics: ['The ACA premium tax credit is not priced in 2027, 2028 (missing-year-contract); the ledger budgets the full Marketplace premium in those years, so a household that receives a credit there would likely be able to spend somewhat more than this answer.'],
    }
    mockedRunSpendingSolve.mockResolvedValueOnce(unpriced).mockResolvedValueOnce(unpriced)
    await mount()
    await advanceComparison()

    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    await act(async () => {
      calculate!.click()
      await Promise.resolve()
    })

    const text = container.textContent
    expect(text).toContain(
      "Baseline and proposal: The premium tax credit isn't counted in 2027 and 2028: the planner doesn't yet collect the household details the credit needs.",
    )
    expect(text.match(/The premium tax credit isn't counted/g)).toHaveLength(1)
    expect(text).not.toContain('missing-year-contract')
  })

  it('clears an in-flight capacity request when switching between equivalent scenarios', async () => {
    const plan = createSamplePlan()
    plan.scenarios = [
      { id: 'equivalent-a', name: 'Equivalent A', patch: { expenses: { baseAnnual: 105_000 } } },
      { id: 'equivalent-b', name: 'Equivalent B', patch: { expenses: { baseAnnual: 105_000 } } },
    ]
    const summary = {
      endingNetWorth: 1_000_000,
      endingAfterTaxEstate: 900_000,
      lifetimeTaxesAndPenalties: 250_000,
      depletionYear: null,
    } as ScenarioComparison['rows'][number]['summary']
    mockedCompareScenarios.mockReturnValue({
      rows: [
        { scenarioId: null, name: 'Base plan', summary, error: null, diff: [], successRate: null, changesNothing: false },
        { scenarioId: 'equivalent-a', name: 'Equivalent A', summary, error: null, diff: [], successRate: null, changesNothing: false },
        { scenarioId: 'equivalent-b', name: 'Equivalent B', summary, error: null, diff: [], successRate: null, changesNothing: false },
      ],
    })
    const baselineSolve = deferred<SpendingSolveResult>()
    const proposalSolve = deferred<SpendingSolveResult>()
    mockedRunSpendingSolve
      .mockReturnValueOnce(baselineSolve.promise)
      .mockReturnValueOnce(proposalSolve.promise)

    await mount(plan)
    await advanceComparison()
    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    await act(async () => calculate!.click())
    expect(calculate!.disabled).toBe(true)

    const equivalentB = container.querySelector<HTMLInputElement>('input[aria-label="Compare Equivalent B"]')
    await act(async () => equivalentB!.click())

    const currentCalculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    expect(currentCalculate).toBeTruthy()
    expect(currentCalculate!.disabled).toBe(false)

    await act(async () => {
      baselineSolve.resolve(solved)
      proposalSolve.resolve(solved)
      await Promise.resolve()
    })
    expect(mockedCompareCapacity).not.toHaveBeenCalled()
    expect(currentCalculate!.disabled).toBe(false)
  })

  it('says a scenario changes nothing, with dashes for its figures, in the table and in the detail panel (review L4, H04, H05)', async () => {
    // Decision D-SCENARIO-JSON-LOSS: a scenario whose plan is the base plan
    // is never shown as a copy of the baseline's figures.
    const plan = createSamplePlan()
    plan.scenarios = [{ id: 'same', name: 'Same spending', patch: { expenses: { baseAnnual: plan.expenses.baseAnnual } } }]
    const summary = {
      endingNetWorth: 1_234_000,
      endingAfterTaxEstate: 987_000,
      lifetimeTaxesAndPenalties: 345_000,
      depletionYear: null,
    } as ScenarioComparison['rows'][number]['summary']
    mockedCompareScenarios.mockReturnValue({
      rows: [
        { scenarioId: null, name: 'Base plan', summary, error: null, diff: [], successRate: null, changesNothing: false },
        { scenarioId: 'same', name: 'Same spending', summary, error: null, diff: [], successRate: null, changesNothing: true },
      ],
    })
    await mount(plan)
    await advanceComparison()

    const radio = container.querySelector<HTMLInputElement>('input[aria-label="Compare Same spending"]')
    const cells = Array.from(radio!.closest('tr')!.querySelectorAll('td')).map((cell) => cell.textContent)
    expect(cells[1]).toBe('Same spendingThis scenario changes nothing in your plan.')
    expect(cells.slice(2, 6)).toEqual(['—', '—', '—', '—'])
    // The baseline row keeps its figures.
    const baseCells = Array.from(container.querySelectorAll('tbody tr')[0]!.querySelectorAll('td')).map((cell) => cell.textContent)
    expect(baseCells.slice(2, 6)).toEqual(['$1.23M', '$987k', '$345k', 'never'])
    // The detail panel says it too, in place of a comparison.
    const notices = Array.from(container.querySelectorAll('p')).filter(
      (paragraph) => paragraph.textContent === 'This scenario changes nothing in your plan.',
    )
    expect(notices).toHaveLength(1)
    expect(container.querySelector('[aria-label="Comparing selected scenario"]')).toBeNull()
  })

  it('pairs baseline and scenario on the engine default seed (D-MC-DEFAULT-SEED)', async () => {
    await mount()
    await advanceComparison()
    const stochastic = mockedComparePlans.mock.calls[0]![2].stochastic
    expect(stochastic?.seed).toBe(6_221_293)
    expect(stochastic?.pathCount).toBe(200)
  })

  it('uses per-plan taxes and discards capacity results after the detail request changes', async () => {
    const baselineSolve = deferred<SpendingSolveResult>()
    const proposalSolve = deferred<SpendingSolveResult>()
    mockedRunSpendingSolve
      .mockReturnValueOnce(baselineSolve.promise)
      .mockReturnValueOnce(proposalSolve.promise)
    const plan = await mount()
    await advanceComparison()

    expect(mockedCompareScenarios.mock.calls[0]![1].taxCalculatorForPlan).toBe(taxCalculatorFor)
    expect(mockedComparePlans.mock.calls[0]![2].taxCalculatorForPlan).toBe(taxCalculatorFor)

    const calculate = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Calculate capacity',
    )
    expect(calculate).toBeTruthy()
    await act(async () => calculate!.click())

    expect(mockedRunSpendingSolve).toHaveBeenCalledTimes(2)
    const baselineRequest = mockedRunSpendingSolve.mock.calls[0]![0]
    const proposalRequest = mockedRunSpendingSolve.mock.calls[1]![0]
    expect(baselineRequest.plan).toBe(plan)
    expect(baselineRequest.startYear).toBe(proposalRequest.startYear)
    expect(proposalRequest.plan).not.toBe(plan)
    expect(proposalRequest.plan.assumptions.ssHaircut).toEqual(TRUSTEES_DEFAULT_SS_HAIRCUT)

    const sharedMarketRisk = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(sharedMarketRisk).toBeTruthy()
    await act(async () => sharedMarketRisk!.click())
    await advanceComparison()

    await act(async () => {
      baselineSolve.resolve(solved)
      proposalSolve.resolve(solved)
      await Promise.resolve()
    })

    expect(mockedCompareCapacity).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Calculate capacity')
    expect(container.textContent).not.toContain('Solved annual base spending')
  })
})
