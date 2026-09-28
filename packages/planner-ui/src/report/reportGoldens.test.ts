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
 *
 * 2026-09-05: state-income-tax provenance figures in the committed goldens
 * were updated to match packages/engine/src/params/provenance.ts (Maine 2026
 * basic/age/phase-out appendix text; West Virginia 2026 §11-21-4j rate range
 * and Michigan ordinary retirement ceiling folded into the all-states group).
 * 2026-09-07: Delaware, Hawaii, Rhode Island, and Utah 2026 parameter
 * provenance wording updated in engine records and DOCS; report calculation
 * values unchanged in these examples — numeric state correction oracles live
 * in engine fixtures. State law oracle coverage lives in engine goldens and
 * DOCS/domain.
 * 2026-09-08: CA/MN provenance wording plus early-career-match CA observed
 * results refreshed in committed report goldens; not a new oracle.
 * 2026-09-08: Maine pension-cap provenance appendix refreshed to match the
 * engine's published $49,824 maximum and disclosed omissions. These report
 * examples have no calculation changes; the Maine numeric oracle is in the
 * engine's state-tax fixtures.
 * 2026-09-12: HECM provenance appendix text updated (provisional federal-pack
 * placeholder removed); example-couple and coast-fire reflect KY/CO state-tax
 * characterization changes. Committed report snapshot bytes are regenerated
 * separately; numeric oracles remain in engine fixtures.
 * 2026-09-25: example-couple's modeling notes lose "Spending withdrawals from
 * traditional accounts pushed income above the Roth-conversion target in some
 * years." (decision D-ROTH-TARGET-WARNING: the warning now needs the year's
 * sized metric to end above the target). Sam's share of each conversion is
 * dropped, so the two years with a spending draw on the IRAs, 2034 and 2035,
 * end about $94,753 and $70,301 under the top of the 22% bracket. No figure
 * in these goldens changed.
 * 2026-09-26 (B2-P1 slice 1, owner decision R15): the headline "Money lasts"
 * row names the last fully funded year and the first short year from the
 * engine's moneyLasts, "Through 2045 (runs short in 2046)" where it said
 * "Depletes in 2046" (under-saved-single; survivor-years and incomplete-data
 * likewise). No figure changed; report-model JSON goldens are unchanged.
 * 2026-09-26: wording only (decision D-PUBLIC-RECORD-WORDING): the page title
 * separator is a middle dot instead of a spaced hyphen, income rows read
 * "Wages (Alex)" and "Social Security (Alex)" instead of "Wages - Alex", and
 * the provenance rows say "parameter set" instead of "parameter pack", and
 * the TIPS curve source in the appendix is "refreshed annually with the
 * parameter sets". No figure in these goldens changed.
 * 2026-09-26 (decision D-ACA-2027-TABLE): 2027 is priced on its published
 * credit figures (Rev. Proc. 2026-26 and the HHS 2026 poverty guidelines).
 * example-couple (952% of the poverty line) and early-career-match (391%, a
 * contribution above the benchmark) show their 2027 ACA ledger row as a $0
 * credit, Actionable, where it read "Not modeled", Non-actionable; the first
 * gross-premium year is now 2028, so example-couple's gross-premium modeling
 * note moves after the Roth note it used to precede. Every report gains the
 * "ACA premium tax credit figures" provenance row and the model's
 * provenance.acaCoverageYears, and the parameter appendix's poverty-line and
 * ACA rows name both coverage years. No other figure changed.
 * 2026-09-27 (same decision, review finding F2): the ACA ledger block gains
 * projectedIncomeTaxNote, and the standalone report prints it under the ACA
 * table: "2027 is priced on published Marketplace figures, with income from
 * projected tax brackets." in example-couple (both HTML goldens) and
 * early-career-match, whose 2027 rows are priced while their income-tax
 * figures are projected; the other report models carry null. That sentence is
 * the only HTML change.
 * 2026-09-27 (same decision, review of #750): the parameter appendix's one
 * "ACA premium tax credit" row, which linked both years' schedules to Rev.
 * Proc. 2025-25, is two rows, "ACA premium tax credit, 2026 coverage" (Rev.
 * Proc. 2025-25) and "ACA premium tax credit, 2027 coverage" (Rev. Proc.
 * 2026-26, rp-26-26.pdf), in every golden and in each model's
 * parameter-sources block; nothing else in any golden changed.
 * 2026-09-27 (decision D-LIFE-TABLE-2023, its review's M3): the parameter
 * appendix and each model's parameter-sources block gain the "SSA period life
 * table" row (Table 4C6, the 2023 period table of the 2026 Trustees Report),
 * after the CPI-U row; nothing else in any golden changed.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '@retiregolden/engine/model/plan'
import type { ProjectionSummary } from '@retiregolden/engine/projection/compare'
import { EXAMPLE_FIXED_YEAR, exampleFixedNow, exampleIdFactory } from '../planner/examples/buildContext'
import { getExampleById } from '../planner/examples/registry'
import { projectPlan } from '../planner/useProjection'
import { buildStandaloneReportHtml, type ReportRecommendationEvidence } from './reportHtml'
import { buildReportModel, parseReportModel, serializeReportModel } from './reportModel'

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
    // example-couple's own claim-age outcome since B2-P1 slice 5: its 2028 and
    // 2029 Marketplace credits cannot be priced, so the search refuses and the
    // report prints the Optimize card's refusal, each year with its reason.
    claimAge: {
      outcome: 'aca-unpriced',
      unpricedAca: [
        { year: 2028, reasons: ['tax-year-parameters-unsupported'] },
        { year: 2029, reasons: ['tax-year-parameters-unsupported'] },
      ],
      alreadyClaimed: [],
      combinationsEvaluated: 1,
      winningClaimLabel: null,
      jointExactEstate: 1_000_000,
      currentClaimExactEstate: 1_000_000,
      claimChangeEstateGain: 0,
      estateYear: 2059,
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
      const serialized = serializeReportModel(model)
      await expect(serialized).toMatchFileSnapshot(`./goldens/${goldenCase.slug}.report-model.json`)
      expect(parseReportModel(serialized)).toMatchObject({ ok: true })
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
