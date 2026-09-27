/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 (review F6): the Insight preview's own Monte Carlo call. The
 * previewed plan must run at the base run's path count (check correction 9)
 * on the model built from the base plan (correction 11), whatever run the KPI
 * bar published for the plan. Here the published base run is a coarse
 * 200-path run, so a call at the default 1,000 paths, or options built from
 * the previewed plan, is seen at the call site.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { spendingGuardrails } from '@retiregolden/engine/insights/detectors/spendingGuardrails'
import type { InsightCard } from '@retiregolden/engine/insights/types'
import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import type { MonteCarloRunOptions } from '../../mc/pool'
import { packForYear } from '@retiregolden/engine/params'
import { projectPlan } from '../../projection'
import { appExamplePlanById } from '../../testSupport/appExamples'
import { settle, waitFor } from '../../testSupport/settle'
import { EXAMPLE_FIXED_YEAR } from '../examples/buildContext'
import { PlanCtx, type PlanContextValue } from '../planContextCore'

vi.mock('../../mc/pool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../mc/pool')>()),
  runMonteCarlo: vi.fn(async (_plan: Plan, options: MonteCarloRunOptions) => ({
    successRate: 0.6,
    pathCount: options.pathCount,
  })),
}))
vi.mock('../useMcSuccessRate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../useMcSuccessRate')>()
  return { ...actual, headlineMcRunOptions: vi.fn(actual.headlineMcRunOptions) }
})

import { runMonteCarlo } from '../../mc/pool'
import { headlineMcRunOptions, publishMcHeadline } from '../useMcSuccessRate'
import { InsightCardView } from './InsightCardView'

function guardrailsCard(plan: Plan): InsightCard {
  const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
  const card = spendingGuardrails.screen({
    plan,
    projection: detectorProjection(view.result, view.summary),
    params: packForYear(EXAMPLE_FIXED_YEAR).pack,
  })
  if (card === null) throw new Error('the spending-guardrails card is not offered')
  return card
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR}-07-01T12:00:00.000Z`))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

async function previewCard(plan: Plan) {
  const card = guardrailsCard(plan)
  const context: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={context}>
          <InsightCardView card={card} onDismiss={() => {}} />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Preview impact')!
  await act(async () => button.click())
  await settle()
  await waitFor(() => /Monte Carlo success: (\S+ pts|no change|—)/u.test(container.textContent ?? ''), {
    what: 'the Monte Carlo line',
    attempts: 28_000,
  })
}

describe('the Insight preview Monte Carlo call (B2-P1 slice 3, review F6)', () => {
  beforeEach(() => {
    vi.mocked(runMonteCarlo).mockClear()
    vi.mocked(headlineMcRunOptions).mockClear()
  })

  it('runs the previewed plan at the published base run path count, on options built from the base plan', async () => {
    // bracket-fill-roth: the exact evaluation does not refuse, so the pair runs.
    const plan = appExamplePlanById('bracket-fill-roth')
    publishMcHeadline(plan, { successRate: 0.5, pathCount: 200 } as MonteCarloSummary, EXAMPLE_FIXED_YEAR)
    await previewCard(plan)

    // The published 200-path run is the base; the previewed plan ran once, at 200 paths.
    const runs = vi.mocked(runMonteCarlo).mock.calls
    expect(runs).toHaveLength(1)
    const [previewedPlan, options] = runs[0]!
    expect(previewedPlan).not.toBe(plan)
    expect(previewedPlan.id).toBe(plan.id)
    expect(options.pathCount).toBe(200)
    expect(options.startYear).toBe(EXAMPLE_FIXED_YEAR)
    // The options were built from the base plan object, at the base run's path count and start year.
    expect(vi.mocked(headlineMcRunOptions)).toHaveBeenCalledWith(plan, 200, EXAMPLE_FIXED_YEAR)
    const built = vi.mocked(headlineMcRunOptions).mock.calls.find(([p]) => p === previewedPlan)
    expect(built).toBeUndefined()
    // 0.5 -> 0.6 on the same 200 paths.
    expect(container.textContent).toContain('Monte Carlo success: +10.0 pts')
    expect(container.querySelector('.insight-error')).toBeNull()
  }, 300_000)

  // PR #754 findings 1 and 2: a published run outlives a New Year when the
  // plan is not edited. The previewed plan runs from the published run's start
  // year, so the pair is one market; from the clock's new year it would be a
  // different horizon, which the engine refuses.
  it('runs the previewed plan from the published run start year after a New Year', async () => {
    const plan = appExamplePlanById('bracket-fill-roth')
    publishMcHeadline(plan, { successRate: 0.5, pathCount: 200 } as MonteCarloSummary, EXAMPLE_FIXED_YEAR)
    vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR + 1}-01-02T12:00:00.000Z`))
    await previewCard(plan)
    const runs = vi.mocked(runMonteCarlo).mock.calls
    expect(runs).toHaveLength(1)
    expect(runs[0]![1].startYear).toBe(EXAMPLE_FIXED_YEAR)
    expect(container.textContent).toContain('Monte Carlo success: +10.0 pts')
    expect(container.querySelector('.insight-error')).toBeNull()
  }, 300_000)

  it('with nothing published, runs the headline and the previewed plan from one start year, the clock one', async () => {
    const plan = appExamplePlanById('bracket-fill-roth')
    await previewCard(plan)
    const runs = vi.mocked(runMonteCarlo).mock.calls
    expect(runs).toHaveLength(2)
    expect(runs[0]![0]).toBe(plan)
    expect(runs.map(([, options]) => options.startYear)).toEqual([EXAMPLE_FIXED_YEAR, EXAMPLE_FIXED_YEAR])
    expect(runs.map(([, options]) => options.pathCount)).toEqual([1_000, 1_000])
    // The mocked pool gives both plans 0.6.
    expect(container.textContent).toContain('Monte Carlo success: no change')
  }, 300_000)
})
