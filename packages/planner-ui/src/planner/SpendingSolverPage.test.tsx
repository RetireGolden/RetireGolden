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

/**
 * A worker result as the engine publishes it: the level that passed
 * (feasibleBaseAnnual), the published answer rounded down to $100
 * (maxBaseAnnual), and the slack measured from the published answer.
 */
function solved(overrides: Partial<SpendingSolveResult>): SpendingSolveResult {
  return {
    maxBaseAnnual: 92_400,
    feasibleBaseAnnual: 92_450,
    maxBaseAnnualRounding: 'down-to-hundred',
    initialWithdrawalRatePct: null,
    spendingSlackDollars: 12_400,
    currentBaseAnnual: 80_000,
    estateFloorTodayDollars: 0,
    converged: true,
    limitingConstraint: 'depletion',
    simulationCount: 10,
    acaGrossPremiumYears: [],
    acaGrossPremiumReasons: [],
    acaGrossPremiumDirection: null,
    zeroSpendingDepletes: false,
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

    // 2027 is priced on its published credit figures (decision
    // D-ACA-2027-TABLE), which moves the answer from $45,313 to $45,625 and
    // leaves 2028 as the one unpriced year.
    expect(heroHeading().textContent).toContain('$45,600')
    const note = container.querySelector('[data-testid="aca-gross-premium-note"]')
    expect(note?.textContent).toBe(
      "The premium tax credit isn't counted in 2028: RetireGolden doesn't have the credit's figures for that year yet. " +
        'The projection pays the full Marketplace premium in that year; if you receive a credit then, you would likely be able to spend somewhat more than this.',
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
          'Even zero base spending depletes the portfolio before the plan ends.',
          'The ACA premium tax credit is not priced in 2026, 2027, 2028 (below-100-fpl-exception-unsupported, tax-year-parameters-unsupported); the ledger budgets the full Marketplace premium in those years, and a credit there would lower that cost.',
        ],
        evidence: null,
      }),
    )
    await renderSolved()
    const well = container.querySelector('.solver-failure')!.textContent
    expect(well).toContain('Even zero base spending depletes')
    expect(well).not.toContain('below-100-fpl-exception-unsupported')
    expect(container.querySelector('[data-testid="aca-gross-premium-note"]')?.textContent).toBe(
      "The premium tax credit isn't counted in 2026 to 2028. In each of those years, at least one of these applies: " +
        'income is below the poverty line, where there is generally no credit and Medicaid may apply; ' +
        "RetireGolden doesn't have the credit's figures for those years yet. " +
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
        diagnostics: ['Even the required spending floor ($34,000/yr) depletes the portfolio before the plan ends.'],
        evidence: null,
      }),
    )
    await renderSolved(plan)
    const well = container.querySelector('.solver-failure')!.textContent
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
        diagnostics: ['Even zero base spending depletes the portfolio before the plan ends.'],
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
        zeroSpendingDepletes: true,
        diagnostics: ['Even zero base spending depletes the portfolio before the plan ends.'],
        evidence: null,
      }),
    )
    await renderSolved()
    expect(container.querySelector('.solver-failure')?.textContent).toContain(FIXED_COSTS)
  })

  it('does not blame fixed costs when the budget stopped before zero spending was tried', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: null,
        spendingSlackDollars: null,
        limitingConstraint: 'depletion',
        simulationCount: 1,
        zeroSpendingDepletes: false,
        diagnostics: ['Simulation budget exhausted before any feasible spending level was found.'],
        evidence: null,
      }),
    )
    await renderSolved()
    const well = container.querySelector('.solver-failure')!.textContent
    expect(well).toContain('Simulation budget exhausted')
    expect(well).not.toContain(FIXED_COSTS)
  })

  async function applyWith(
    policy: 'fixedTarget' | 'withdrawalRateGuardrails',
    result: SpendingSolveResult = solved({}),
  ): Promise<Plan> {
    mockedSolve.mockResolvedValue(result)
    const plan = createSamplePlan()
    plan.expenses.spendingPolicy = { mode: policy }
    let applied: Plan = plan
    const ctx: PlanContextValue = {
      plan,
      update: (fn) => {
        const draft = structuredClone(plan)
        fn(draft)
        applied = draft
      },
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
      await new Promise((r) => setTimeout(r, 400))
    })
    const applyButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Apply to Spending')
    await act(async () => applyButton!.click())
    return applied
  }

  it('applies the published figure at fixed-target spending', async () => {
    const applied = await applyWith('fixedTarget')
    expect(applied.expenses.baseAnnual).toBe(92_400)
    expect(container.textContent).toContain("sets your plan's baseline spending to $92,400/yr")
    expect(container.textContent).not.toContain('was run too')
  })

  it('applies the rounded figure under guardrail spending once the engine has run it and it passes', async () => {
    const applied = await applyWith('withdrawalRateGuardrails')
    expect(applied.expenses.baseAnnual).toBe(92_400)
    expect(container.textContent).toContain("sets your plan's baseline spending to $92,400/yr")
    expect(container.textContent).toContain('so that rounded figure was run too, and it passes')
  })

  it('shows and applies the exact amount when the rounded figure fails under guardrail spending, and says why', async () => {
    const why =
      "The answer is the exact amount that passed ($92,450/yr), not rounded down to $92,400/yr: under this plan's guardrail spending that lower level was run and runs out of money before the plan ends."
    const applied = await applyWith(
      'withdrawalRateGuardrails',
      solved({
        maxBaseAnnual: 92_450,
        feasibleBaseAnnual: 92_450,
        maxBaseAnnualRounding: 'none',
        spendingSlackDollars: 12_450,
        diagnostics: [why],
      }),
    )
    expect(applied.expenses.baseAnnual).toBe(92_450)
    expect(heroHeading().textContent).toContain('$92,450')
    expect(container.querySelector('[data-testid="exact-answer-note"]')!.textContent).toBe(why)
    expect(container.textContent).toContain("sets your plan's baseline spending to $92,450/yr")
    expect(container.querySelector('.ss-explainer')!.textContent).toContain(
      'at that exact amount, not rounded down to the nearest $100, for the reason given above',
    )
  })

  it('does not call a baseline the plan sustains unsustainable because the shown figure is rounded down', async () => {
    // Today's base 72,030; the seed probe at 72,030 passed and is the answer.
    // The page shows 72,000, $30 under the baseline, but the baseline holds.
    mockedSolve.mockResolvedValue(
      solved({ maxBaseAnnual: 72_000, feasibleBaseAnnual: 72_030, spendingSlackDollars: -30, currentBaseAnnual: 72_030 }),
    )
    await renderSolved()

    const heading = heroHeading()
    expect(heading.textContent).toContain('$72,000')
    expect(heading.style.color).toBe('var(--good)')
    const hero = container.querySelector('.mc-hero')!.textContent
    expect(hero).toContain('That covers your current $72,030 baseline with less than $100 a year to spare')
    expect(hero).not.toContain('BELOW')
    expect(hero).not.toContain('cannot sustain')
    const tiles = container.querySelector('.stat-grid')!.textContent
    expect(tiles).toContain('Under $100/yr')
    expect(tiles).not.toContain('-$30')
  })

  it('says the plan cannot sustain today’s spending when the exact answer is below it by depletion', async () => {
    mockedSolve.mockResolvedValue(
      solved({ maxBaseAnnual: 71_900, feasibleBaseAnnual: 71_950, spendingSlackDollars: -130, currentBaseAnnual: 72_030 }),
    )
    await renderSolved()

    expect(heroHeading().style.color).toBe('var(--bad)')
    const hero = container.querySelector('.mc-hero')!.textContent
    expect(hero).toContain('That is $130 per year BELOW your current $72,030 baseline.')
    expect(hero).toContain("Your projection cannot sustain today's spending through the horizon.")
  })

  it('names the bequest target when the estate floor is what limits the answer', async () => {
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: 61_400,
        feasibleBaseAnnual: 61_437,
        spendingSlackDollars: -10_630,
        currentBaseAnnual: 72_030,
        estateFloorTodayDollars: 300_000,
        limitingConstraint: 'estate-floor',
      }),
    )
    await renderSolved()

    expect(heroHeading().style.color).toBe('var(--bad)')
    const hero = container.querySelector('.mc-hero')!.textContent
    expect(hero).toContain("Your projection cannot sustain today's spending and still leave your bequest target.")
    expect(hero).not.toContain('through the horizon')
  })

  it('judges a fractional baseline against the whole-dollar level the solver seeded', async () => {
    // Base 72,030.40 is seeded at 72,030; that seed passed and is the answer.
    mockedSolve.mockResolvedValue(
      solved({ maxBaseAnnual: 72_000, feasibleBaseAnnual: 72_030, spendingSlackDollars: -30.4, currentBaseAnnual: 72_030.4 }),
    )
    await renderSolved()

    expect(heroHeading().style.color).toBe('var(--good)')
    const hero = container.querySelector('.mc-hero')!.textContent
    expect(hero).toContain('less than $100 a year to spare')
    expect(hero).not.toContain('cannot sustain')
  })

  it('says why the rounded figure passes: implied at fixed-target spending, run under guardrail spending', async () => {
    mockedSolve.mockResolvedValue(solved({}))
    const fixedTarget = createSamplePlan()
    fixedTarget.expenses.spendingPolicy = { mode: 'fixedTarget' }
    await renderSolved(fixedTarget)
    expect(container.querySelector('.ss-explainer')!.textContent).toContain('a lower level is expected to pass when a higher one does')

    await act(async () => root.unmount())
    root = createRoot(container)
    const guardrails = createSamplePlan()
    guardrails.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    await renderSolved(guardrails)
    const explainer = container.querySelector('.ss-explainer')!.textContent
    expect(explainer).not.toContain('expected to pass when a higher one does')
    expect(explainer).toContain('so that rounded figure was run too, and it passes')
  })

  it('describes the solve that ran, not a spending policy the plan switched to before the next solve lands', async () => {
    async function show(plan: Plan): Promise<void> {
      const ctx: PlanContextValue = { plan, update: () => {}, discardPendingSave: () => {}, saveState: 'saved', issues: [] }
      await act(async () => {
        root.render(
          <MemoryRouter>
            <PlanCtx.Provider value={ctx}>
              <SpendingSolverPage />
            </PlanCtx.Provider>
          </MemoryRouter>,
        )
      })
    }
    const explainer = () => container.querySelector('.ss-explainer')!.textContent
    const applyHint = () => container.querySelector('.ss-explainer')!.previousElementSibling!.textContent
    // Solved at fixed-target spending (the rounded figure published without a
    // run of its own); the plan then switches to guardrails, and until the next
    // solve lands (it never does here) the copy still describes that solve.
    mockedSolve.mockResolvedValueOnce(solved({})).mockReturnValue(new Promise<SpendingSolveResult>(() => {}))
    const fixedTarget = createSamplePlan()
    fixedTarget.expenses.spendingPolicy = { mode: 'fixedTarget' }
    await renderSolved(fixedTarget)
    await show({ ...fixedTarget, expenses: { ...fixedTarget.expenses, spendingPolicy: { mode: 'withdrawalRateGuardrails' } } })
    expect(explainer()).toContain('at fixed-target spending a lower level is expected to pass when a higher one does')
    expect(explainer()).not.toContain('was run too')
    expect(applyHint()).not.toContain('was run too')

    // And the reverse: solved under guardrails, then switched to fixed target.
    await act(async () => root.unmount())
    root = createRoot(container)
    mockedSolve.mockReset()
    mockedSolve.mockResolvedValueOnce(solved({})).mockReturnValue(new Promise<SpendingSolveResult>(() => {}))
    const guardrails = createSamplePlan()
    guardrails.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
    await renderSolved(guardrails)
    await show({ ...guardrails, expenses: { ...guardrails.expenses, spendingPolicy: { mode: 'fixedTarget' } } })
    expect(explainer()).toContain('so that rounded figure was run too, and it passes')
    expect(explainer()).not.toContain('expected to pass when a higher one does')
    expect(applyHint()).toContain('so that rounded figure was run too, and it passes')
  })

  async function solveShapes(rows: Partial<SpendingSolveResult>[], plan: Plan = createSamplePlan()): Promise<string> {
    // The first call is the page's own auto-run; the next three are the shapes.
    let call = 0
    mockedSolve.mockImplementation(() => Promise.resolve(solved(call++ === 0 ? {} : rows[(call - 2) % rows.length]!)))
    await renderSolved(plan)
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Solve per shape'))
    expect(button, 'the shape comparison button should render').toBeTruthy()
    await act(async () => {
      button!.click()
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(container.querySelector('[aria-label="Spending shape comparison"]'), 'the shape table should render').toBeTruthy()
    const card = Array.from(container.querySelectorAll('.card')).find(
      (element) => element.querySelector('h2')?.textContent === 'What shape of spending?',
    )
    return card!.textContent
  }

  it("names the union of the shapes' unpriced years once, collapsed into a run", async () => {
    const text = await solveShapes([
      { acaGrossPremiumYears: [2028, 2029], acaGrossPremiumReasons: ['tax-year-parameters-unsupported'], acaGrossPremiumDirection: 'conservative' },
      { acaGrossPremiumYears: [2028, 2029, 2030], acaGrossPremiumReasons: ['tax-year-parameters-unsupported'], acaGrossPremiumDirection: 'conservative' },
      { acaGrossPremiumYears: [2029], acaGrossPremiumReasons: ['tax-year-parameters-unsupported'], acaGrossPremiumDirection: 'conservative' },
    ])
    expect(text).toContain(
      "In these solves the premium tax credit isn't counted in 2028 to 2030, so they pay the full Marketplace premium then; " +
        'if you receive a credit in those years, you would likely be able to spend somewhat more than these amounts.',
    )
  })

  it('uses the guardrail wording for the shapes of a guardrail plan', async () => {
    const text = await solveShapes([
      { acaGrossPremiumYears: [2027], acaGrossPremiumReasons: ['guardrail-interaction-unsupported'], acaGrossPremiumDirection: 'uncertain' },
    ])
    expect(text).toContain(
      'a credit in those years could move these amounts up or down, because your spending guardrails respond to what healthcare costs.',
    )
    expect(text).not.toContain('would likely be able to spend somewhat more')
  })

  it('adds nothing to the shape table when every shape prices its credit', async () => {
    const text = await solveShapes([{}])
    expect(text).not.toContain('premium tax credit')
  })

  it('does not call an exact published amount rounded when the baseline holds with under $100 to spare', async () => {
    // A guardrail plan whose rounded amount failed publishes the exact 72,030;
    // today's base 72,030.40 was seeded at 72,030 and passed.
    mockedSolve.mockResolvedValue(
      solved({
        maxBaseAnnual: 72_030,
        feasibleBaseAnnual: 72_030,
        maxBaseAnnualRounding: 'none',
        sustainsCurrentBase: true,
        spendingSlackDollars: -0.4,
        currentBaseAnnual: 72_030.4,
      }),
    )
    await renderSolved()
    const hero = container.querySelector('.mc-hero')!.textContent
    expect(hero).toContain('less than $100 a year to spare')
    expect(hero).not.toContain('rounded down to the nearest $100')
  })

  it("judges today's baseline on the engine's verdict, not on the slack's sign", async () => {
    mockedSolve.mockResolvedValue(
      solved({ maxBaseAnnual: 72_000, feasibleBaseAnnual: 72_030, sustainsCurrentBase: true, spendingSlackDollars: -30, currentBaseAnnual: 72_030 }),
    )
    await renderSolved()
    expect(heroHeading().style.color).toBe('var(--good)')
    expect(container.querySelector('.mc-hero')!.textContent).not.toContain('cannot sustain')
  })

  it("prints the evidence estate in today's dollars as the engine converted it, beside the nominal figure", async () => {
    mockedSolve.mockResolvedValue(
      solved({
        evidence: {
          endingAfterTaxEstate: 500_000,
          endingAfterTaxEstateTodayDollars: 400_000,
          endingNetWorth: 500_000,
          lifetimeTaxesAndPenalties: 100_000,
          depletionYear: null,
          endYear: 2075,
        },
      }),
    )
    await renderSolved()
    const evidence = Array.from(container.querySelectorAll('.card')).find(
      (element) => element.querySelector('h2')?.textContent === 'Evidence at that level',
    )!
    expect(evidence.textContent).toContain("$400,000 today's dollars ($500,000 nominal)")
  })
})
