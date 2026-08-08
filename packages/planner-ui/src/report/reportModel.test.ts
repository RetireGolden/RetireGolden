import { describe, expect, it } from 'vitest'

import {
  recurringOrdinaryIncome,
  setAcaYearContract,
  singlePersonPlan,
  taxableAccount,
  validatePlan,
} from '@retiregolden/engine/testing/planFixtures'
import type { Plan } from '@retiregolden/engine/model/plan'
import { draftPlanFromBrokerAccounts, parseBrokerPositionsCsv } from '../import/brokerCsv'
import { projectPlan } from '../planner/useProjection'
import { fmtMoney } from '../planner/format'
import { renderStandaloneReportHtml, reportEvidenceFromOptimizeResult } from './reportHtml'
import type { InheritedAccountYearEvidence, YearResult } from '@retiregolden/engine/projection/types'
import {
  REPORT_BLOCK_IDS,
  REPORT_EDUCATIONAL_DISCLAIMER,
  accountsCsv,
  buildInheritedSchedules,
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
    expect(model.version).toBe(2)
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

  it('reports exact ACA ledger economics when annual contracts override a zero legacy premium', () => {
    const plan = fixturePlan((candidate) => {
      candidate.incomes = [recurringOrdinaryIncome('income', 30_000, 2026)]
      setAcaYearContract(candidate, {
        year: 2026,
        monthlyEnrollment: 1_000,
        monthlySlcsp: 1_000,
        coveredPersonIds: ['p1'],
      })
      candidate.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    })
    const { result, summary } = projectPlan(plan, START_YEAR)
    const model = buildReportModel({
      plan,
      result,
      summary,
      startYear: START_YEAR,
      generatedAtIso: GENERATED_AT,
    })
    const exact = result.years[0]!.aca!
    const row = model.blocks['aca-ledger'].rows[0]!

    expect(exact.readiness).toBe('actionable')
    expect(exact.grossEnrollmentPremium).toBe(12_000)
    expect(exact.modeledAllowablePtc).toBeGreaterThan(0)
    expect(exact.economicNetPremium).toBeCloseTo(12_000 - exact.modeledAllowablePtc!, 6)
    expect(row).toEqual({
      year: 2026,
      grossEnrollmentPremium: 12_000,
      applicableSlcspPremium: 12_000,
      modeledAllowablePtc: Math.round(exact.modeledAllowablePtc!),
      economicNetPremium: Math.round(exact.economicNetPremium),
      readiness: 'actionable',
    })

    const html = renderStandaloneReportHtml(model)
    expect(html).toContain('ACA current-year ledger')
    expect(html).toContain(fmtMoney(row.grossEnrollmentPremium))
    expect(html).toContain(fmtMoney(row.modeledAllowablePtc!))
    expect(html).toContain(fmtMoney(row.economicNetPremium))
    expect(html).toContain('Actionable')
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
    expect(JSON.parse(first)).toMatchObject({ kind: 'retiregolden.report-model', version: 2 })
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

  it('neutralizes formula-like account names that came through the broker importer', () => {
    const parsed = parseBrokerPositionsCsv(`"Positions for account =1+1 as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"VTI","Fund","+not-a-number","$400.00"
"VXUS","Fund","$500.00","$400.00"

"Positions for account @SUM(A1) as of 07/07/2026"
"Symbol","Description","Mkt Val (Market Value)","Cost Basis"
"BND","Fund","$250.00","$200.00"
`)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    let nextId = 0
    const draft = draftPlanFromBrokerAccounts(parsed.broker, parsed.accounts, () => `broker-${++nextId}`)
    expect(draft.ok).toBe(true)
    if (!draft.ok) return

    const csv = accountsCsv(modelFor(draft.plan).blocks['accounts'])
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'@SUM(A1)")
    for (const line of csv.split('\n').slice(1)) {
      expect(line).not.toMatch(/^[=+\-@]/)
    }
  })
})

describe('buildInheritedSchedules', () => {
  function year(year: number, rows: InheritedAccountYearEvidence[]): YearResult {
    return { year, inheritedAccounts: rows } as YearResult
  }

  it('builds a classified S1 schedule with facts, kinds, and no professional flag when settled/clean', () => {
    const plan = fixturePlan((p) => {
      p.household.people[0]!.dob = '1965-06-15'
      p.household.people[0]!.longevity = { planningAge: 95, source: 'manual' }
      p.accounts.push({
        type: 'traditional',
        id: 'spouse-ira',
        name: 'Spouse Inherited IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 300_000,
        annualContribution: 0,
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: true,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'surviving-spouse',
            beneficiaryBirthYear: 1965,
            soleBeneficiary: true,
            election: 'remain-beneficiary',
            ownerBirthYear: 1945,
            ownerYearOfDeathRmdSatisfied: true,
            provenance: { source: 'user-entered', asOf: '2026-01-01' },
          },
        },
      })
    })
    const evidence: InheritedAccountYearEvidence = {
      accountId: 'spouse-ira',
      ownerPersonId: 'p1',
      regime: 'spouse-remain-beneficiary',
      matrixRow: 'S1',
      classification: 'settled',
      requirementKind: 'annual-rmd',
      requiredAmount: 25_210.4,
      executedRequiredAmount: 25_210.4,
      voluntaryAmount: 100.2,
      disclosures: [],
      citations: ['Treas. Reg. §1.401(a)(9)-5(d)(3)(iv)'],
    }
    const block = buildInheritedSchedules(plan, [year(2026, [evidence])])
    expect(block.accounts).toHaveLength(1)
    const account = block.accounts[0]!
    expect(account.regimeLabel).toContain('Spouse life-expectancy schedule')
    expect(account.regimeLabel).toContain('S1')
    expect(account.isLegacyApproximation).toBe(false)
    expect(account.isRefusal).toBe(false)
    expect(account.needsProfessionalConfirmation).toBe(false)
    expect(account.facts.some((f) => f.includes('surviving-spouse'))).toBe(true)
    expect(account.years[0]).toMatchObject({
      year: 2026,
      kindLabel: 'Annual RMD',
      requiredAmount: 25_210,
      executedRequiredAmount: 25_210,
      voluntaryAmount: 100,
    })
  })

  it('labels a legacy two-field account as the planning approximation', () => {
    const plan = fixturePlan((p) => {
      p.accounts.push({
        type: 'traditional',
        id: 'legacy-ira',
        name: 'Legacy Inherited IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
        inherited: { ownerDeathYear: 2022, decedentHadStartedRmds: false },
      })
    })
    const evidence: InheritedAccountYearEvidence = {
      accountId: 'legacy-ira',
      ownerPersonId: 'p1',
      regime: 'legacy-planning-approximation',
      matrixRow: 'X1',
      requirementKind: 'legacy',
      requiredAmount: 10_000,
      executedRequiredAmount: 10_000,
      voluntaryAmount: 0,
      disclosures: [],
      citations: ['SECURE Act §401(b)(1)'],
    }
    const account = buildInheritedSchedules(plan, [year(2026, [evidence])]).accounts[0]!
    expect(account.isLegacyApproximation).toBe(true)
    expect(account.regimeLabel).toContain('Planning estimate')
    expect(account.facts.some((f) => f.includes('not provided'))).toBe(true)
  })

  it('flags an estate refusal for professional confirmation and the refusal note path', () => {
    const plan = fixturePlan((p) => {
      p.accounts.push({
        type: 'traditional',
        id: 'estate-ira',
        name: 'Estate Inherited IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 80_000,
        annualContribution: 0,
        inherited: {
          ownerDeathYear: 2023,
          decedentHadStartedRmds: false,
          beneficiary: {
            beneficiaryClass: 'estate',
            provenance: { source: 'user-entered', asOf: '2026-01-01' },
          },
        },
      })
    })
    const evidence: InheritedAccountYearEvidence = {
      accountId: 'estate-ira',
      ownerPersonId: 'p1',
      regime: 'unsupported',
      matrixRow: 'X3',
      refusalReason: "beneficiaryClass 'estate' is unsupported",
      requirementKind: 'legacy',
      requiredAmount: 8_000,
      executedRequiredAmount: 8_000,
      voluntaryAmount: 0,
      disclosures: [],
      citations: ['Treas. Reg. §1.401(a)(9)-4(f)'],
    }
    const account = buildInheritedSchedules(plan, [year(2026, [evidence])]).accounts[0]!
    expect(account.isRefusal).toBe(true)
    expect(account.refusalReason).toContain('estate')
    expect(account.needsProfessionalConfirmation).toBe(true)
  })

  it('returns an empty block when the plan has no inherited accounts', () => {
    expect(buildInheritedSchedules(fixturePlan(), [year(2026, [])]).accounts).toEqual([])
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
      expect(html).toContain('(plan setup incomplete; see missing-data note)')
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

describe('optimizer recommendation evidence', () => {
  it('reports a policy winner withheld for missing account allocation', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'min-lifetime-tax-estate-floor',
        candidates: [{
          id: 'fill-12',
          label: 'Fill the 12% bracket',
          executedConversionTotal: 50_000,
          afterTaxEstateDelta: 2_000,
          lifetimeTaxDelta: -5_000,
          moneyLastsYearsDelta: 0,
        }],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: {
          reason: 'identityIncomplete',
          vetoedWinnerSource: 'candidate',
          vetoedCandidateId: 'fill-12',
          vetoedCandidateLabel: 'Fill the 12% bracket',
          vetoedConversions: [{ year: 2026, amount: 50_000 }],
          vetoedValidation: {
            baseline: { endingAfterTaxEstate: 100_000 },
            candidate: { endingAfterTaxEstate: 102_000 },
            afterTaxEstateDelta: 2_000,
            endingNetWorthDelta: 1_500,
            lifetimeTaxDelta: -5_000,
            moneyLastsYearsDelta: 0,
            requestedConversionTotal: 50_000,
            executedConversionTotal: 50_000,
            executedConversionRatio: 1,
            firstMateriallyUnexecutedYear: null,
            traditionalDepletionYear: null,
            recommendationState: 'rejected',
          },
        },
      },
      claimAge: null,
    } as never)

    expect(evidence.recommendationState).toBe('identityIncomplete')
    expect(evidence.validation?.recommendationState).toBe('rejected')
    expect(evidence.winnerLabel).toContain('withheld pending account allocation')
    expect(evidence.winnerSource).toBe('candidate')
    expect(evidence.validation?.afterTaxEstateDelta).toBe(2_000)
    expect(evidence.validation?.requestedConversionTotal).toBe(50_000)
    expect(evidence.candidates[0]?.lossReason).toMatch(
      /cleared the selected objective.*owner, source IRA, and Roth destination/i,
    )
    expect(evidence.candidates[0]?.lossReason).not.toMatch(/no candidate cleared/i)
  })

  it('does not describe other rows as clearing no objective when a winner was withheld', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'min-lifetime-tax-estate-floor',
        candidates: [
          {
            id: 'fill-10',
            label: 'Fill the 10% bracket',
            executedConversionTotal: 20_000,
            afterTaxEstateDelta: 1_000,
            lifetimeTaxDelta: -2_000,
            moneyLastsYearsDelta: 0,
          },
          {
            id: 'fill-12',
            label: 'Fill the 12% bracket',
            executedConversionTotal: 50_000,
            afterTaxEstateDelta: 2_000,
            lifetimeTaxDelta: -5_000,
            moneyLastsYearsDelta: 0,
          },
        ],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: {
          reason: 'identityIncomplete',
          vetoedWinnerSource: 'candidate',
          vetoedCandidateId: 'fill-12',
          vetoedCandidateLabel: 'Fill the 12% bracket',
          vetoedConversions: [{ year: 2026, amount: 50_000 }],
          vetoedValidation: {
            baseline: { endingAfterTaxEstate: 100_000 },
            candidate: { endingAfterTaxEstate: 102_000 },
            afterTaxEstateDelta: 2_000,
            endingNetWorthDelta: 1_500,
            lifetimeTaxDelta: -5_000,
            moneyLastsYearsDelta: 0,
            requestedConversionTotal: 50_000,
            executedConversionTotal: 50_000,
            executedConversionRatio: 1,
            firstMateriallyUnexecutedYear: null,
            traditionalDepletionYear: null,
            recommendationState: 'identityIncomplete',
          },
        },
      },
      claimAge: null,
    } as never)

    expect(evidence.candidates[0]?.lossReason).toMatch(
      /trailed the calculated winner.*withheld pending account allocation/i,
    )
    expect(evidence.candidates[0]?.lossReason).not.toMatch(
      /no candidate cleared|current conversion strategy remained/i,
    )
  })

  it('reports a diagnostic-only cleaned schedule withheld for missing account allocation', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'max-after-tax-estate',
        candidates: [],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: null,
      },
      postProcessed: {
        cleanedSchedule: { conversions: [{ year: 2026, amount: 50_000 }] },
        cleanedValidation: { recommendationState: 'identityIncomplete' },
        stabilized: true,
        minimumRequestedConversionDollars: 1,
      },
      claimAge: null,
    } as never)

    expect(evidence.recommendationState).toBe('identityIncomplete')
    expect(evidence.winnerLabel).toBe(
      "the solver's cleaned schedule (withheld pending account allocation)",
    )
    expect(evidence.winnerSource).toBe('milp')
    expect(evidence.validation).toBeNull()
  })

  it('does not resurrect a legacy identity-withheld MILP row under a non-estate policy', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'min-lifetime-tax-estate-floor',
        candidates: [],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: null,
      },
      postProcessed: {
        cleanedSchedule: { conversions: [{ year: 2026, amount: 50_000 }] },
        cleanedValidation: { recommendationState: 'identityIncomplete' },
        stabilized: true,
        minimumRequestedConversionDollars: 1,
      },
      claimAge: null,
    } as never)

    expect(evidence.recommendationState).toBe('none')
    expect(evidence.winnerLabel).toBe('none')
    expect(evidence.winnerSource).toBe('none')
  })

  it('attributes a withheld MILP row to the readiness veto', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'max-after-tax-estate',
        candidates: [],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: {
          reason: 'identityIncomplete',
          vetoedWinnerSource: 'milp',
          vetoedCandidateId: null,
          vetoedCandidateLabel: null,
          vetoedConversions: [{ year: 2026, amount: 50_000 }],
          vetoedValidation: {
            baseline: { endingAfterTaxEstate: 100_000 },
            candidate: { endingAfterTaxEstate: 102_000 },
            afterTaxEstateDelta: 2_000,
            endingNetWorthDelta: 1_500,
            lifetimeTaxDelta: -5_000,
            moneyLastsYearsDelta: 0,
            requestedConversionTotal: 50_000,
            executedConversionTotal: 50_000,
            executedConversionRatio: 1,
            firstMateriallyUnexecutedYear: null,
            traditionalDepletionYear: null,
            recommendationState: 'identityIncomplete',
          },
        },
      },
      claimAge: null,
    } as never)

    expect(evidence.winnerSource).toBe('milp')
    expect(evidence.candidates[0]).toMatchObject({
      candidateId: 'milp-cleaned-schedule',
      label: "the solver's cleaned schedule",
      afterTaxEstateDelta: 2_000,
      lifetimeTaxDelta: -5_000,
      moneyLastsYearsDelta: 0,
    })
    expect(evidence.candidates[0]?.lossReason).toMatch(
      /owner, source IRA, and Roth destination/i,
    )
    expect(evidence.candidates[0]?.lossReason).not.toMatch(/no candidate cleared/i)
  })

  it('does not relabel an ACA-vetoed result as account-allocation withholding', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'max-after-tax-estate',
        candidates: [],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: {
          baselineNonActionableYears: [2027],
          candidateNonActionableYears: [],
          supportCodes: ['tax-year-parameters-unsupported'],
          vetoedCandidateIds: [],
          vetoedMilp: true,
        },
        retirementActionReadinessVeto: null,
      },
      postProcessed: {
        cleanedSchedule: { conversions: [{ year: 2026, amount: 50_000 }] },
        cleanedValidation: { recommendationState: 'identityIncomplete' },
        stabilized: true,
        minimumRequestedConversionDollars: 1,
      },
      claimAge: null,
    } as never)

    expect(evidence.recommendationState).toBe('none')
    expect(evidence.winnerLabel).toBe('none')
    expect(evidence.winnerSource).toBe('none')
  })
})

/**
 * The report's half of the promoted-schedule verdicts. A published promotion
 * lifts the veto, so the report's existing withheld arms never see one; what it
 * has to say instead is which schedule won, and that the winner is the one
 * naming accounts.
 */
describe('optimizer recommendation evidence for a promoted winner', () => {
  const winnerValidation = {
    baseline: { endingAfterTaxEstate: 100_000 },
    candidate: { endingAfterTaxEstate: 104_000 },
    afterTaxEstateDelta: 4_000,
    endingNetWorthDelta: 3_500,
    lifetimeTaxDelta: -5_000,
    moneyLastsYearsDelta: 0,
    requestedConversionTotal: 40_000,
    executedConversionTotal: 40_000,
    executedConversionRatio: 1,
    firstMateriallyUnexecutedYear: null,
    traditionalDepletionYear: null,
    recommendationState: 'beneficial',
  }

  function publishedTournament(promotion: unknown) {
    return {
      tournament: {
        policyId: 'max-after-tax-estate',
        candidates: [],
        winnerSource: 'candidate',
        winnerCandidateId: 'promoted-candidate',
        winnerLabel: 'Explicit schedule after exploring: Fill the 22% bracket',
        winnerConversions: [{ year: 2026, amount: 40_000 }],
        winnerValidation,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: null,
        retirementActionPromotion: promotion,
      },
      postProcessed: null,
      claimAge: null,
    }
  }

  it('marks an equivalent winner as the named account schedule', () => {
    const evidence = reportEvidenceFromOptimizeResult(publishedTournament({
      outcome: 'equivalent',
      candidateId: 'promoted-candidate',
      label: 'Explicit schedule after exploring: Fill the 22% bracket',
      actionRequestIds: ['promoted-2026'],
      planPatch: {},
      years: [],
      evidence: { equality: 'exactMinorUnitByRequiredKey' },
      binding: null,
    }) as never)

    expect(evidence.recommendationState).toBe('beneficial')
    expect(evidence.winnerLabel).toBe(
      'Explicit schedule after exploring: Fill the 22% bracket (named account schedule)',
    )
    expect(evidence.winnerLabel).not.toContain('withheld pending account allocation')
  })

  it('says a repriced winner carries its own pricing', () => {
    const evidence = reportEvidenceFromOptimizeResult(publishedTournament({
      outcome: 'repriced',
      candidateId: 'promoted-candidate',
      label: 'Explicit schedule after exploring: Fill the 22% bracket',
      actionRequestIds: ['promoted-2026'],
      planPatch: {},
      years: [],
      aggregateConversions: [{ year: 2026, amount: 60_000 }],
    }) as never)

    expect(evidence.winnerLabel).toBe(
      'Explicit schedule after exploring: Fill the 22% bracket ' +
      '(named account schedule, priced on its own projection)',
    )
  })

  it('adds what the promotion loop found to a withheld winner’s loss reason', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'max-after-tax-estate',
        candidates: [{
          id: 'fill-22',
          label: 'Fill the 22% bracket',
          executedConversionTotal: 60_000,
          afterTaxEstateDelta: 4_000,
          lifetimeTaxDelta: -5_000,
          moneyLastsYearsDelta: 0,
        }],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: {
          reason: 'identityIncomplete',
          vetoedWinnerSource: 'candidate',
          vetoedCandidateId: 'fill-22',
          vetoedCandidateLabel: 'Fill the 22% bracket',
          vetoedConversions: [{ year: 2026, amount: 60_000 }],
          vetoedValidation: { ...winnerValidation, recommendationState: 'identityIncomplete' },
        },
        retirementActionPromotion: {
          outcome: 'notComparable',
          reason: 'allocatedRankingNotComparable',
          allocatedRecommendationState: 'diagnostic',
          diagnostics: ['Blocking reasons: conversion-plan-availability-unknown.'],
        },
      },
      postProcessed: null,
      claimAge: null,
    } as never)

    expect(evidence.candidates[0]?.lossReason).toMatch(
      /owner, source IRA, and Roth destination.*did not execute as written/is,
    )
  })

  it('leaves the withheld sentence alone when no promotion loop ran', () => {
    const evidence = reportEvidenceFromOptimizeResult({
      tournament: {
        policyId: 'max-after-tax-estate',
        candidates: [{
          id: 'fill-22',
          label: 'Fill the 22% bracket',
          executedConversionTotal: 60_000,
          afterTaxEstateDelta: 4_000,
          lifetimeTaxDelta: -5_000,
          moneyLastsYearsDelta: 0,
        }],
        winnerSource: 'none',
        winnerCandidateId: null,
        winnerLabel: null,
        winnerConversions: [],
        winnerValidation: null,
        marginOverMilpDollars: 0,
        searchRefined: false,
        searchSimulations: 0,
        acaActionabilityVeto: null,
        retirementActionReadinessVeto: {
          reason: 'identityIncomplete',
          vetoedWinnerSource: 'candidate',
          vetoedCandidateId: 'fill-22',
          vetoedCandidateLabel: 'Fill the 22% bracket',
          vetoedConversions: [{ year: 2026, amount: 60_000 }],
          vetoedValidation: { ...winnerValidation, recommendationState: 'identityIncomplete' },
        },
        retirementActionPromotion: null,
      },
      postProcessed: null,
      claimAge: null,
    } as never)

    expect(evidence.candidates[0]?.lossReason).toMatch(/until those account identities are allocated\.$/)
  })
})
