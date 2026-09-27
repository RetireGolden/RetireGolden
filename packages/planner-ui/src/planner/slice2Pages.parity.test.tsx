/** @vitest-environment jsdom */
/**
 * B2-P1 slice 2, rendered: the pages print the engine's figures in the right
 * places.
 *
 * - The risk-based guardrail thresholds (R3) on the Spending card, the
 *   Results callout and the Monte Carlo page: the cut figure where the cut is
 *   named and the raise figure where the raise is, from
 *   `guardrailThresholdDollars`; with no investable balance the percents and
 *   the sentence saying there is no dollar figure; with the cut threshold not
 *   below the raise threshold the sentence saying the rule holds spending.
 * - The threshold solve persists the solver's `balancePct` (two decimals),
 *   not the fraction.
 * - The Income floor quote prints the engine's yield unscaled and each
 *   buy-list row's own maturity year.
 */
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { quotePlanLadder } from '@retiregolden/engine/ladder/ladderMath'
import { parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { guardrailThresholdDollars, solveRiskBasedGuardrails } from '@retiregolden/engine/montecarlo/riskBasedGuardrails'
import { createSamplePlan } from '../testSupport/samplePlan'
import { waitFor } from '../testSupport/settle'
import { fmtMoney } from './format'
import { MonteCarloPage } from './MonteCarloPage'
import { PlanCtx } from './planContextCore'
import { ResultsPage } from './ResultsPage'
import { IncomeFloorSection } from './sections/IncomeFloorSection'
import { RiskBasedThresholdsCallout } from './sections/SpendingPolicyRiskBased'
import { useThresholdSolve, type ThresholdSolve } from './sections/useThresholdSolve'
import { currentStartYear } from './useProjection'

vi.mock('./useMcSuccessRate', async (importOriginal) => {
  const original = await importOriginal<typeof import('./useMcSuccessRate')>()
  return { ...original, useMcSuccessRateState: () => ({ rate: null, status: 'running', pathCount: 1_000 }) }
})

vi.mock('../mc/pool', async (importOriginal) => {
  const original = await importOriginal<typeof import('../mc/pool')>()
  return {
    ...original,
    // Keep the page's own run tiny.
    runMonteCarlo: vi.fn((plan: Plan, opts: Parameters<typeof original.runMonteCarlo>[1]) =>
      original.runMonteCarlo(plan, { ...opts, pathCount: 8 }),
    ),
    // The threshold solve through the solver's test seam: success min(1, f / 2m).
    runRiskBasedGuardrailSolve: vi.fn((plan: Plan, opts: Parameters<typeof original.runRiskBasedGuardrailSolve>[1]) =>
      Promise.resolve(
        solveRiskBasedGuardrails(plan, {
          startYear: opts.startYear,
          taxCalculator: undefined as never,
          model: opts.model,
          pathCount: 1,
          seed: 1,
          successProbe: (f: number, m: number) => Math.min(1, f / (2 * m)),
        }),
      ),
    ),
  }
})

let root: Root | null = null
let container: HTMLDivElement | null = null

afterEach(async () => {
  if (root !== null) await act(async () => root!.unmount())
  container?.remove()
  root = null
  container = null
})

function validPlan(mutate: (plan: Plan) => void): Plan {
  const plan = createSamplePlan()
  mutate(plan)
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function riskBased(lower: number, upper: number, zeroBalances = false): Plan {
  return validPlan((plan) => {
    plan.expenses.spendingPolicy = { mode: 'riskBasedGuardrails', lowerBalanceThresholdPct: lower, upperBalanceThresholdPct: upper }
    if (zeroBalances) {
      for (const account of plan.accounts) if ('balance' in account) account.balance = 0
    }
  })
}

/** Mounts `child` under a plan context whose `update` records the drafted plan. */
async function mount(initialPlan: Plan, child: React.ReactNode, onUpdate?: (plan: Plan) => void): Promise<HTMLDivElement> {
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
              onUpdate?.(next)
              return next
            }),
          discardPendingSave: () => undefined,
          saveState: 'saved',
          issues: [],
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

const IDLE: ThresholdSolve = { solving: false, error: null, solution: null, solve: () => {}, clear: () => {} }

function dollarsOf(plan: Plan): { lower: string; upper: string } {
  const published = guardrailThresholdDollars(plan)
  if (published?.status !== 'anchored' || published.lower === null || published.upper === null) {
    throw new Error('expected anchored thresholds')
  }
  // The two figures must differ, or a swap could not be seen.
  expect(published.lower).not.toBe(published.upper)
  return { lower: fmtMoney(published.lower), upper: fmtMoney(published.upper) }
}

describe('risk-based guardrail thresholds on the three pages', () => {
  it('Spending card: the cut figure after "falls below", the raise figure after "rises above"', async () => {
    const plan = riskBased(80, 150)
    const { lower, upper } = dollarsOf(plan)
    const host = await mount(plan, <RiskBasedThresholdsCallout thresholds={IDLE} />)
    expect(host.textContent).toContain(`cut spending if the portfolio falls below ${lower}`)
    expect(host.textContent).toContain(`raise if it rises above ${upper}`)
    expect(host.textContent).not.toContain('holds spending every year')
  })

  it('Spending card: percents and no dollar figure without an investable balance; a hold with the pair inverted', async () => {
    const zero = await mount(riskBased(80, 150, true), <RiskBasedThresholdsCallout thresholds={IDLE} />)
    expect(zero.textContent).toContain('cut below 80% and raise above 150% of the portfolio')
    // The Spending card serves both surfaces, so it names where the percents
    // apply in each: the projection's first funded year, and each Monte Carlo
    // path's own.
    expect(zero.textContent).toContain(
      'those percents apply to the portfolio in the first year it has a balance: in the projection, the first year the projection gives it one, and in Monte Carlo, the first year each simulated path does.',
    )
    expect(zero.textContent).toContain('There is no dollar figure to show')
    expect(zero.textContent).not.toContain('$0')
    await act(async () => root!.unmount())
    container!.remove()
    const inverted = await mount(riskBased(150, 80), <RiskBasedThresholdsCallout thresholds={IDLE} />)
    expect(inverted.textContent).toContain('the rule holds spending every year')
  })

  it('Results: the cut figure where spending is trimmed, the raise figure where it can be raised', async () => {
    const plan = riskBased(80, 150)
    const { lower, upper } = dollarsOf(plan)
    const host = await mount(plan, <ResultsPage />)
    const callout = [...host.querySelectorAll('.callout')].find((element) =>
      element.textContent?.includes('Risk-based spending guardrails'),
    )!
    expect(callout.textContent).toContain(`if the portfolio falls below ${lower}, flexible spending is trimmed`)
    expect(callout.textContent).toContain(`above ${upper}, spending can be restored or raised`)
  })

  it('Results: percents without an investable balance, and the hold sentence with the pair inverted', async () => {
    const zero = await mount(riskBased(80, 150, true), <ResultsPage />)
    expect(zero.textContent).toContain('cut below 80% and raise above 150% of the portfolio')
    expect(zero.textContent).toContain(
      'This plan has no investable balance today, so in this projection those percents apply to the portfolio in the first year the projection gives it a balance',
    )
    await act(async () => root!.unmount())
    container!.remove()
    const inverted = await mount(riskBased(150, 80), <ResultsPage />)
    expect(inverted.textContent).toContain('the rule holds spending every year')
  })

  it('Monte Carlo: "cut below" the cut figure and "raise above" the raise figure; percents without a balance', async () => {
    const plan = riskBased(80, 150)
    const { lower, upper } = dollarsOf(plan)
    const host = await mount(plan, <MonteCarloPage />)
    await waitFor(() => host.textContent?.includes('Risk-based dollar guardrails') ?? false, { what: 'the guardrail note' })
    expect(host.textContent).toContain(`cut below ${lower} · raise above ${upper}`)
    await act(async () => root!.unmount())
    container!.remove()
    const zero = await mount(riskBased(80, 150, true), <MonteCarloPage />)
    await waitFor(() => zero.textContent?.includes('Risk-based guardrails (') ?? false, { what: 'the zero-balance note' })
    expect(zero.textContent).toContain('cut below 80% · raise above 150%')
    expect(zero.textContent).toContain('of the portfolio in the first year each simulated path gives it a balance')
    expect(zero.textContent).toContain('there is no dollar figure to show')
  })

  it('Monte Carlo: the hold sentence with the pair inverted', async () => {
    const host = await mount(riskBased(150, 80), <MonteCarloPage />)
    await waitFor(() => host.textContent?.includes('Risk-based dollar guardrails') ?? false, { what: 'the guardrail note' })
    expect(host.textContent).toContain('the rule holds spending every year')
  })
})

describe('the threshold solve', () => {
  it("persists the solver's two-decimal percents, not the fractions", async () => {
    const drafts: Plan[] = []
    function Solver() {
      const thresholds = useThresholdSolve()
      return (
        <button type="button" onClick={thresholds.solve}>
          solve
        </button>
      )
    }
    const plan = validPlan((draft) => {
      draft.expenses.spendingPolicy = { mode: 'riskBasedGuardrails' }
    })
    const host = await mount(plan, <Solver />, (next) => drafts.push(next))
    await act(async () => host.querySelector('button')!.click())
    await waitFor(() => drafts.length > 0, { what: 'the persisted thresholds' })
    const policy = drafts.at(-1)!.expenses.spendingPolicy!
    // The analytic curve's edges are the solver's lattice points 1.4036718749999997 and 1.9011718749999997.
    expect(policy.lowerBalanceThresholdPct).toBe(140.37)
    expect(policy.upperBalanceThresholdPct).toBe(190.12)
  })
})

describe('the Income floor quote', () => {
  it("prints the engine's yield unscaled and each buy-list row's own maturity year", async () => {
    const startYear = currentStartYear()
    const plan = validPlan((draft) => {
      draft.incomeFloor = {
        ladders: [
          { id: 'ladder-p', name: 'Floor ladder', purpose: 'floor', startYear: startYear + 2, endYear: startYear + 6, annualRealAmount: 12_000 },
        ],
      }
    })
    const quote = quotePlanLadder(plan.incomeFloor!.ladders[0]!, startYear)!
    const host = await mount(plan, <IncomeFloorSection />)
    expect(host.textContent).toContain(`That's ${quote.incomeYieldPct.toFixed(2)}% of cost per year`)
    const years = [...host.querySelectorAll('details table tbody tr')].map((row) => Number(row.querySelector('td')!.textContent))
    expect(years).toEqual(quote.maturityYears)
    expect(new Set(years).size).toBe(years.length)
  })
})
