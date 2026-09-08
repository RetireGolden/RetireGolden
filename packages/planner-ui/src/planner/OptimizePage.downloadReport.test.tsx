/** @vitest-environment jsdom */
/**
 * Download recommendation report (#672 / #426): a worker crash drops the held
 * result, so the button stays disabled after Try again until a run actually
 * produces a recommendation. Design QA saw this on Roth & Tax Optimizer when
 * the shared planner worker TDZ'd (`Cannot access 'oe' before initialization`)
 * on every spawn — retry could not enable the download.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'

vi.mock('../optimize/runner', () => ({ runOptimize: vi.fn() }))
vi.mock('../mc/pool', () => ({
  DEFAULT_PATH_COUNT: 100,
  runMonteCarlo: vi.fn().mockResolvedValue({ successRate: 0.91 }),
}))

import { runOptimize } from '../optimize/runner'
import type { OptimizeResult } from '../optimize/messages'
import { OptimizePage } from './OptimizePage'

const mockedRunOptimize = vi.mocked(runOptimize)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.clearAllMocks()
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

async function mount(plan: Plan) {
  await act(async () => {
    root.render(
      <MemoryRouter>
        <PlanCtx.Provider value={contextFor(plan)}>
          <OptimizePage />
        </PlanCtx.Provider>
      </MemoryRouter>,
    )
  })
  await settle()
}

async function settle() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
}

/** A recommendable candidate win — enough for the page to enable the report. */
function recommendableResult(): OptimizeResult {
  return {
    schedule: {
      status: 'optimal',
      endingAfterTax: 1_000_000,
      lifetimeTax: 100_000,
      schedule: [],
      conversions: [{ year: 2027, amount: 60_000 }],
      solveMs: 1,
    },
    postProcessed: null,
    tournament: {
      policyId: 'max-after-tax-estate',
      winnerSource: 'candidate',
      winnerCandidateId: 'fill-22',
      winnerLabel: 'Fill the 22% bracket',
      winnerConversions: [{ year: 2027, amount: 60_000 }],
      winnerValidation: {
        recommendationState: 'beneficial',
        afterTaxEstateDelta: 65_000,
        lifetimeTaxDelta: 12_000,
        moneyLastsYearsDelta: 0,
        requestedConversionTotal: 60_000,
        executedConversionTotal: 60_000,
        baseline: { endingAfterTaxEstate: 935_000 },
        candidate: { endingAfterTaxEstate: 1_000_000 },
      },
      marginOverMilpDollars: 9_000,
      candidates: [
        {
          id: 'fill-22',
          label: 'Fill the 22% bracket',
          executedConversionTotal: 60_000,
          afterTaxEstateDelta: 65_000,
          lifetimeTaxDelta: 12_000,
          moneyLastsYearsDelta: 0,
        },
      ],
      retirementActionReadinessVeto: null,
      retirementActionPromotion: null,
      acaActionabilityVeto: null,
      searchRefined: true,
      searchSimulations: 8,
    },
    convergence: {},
    claimAge: null,
  } as unknown as OptimizeResult
}

const findButton = (text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent === text)

describe('Optimize download recommendation report (#672)', () => {
  it('stays disabled after a worker TDZ, then enables after a successful retry', async () => {
    mockedRunOptimize
      .mockRejectedValueOnce(
        new Error("Uncaught ReferenceError: Cannot access 'oe' before initialization"),
      )
      .mockResolvedValueOnce(recommendableResult())

    await mount(createSamplePlan())

    expect(container.textContent).toContain(
      "Optimizer error: Uncaught ReferenceError: Cannot access 'oe' before initialization",
    )
    const downloadWhileFailed = findButton('Download recommendation report')
    expect(downloadWhileFailed, 'download control stays on screen after a crash').toBeTruthy()
    expect(downloadWhileFailed!.disabled, 'no held result — #426 / Design QA retry').toBe(true)

    const tryAgain = findButton('Try again')
    expect(tryAgain).toBeTruthy()
    await act(async () => tryAgain!.click())
    await settle()

    expect(container.textContent).not.toContain('Optimizer error:')
    expect(container.textContent).toContain('Fill the 22% bracket')
    const downloadAfterRetry = findButton('Download recommendation report')
    expect(downloadAfterRetry).toBeTruthy()
    expect(downloadAfterRetry!.disabled, 'successful retry restores a reportable result').toBe(false)
  })
})
