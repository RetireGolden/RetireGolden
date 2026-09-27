/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'

import type { ExactLedgerValidation } from '@retiregolden/engine/projection/optimizePlan'
import { conversionScheduleTotal, type OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import {
  publicationValidation,
  recommendationBody,
  recommendationHeading,
} from './optimizePageRecommendation'
import {
  actionableTournamentConversions,
  buildOptimizeChartRows,
  displayedCleanedConversions,
  displayedScheduleAlreadyExecuted,
  monteCarloSuccessValue,
  positiveConversionCount,
  shouldShowRecommendedScheduleBars,
} from './optimizePageChart'
import { stateTaxIncompleteGuidance } from './stateTaxIncompleteGuidanceModel'

function schedule(conversions: { year: number; amount: number }[]): OptimizedSchedule {
  return {
    status: 'optimal',
    endingAfterTax: 0,
    lifetimeTax: 0,
    schedule: [],
    conversions,
    conversionTotal: conversionScheduleTotal(conversions),
    solveMs: 0,
  }
}

describe('OptimizePage tournament display helpers', () => {
  it('counts only positive conversion years as movement', () => {
    expect(positiveConversionCount([
      { year: 2026, amount: 0 },
      { year: 2027, amount: 5_000 },
      { year: 2028, amount: 0 },
    ])).toBe(1)
    expect(positiveConversionCount([
      { year: 2026, amount: 0 },
      { year: 2027, amount: 0 },
    ])).toBe(0)
  })

  it('describes identity withholding without claiming an execution shortfall', () => {
    const validation = {
      recommendationState: 'identityIncomplete',
      requestedConversionTotal: 5_000,
      executedConversionTotal: 5_000,
      baseline: { endingAfterTaxEstate: 100_000 },
      candidate: { endingAfterTaxEstate: 105_000 },
      lifetimeTaxDelta: 0,
    } as ExactLedgerValidation

    expect(recommendationHeading(validation)).toMatch(/account allocation/i)
    expect(recommendationBody(validation)).toMatch(/priced and executed.*owner.*source IRA.*Roth destination/i)
    expect(recommendationBody(validation)).not.toMatch(/only .* could actually be converted/i)
  })

  it('names the cause of an unexecutable verdict, and claims a shortfall only when a year fell short (B2-P1 slice 3)', () => {
    const base = {
      recommendationState: 'unexecutable',
      requestedConversionTotal: 1_135_975.34,
      executedConversionTotal: 1_135_975.34,
      firstMateriallyUnexecutedYear: null,
      baseline: { endingAfterTaxEstate: 100_000 },
      candidate: { endingAfterTaxEstate: 105_000 },
      lifetimeTaxDelta: 0,
    } as unknown as ExactLedgerValidation
    // Held back for unpriced credit years: the whole request ran.
    const aca = recommendationBody(base, { acaActionabilityVeto: {} as never })
    expect(recommendationHeading(base)).toBe('This conversion schedule is shown as a diagnostic.')
    expect(aca).toBe(
      "Your full projection converts all $1,135,975 requested, but the marketplace (ACA) premium tax credit isn't priced in some of the plan's years, and conversion income changes that credit, so the schedule is shown as a diagnostic, not a recommendation. The ACA note below names the years.",
    )
    expect(aca).not.toMatch(/only .* could actually be converted/i)
    // Held back for incomplete tax years, which it names.
    expect(recommendationBody({ ...base, incompleteComputationYears: [2031, 2032, 2033] })).toBe(
      'Your full projection converts all $1,135,975 requested, but its tax could not be computed completely in 2031 to 2033, so the schedule is shown as a diagnostic, not a recommendation.',
    )
    // Any other cause, with a partial execution below the material shortfall.
    expect(recommendationBody({ ...base, executedConversionTotal: 1_135_000 })).toBe(
      'Your full projection converts $1,135,000 of the $1,135,975 requested, but it cannot be applied to your plan as it stands, so the schedule is shown as a diagnostic, not a recommendation.',
    )
    // A real shortfall year keeps the shortfall sentence and heading.
    const shortfall = { ...base, executedConversionTotal: 600_000, firstMateriallyUnexecutedYear: 2031 } as ExactLedgerValidation
    expect(recommendationHeading(shortfall)).toBe('This conversion schedule is mostly theoretical.')
    expect(recommendationBody(shortfall)).toMatch(/but only \$600,000 could actually be converted/)
  })

  it('reads an aggregate shortfall with no short year as a shortfall, not another cause (B2-P1 slice 3 review F3)', () => {
    // Ten requested years of $10,000, each executing $9,100: no year is short by
    // more than max($1,000, 5% of $10,000), so firstMateriallyUnexecutedYear is
    // null, but the schedule is $9,000 short of $100,000, more than max($1,000,
    // $5,000), which the engine marks unexecutable. The copy keeps the shortfall.
    const aggregate = {
      recommendationState: 'unexecutable',
      requestedConversionTotal: 100_000,
      executedConversionTotal: 91_000,
      firstMateriallyUnexecutedYear: null,
      baseline: { endingAfterTaxEstate: 100_000 },
      candidate: { endingAfterTaxEstate: 105_000 },
      lifetimeTaxDelta: 0,
    } as unknown as ExactLedgerValidation
    expect(recommendationHeading(aggregate)).toBe('This conversion schedule is mostly theoretical.')
    expect(recommendationBody(aggregate, { acaActionabilityVeto: {} as never })).toBe(
      'The optimizer proposed converting $100,000, but only $91,000 could actually be converted. The traditional balance it counted on is not available in the plan years shown.',
    )
    // At the margin itself ($5,000 short of $100,000) the engine's test is not
    // met, so another cause holds the schedule back.
    const atMargin: ExactLedgerValidation = { ...aggregate, executedConversionTotal: 95_000 }
    expect(recommendationHeading(atMargin)).toBe('This conversion schedule is shown as a diagnostic.')
    expect(recommendationBody(atMargin)).toBe(
      'Your full projection converts $95,000 of the $100,000 requested, but it cannot be applied to your plan as it stands, so the schedule is shown as a diagnostic, not a recommendation.',
    )
  })

  it('uses the publication veto for headline copy while retaining exact metrics', () => {
    const validation = {
      recommendationState: 'rejected',
      afterTaxEstateDelta: -5_000,
      lifetimeTaxDelta: -10_000,
    } as ExactLedgerValidation
    const presented = publicationValidation(validation, {
      reason: 'identityIncomplete',
    } as never)

    expect(presented.recommendationState).toBe('identityIncomplete')
    expect(presented.afterTaxEstateDelta).toBe(-5_000)
    expect(presented.lifetimeTaxDelta).toBe(-10_000)
    expect(recommendationHeading(presented)).toMatch(/account allocation/i)
  })

  it('only exposes a tournament winner schedule for an actionable winner', () => {
    const conversions = [{ year: 2026, amount: 5_000 }]
    const tournament = (winnerSource: 'candidate' | 'milp' | 'incumbent' | 'none') => ({
      winnerSource,
      winnerConversions: conversions,
    })

    expect(actionableTournamentConversions(tournament('candidate'))).toBe(conversions)
    expect(actionableTournamentConversions(tournament('milp'))).toBe(conversions)
    expect(actionableTournamentConversions(tournament('incumbent'))).toEqual([])
    expect(actionableTournamentConversions(tournament('none'))).toEqual([])
    expect(actionableTournamentConversions(null)).toEqual([])
  })

  it('preserves an identity-withheld cleaned schedule only for diagnostic display', () => {
    const conversions = [{ year: 2026, amount: 5_000 }]
    const tournament = {
      winnerSource: 'none' as const,
      winnerConversions: [] as { year: number; amount: number }[],
      retirementActionReadinessVeto: null,
    }
    const postProcessed = {
      cleanedSchedule: schedule(conversions),
      cleanedValidation: { recommendationState: 'identityIncomplete' },
      stabilized: true,
      minimumRequestedConversionDollars: 1,
    } as never

    expect(actionableTournamentConversions(tournament)).toEqual([])
    expect(displayedCleanedConversions(tournament, postProcessed)).toBe(conversions)
    expect(displayedCleanedConversions(tournament, {
      cleanedSchedule: schedule(conversions),
      cleanedValidation: { recommendationState: 'neutral' },
      stabilized: true,
      minimumRequestedConversionDollars: 1,
    } as never)).toEqual([])
    expect(displayedCleanedConversions(tournament, {
      cleanedSchedule: schedule(conversions),
      cleanedValidation: { recommendationState: 'identityIncomplete' },
      stabilized: false,
      minimumRequestedConversionDollars: 1,
    } as never)).toEqual([])
    expect(displayedCleanedConversions(tournament, {
      cleanedSchedule: schedule(conversions),
      cleanedValidation: { recommendationState: 'identityIncomplete' },
      stabilized: true,
      minimumRequestedConversionDollars: 5_001,
    } as never)).toEqual([])
    expect(displayedCleanedConversions({
      winnerSource: 'incumbent',
      winnerConversions: [{ year: 2025, amount: 2_000 }],
      retirementActionReadinessVeto: null,
    }, postProcessed)).toEqual([])
    const withheld = [{ year: 2028, amount: 8_000 }]
    expect(displayedCleanedConversions({
      winnerSource: 'incumbent',
      winnerConversions: [{ year: 2025, amount: 2_000 }],
      retirementActionReadinessVeto: { vetoedConversions: withheld },
    } as never, postProcessed)).toBe(withheld)
    expect(displayedCleanedConversions(null, postProcessed)).toEqual([])
  })

  it('uses the selected withheld winner for diagnostics and never shows a pending Monte Carlo rate', () => {
    const withheld = [{ year: 2028, amount: 8_000 }]
    expect(displayedCleanedConversions({
      winnerSource: 'none',
      winnerConversions: [],
      retirementActionReadinessVeto: {
        vetoedConversions: withheld,
      },
    } as never, {
      cleanedSchedule: schedule([{ year: 2026, amount: 5_000 }]),
      cleanedValidation: { recommendationState: 'identityIncomplete' },
    } as never)).toBe(withheld)
    expect(monteCarloSuccessValue(false, null)).toBe('Unavailable')
    expect(monteCarloSuccessValue(true, null)).toBe('…')
    expect(monteCarloSuccessValue(true, 0.914)).toBe('91%')
  })

  it('shows recommended bars when a candidate wins even without a cleanup mismatch', () => {
    expect(shouldShowRecommendedScheduleBars(true, false)).toBe(true)
    expect(shouldShowRecommendedScheduleBars(false, true)).toBe(true)
    expect(shouldShowRecommendedScheduleBars(false, false)).toBe(false)
  })

  it('treats a search-refined withheld MILP schedule as exact-ledger executed', () => {
    expect(displayedScheduleAlreadyExecuted({
      winnerSource: 'milp',
      searchRefined: true,
      retirementActionReadinessVeto: null,
    } as never)).toBe(true)
    expect(displayedScheduleAlreadyExecuted({
      winnerSource: 'milp',
      searchRefined: false,
      retirementActionReadinessVeto: null,
    } as never)).toBe(false)
    expect(displayedScheduleAlreadyExecuted({
      winnerSource: 'none',
      searchRefined: true,
      retirementActionReadinessVeto: { vetoedWinnerSource: 'milp' },
    } as never)).toBe(true)
    expect(displayedScheduleAlreadyExecuted({
      winnerSource: 'none',
      searchRefined: false,
      retirementActionReadinessVeto: { vetoedWinnerSource: 'milp' },
    } as never)).toBe(false)
  })

  it('builds chart execution from a displayed actionable or withheld candidate schedule', () => {
    const rows = buildOptimizeChartRows({
      schedule: schedule([{ year: 2026, amount: 1_000 }]),
      recommendedConversions: [
        { year: 2026, amount: 5_000 },
        { year: 2027, amount: 6_000 },
      ],
      postProcessed: {
        cleanedExecutionByYear: [{ year: 2026, rothConversion: 999 }],
      } as never,
      displayedScheduleAlreadyExecuted: true,
    })

    expect(rows).toEqual([
      { year: 2026, requested: 1_000, cleaned: 5_000, executed: 5_000 },
      { year: 2027, requested: 0, cleaned: 6_000, executed: 6_000 },
    ])
  })

  it('keeps candidate-only optimizer issue details unavailable', () => {
    const guidance = stateTaxIncompleteGuidance([2028])
    expect(guidance?.summary).toContain('2028')
    expect(guidance?.worksheetLinkLabel).toBeNull()
    expect(guidance?.summary).toContain('Issue details are unavailable')
  })
})
