/**
 * The downloadable report's claim-age evidence (B2-P1 slice 5, PR #758 review
 * 1): the report carries the co-optimization's outcome, its unpriced credit
 * years with their reasons and the claims it held, and prints the Optimize
 * card's own refusal ('aca-unpriced', 'already-claimed', 'no-age-left') where
 * it printed "SS claim combinations optimized: 1 / None (current claim ages
 * held)". A version-3 model saved before the outcome existed still renders as
 * a search that ran.
 */
import { describe, expect, it } from 'vitest'

import type { ClaimAgeCoOptimization } from '@retiregolden/engine/projection/optimizePlan'
import type { OptimizeResult } from '../optimize/messages'
import { runOptimizeRequest } from '../optimize/runOptimize'
import { projectPlan } from '../projection'
import { appExamplePlanById } from '../testSupport/appExamples'
import { EXAMPLE_FIXED_YEAR } from '../planner/examples/buildContext'
import { claimAgeSearchRefusal } from '../planner/claimAgeCopy'
import { buildStandaloneReportHtml, reportEvidenceFromOptimizeResult } from './reportHtml'
import { buildReportModel, parseReportModel, serializeReportModel, type ReportClaimAgeEvidence } from './reportModel'

const plan = appExamplePlanById('example-couple')
const view = projectPlan(plan, EXAMPLE_FIXED_YEAR)
const [alex, sam] = plan.household.people

function html(claimAge: ReportClaimAgeEvidence): string {
  return buildStandaloneReportHtml({
    plan,
    result: view.result,
    summary: view.summary,
    startYear: EXAMPLE_FIXED_YEAR,
    recommendationEvidence: {
      objectiveId: 'max-after-tax-estate',
      objectiveLabel: 'Maximize after-tax estate',
      recommendationState: 'neutral',
      winnerLabel: 'Current plan',
      winnerSource: 'incumbent',
      validation: null,
      candidates: [],
      claimAge,
    },
  })
}

/** A co-optimization result for the report builder, the tournament left out. */
function resultWith(claimAge: ClaimAgeCoOptimization, from: OptimizeResult): OptimizeResult {
  return { ...from, claimAge }
}

const base = {
  enabled: true,
  combinationsEvaluated: 1,
  winningClaimLabel: null,
  winningClaimPatch: null,
  jointExactEstate: 1_000_000,
  currentClaimExactEstate: 1_000_000,
  claimChangeEstateGain: 0,
  estateYear: 2059,
} as const

describe('the report prints the claim-age search the Optimize card prints', () => {
  it('example-couple: its real co-optimization refuses on 2028 and 2029, and the report says so with each reason', async () => {
    const result = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: true })
    const evidence = reportEvidenceFromOptimizeResult(result, plan.household.people)
    expect(evidence.claimAge).toMatchObject({
      outcome: 'aca-unpriced',
      unpricedAca: [
        { year: 2028, reasons: ['tax-year-parameters-unsupported'] },
        { year: 2029, reasons: ['tax-year-parameters-unsupported'] },
      ],
      alreadyClaimed: [],
    })
    const page = html(evidence.claimAge!)
    const refusal = claimAgeSearchRefusal(result.claimAge!, (id) => id, EXAMPLE_FIXED_YEAR)!
    expect(page).toContain(`<td>Social Security claim age</td><td>${refusal}</td>`)
    expect(page).toContain("can't be priced in 2028 and 2029 (RetireGolden doesn't have the credit's figures for those years yet)")
    expect(page).not.toContain('SS claim combinations optimized')
    expect(page).not.toContain('None (current claim ages held)')
  }, 240_000)

  it('names who claimed and when when every claim was made, as the card does', async () => {
    const shell = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: false })
    const evidence = reportEvidenceFromOptimizeResult(
      resultWith(
        {
          ...base,
          outcome: 'already-claimed',
          unpricedAca: [],
          alreadyClaimed: [
            { personId: alex!.id, streamId: 's1', claimAge: { years: 67, months: 0 }, claimYear: 2020 },
            { personId: sam!.id, streamId: 's2', claimAge: { years: 66, months: 6 }, claimYear: 2022 },
          ],
        },
        shell,
      ),
      plan.household.people,
    )
    const page = html(evidence.claimAge!)
    expect(page).toContain(
      `Social Security claim age not searched: ${alex!.name} claimed at 67 in 2020 and ${sam!.name} at 66y 6m in 2022, before the plan starts in ${EXAMPLE_FIXED_YEAR}, so there is no claim age left to move.`,
    )
    expect(page).not.toContain('SS claim combinations optimized')
  }, 240_000)

  it('says no claim age was left to try, never "1 claim combinations"', async () => {
    const shell = await runOptimizeRequest({ plan, startYear: EXAMPLE_FIXED_YEAR, coOptimizeClaimAge: false })
    const evidence = reportEvidenceFromOptimizeResult(resultWith({ ...base, outcome: 'no-age-left', unpricedAca: [], alreadyClaimed: [] }, shell), plan.household.people)
    const page = html(evidence.claimAge!)
    expect(page).toContain('Social Security claim age not searched: none of the ages it tries (62, full retirement age and 70)')
    expect(page).toContain('so there is no claim age left to try.')
    expect(page).not.toContain('SS claim combinations optimized')
  }, 240_000)

  it('keeps the search rows for a search that ran, and names a claim it held', () => {
    const page = html({
      ...base,
      outcome: 'searched',
      combinationsEvaluated: 3,
      unpricedAca: [],
      alreadyClaimed: [{ personId: alex!.id, name: alex!.name, claimAge: { years: 62, months: 0 }, claimYear: 2025 }],
    })
    expect(page).toContain('<td>SS claim combinations optimized</td><td>3</td>')
    expect(page).toContain(`${alex!.name} claimed at 62 in 2025, before the plan starts, so that claim was held as it is.`)
  })

  it('names the edit that removed the contract of a year, as the Optimize card does, and keeps it in a saved model (review finding M2)', () => {
    const edited = structuredClone(plan)
    edited.expenses.healthcare.acaYearsRemoved = [{ edit: 'filingStatusChanged', years: [2026] }]
    const claimAge: ReportClaimAgeEvidence = {
      ...base,
      outcome: 'aca-unpriced',
      unpricedAca: [
        { year: 2026, reasons: ['missing-year-contract'] },
        { year: 2028, reasons: ['tax-year-parameters-unsupported'] },
      ],
      alreadyClaimed: [],
    }
    const findings = {
      objectiveId: 'max-after-tax-estate' as const,
      objectiveLabel: 'Maximize after-tax estate',
      recommendationState: 'neutral' as const,
      winnerLabel: 'Current plan',
      winnerSource: 'incumbent' as const,
      validation: null,
      candidates: [],
      claimAge,
    }
    const input = { plan: edited, result: view.result, summary: view.summary, startYear: EXAMPLE_FIXED_YEAR }
    const page = buildStandaloneReportHtml({ ...input, recommendationEvidence: findings })
    const card = claimAgeSearchRefusal(
      { outcome: 'aca-unpriced', unpricedAca: [{ year: 2026, reasons: ['missing-year-contract'] }, { year: 2028, reasons: ['tax-year-parameters-unsupported'] }], alreadyClaimed: [] },
      (id) => id,
      EXAMPLE_FIXED_YEAR,
      edited.expenses.healthcare,
    )!
    expect(card).toContain('2026 (the details the credit needs were removed when the filing status was changed)')
    expect(page).toContain(`<td>Social Security claim age</td><td>${card}</td>`)
    const model = buildReportModel({ ...input, modeledFindings: findings })
    expect(model.blocks['modeled-findings']?.claimAge?.unpricedAca).toEqual([
      { year: 2026, reasons: ['missing-year-contract'], removedBy: 'filingStatusChanged' },
      { year: 2028, reasons: ['tax-year-parameters-unsupported'] },
    ])
    const parsed = parseReportModel(serializeReportModel(model))
    expect(parsed.ok).toBe(true)
  })

  it('renders a version-3 model saved before the outcome existed as a search that ran', () => {
    const legacy: ReportClaimAgeEvidence = { ...base }
    const model = buildReportModel({
      plan,
      result: view.result,
      summary: view.summary,
      startYear: EXAMPLE_FIXED_YEAR,
      modeledFindings: {
        objectiveId: 'max-after-tax-estate',
        objectiveLabel: 'Maximize after-tax estate',
        recommendationState: 'neutral',
        winnerLabel: 'Current plan',
        winnerSource: 'incumbent',
        validation: null,
        candidates: [],
        claimAge: legacy,
      },
    })
    const parsed = parseReportModel(serializeReportModel(model))
    expect(parsed.ok).toBe(true)
    expect(html(legacy)).toContain('<td>SS claim combinations optimized</td><td>1</td>')
  })
})
