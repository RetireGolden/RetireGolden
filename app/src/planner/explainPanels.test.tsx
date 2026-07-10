/** @vitest-environment jsdom */
/**
 * Rendering guarantees for the "why this number" panels (steps 2–3 of the
 * trust-and-transparency layer): the success explainer decomposes the MC
 * result from the existing summary alone, and the recommendation explainer
 * lists every beaten alternative with its dollar margin.
 */
import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'

import type { MonteCarloSummary } from '../engine/montecarlo/run'
import type { ExactLedgerTournament, ExactLedgerValidation } from '../engine/projection/optimizePlan'
import { WhyRecommendationPanel, WhySuccessPanel } from './explainPanels'

function render(node: React.ReactNode): { container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<MemoryRouter>{node}</MemoryRouter>)
  })
  return {
    container,
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

const percentiles = (base: number) => ({ p10: base * 0.5, p25: base * 0.75, p50: base, p75: base * 1.25, p90: base * 1.5 })

function fakeSummary(): MonteCarloSummary {
  return {
    pathCount: 1000,
    successRate: 0.85,
    requiredFloorSuccessRate: 0.85,
    targetLifestyleSuccessRate: 0.85,
    targetAttainmentPct: percentiles(1),
    averageAnnualTargetShortfall: 0,
    p90AverageAnnualTargetShortfall: 0,
    averageYearsBelowTarget: 0,
    idealFundingRate: 1,
    excessFundingRate: 1,
    flexibleGoals: { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 },
    guardrailActionCounts: { cut: 0, raise: 0, hold: 0 },
    adjustments: {
      pathsWithCut: 0,
      pathsWithRaise: 0,
      medianMaxCutDepth: 0,
      p90MaxCutDepth: 0,
      averageCutYears: 0,
      p90CutYears: 0,
      averageLongestCutSpellYears: 0,
      probEndingSurplus: 1,
      probEndingAboveBequestTarget: null,
    },
    downsideRisk: {
      failureRate: 0.15,
      failingPathCount: 150,
      expectedShortfallDollars: 200_000,
      expectedRequiredShortfallDollars: 0,
      expectedTargetShortfallDollars: 0,
      p90TotalShortfallDollars: 400_000,
    },
    spendingShortfall: {
      averageTotalShortfallDollars: 0,
      averageRequiredShortfallDollars: 0,
      averageTargetShortfallDollars: 0,
      p90TotalShortfallDollars: 400_000,
    },
    fan: Array.from({ length: 30 }, (_, i) => ({ year: 2026 + i, ...percentiles(1_000_000 - i * 10_000) })),
    endingInvestable: { percentiles: percentiles(800_000), histogram: { min: 0, binWidth: 1, counts: [] } },
    endingNetWorth: { percentiles: percentiles(900_000), histogram: { min: 0, binWidth: 1, counts: [] } },
    endingAfterTaxEstate: { percentiles: percentiles(850_000), histogram: { min: 0, binWidth: 1, counts: [] } },
    depletionYearCounts: [
      { year: 2047, count: 40 },
      { year: 2050, count: 60 },
      { year: 2053, count: 50 },
    ],
    depletionProbabilityByYear: [],
  }
}

describe('WhySuccessPanel', () => {
  it('decomposes the success rate: definition, model, seed, precision, and driving years', () => {
    const { container, unmount } = render(
      <WhySuccessPanel summary={fakeSummary()} modelLabel="Lognormal returns" seed={42} planId="plan-1" />,
    )
    const text = container.textContent!
    expect(text).toContain('85%')
    expect(text).toContain('850 of the 1,000 simulated markets')
    expect(text).toContain('Lognormal returns')
    expect(text).toContain('seed 42')
    expect(text).toContain('±1.5')
    // Depletion-year trace: earliest, latest, and the median failing year.
    expect(text).toContain('between 2047 and 2053')
    expect(text).toContain('median 2050')
    // First-decade sensitivity from the fan (year 10 = 2035).
    expect(text).toContain('2035')
    unmount()
  })

  it('handles the no-failures case without a depletion trace', () => {
    const summary = { ...fakeSummary(), successRate: 1, depletionYearCounts: [] }
    summary.downsideRisk = { ...summary.downsideRisk, failingPathCount: 0, failureRate: 0 }
    const { container, unmount } = render(
      <WhySuccessPanel summary={summary} modelLabel="Lognormal returns" seed={1} planId="plan-1" />,
    )
    expect(container.textContent).toContain('No simulated path depleted')
    unmount()
  })
})

/**
 * Only the fields the panel reads matter here; the two ProjectionSummary
 * payloads inside a real ExactLedgerValidation are irrelevant to rendering.
 */
function fakeValidation(
  afterTaxEstateDelta: number,
  rest: Partial<ExactLedgerValidation> = {},
): ExactLedgerValidation {
  return { afterTaxEstateDelta, lifetimeTaxDelta: 0, moneyLastsYearsDelta: 0, executedConversionTotal: 0, ...rest } as ExactLedgerValidation
}

function fakeTournament(overrides: Partial<ExactLedgerTournament> = {}): ExactLedgerTournament {
  return {
    policyId: 'max-after-tax-estate',
    candidates: [
      { id: 'fill-22', label: 'Fill the 22% bracket', executedConversionTotal: 180_000, afterTaxEstateDelta: 65_000, lifetimeTaxDelta: 30_000, moneyLastsYearsDelta: 0 },
      { id: 'fill-12', label: 'Fill the 12% bracket', executedConversionTotal: 90_000, afterTaxEstateDelta: 41_000, lifetimeTaxDelta: 12_000, moneyLastsYearsDelta: 0 },
      { id: 'irmaa-1', label: 'Stay under IRMAA tier 1', executedConversionTotal: 120_000, afterTaxEstateDelta: -8_000, lifetimeTaxDelta: 18_000, moneyLastsYearsDelta: -1 },
    ],
    winnerSource: 'candidate',
    winnerCandidateId: 'fill-22',
    winnerLabel: 'Fill the 22% bracket',
    winnerConversions: [{ year: 2027, amount: 60_000 }],
    winnerValidation: fakeValidation(65_000),
    marginOverMilpDollars: 9_000,
    searchRefined: true,
    searchSimulations: 64,
    ...overrides,
  }
}

describe('WhyRecommendationPanel', () => {
  it('shows every beaten alternative with dollar margins and the winner marked', () => {
    const { container, unmount } = render(
      <WhyRecommendationPanel tournament={fakeTournament()} objectiveLabel="Maximize after-tax estate" />,
    )
    const text = container.textContent!
    expect(text).toContain('Maximize after-tax estate')
    expect(text).toContain('Fill the 22% bracket — winner')
    // Margin over the runner-up: 65k − 41k.
    expect(text).toContain('$24,000')
    // Beat the solver's own schedule.
    expect(text).toContain('$9,000')
    // Every alternative appears with its signed estate delta.
    expect(text).toContain('Fill the 12% bracket')
    expect(text).toContain('+$41,000')
    expect(text).toContain('Stay under IRMAA tier 1')
    expect(text).toContain('−$8,000')
    // The refinement note and the baseline anchor row.
    expect(text).toContain('64 extra full-projection runs')
    expect(text).toContain('Your current plan (baseline)')
    unmount()
  })

  it('frames the incumbent-holds case as the current plan winning by the challenger margin', () => {
    const { container, unmount } = render(
      <WhyRecommendationPanel
        tournament={fakeTournament({
          winnerSource: 'incumbent',
          winnerCandidateId: null,
          winnerLabel: 'your applied optimizer schedule',
          winnerValidation: null,
          marginOverMilpDollars: 0,
          searchRefined: false,
          searchSimulations: 0,
          candidates: [
            { id: 'fill-12', label: 'Fill the 12% bracket', executedConversionTotal: 90_000, afterTaxEstateDelta: -5_000, lifetimeTaxDelta: 12_000, moneyLastsYearsDelta: 0 },
          ],
        })}
        objectiveLabel="Maximize after-tax estate"
      />,
    )
    const text = container.textContent!
    expect(text).toContain('your applied optimizer schedule')
    expect(text).toContain('Your current plan (baseline) — winner')
    // The best challenger loses by $5,000, so the incumbent's margin is $5,000.
    expect(text).toContain('$5,000')
    unmount()
  })

  it('handles winnerSource "none" without fabricating a winner or margin', () => {
    const { container, unmount } = render(
      <WhyRecommendationPanel
        tournament={fakeTournament({
          winnerSource: 'none',
          winnerCandidateId: null,
          winnerLabel: null,
          winnerConversions: [],
          winnerValidation: null,
          marginOverMilpDollars: 0,
          searchRefined: false,
          searchSimulations: 0,
        })}
        objectiveLabel="Maximize after-tax estate"
      />,
    )
    const text = container.textContent!
    expect(text).toContain('None cleared the recommendation threshold')
    expect(text).not.toContain('The winner is')
    expect(text).not.toContain('— winner')
    expect(text).not.toContain('ahead of the next-best')
    // The considered alternatives still show, with their real deltas.
    expect(text).toContain('Fill the 22% bracket')
    unmount()
  })

  it('excludes money-lasts-rejected challengers from the runner-up margin and never claims a negative margin', () => {
    // The only non-winner with a higher estate delta is rejected (shortens
    // money-lasts); the best *eligible* challenger is $41k, so the margin is
    // $65k − $41k, not a fabricated "ahead by" over the $80k rejected row.
    const { container, unmount } = render(
      <WhyRecommendationPanel
        tournament={fakeTournament({
          candidates: [
            { id: 'fill-22', label: 'Fill the 22% bracket', executedConversionTotal: 180_000, afterTaxEstateDelta: 65_000, lifetimeTaxDelta: 30_000, moneyLastsYearsDelta: 0 },
            { id: 'reckless', label: 'Convert everything now', executedConversionTotal: 500_000, afterTaxEstateDelta: 80_000, lifetimeTaxDelta: 90_000, moneyLastsYearsDelta: -2 },
            { id: 'fill-12', label: 'Fill the 12% bracket', executedConversionTotal: 90_000, afterTaxEstateDelta: 41_000, lifetimeTaxDelta: 12_000, moneyLastsYearsDelta: 0 },
          ],
        })}
        objectiveLabel="Maximize after-tax estate"
      />,
    )
    const text = container.textContent!
    expect(text).toContain('ahead of the next-best eligible alternative by $24,000')
    unmount()
  })

  it('marks the solver row as the winner when the MILP schedule wins', () => {
    const { container, unmount } = render(
      <WhyRecommendationPanel
        tournament={fakeTournament({
          winnerSource: 'milp',
          winnerCandidateId: null,
          winnerLabel: null,
          winnerValidation: fakeValidation(72_000, { lifetimeTaxDelta: 25_000, executedConversionTotal: 210_000 }),
          marginOverMilpDollars: 0,
        })}
        objectiveLabel="Maximize after-tax estate"
      />,
    )
    const text = container.textContent!
    expect(text).toContain("The winner is the solver's schedule")
    expect(text).toContain("Solver's schedule (post-processed) — winner")
    expect(text).toContain('+$72,000')
    // Margin vs the best eligible candidate ($65k): 72k − 65k.
    expect(text).toContain('ahead of the next-best eligible alternative by $7,000')
    unmount()
  })
})
