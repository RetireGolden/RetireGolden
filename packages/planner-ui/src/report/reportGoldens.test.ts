/**
 * Golden fixtures for the report pipeline over the reference cases from the
 * advisor-branding plan: single/couple, accumulation/retirement, survivor,
 * failure path, and incomplete data.
 *
 * Two layers share the same cases:
 *  - `goldens/*.report.html` locks the standalone report HTML byte for byte —
 *    the oracle that the report-model refactor restructures assembly without
 *    changing output;
 *  - `goldens/*.report-model.json` locks the edition-neutral ReportModel JSON
 *    contract that downstream renderers consume.
 *
 * Everything is pinned (fixed clock, fixed start year, deterministic example
 * ids), so any diff in these files is a real contract change and must be
 * reviewed as one.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import type { ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { EXAMPLE_FIXED_YEAR, exampleFixedNow, exampleIdFactory } from '../planner/examples/buildContext'
import { getExampleById } from '../planner/examples/registry'
import { projectPlan } from '../planner/useProjection'
import { buildStandaloneReportHtml, type ReportRecommendationEvidence } from './reportHtml'
import { buildReportModel, serializeReportModel } from './reportModel'

// Noon UTC (repo convention, see EXAMPLE_FIXED_NOW_ISO): the report's
// prepared-date line renders in the local timezone, and noon keeps the
// calendar date stable across the timezones CI and dev machines run in.
const GOLDEN_PREPARED_AT = '2026-07-11T12:00:00.000Z'

function examplePlan(id: string): Plan {
  const example = getExampleById(id)
  if (!example) throw new Error(`example ${id} missing from registry`)
  return example.build()
}

/** A plan still being set up: no income, nothing that can fund spending. */
function incompleteDataPlan(): Plan {
  return createEmptyPlan({
    newId: exampleIdFactory('golden-incomplete'),
    now: exampleFixedNow,
    name: 'Incomplete plan',
  })
}

/**
 * Deterministic modeled-findings evidence (mirrors the shape the optimizer
 * emits) so the goldens exercise the findings block without running the LP
 * solver in this suite.
 */
function syntheticFindings(summary: ProjectionSummary): ReportRecommendationEvidence {
  return {
    objectiveId: 'max-after-tax-estate',
    objectiveLabel: 'Maximize after-tax estate',
    recommendationState: 'beneficial',
    winnerLabel: 'Fill the 12% bracket',
    winnerSource: 'candidate',
    validation: {
      // Whole dollars: raw engine floats differ in the last digit across
      // platforms (libm), which would make the committed goldens unstable.
      baselineAfterTaxEstate: Math.round(summary.endingAfterTaxEstate),
      candidateAfterTaxEstate: Math.round(summary.endingAfterTaxEstate) + 1000,
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
}

interface GoldenCase {
  slug: string
  covers: string
  plan: () => Plan
  withFindings?: boolean
}

/** The reference cases from the advisor-branding plan's acceptance criteria. */
const GOLDEN_CASES: GoldenCase[] = [
  { slug: 'example-couple', covers: 'couple near retirement', plan: () => examplePlan('example-couple'), withFindings: true },
  { slug: 'under-saved-single', covers: 'single retiree, failure path (depletion)', plan: () => examplePlan('under-saved-single') },
  { slug: 'early-career-match', covers: 'accumulation', plan: () => examplePlan('early-career-match') },
  { slug: 'survivor-years', covers: 'survivor years', plan: () => examplePlan('survivor-years') },
  { slug: 'incomplete-data', covers: 'plan still being set up', plan: incompleteDataPlan },
]

function projectGoldenCase(goldenCase: GoldenCase) {
  const plan = goldenCase.plan()
  const { result, summary } = projectPlan(plan, EXAMPLE_FIXED_YEAR)
  const findings = goldenCase.withFindings ? syntheticFindings(summary) : null
  return { plan, result, summary, findings }
}

describe('standalone report HTML goldens', () => {
  for (const goldenCase of GOLDEN_CASES) {
    it(`matches the committed report HTML for ${goldenCase.slug} (${goldenCase.covers})`, async () => {
      const { plan, result, summary, findings } = projectGoldenCase(goldenCase)
      const html = buildStandaloneReportHtml({
        plan,
        result,
        summary,
        startYear: EXAMPLE_FIXED_YEAR,
        preparedAtIso: GOLDEN_PREPARED_AT,
        recommendationEvidence: findings,
      })
      await expect(html).toMatchFileSnapshot(`./goldens/${goldenCase.slug}.report.html`)
    })
  }

  it('matches the committed report HTML for example-couple with host branding', async () => {
    const { plan, result, summary } = projectGoldenCase(GOLDEN_CASES[0]!)
    const html = buildStandaloneReportHtml({
      plan,
      result,
      summary,
      startYear: EXAMPLE_FIXED_YEAR,
      preparedAtIso: GOLDEN_PREPARED_AT,
      branding: {
        productName: 'Acme Wealth Planner',
        logoDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
        logoAlt: 'Acme Wealth',
        accentColor: '#123456',
        footerNote: 'Prepared by Acme Wealth Advisors LLC. For client review only.',
      },
    })
    await expect(html).toMatchFileSnapshot('./goldens/example-couple.branded.report.html')
  })
})

describe('report model JSON goldens', () => {
  for (const goldenCase of GOLDEN_CASES) {
    it(`matches the committed report model for ${goldenCase.slug} (${goldenCase.covers})`, async () => {
      const { plan, result, summary, findings } = projectGoldenCase(goldenCase)
      const model = buildReportModel({
        plan,
        result,
        summary,
        startYear: EXAMPLE_FIXED_YEAR,
        generatedAtIso: GOLDEN_PREPARED_AT,
        modeledFindings: findings,
      })
      await expect(serializeReportModel(model)).toMatchFileSnapshot(`./goldens/${goldenCase.slug}.report-model.json`)
    })
  }

  it('never marks a funded reference case as incomplete, and always marks the setup case', () => {
    for (const goldenCase of GOLDEN_CASES) {
      const { plan, result, summary } = projectGoldenCase(goldenCase)
      const model = buildReportModel({
        plan,
        result,
        summary,
        startYear: EXAMPLE_FIXED_YEAR,
        generatedAtIso: GOLDEN_PREPARED_AT,
      })
      expect(model.blocks['household'].incompleteData, goldenCase.slug).toBe(goldenCase.slug === 'incomplete-data')
    }
  })
})
