import { describe, expect, it } from 'vitest'

import { defaultExampleCases, projectCase } from '../cases/caseRunner'
import { buildStandaloneReportHtml, type ReportRecommendationEvidence } from './reportHtml'

describe('standalone report HTML', () => {
  it('renders self-contained audit sections for a projected plan', () => {
    const caseDefinition = defaultExampleCases()[0]!
    const { result, summary } = projectCase(caseDefinition)
    const html = buildStandaloneReportHtml({
      plan: caseDefinition.plan,
      result,
      summary,
      startYear: result.startYear,
      preparedAtIso: '2026-07-07T00:00:00.000Z',
    })

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('Example couple')
    expect(html).toContain('Headline results')
    expect(html).toContain('Assumptions and provenance')
    expect(html).toContain('Parameter source appendix')
    expect(html).toContain('Embedded chart/automation data CSV')
    expect(html).not.toContain('<script')
  })

  it('includes exact-ledger recommendation evidence when supplied', () => {
    const caseDefinition = defaultExampleCases()[0]!
    const { result, summary } = projectCase(caseDefinition)
    const evidence: ReportRecommendationEvidence = {
      objectiveId: 'max-after-tax-estate',
      objectiveLabel: 'Maximize after-tax estate',
      recommendationState: 'beneficial',
      winnerLabel: 'Fill the 12% bracket',
      winnerSource: 'candidate',
      validation: {
        baseline: summary,
        candidate: { ...summary, endingAfterTaxEstate: summary.endingAfterTaxEstate + 1000 },
        afterTaxEstateDelta: 1000,
        endingNetWorthDelta: 1200,
        lifetimeTaxDelta: 300,
        moneyLastsYearsDelta: 0,
        requestedConversionTotal: 50_000,
        executedConversionTotal: 49_500,
        executedConversionRatio: 0.99,
        firstMateriallyUnexecutedYear: null,
        traditionalDepletionYear: null,
        recommendationState: 'beneficial',
      },
      candidates: [
        {
          candidateId: 'bracket-10',
          label: 'Fill the 10% bracket',
          afterTaxEstateDelta: 500,
          lifetimeTaxDelta: 100,
          moneyLastsYearsDelta: 0,
          lossReason: 'Trailed the selected recommendation by $500.',
        },
      ],
      claimAge: {
        combinationsEvaluated: 3,
        winningClaimLabel: 'Pat claims Social Security at 70',
        jointExactEstate: 1_118_000,
        currentClaimExactEstate: 1_000_000,
      },
    }
    const html = buildStandaloneReportHtml({
      plan: caseDefinition.plan,
      result,
      summary,
      startYear: result.startYear,
      preparedAtIso: '2026-07-07T00:00:00.000Z',
      recommendationEvidence: evidence,
    })

    expect(html).toContain('Recommendation evidence')
    expect(html).toContain('Baseline after-tax estate')
    expect(html).toContain('Candidate loss reasons')
    expect(html).toContain('Fill the 10% bracket')
    expect(html).toContain('Recommended Social Security claim change')
    expect(html).toContain('Pat claims Social Security at 70')
    expect(html).toContain('Claim-change estate gain')
    expect(html).toContain('+$118,000')
  })

  it('reports a held current claim without the estate-gain rows', () => {
    const caseDefinition = defaultExampleCases()[0]!
    const { result, summary } = projectCase(caseDefinition)
    const html = buildStandaloneReportHtml({
      plan: caseDefinition.plan,
      result,
      summary,
      startYear: result.startYear,
      preparedAtIso: '2026-07-07T00:00:00.000Z',
      recommendationEvidence: {
        objectiveId: 'max-after-tax-estate',
        objectiveLabel: 'Maximize after-tax estate',
        recommendationState: 'neutral',
        winnerLabel: 'current plan strategy',
        winnerSource: 'incumbent',
        validation: null,
        candidates: [],
        claimAge: {
          combinationsEvaluated: 5,
          winningClaimLabel: null,
          jointExactEstate: 1_000_000,
          currentClaimExactEstate: 1_000_000,
        },
      },
    })

    expect(html).toContain('SS claim combinations optimized')
    expect(html).toContain('None - current claim ages held')
    expect(html).not.toContain('Claim-change estate gain')
  })
})
