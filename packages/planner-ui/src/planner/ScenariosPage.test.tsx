/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'

import type { Plan } from '@retiregolden/engine/model/plan'
import { TRUSTEES_DEFAULT_SS_HAIRCUT } from '@retiregolden/engine/params'
import type { ScenarioPlanComparison } from '@retiregolden/engine/scenarios/comparison'
import type { SpendingSolveResult } from '../optimize/spendingMessages'
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

vi.mock('../optimize/spendingRunner', () => ({ runSpendingSolve: vi.fn() }))

import * as comparisonModule from '@retiregolden/engine/scenarios/comparison'
import * as scenariosModule from '@retiregolden/engine/scenarios/scenarios'
import { runSpendingSolve } from '../optimize/spendingRunner'
import { MetricTable, ScenariosPage } from './ScenariosPage'
import {
  formatMetricValue,
  formatScenarioDelta,
  isScenarioComparisonCurrent,
  scenarioOverviewRequestKey,
  spendingCapacityStatus,
} from './scenarioComparisonView'

const actualComparison = await vi.importActual<typeof import('@retiregolden/engine/scenarios/comparison')>(
  '@retiregolden/engine/scenarios/comparison',
)
const mockedComparePlans = vi.mocked(comparisonModule.compareScenarioPlans)
const mockedCompareCapacity = vi.mocked(comparisonModule.compareScenarioSpendingCapacityResults)
const mockedCompareScenarios = vi.mocked(scenariosModule.compareScenarios)
const mockedRunSpendingSolve = vi.mocked(runSpendingSolve)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((fulfill) => {
    resolve = fulfill
  })
  return { promise, resolve }
}

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

  function contextFor(plan: Plan): PlanContextValue {
    return {
      plan,
      update: () => undefined,
      discardPendingSave: () => undefined,
      saveState: 'saved',
      issues: [],
    }
  }

  async function mount(plan = createSamplePlan()) {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <ScenariosPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    return plan
  }

  async function advanceComparison() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
  }

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

  it('starts a fresh comparison with the new calendar year after a rerender', async () => {
    vi.setSystemTime(new Date('2026-12-31T17:00:00Z'))
    const plan = await mount()
    await advanceComparison()
    expect(mockedComparePlans.mock.calls.at(-1)![2].startYear).toBe(2026)

    vi.setSystemTime(new Date('2027-01-02T17:00:00Z'))
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <ScenariosPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await advanceComparison()

    expect(mockedComparePlans.mock.calls.at(-1)![2].startYear).toBe(2027)
    expect(mockedCompareScenarios.mock.calls.at(-1)![1].startYear).toBe(2027)
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
