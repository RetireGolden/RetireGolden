import { describe, expect, it } from 'vitest'

import { singlePersonPlan, taxableAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import type { Plan } from '@retiregolden/engine/model/plan'
import { projectPlan } from '../planner/useProjection'
import { renderStandaloneReportHtml } from './reportHtml'
import {
  REPORT_BLOCK_IDS,
  REPORT_EDUCATIONAL_DISCLAIMER,
  accountsCsv,
  buildReportModel,
  chartDataCsv,
  serializeReportModel,
  yearLedgerCsv,
  type ReportModel,
  type ReportModelInput,
} from './reportModel'

const START_YEAR = 2026
const GENERATED_AT = '2026-07-11T00:00:00.000Z'

function fixturePlan(mutate?: (plan: Plan) => void): Plan {
  const plan = singlePersonPlan()
  plan.accounts.push(taxableAccount('acct-taxable', 500_000, 250_000))
  mutate?.(plan)
  return validatePlan(plan)
}

function modelFor(plan: Plan, extra: Partial<ReportModelInput> = {}): ReportModel {
  const { result, summary } = projectPlan(plan, START_YEAR)
  return buildReportModel({ plan, result, summary, startYear: START_YEAR, generatedAtIso: GENERATED_AT, ...extra })
}

describe('buildReportModel', () => {
  it('carries every declared block id, and nothing else', () => {
    const model = modelFor(fixturePlan())
    expect(Object.keys(model.blocks).sort()).toEqual([...REPORT_BLOCK_IDS].sort())
  })

  it('stamps identity, span, and provenance', () => {
    const model = modelFor(fixturePlan())
    expect(model.kind).toBe('retiregolden.report-model')
    expect(model.version).toBe(1)
    expect(model.planName).toBe('Test plan')
    expect(model.generatedAtIso).toBe(GENERATED_AT)
    expect(model.startYear).toBe(START_YEAR)
    expect(model.endYear).toBeGreaterThanOrEqual(START_YEAR)
    expect(model.provenance.federalParameterPackYear).toBeGreaterThanOrEqual(2025)
    expect(model.provenance.stateParameterPackYear).toBeGreaterThanOrEqual(2025)
    expect(model.provenance.parameterDataAsOf).not.toBe('')
    // Build identifiers are host-supplied facts, never guessed.
    expect(model.provenance.engineVersion).toBeNull()
    expect(model.provenance.hostVersion).toBeNull()
  })

  it('records host build identifiers verbatim when supplied', () => {
    const model = modelFor(fixturePlan(), { build: { engineVersion: '0.1.0', hostVersion: '2.3.4' } })
    expect(model.provenance.engineVersion).toBe('0.1.0')
    expect(model.provenance.hostVersion).toBe('2.3.4')
  })

  it('selects headline metrics from the summary at whole-dollar presentation precision', () => {
    const plan = fixturePlan()
    const { result, summary } = projectPlan(plan, START_YEAR)
    const model = buildReportModel({ plan, result, summary, startYear: START_YEAR, generatedAtIso: GENERATED_AT })
    const headline = model.blocks['headline-results']
    expect(headline.endingNetWorth).toBe(Math.round(summary.endingNetWorth))
    expect(headline.endingAfterTaxEstate).toBe(Math.round(summary.endingAfterTaxEstate))
    expect(headline.depletionYear).toBe(summary.depletionYear)
    expect(headline.lifetimeTaxesAndPenalties).toBe(Math.round(summary.lifetimeTaxesAndPenalties))
    expect(headline.fiNumber).toBe(Math.round(summary.fiNumber))
    expect(model.blocks['year-ledger'].rows).toHaveLength(result.years.length)
    const firstYear = result.years[0]!
    expect(model.blocks['year-ledger'].rows[0]).toMatchObject({
      year: firstYear.year,
      income: Math.round(firstYear.incomes.total),
      taxAndPenalties: Math.round(firstYear.tax + firstYear.penalties),
      netWorth: Math.round(firstYear.netWorth),
    })
  })

  it('flags a plan that cannot fund spending as incomplete data', () => {
    const funded = modelFor(fixturePlan())
    expect(funded.blocks['household'].incompleteData).toBe(false)

    const bare = singlePersonPlan()
    bare.accounts = []
    bare.incomes = []
    const empty = modelFor(validatePlan(bare))
    expect(empty.blocks['household'].incompleteData).toBe(true)
  })

  it('always carries the educational disclosure', () => {
    const model = modelFor(fixturePlan())
    expect(model.blocks['disclosures'].statements).toContain(REPORT_EDUCATIONAL_DISCLAIMER)
  })

  it('leaves modeled findings and advisor content null unless supplied', () => {
    const model = modelFor(fixturePlan())
    expect(model.blocks['modeled-findings']).toBeNull()
    expect(model.blocks['advisor-recommendations']).toBeNull()
  })

  it('treats an empty advisor list the same as none — the block is never auto-populated', () => {
    const model = modelFor(fixturePlan(), { advisorRecommendations: [] })
    expect(model.blocks['advisor-recommendations']).toBeNull()
  })

  it('snapshots modeled findings — mutating the input afterwards leaves the model unchanged', () => {
    const findings = {
      objectiveId: 'max-after-tax-estate',
      objectiveLabel: 'Maximize after-tax estate',
      recommendationState: 'beneficial',
      winnerLabel: 'Fill the 12% bracket',
      winnerSource: 'candidate',
      validation: null,
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
      claimAge: null,
    }
    const model = modelFor(fixturePlan(), { modeledFindings: findings })
    findings.winnerLabel = 'mutated'
    findings.candidates[0]!.label = 'mutated'
    const block = model.blocks['modeled-findings']!
    expect(block.winnerLabel).toBe('Fill the 12% bracket')
    expect(block.candidates[0]!.label).toBe('Fill the 10% bracket')
  })

  it('copies advisor-authored content verbatim when the host supplies it', () => {
    const model = modelFor(fixturePlan(), {
      advisorRecommendations: [
        { heading: 'Revisit the emergency fund', body: 'Keep two years of spending liquid.', authoredBy: 'A. Advisor, CFP' },
      ],
    })
    expect(model.blocks['advisor-recommendations']).toEqual({
      entries: [
        {
          heading: 'Revisit the emergency fund',
          body: 'Keep two years of spending liquid.',
          authoredBy: 'A. Advisor, CFP',
          adoptedAtIso: null,
        },
      ],
    })
  })
})

describe('serializeReportModel', () => {
  it('is deterministic and key-order independent', () => {
    const plan = fixturePlan()
    const first = serializeReportModel(modelFor(plan))
    const second = serializeReportModel(modelFor(fixturePlan()))
    expect(second).toBe(first)
    expect(first.endsWith('\n')).toBe(true)
    // Sorted keys: "blocks" precedes "kind" precedes "version".
    expect(first.indexOf('"blocks"')).toBeLessThan(first.indexOf('"kind"'))
    expect(JSON.parse(first)).toMatchObject({ kind: 'retiregolden.report-model', version: 1 })
  })
})

describe('table export helpers', () => {
  it('chart CSV reproduces the exact CSV embedded in the standalone HTML report', () => {
    const model = modelFor(fixturePlan())
    const csv = chartDataCsv(model.blocks['chart-data'])
    expect(csv.startsWith('year,cash,taxable,equityComp,traditional,roth,hsa,income,spendingPlusTax\n')).toBe(true)
    // The chart CSV is numeric-only, so it survives HTML escaping untouched.
    expect(renderStandaloneReportHtml(model)).toContain(`<pre>${csv}</pre>`)
  })

  it('year-ledger CSV carries one row per projected year, reconciling to the model', () => {
    const model = modelFor(fixturePlan())
    const lines = yearLedgerCsv(model.blocks['year-ledger']).split('\n')
    expect(lines).toHaveLength(model.blocks['year-ledger'].rows.length + 1)
    const firstRow = model.blocks['year-ledger'].rows[0]!
    expect(lines[1]!.startsWith(`${firstRow.year},${firstRow.income},`)).toBe(true)
  })

  it('accounts CSV quotes cells that contain commas, quotes, or line breaks', () => {
    const model = modelFor(
      fixturePlan((plan) => {
        plan.accounts[plan.accounts.length - 1]!.name = 'Brokerage, "joint"\rextra'
      }),
    )
    expect(accountsCsv(model.blocks['accounts'])).toContain('"Brokerage, ""joint""\rextra"')
  })

  it('accounts CSV neutralizes spreadsheet formula injection in text cells', () => {
    const model = modelFor(
      fixturePlan((plan) => {
        plan.accounts[plan.accounts.length - 1]!.name = '=HYPERLINK("https://attacker.example","Open")'
      }),
    )
    const csv = accountsCsv(model.blocks['accounts'])
    // Apostrophe-prefixed so Excel/Sheets render text instead of evaluating.
    expect(csv).toContain(`"'=HYPERLINK(""https://attacker.example"",""Open"")"`)
    expect(csv).not.toMatch(/^=|[\n,]=/m)
  })
})

describe('renderStandaloneReportHtml incomplete-data caveat', () => {
  it('renders the missing-data caveat and qualified headline for an incomplete plan', () => {
    const bare = singlePersonPlan()
    bare.accounts = []
    bare.incomes = []
    const model = modelFor(validatePlan(bare))
    expect(model.blocks['household'].incompleteData).toBe(true)
    const html = renderStandaloneReportHtml(model)
    expect(html).toContain('Missing data: this plan has no income sources and no funded accounts')
    expect(html).toContain('the household setup is incomplete')
    if (model.blocks['headline-results'].depletionYear !== null) {
      expect(html).toContain('(plan setup incomplete - see missing-data note)')
      expect(html).not.toMatch(/Depletes in \d+</)
    }
  })

  it('renders no caveat for a funded plan', () => {
    const html = renderStandaloneReportHtml(modelFor(fixturePlan()))
    expect(html).not.toContain('Missing data:')
    expect(html).not.toContain('setup is incomplete')
  })
})

describe('renderStandaloneReportHtml advisor block', () => {
  it('renders host-authored advisor content as an attributed section without scripts', () => {
    const model = modelFor(fixturePlan(), {
      advisorRecommendations: [
        {
          heading: 'Revisit the emergency fund <script>',
          body: 'Keep two years of spending liquid.',
          authoredBy: 'A. Advisor, CFP',
          // Noon UTC so the rendered calendar date is timezone-stable.
          adoptedAtIso: '2026-07-01T12:00:00.000Z',
        },
      ],
    })
    const html = renderStandaloneReportHtml(model)
    expect(html).toContain('Advisor recommendations')
    expect(html).toContain('Authored by A. Advisor, CFP')
    expect(html).toContain('adopted July 1, 2026')
    expect(html).not.toContain('<script')
  })
})
