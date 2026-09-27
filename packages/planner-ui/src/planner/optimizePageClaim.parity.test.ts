/**
 * B2-P1 slice 3 parity for the claim-age co-optimization gain (R17): the
 * engine publishes ClaimAgeCoOptimization.claimChangeEstateGain once, the
 * Optimize page's claim card and the downloadable report read it, and it is
 * the retired planner subtraction (kept here) bit for bit, on an example
 * whose claim change wins and one whose current claim holds. The report row
 * names the year whose dollars it is in (P8).
 */
import { describe, expect, it } from 'vitest'

import type { ClaimAgeCoOptimization } from '@retiregolden/engine/projection/optimizePlan'
import { projectPlan } from '../projection'
import { runOptimizeRequest } from '../optimize/runOptimize'
import { buildStandaloneReportHtml } from '../report/reportHtml'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from './examples/buildContext'
import { fmtMoney } from './format'

/** The retired optimizePageClaim.ts#claimEstateGain (and the report's own copy of it). */
function retiredClaimEstateGain(claimAge: ClaimAgeCoOptimization | null): number {
  if (!claimAge?.winningClaimPatch) return 0
  return claimAge.jointExactEstate - claimAge.currentClaimExactEstate
}

describe('claim-age co-optimization gain on library examples (B2-P1 slice 3)', () => {
  it('example-couple: a claim change wins, and the published gain is the retired subtraction', async () => {
    const plan = appExamplePlanById('example-couple')
    const result = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: true })
    const claim = result.claimAge!
    expect(claim.winningClaimLabel).toBe('Sam claims Social Security at 70')
    expect(Object.is(claim.claimChangeEstateGain, retiredClaimEstateGain(claim))).toBe(true)
    expect(claim.claimChangeEstateGain).toBeGreaterThan(1_000)
    expect(claim.estateYear).toBe(projectPlan(plan, EXAMPLE_FIXED_YEAR).result.endYear)
    expect(claim.estateYear).toBe(2059)
    expect(fmtMoney(claim.claimChangeEstateGain)).toBe('$104,018')
  }, 240_000)

  it('bracket-fill-roth: the current claim ages hold, and the gain is exactly 0', async () => {
    const plan = appExamplePlanById('bracket-fill-roth')
    const result = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: true })
    const claim = result.claimAge!
    expect(claim.winningClaimPatch).toBeNull()
    expect(Object.is(claim.claimChangeEstateGain, retiredClaimEstateGain(claim))).toBe(true)
    expect(Object.is(claim.claimChangeEstateGain, 0)).toBe(true)
  }, 240_000)

  it('the report row reads the published gain and names its year', () => {
    const plan = appExamplePlanById('example-couple')
    const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
    const claimAge = {
      combinationsEvaluated: 3,
      winningClaimLabel: 'Pat claims Social Security at 70',
      jointExactEstate: 1_118_000,
      currentClaimExactEstate: 1_000_000,
      claimChangeEstateGain: 118_000,
      estateYear: 2059,
    }
    const html = buildStandaloneReportHtml({
      plan,
      result: view.result,
      summary: view.summary,
      startYear: EXAMPLE_FIXED_YEAR,
      recommendationEvidence: {
        objectiveId: 'max-after-tax-estate',
        objectiveLabel: 'Maximize after-tax estate',
        recommendationState: 'beneficial',
        winnerLabel: 'Fill the 12% bracket',
        winnerSource: 'candidate',
        validation: null,
        candidates: [],
        claimAge,
      },
    })
    // The retired report cell: fmtSignedMoney(joint − current).
    expect(html).toContain(`<td>Claim-change estate gain (2059 dollars)</td><td>+${fmtMoney(retiredClaimEstateGain({ ...claimAge, enabled: true, winningClaimPatch: { incomes: [] } }))}</td>`)
  })
})
