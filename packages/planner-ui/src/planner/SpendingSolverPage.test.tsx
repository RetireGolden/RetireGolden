/** @vitest-environment jsdom */
/**
 * "How much can I spend?" page statements (D-SOLVER-ACA-GATE, 2026-09-26):
 * the note naming the years whose premium tax credit the answer does not
 * count, the failure well's fixed-costs sentence only after a probe that ran
 * and failed, and the hero judging today's baseline by the solver's exact
 * answer rather than by the figure rounded down to $100.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'

import type { Plan } from '@retiregolden/engine/model/plan'
import { PlanCtx, type PlanContextValue } from './planContextCore'
import { createSamplePlan } from '../testSupport/samplePlan'
import type { SpendingSolveResult } from '../optimize/spendingMessages'
import { runSpendingSolveRequest } from '../optimize/runSpendingSolve'
import { EXAMPLE_FIXED_YEAR, exampleFixedNow } from './examples/buildContext'
import { getExampleById } from './examples/registry'

vi.mock('../optimize/spendingRunner', () => ({ runSpendingSolve: vi.fn() }))
import { runSpendingSolve } from '../optimize/spendingRunner'
import { SpendingSolverPage } from './SpendingSolverPage'

const mockedSolve = vi.mocked(runSpendingSolve)

const FIXED_COSTS = 'Fixed costs modeled outside baseline spending'

function solved(overrides: Partial<SpendingSolveResult>): SpendingSolveResult {
  return {
    maxBaseAnnual: 92_450,
    spendingSlackDollars: 12_450,
    currentBaseAnnual: 80_000,
    estateFloorTodayDollars: 0,
    converged: true,
    limitingConstraint: 'depletion',
    simulationCount: 10,
    acaGrossPremiumYears: [],
    acaGrossPremiumReasons: [],
    acaGrossPremiumDirection: null,
    diagnostics: [],
    evidence: {
      endingAfterTaxEstate: 500_000,
      endingNetWorth: 500_000,
      lifetimeTaxesAndPenalties: 100_000,
      depletionYear: null,
      endYear: 2075,
    },
    ...overrides,
  }
}

/** As `loadExample.ts#stampDemo` stamps a library demo before the planner opens it. */
function stampedExample(id: string): Plan {
  const example = getExampleById(id)
  if (!example) throw new Error(`no example ${id}`)
  return {
    ...example.build(),
    id: `example--${id}`,
    name: example.title,
    origin: 'example',
    exampleSourceId: id,
    createdAtIso: exampleFixedNow().toISOString(),
    updatedAtIso: exampleFixedNow().toISOString(),
  }
}

describe('SpendingSolverPage statements', () => {
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
    vi.restoreAllMocks()
  })

  async function renderSolved(plan: Plan = createSamplePlan()): Promise<void> {
    const ctx: PlanContextValue = {
      plan,
      update: () => {},
      discardPendingSave: () => {},
      saveState: 'saved',
      issues: [],
    }
    await act(async () => {
      root.render(
        <MemoryRouter>
          <PlanCtx.Provider value={ctx}>
            <SpendingSolverPage />
          </PlanCtx.Provider>
        </MemoryRouter>,
      )
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400)) // past the 300 ms auto-run debounce
    })
  }

  function heroHeading(): HTMLHeadingElement {
    const heading = container.querySelector<HTMLHeadingElement>('.mc-hero h2')
    expect(heading, 'the answer hero should render').toBeTruthy()
    return heading!
  }

  it('names the unpriced credit years under the answer for early-retiree-aca', async () => {
    // The example's real solve, from the examples' fixed start year.
    mockedSolve.mockImplementation((req) => Promise.resolve(runSpendingSolveRequest({ ...req, startYear: EXAMPLE_FIXED_YEAR })))
    await renderSolved(stampedExample('early-retiree-aca'))

    expect(heroHeading().textContent).toContain('$45,300')
    const note = container.querySelector('[data-testid="aca-gross-premium-note"]')
    expect(note?.textContent).toBe(
      "The premium tax credit isn't counted in 2027 and 2028: the credit's figures for those years aren't published yet. " +
        'The projection pays the full Marketplace premium in those years; if you receive a credit then, you would likely be able to spend somewhat more than this.',
    )
  })

  it('shows no credit note when every year is priced', async () => {
    mockedSolve.mockResolvedValue(solved({}))
    await renderSolved()
    expect(container.querySelector('[data-testid="aca-gross-premium-note"]')).toBeNull()
  })

  it('says nothing about fixed costs after a solve that could not run a probe', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: null,
        spendingSlackDollars: null,
        limitingConstraint: null,
        simulationCount: 1,
        diagnostics: ['required annual spending cannot exceed baseline (target) annual spending'],
        evidence: null,
      }),
    )
    await renderSolved()
    const well = container.querySelector('.solver-failure')
    expect(well?.textContent).toContain('required annual spending cannot exceed baseline')
    expect(well?.textContent).not.toContain(FIXED_COSTS)
  })

  it('replaces the raw unpriced-credit sentence in the failure well with the plain note', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: null,
        spendingSlackDollars: null,
        limitingConstraint: 'depletion',
        simulationCount: 2,
        acaGrossPremiumYears: [2026, 2027, 2028],
        acaGrossPremiumReasons: ['below-100-fpl-exception-unsupported', 'tax-year-parameters-unsupported'],
        acaGrossPremiumDirection: 'conservative',
        diagnostics: [
          'Even zero base spending depletes the portfolio or breaks the estate floor.',
          'The ACA premium tax credit is not priced in 2026, 2027, 2028 (below-100-fpl-exception-unsupported, tax-year-parameters-unsupported); the ledger budgets the full Marketplace premium in those years, and a credit there would lower that cost.',
        ],
        evidence: null,
      }),
    )
    await renderSolved()
    const well = container.querySelector('.solver-failure')!.textContent!
    expect(well).toContain('Even zero base spending depletes')
    expect(well).not.toContain('below-100-fpl-exception-unsupported')
    expect(container.querySelector('[data-testid="aca-gross-premium-note"]')?.textContent).toBe(
      "The premium tax credit isn't counted in 2026 to 2028. In each of those years, at least one of these applies: " +
        'income is below the poverty line, where there is generally no credit and Medicaid may apply; ' +
        "the credit's figures for those years aren't published yet. " +
        'The projection pays the full Marketplace premium in those years; a credit then would lower that cost.',
    )
  })

  it('names the required floor instead of blaming fixed costs when the floor fails', async () => {
    const plan = createSamplePlan()
    plan.expenses.requiredAnnual = Math.min(34_000, plan.expenses.baseAnnual)
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: null,
        spendingSlackDollars: null,
        limitingConstraint: 'depletion',
        simulationCount: 2,
        diagnostics: ['Even the required spending floor ($34,000/yr) depletes the portfolio or breaks the estate floor.'],
        evidence: null,
      }),
    )
    await renderSolved(plan)
    const well = container.querySelector('.solver-failure')!.textContent!
    expect(well).toContain('Even the required spending floor ($34,000/yr) depletes')
    expect(well).not.toContain(FIXED_COSTS)
  })

  it('does not blame fixed costs when only the bequest target fails', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: null,
        spendingSlackDollars: null,
        limitingConstraint: 'estate-floor',
        simulationCount: 2,
        estateFloorTodayDollars: 2_000_000,
        diagnostics: ['Even zero base spending depletes the portfolio or breaks the estate floor.'],
        evidence: null,
      }),
    )
    await renderSolved()
    expect(container.querySelector('.solver-failure')?.textContent).not.toContain(FIXED_COSTS)
  })

  it('keeps the fixed-costs sentence after a real depletion', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: null,
        spendingSlackDollars: null,
        limitingConstraint: 'depletion',
        simulationCount: 2,
        diagnostics: ['Even zero base spending depletes the portfolio or breaks the estate floor.'],
        evidence: null,
      }),
    )
    await renderSolved()
    expect(container.querySelector('.solver-failure')?.textContent).toContain(FIXED_COSTS)
  })

  it('does not call a baseline the plan sustains unsustainable because the shown figure is rounded down', async () => {
    // Today's base 72,030; the seed probe at 72,030 passed and is the answer.
    // The page shows 72,000, $30 under the baseline, but the baseline holds.
    mockedSolve.mockResolvedValue(solved({ maxBaseAnnual: 72_030, spendingSlackDollars: 0, currentBaseAnnual: 72_030 }))
    await renderSolved()

    const heading = heroHeading()
    expect(heading.textContent).toContain('$72,000')
    expect(heading.style.color).toBe('var(--good)')
    const hero = container.querySelector('.mc-hero')!.textContent!
    expect(hero).toContain('That covers your current $72,030 baseline with less than $100 a year to spare')
    expect(hero).not.toContain('BELOW')
    expect(hero).not.toContain('cannot sustain')
    const tiles = container.querySelector('.stat-grid')!.textContent!
    expect(tiles).toContain('Under $100/yr')
    expect(tiles).not.toContain('-$30')
  })

  it('says the plan cannot sustain today’s spending when the exact answer is below it by depletion', async () => {
    mockedSolve.mockResolvedValue(solved({ maxBaseAnnual: 71_950, spendingSlackDollars: -80, currentBaseAnnual: 72_030 }))
    await renderSolved()

    expect(heroHeading().style.color).toBe('var(--bad)')
    const hero = container.querySelector('.mc-hero')!.textContent!
    expect(hero).toContain('That is $130 per year BELOW your current $72,030 baseline.')
    expect(hero).toContain("Your projection cannot sustain today's spending through the horizon.")
  })

  it('names the bequest target when the estate floor is what limits the answer', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: 61_400,
        spendingSlackDollars: -10_630,
        currentBaseAnnual: 72_030,
        estateFloorTodayDollars: 300_000,
        limitingConstraint: 'estate-floor',
      }),
    )
    await renderSolved()

    expect(heroHeading().style.color).toBe('var(--bad)')
    const hero = container.querySelector('.mc-hero')!.textContent!
    expect(hero).toContain("Your projection cannot sustain today's spending and still leave your bequest target.")
    expect(hero).not.toContain('through the horizon')
  })
})
