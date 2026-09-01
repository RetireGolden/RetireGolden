import { describe, expect, it } from 'vitest'

import { optimizerProducedNoRecommendation } from './optimizePageRecommendation'

/**
 * #426: the recommendation report is offered only when a recommendation
 * exists. The predicate below is the one the page uses both for the
 * "Couldn't optimize this plan" card and to withhold the download.
 */
describe('optimizerProducedNoRecommendation (#426)', () => {
  const base = { scheduleStatus: 'infeasible', incumbentHolds: false, candidateWins: false, readinessVeto: null } as const

  it('is true for an infeasible solve with nothing standing in for a result', () => {
    expect(optimizerProducedNoRecommendation(base)).toBe(true)
    expect(optimizerProducedNoRecommendation({ ...base, readinessVeto: undefined })).toBe(true)
  })

  it('is false when the incumbent strategy holds, even on an infeasible fresh solve', () => {
    // A plan with conversions already installed can beat every alternative
    // while the new MILP solve is infeasible; the page shows "Nothing beat
    // your current plan" and the "no change" report must stay downloadable.
    expect(optimizerProducedNoRecommendation({ ...base, incumbentHolds: true })).toBe(false)
  })

  it('is false when a tournament candidate or a readiness veto stands in for the result', () => {
    expect(optimizerProducedNoRecommendation({ ...base, candidateWins: true })).toBe(false)
    expect(
      optimizerProducedNoRecommendation({ ...base, readinessVeto: { reason: 'identityIncomplete' } as never }),
    ).toBe(false)
  })

  it('is false for every reportable outcome, including "no change" results', () => {
    for (const scheduleStatus of ['optimal', 'feasible', 'timeout', null] as const) {
      expect(optimizerProducedNoRecommendation({ ...base, scheduleStatus })).toBe(false)
    }
  })
})
