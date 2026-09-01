import { describe, expect, it } from 'vitest'

import { optimizerProducedNoRecommendation } from './optimizePageRecommendation'

/**
 * #426: the recommendation report is offered only when a recommendation
 * exists. The predicate below is the one the page uses both for the
 * "Couldn't optimize this plan" card and to withhold the download.
 */
describe('optimizerProducedNoRecommendation (#426)', () => {
  it('is true for an infeasible solve with no candidate winner and no readiness veto', () => {
    expect(
      optimizerProducedNoRecommendation({ scheduleStatus: 'infeasible', candidateWins: false, readinessVeto: null }),
    ).toBe(true)
    expect(
      optimizerProducedNoRecommendation({
        scheduleStatus: 'infeasible',
        candidateWins: false,
        readinessVeto: undefined,
      }),
    ).toBe(true)
  })

  it('is false when a tournament candidate or a readiness veto stands in for the result', () => {
    expect(
      optimizerProducedNoRecommendation({ scheduleStatus: 'infeasible', candidateWins: true, readinessVeto: null }),
    ).toBe(false)
    expect(
      optimizerProducedNoRecommendation({
        scheduleStatus: 'infeasible',
        candidateWins: false,
        readinessVeto: { reason: 'identityIncomplete' } as never,
      }),
    ).toBe(false)
  })

  it('is false for every reportable outcome, including "no change" results', () => {
    for (const scheduleStatus of ['optimal', 'feasible', 'timeout', null] as const) {
      expect(optimizerProducedNoRecommendation({ scheduleStatus, candidateWins: false, readinessVeto: null })).toBe(
        false,
      )
    }
  })
})
