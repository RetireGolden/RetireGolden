/** @vitest-environment jsdom */
/**
 * B2-P1 slice 3 parity for the Insight preview's Monte Carlo line (R11): the
 * spending-guardrails preview now runs the headline configuration (the model
 * built from the base plan, the engine's default seed, and the base run's path
 * count, reusing the run whose rate the KPI bar shows) and prints the engine's
 * compareMonteCarloSuccessRates. On bracket-fill-roth the line moves from the
 * retired "+25.2 pts" (historical returns, 250 paths; kept here) to
 * "+22.5 pts", asserted as a change. A preview the exact evaluation refuses
 * for unpriced credit years says so in plain words.
 *
 * Re-measured 2026-09-28 (decision D-MC-DEFAULT-SEED): every plan now draws
 * from the engine's default seed, 0x5eeded, instead of a hash of the plan id.
 * On the plan-id seed the pair read "+25.1 pts" (66.8% to 91.9%) and the
 * retired preview "+30.8 pts" (55.2% to 86.0%); on the default seed they read
 * "+22.5 pts" (68.0% to 90.5%) and "+25.2 pts" (62.0% to 87.2%), the figures
 * the independent check of the diagnosis measured (section 4.4). The move is
 * sampling noise, not a model change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { compareMonteCarloSuccessRates } from '@retiregolden/engine/decisions'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { spendingGuardrails } from '@retiregolden/engine/insights/detectors/spendingGuardrails'
import type { InsightCard } from '@retiregolden/engine/insights/types'
import { aggregateMonteCarlo, mergePathResults, type MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { packForYear } from '@retiregolden/engine/params'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'
import { runMonteCarlo } from '../../mc/pool'
import { runMcRequest } from '../../mc/runRequest'
import { projectPlan } from '../../projection'
import { appExamplePlanById } from '../../testSupport/appExamples'
import { settle, waitFor } from '../../testSupport/settle'
import { EXAMPLE_FIXED_YEAR } from '../examples/buildContext'
import { PlanCtx, type PlanContextValue } from '../planContextCore'
import { headlineMcRun, headlineMcRunOptions, publishMcHeadline } from '../useMcSuccessRate'
import { DEFAULT_MONTE_CARLO_SEED } from '@retiregolden/engine/montecarlo/rng'
import { InsightCardView } from './InsightCardView'
import { formatMcDelta } from './mcDeltaFormat'

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

function previewedPlan(plan: Plan, card: InsightCard): Plan {
  if (card.action.kind !== 'preview-scenario') throw new Error('not a preview card')
  const applied = applyScenarioPatch(plan, card.action.patch)
  if (!applied.ok) throw new Error(applied.issues.join('; '))
  return applied.plan
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${EXAMPLE_FIXED_YEAR}-07-01T12:00:00.000Z`))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the Insight preview Monte Carlo line on bracket-fill-roth (B2-P1 slice 3)', () => {
  it('splitting the paths across workers gives the same delta, bit for bit', () => {
    const plan = appExamplePlanById('bracket-fill-roth')
    const previewed = previewedPlan(plan, guardrailsCard(plan))
    const options = headlineMcRunOptions(plan, 200)
    const run = (p: Plan, slices: [number, number][]) => ({
      startYear: options.startYear,
      ...aggregateMonteCarlo(
        mergePathResults(
          slices.map(([firstPathIndex, pathCount]) =>
            runMcRequest({
              kind: 'monteCarlo',
              plan: p,
              startYear: options.startYear,
              seed: options.seed,
              model: options.model,
              pathCount,
              firstPathIndex,
              progressEvery: pathCount,
            }),
          ),
        ),
      ),
    })
    const single = compareMonteCarloSuccessRates(run(plan, [[0, 200]]), run(previewed, [[0, 200]]))
    const split = compareMonteCarloSuccessRates(run(plan, [[0, 80], [80, 120]]), run(previewed, [[0, 120], [120, 80]]))
    expect(Object.is(split.delta, single.delta)).toBe(true)
    expect(Object.is(single.delta, single.proposal - single.baseline)).toBe(true)
  }, 300_000)

  it('reuses a published finer headline run as the base, and runs the previewed plan at its path count', async () => {
    const plan = appExamplePlanById('bracket-fill-roth')
    publishMcHeadline(plan, { successRate: 0.5, pathCount: 10_000 } as MonteCarloSummary, EXAMPLE_FIXED_YEAR)
    const base = await headlineMcRun(plan)
    expect(base).toEqual({ successRate: 0.5, pathCount: 10_000, startYear: EXAMPLE_FIXED_YEAR })
    expect(headlineMcRunOptions(plan, base.pathCount, base.startYear).pathCount).toBe(10_000)
    // A 1,000-path previewed run against it is refused, not printed.
    expect(() => compareMonteCarloSuccessRates(base, { successRate: 0.6, pathCount: 1_000, startYear: EXAMPLE_FIXED_YEAR })).toThrow(RangeError)
  })
})

describe('the rendered Insight card (B2-P1 slice 3)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  function contextFor(plan: Plan): PlanContextValue {
    return { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
  }

  async function preview(plan: Plan) {
    const card = guardrailsCard(plan)
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={contextFor(plan)}>
            <InsightCardView card={card} onDismiss={() => {}} />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    const button = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Preview impact')!
    await act(async () => button.click())
    await settle()
  }

  it('bracket-fill-roth: prints +22.5 pts on the headline configuration, where the retired preview printed +25.2 pts', async () => {
    const plan = appExamplePlanById('bracket-fill-roth')
    await preview(plan)
    await waitFor(() => (container.textContent ?? '').includes('pts'), { what: 'the Monte Carlo line', attempts: 28_000 })
    expect(container.textContent).toContain('Monte Carlo success: +22.5 pts')

    // The base side is the headline run the KPI bar shares for this plan
    // object: 1,000 paths on the headline configuration.
    const base = await headlineMcRun(plan)
    expect(base.pathCount).toBe(1_000)

    // The retired preview: historical returns drawn independently, 60 percent
    // equity, 250 paths, the default seed, on both plans.
    const previewed = previewedPlan(plan, guardrailsCard(plan))
    const retiredOptions = {
      startYear: EXAMPLE_FIXED_YEAR,
      pathCount: 250,
      seed: DEFAULT_MONTE_CARLO_SEED,
      model: { type: 'historical' as const, mode: 'iid' as const, equityWeightPct: 60 },
    }
    const [retiredBase, retiredPatch] = await Promise.all([runMonteCarlo(plan, retiredOptions), runMonteCarlo(previewed, retiredOptions)])
    expect(formatMcDelta(retiredPatch.successRate - retiredBase.successRate)).toEqual({ flat: false, good: true, text: '+25.2 pts' })
  }, 300_000)

  it('example-couple: the refused preview names the unpriced credit years and why, in plain words', async () => {
    await preview(appExamplePlanById('example-couple'))
    await waitFor(() => container.querySelector('.insight-error') !== null, { what: 'the refusal' })
    const text = container.querySelector('.insight-error')!.textContent ?? ''
    // The base plan's credit is unpriced in 2028 and 2029 (no figures yet);
    // under the previewed guardrail policy it is unpriced from 2026 as well,
    // because the credit is not modeled together with guardrail spending.
    expect(text).toBe(
      "No preview is shown for this plan. The premium tax credit isn't counted in 2026 to 2029. In each of those " +
        "years, at least one of these applies: RetireGolden doesn't have the credit's figures for those years yet; " +
        "the credit isn't modeled together with guardrail spending. Guardrail spending changes how much you withdraw " +
        'each year, and your withdrawals change the credit, so a preview that leaves the credit out could come out too ' +
        'high or too low.',
    )
    expect(text).not.toContain('non-actionable')
  }, 120_000)
})
