/**
 * B2-P1 slice 3 parity for the claim-age co-optimization gain (R17): the
 * engine publishes ClaimAgeCoOptimization.claimChangeEstateGain once, the
 * Optimize page's claim card and the downloadable report read it, and it is
 * the retired planner subtraction (kept here) bit for bit, on a plan whose
 * claim change wins (constructed: since B2-P1 slice 5 no example's does) and on
 * examples whose current claim holds or whose search refuses. The report row
 * names the year whose dollars it is in (P8).
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan } from '@retiregolden/engine/model/plan'
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
  it('a claim change wins, and the published gain is the retired subtraction', async () => {
    // Since B2-P1 slice 5 no example's claim change wins: the five former
    // winners (example-couple's "Sam claims Social Security at 70", $104,018,
    // among them) priced their gains against a premium credit the ledger cannot
    // price, and the search now refuses there. A constructed plan stands in: one
    // person born 1966-01-01 claiming at 70, planning to 72, cash only, so the
    // claim at 62 pays eight more years and wins.
    const draft = createEmptyPlan({ newId: (() => { let n = 0; return () => `gain-${++n}` })() })
    draft.household.people[0] = { id: 'p1', name: 'Pat', dob: '1966-01-01', sex: 'average', retirementAge: 60, longevity: { planningAge: 72, source: 'manual' } }
    draft.assumptions.inflationPct = 0
    draft.assumptions.defaultReturnPct = 0
    draft.expenses.baseAnnual = 0
    draft.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 200_000, annualContribution: 0 }]
    draft.incomes = [{ type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 2_600, earnings: null, claimAge: { years: 70, months: 0 } }]
    const parsed = parsePlan(draft)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const plan = parsed.plan
    const result = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: true })
    const claim = result.claimAge!
    expect(claim.winningClaimLabel).toBe('Pat claims Social Security at 62')
    expect(Object.is(claim.claimChangeEstateGain, retiredClaimEstateGain(claim))).toBe(true)
    expect(claim.claimChangeEstateGain).toBeGreaterThan(1_000)
    expect(claim.estateYear).toBe(projectPlan(plan, EXAMPLE_FIXED_YEAR).result.endYear)
    expect(claim.estateYear).toBe(2038)
    expect(fmtMoney(claim.claimChangeEstateGain)).toBe('$124,176')
  }, 240_000)

  it('example-couple: the search refuses on its unpriced credit years, and the gain is exactly 0', async () => {
    const plan = appExamplePlanById('example-couple')
    const result = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: true })
    const claim = result.claimAge!
    expect(claim.outcome).toBe('aca-unpriced')
    expect(claim.winningClaimPatch).toBeNull()
    expect(Object.is(claim.claimChangeEstateGain, retiredClaimEstateGain(claim))).toBe(true)
    expect(Object.is(claim.claimChangeEstateGain, 0)).toBe(true)
    expect(claim.estateYear).toBe(2059)
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
      // The co-optimization's outcome and refusal facts (B2-P1 slice 5): a search that ran.
      outcome: 'searched' as const,
      unpricedAca: [],
      alreadyClaimed: [],
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
