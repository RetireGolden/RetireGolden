/** @vitest-environment jsdom */
/**
 * PR #754: the Insights card's preview says a refusal or failure in plain
 * words with a next step, never in the engine's wording: a figure that could
 * not be computed, two Monte Carlo runs on different path counts or from
 * different start years, a detector that found nothing to preview (in its own
 * words), and anything else.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { MonteCarloComparisonRefusal } from '@retiregolden/engine/decisions/stochastic'
import { detectorProjection } from '@retiregolden/engine/insights/detectorProjection'
import { spendingGuardrails } from '@retiregolden/engine/insights/detectors/spendingGuardrails'
import { InsightPreviewUnavailable } from '@retiregolden/engine/insights/previewUnavailable'
import type { InsightCard } from '@retiregolden/engine/insights/types'
import type { MonteCarloSummary } from '@retiregolden/engine/montecarlo/run'
import { packForYear } from '@retiregolden/engine/params'
import { NonFiniteComparisonError } from '@retiregolden/engine/scenarios/scalarComparison'
import type { MonteCarloRunOptions } from '../../mc/pool'
import { projectPlan } from '../../projection'
import { appExamplePlanById } from '../../testSupport/appExamples'
import { settle, waitFor } from '../../testSupport/settle'
import { EXAMPLE_FIXED_YEAR } from '../examples/buildContext'
import { PlanCtx, type PlanContextValue } from '../planContextCore'

vi.mock('../../mc/pool', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../mc/pool')>()),
  runMonteCarlo: vi.fn(async (_plan: Plan, options: MonteCarloRunOptions) => ({ successRate: 0.6, pathCount: options.pathCount })),
}))
vi.mock('@retiregolden/engine/decisions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@retiregolden/engine/decisions')>()
  return { ...actual, compareMonteCarloSuccessRates: vi.fn(actual.compareMonteCarloSuccessRates) }
})

import { compareMonteCarloSuccessRates } from '@retiregolden/engine/decisions'
import { publishMcHeadline } from '../useMcSuccessRate'
import { InsightCardView } from './InsightCardView'

const BANNED = ['NaN', 'Infinity', 'YYYY-MM-DD', 'baseline', 'proposal', 'finite number', 'inflationScale']

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
  vi.mocked(compareMonteCarloSuccessRates).mockReset()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

/** Preview the guardrails card on bracket-fill-roth (its exact evaluation is not refused) and return the alert text. */
async function previewError(): Promise<string> {
  const plan = appExamplePlanById('bracket-fill-roth')
  publishMcHeadline(plan, { successRate: 0.5, pathCount: 200 } as MonteCarloSummary, EXAMPLE_FIXED_YEAR)
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
  await waitFor(() => container.querySelector('.insight-error') !== null, { what: 'the preview error', attempts: 28_000 })
  return container.querySelector('.insight-error')!.textContent ?? ''
}

describe('the Insights card preview states refusals in plain words (PR #754)', () => {
  const cases: [string, () => Error, string][] = [
    [
      'a previewed figure that could not be computed',
      () => new NonFiniteComparisonError('proposal', Number.NaN),
      "No preview is shown for this insight: one of the previewed plan's figures could not be computed. Check your plan's inputs, then preview again.",
    ],
    [
      'a plan figure that could not be computed',
      () => new NonFiniteComparisonError('baseline', Number.POSITIVE_INFINITY),
      "No preview is shown for this insight: one of your plan's figures could not be computed. Check your plan's Results page, then preview again.",
    ],
    [
      'two Monte Carlo runs on different path counts',
      () => new MonteCarloComparisonRefusal('path-counts-differ', 'Success rates are compared only on the same number of paths; the baseline ran 200 and the proposal 1000'),
      "The Monte Carlo line isn't shown: your plan's success rate and the preview's came from different numbers of simulated markets. Preview again to run both on the same markets.",
    ],
    [
      'two Monte Carlo runs from different start years',
      () => new MonteCarloComparisonRefusal('start-years-differ', 'Success rates are compared only from one start year; the baseline starts in 2026 and the proposal in 2027'),
      "The Monte Carlo line isn't shown: your plan's success rate and the preview's came from simulations that start in different years. Preview again to run both on the same markets.",
    ],
    [
      'any other failure',
      () => new Error('Monte Carlo worker failed'),
      "No preview is shown for this insight: it could not be worked out for your plan. Preview it again; if it still fails, check your plan's Results page.",
    ],
  ]
  for (const [what, refusal, sentence] of cases) {
    it(`states ${what}`, async () => {
      vi.mocked(compareMonteCarloSuccessRates).mockImplementation(() => {
        throw refusal()
      })
      const text = await previewError()
      expect(text).toBe(sentence)
      for (const banned of BANNED) expect(text, banned).not.toContain(banned)
    }, 300_000)
  }

  it("shows a detector's own reason when it found nothing to preview", async () => {
    const reason = 'No beneficial asset-location swap was found once taxes, taxable drag, and rebalancing were priced in.'
    vi.spyOn(spendingGuardrails, 'evaluate').mockImplementation(() => {
      throw new InsightPreviewUnavailable(reason)
    })
    const text = await previewError()
    expect(text).toBe(reason)
  }, 300_000)
})
