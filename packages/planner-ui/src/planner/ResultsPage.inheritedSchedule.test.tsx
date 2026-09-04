/** @vitest-environment jsdom */
/**
 * WS5 Chunk B — inherited schedule explanation surface on Results.
 * Renders the expandable per-account section from synthetic
 * YearResult.inheritedAccounts rows (no full projection required).
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import type { Plan } from '@retiregolden/engine/model/plan'
import type {
  InheritedAccountYearEvidence,
  InheritedIraRefusalCode,
  YearResult,
} from '@retiregolden/engine/projection/types'
import { singlePersonPlan, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { InheritedSchedulesSection } from './ResultsPage'

function basePlan(mutate?: (plan: Plan) => void): Plan {
  const plan = singlePersonPlan({ dob: '1965-06-15', planningAge: 95, retirementAge: null })
  plan.accounts = []
  mutate?.(plan)
  return validatePlan(plan)
}

function yearWithEvidence(
  year: number,
  rows: InheritedAccountYearEvidence[],
): YearResult {
  return {
    year,
    people: [{ personId: 'p1', ageAttained: 61, alive: true }],
    filingStatus: 'single',
    incomes: {
      wages: 0,
      socialSecurity: 0,
      pension: 0,
      annuity: 0,
      tipsLadder: 0,
      recurring: 0,
      oneTime: 0,
      taxableInterest: 0,
      taxExemptInterest: 0,
      ordinaryDividends: 0,
      qualifiedDividends: 0,
      taxableYield: 0,
      total: 0,
    },
    expenses: {
      baseSpending: 0,
      healthcare: 0,
      propertyCosts: 0,
      debtService: 0,
      insurancePremiums: 0,
      careCost: 0,
      ltcBenefit: 0,
      oneTimeGoals: 0,
      requiredSpending: 0,
      targetSpending: 0,
      idealSpending: 0,
      excessSpending: 0,
      intendedSpending: 0,
      total: 0,
      guardrailFactor: 1,
    },
    contributions: 0,
    employerMatch: 0,
    rmd: 0,
    sepp: 0,
    inheritedDistribution: rows.reduce((sum, row) => sum + row.executedRequiredAmount, 0),
    inheritedTraditionalDistribution: rows.reduce((sum, row) => sum + row.executedRequiredAmount, 0),
    inheritedAccounts: rows,
    qcd: 0,
    rothConversion: 0,
    tax: 0,
    amt: 0,
    penalties: 0,
    magi: 0,
    withdrawals: { cash: 0, taxable: 0, equityComp: 0, traditional: 0, roth: 0, hsa: 0, total: 0 },
    realizedGains: 0,
    capitalLossUsedAgainstGains: 0,
    capitalLossUsedAgainstOrdinary: 0,
    capitalLossCarryforwardRemaining: 0,
    ltcgZeroHeadroom: 0,
    shortfall: 0,
    requiredShortfall: 0,
    targetShortfall: 0,
    idealShortfall: 0,
    excessShortfall: 0,
    guardrailAction: 'hold',
    flexibleGoals: {
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    },
    balances: {},
    investableTotal: 0,
    insuranceCashValue: 0,
    ladderValue: 0,
    deathBenefit: 0,
    netWorth: 0,
  } as unknown as YearResult // Fixture supplies only the fields InheritedSchedulesSection reads.
}

const identityAdj = (_year: number, v: number) => v

function renderSection(plan: Plan, years: YearResult[]) {
  return renderToStaticMarkup(
    <InheritedSchedulesSection plan={plan} years={years} startYear={2026} adj={identityAdj} />,
  )
}

/** A plan whose one inherited account always lands on the refusal callout. */
function refusedPlan(): Plan {
  return basePlan((p) => {
    p.accounts.push({
      type: 'traditional',
      id: 'refused-ira',
      name: 'Refused Inherited IRA',
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
}

function refusedEvidence(
  refusalReason: string,
  refusalCode: InheritedIraRefusalCode | null,
): InheritedAccountYearEvidence {
  return {
    accountId: 'refused-ira',
    ownerPersonId: 'p1',
    regime: 'unsupported',
    matrixRow: 'X3',
    refusalReason,
    ...(refusalCode === null ? {} : { refusalCode }),
    requirementKind: 'legacy',
    requiredAmount: 8_000,
    executedRequiredAmount: 8_000,
    voluntaryAmount: 0,
    disclosures: [],
    citations: [],
  }
}

describe('InheritedSchedulesSection', () => {
  it('renders a classified S1-style spouse schedule with regime label and deadline', () => {
    const plan = basePlan((p) => {
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
      requiredAmount: 25_210,
      executedRequiredAmount: 25_210,
      voluntaryAmount: 0,
      divisor: 11.9,
      divisorArm: 'spouse-redetermined',
      finalDeadlineYear: undefined,
      disclosures: [],
      citations: [
        'IRC §401(a)(9)(B)(iii)–(iv)',
        'Treas. Reg. §1.401(a)(9)-5(d)(3)(iv)',
      ],
    }
    const html = renderSection(plan, [yearWithEvidence(2026, [evidence])])
    expect(html).toContain('Spouse Inherited IRA')
    expect(html).toContain('Spouse life-expectancy schedule')
    expect(html).not.toContain('matrix S1')
    expect(html).toContain('No fixed deadline year: amounts continue over the beneficiary')
    expect(html).toContain('Annual RMD')
    expect(html).toContain('EDB category: surviving-spouse')
    expect(html).toContain('Treas. Reg. §1.401(a)(9)-5(d)(3)(iv)')
    expect(html).toContain('https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5')
    expect(html).toContain('IRC §401(a)(9)(B)(iii)–(iv)')
    expect(html).not.toContain('href="IRC')
    expect(html).not.toContain('Confirm this schedule with a tax professional')
  })

  it('labels a legacy two-field account as the planning approximation', () => {
    const plan = basePlan((p) => {
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
    const html = renderSection(plan, [yearWithEvidence(2026, [evidence])])
    expect(html).toContain('Planning estimate')
    expect(html).toContain('Beneficiary details: not provided')
    expect(html).toContain(
      'The simpler planning estimate empties the account by the 10th year after the owner',
    )
    expect(html).toContain('Confirm this schedule with a tax professional')
  })

  it('names a treat-as-own account from primary classification and routes the null deadline', () => {
    const plan = basePlan((p) => {
      p.accounts.push({
        type: 'traditional',
        id: 's2-ira',
        name: 'Spouse Treat-as-Own IRA',
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
            election: 'treat-as-own',
            treatAsOwnElectionYear: 2027,
            spouseUnlimitedWithdrawalRight: true,
            ownerBirthYear: 1945,
            ownerYearOfDeathRmdSatisfied: true,
            provenance: { source: 'user-entered', asOf: '2026-01-01' },
          },
        },
      })
    })
    const evidence: InheritedAccountYearEvidence = {
      accountId: 's2-ira',
      ownerPersonId: 'p1',
      regime: 'spouse-remain-beneficiary',
      matrixRow: 'S0',
      classification: 'settled',
      requirementKind: 'annual-rmd',
      requiredAmount: 20_000,
      executedRequiredAmount: 20_000,
      voluntaryAmount: 0,
      disclosures: [],
      citations: [],
    }
    const html = renderSection(plan, [yearWithEvidence(2026, [evidence])])
    expect(html).toContain('Spouse treats account as own (from 2027)')
    expect(html).toContain("After the transition the account follows the owner")
    expect(html).not.toContain('matrix')
  })

  it('renders a prominent refusal note for an estate beneficiary path', () => {
    const plan = basePlan((p) => {
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
      refusalReason:
        "beneficiaryClass 'estate' is unsupported (see-through trust and non-individual rules of Treas. Reg. §1.401(a)(9)-4(f) are not modeled)",
      refusalCode: 'entity-beneficiary',
      requirementKind: 'legacy',
      requiredAmount: 8_000,
      executedRequiredAmount: 8_000,
      voluntaryAmount: 0,
      disclosures: [],
      citations: ['Treas. Reg. §1.401(a)(9)-4(f)'],
    }
    const html = renderSection(plan, [yearWithEvidence(2026, [evidence])])
    expect(html).toContain('Needs review')
    expect(html).toContain('simpler planning estimate')
    expect(html).toContain(
      'The model does not cover these facts: estates, trusts, and other entities are not modeled',
    )
    expect(html).toContain('Technical detail')
    // renderToStaticMarkup HTML-escapes apostrophes in text nodes.
    expect(html).toMatch(/beneficiaryClass &#x27;estate&#x27; is unsupported/)
    expect(html).toContain('Confirm this schedule with a tax professional')
    expect(html).toContain(
      'The simpler planning estimate empties the account by the 10th year after the owner',
    )
  })

  it('reads the published refusal code, not the prose, when both are present', () => {
    // Same account and the same technical prose in both arms; only the
    // published code differs. The prose here names an estate, which the
    // legacy substring reading would classify as an entity — so a row that
    // carries a workplace-plan code proves the code decides.
    const plan = refusedPlan()
    const prose =
      "beneficiaryClass 'estate' is unsupported (see-through trust and non-individual rules of Treas. Reg. §1.401(a)(9)-4(f) are not modeled)"
    const withCode = renderSection(plan, [yearWithEvidence(2026, [refusedEvidence(prose, 'employer-plan')])])
    expect(withCode).toContain(
      'The model does not cover these facts: inherited workplace-plan schedules are not modeled',
    )
    expect(withCode).not.toContain('estates, trusts, and other entities are not modeled')
  })

  it('falls back to reading the prose for a result stored before codes existed', () => {
    // No refusalCode on the row, as an older serialized result would have.
    const plan = refusedPlan()
    const html = renderSection(plan, [yearWithEvidence(2026, [refusedEvidence(
      'this matrix scopes inherited support to IRAs; employer-plan beneficiary rules are not modeled',
      null,
    )])])
    expect(html).toContain(
      'The model does not cover these facts: inherited workplace-plan schedules are not modeled',
    )
  })

  it('names each published code with its own plain-language cause', () => {
    const plan = refusedPlan()
    const cases = [
      ['entity-beneficiary', 'estates, trusts, and other entities are not modeled'],
      ['successor-beneficiary', 'accounts already inherited from a prior beneficiary are not modeled'],
      ['employer-plan', 'inherited workplace-plan schedules are not modeled'],
      ['multiple-beneficiaries', 'facts are contradictory or incomplete'],
      ['needs-review', 'facts are contradictory or incomplete'],
    ] as const
    for (const [code, cause] of cases) {
      const html = renderSection(plan, [
        yearWithEvidence(2026, [refusedEvidence('technical prose for ' + code, code)]),
      ])
      expect(html, code).toContain('The model does not cover these facts: ' + cause)
    }
  })

  it('renders nothing when the plan has no inherited accounts', () => {
    const plan = basePlan()
    const html = renderSection(plan, [yearWithEvidence(2026, [])])
    expect(html).toBe('')
  })

  it('shows a successor-scope note without the refusal callout', () => {
    const plan = basePlan((p) => {
      p.accounts.push({
        type: 'traditional',
        id: 'edb-ira',
        name: 'EDB Inherited IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 200_000,
        annualContribution: 0,
        inherited: {
          ownerDeathYear: 2020,
          decedentHadStartedRmds: true,
          beneficiary: {
            beneficiaryClass: 'designated-individual',
            edbCategory: 'disabled',
            beneficiaryBirthYear: 1960,
            soleBeneficiary: true,
            ownerBirthYear: 1940,
            ownerYearOfDeathRmdSatisfied: true,
            provenance: { source: 'user-entered', asOf: '2026-01-01' },
          },
        },
      })
    })
    const evidence: InheritedAccountYearEvidence = {
      accountId: 'edb-ira',
      ownerPersonId: 'p1',
      regime: 'edb-life-expectancy',
      matrixRow: 'E1',
      classification: 'settled',
      requirementKind: 'none',
      requiredAmount: 0,
      executedRequiredAmount: 0,
      voluntaryAmount: 0,
      refusalReason:
        'beneficiary death starts the successor 10-year clock (IRC §401(a)(9)(H)(iii); Treas. Reg. §1.401(a)(9)-5(e)(3); matrix X2); successor schedules are out of scope',
      refusalCode: 'successor-clock-out-of-scope',
      disclosures: ['successor-clock-out-of-scope'],
      citations: ['IRC §401(a)(9)(H)(iii)'],
    }
    const html = renderSection(plan, [yearWithEvidence(2028, [evidence])])
    expect(html).toContain('successor schedules are not modeled')
    expect(html).not.toContain('Needs review')
    expect(html).not.toContain('The model does not cover these facts, so it shows the limitation')
    expect(html).toContain('Confirm this schedule with a tax professional')
  })
})
