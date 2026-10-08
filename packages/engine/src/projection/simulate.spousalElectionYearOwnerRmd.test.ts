/**
 * Production discriminators for Treas. Reg. §1.408-8(c)(3) election-year owner
 * RMD after a verified current-year spousal election event.
 *
 * Oracles: code009-final-acceptance-adjudication.md numeric cases; Uniform
 * Lifetime divisor 24.6 at age 75 from the versioned 2026 pack; j(4) official
 * 10,383.68 / 383.68 catch-up from federal-spouse-hecm-completion-spec.md S1/S2.
 * Expectations are source-derived, not read back from the planner under test.
 */
import { expect, it, vi } from 'vitest'

import { asUsdCents } from '../actions/money.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput } from './types.js'
import * as inheritedDistributionPlanner from './internal/annualInheritedIraDistributions.js'
import { gateSpousalElectionFromInheritedAccount } from './internal/beneficiarySpousalElectionGateAdapter.js'

const noTax = createFlatTaxCalculator(0)
let sequence = 0
const id = () => `election-year-owner-rmd-${++sequence}`

type Beneficiary = NonNullable<Extract<Account, { type: 'traditional' }>['inherited']>['beneficiary']

function planFor(dob: string, planningAge = 100): Plan {
  const plan = createEmptyPlan({ newId: id, now: () => new Date('2026-01-01T00:00:00.000Z') })
  plan.household.people[0] = {
    id: 'beneficiary', name: 'Beneficiary', dob,
    sex: 'average', retirementAge: null, longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0,
  }
  plan.accounts = [{
    type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null,
    annualReturnPct: null, balance: 1_000_000, annualContribution: 0,
  } as Account]
  return plan
}

function facts(overrides: Partial<NonNullable<Beneficiary>> = {}): NonNullable<Beneficiary> {
  return {
    beneficiaryClass: 'designated-individual', edbCategory: 'surviving-spouse',
    beneficiaryBirthYear: 1951, soleBeneficiary: true, ownerBirthYear: 1945,
    spouseUnlimitedWithdrawalRight: true, election: 'none',
    provenance: { source: 'test', asOf: '2026-01-01' },
    ...overrides,
  }
}

function inherited(
  plan: Plan,
  inheritedFacts: Record<string, unknown>,
  balance: number,
) {
  plan.accounts.push({
    type: 'traditional', id: 'inherited', name: 'Inherited IRA',
    ownerPersonId: 'beneficiary', annualReturnPct: null, kind: 'ira',
    balance, annualContribution: 0, inherited: inheritedFacts,
  } as Account)
}

function observedElection(
  plan: Plan,
  date: string,
  deathDate: string,
  priorYears: number[],
  opts: {
    referenceBalance?: number
    preElectionDistributed?: number
    preElectionMethod?: 'lifeExpectancyRule' | 'tenYearRule'
    j4?: NonNullable<NonNullable<Beneficiary>['spousalElectionFacts']>['section402c2j4Inputs']
  } = {},
) {
  const account = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, { type: 'traditional' }>
  const block = account.inherited!
  block.decedentId = 'spouse-decedent'
  block.ownerDeathDate = deathDate
  block.annualDistributionHistory = priorYears.map((taxYear) => ({
    taxYear,
    requiredAmount: block.decedentHadStartedRmds ? 1000 : 0,
    distributedAmount: block.decedentHadStartedRmds ? 1000 : 0,
    observedAsOfDate: `${taxYear}-12-31`,
    legalDistributionDeadline: `${taxYear}-12-31`,
    provenance: {
      source: 'Custodian completed statutory distribution record',
      asOf: `${taxYear}-12-31`,
    },
  }))
  const method = opts.preElectionMethod ?? 'lifeExpectancyRule'
  block.beneficiary!.spousalElectionFacts = {
    directSpouseNamedOnIra: 'verifiedYes',
    affirmativeElectionDate: date,
    affirmativeElectionYear: Number(date.slice(0, 4)),
    nonRolloverContributionYears: [],
    lateElectionCatchUp: null,
    preElectionDistributionMethod: method,
    section402c2j4Inputs: opts.j4 ?? {
      transaction: 'affirmativeTreatAsOwnElection',
      spouseBirthDate: plan.household.people[0]!.dob,
      decedentBirthDate: `${block.beneficiary!.ownerBirthYear}-01-01`,
      distributionYear: Number(date.slice(0, 4)),
      currentYearRmdReferenceBalance: opts.referenceBalance ?? 0,
      actualPriorYearDistributions: [],
      actualPreElectionDistributionsCurrentYear: opts.preElectionDistributed ?? 0,
      currentDistributionOrRemainingInterest: 0,
      provenance: { source: 'Custodian election-year RMD reference evidence', asOf: date },
    },
    provenance: { source: 'Executed custodian owner redesignation', asOf: date },
  }
}

function run(plan: Plan, horizonEndYear?: number) {
  const parsed = parsePlan(plan)
  expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, { startYear: 2026, horizonEndYear, taxCalculator: noTax })
}

function year(result: ReturnType<typeof run>, value: number) {
  const found = result.years.find((candidate) => candidate.year === value)
  if (!found) throw new Error(`missing ${value}`)
  return found
}

function evidence(result: ReturnType<typeof run>, value: number) {
  const row = year(result, value).inheritedAccounts?.find((candidate) => candidate.accountId === 'inherited')
  if (!row) throw new Error(`missing inherited evidence for ${value}`)
  return row
}

function ownerObligation(result: ReturnType<typeof run>, value: number) {
  const row = year(result, value).electionYearOwnerRmdObligations
    ?.find((candidate) => candidate.accountId === 'inherited')
  if (!row) throw new Error(`missing owner RMD obligation for ${value}`)
  return row
}

describeRule('treas-reg-1-408-8-c-3-spouse-treated-as-owner', {
  readings: {
    currentYearElectionUsesOwnerRmd: 'ownerTreatment',
    currentYearElectionLeavesBeneficiaryRequirementFinal: 'beneficiaryTreatment',
  },
  accepted: 'currentYearElectionUsesOwnerRmd',
  note: 'election-year owner-RMD production',
}, ({ accepted, readings }) => {
  it('uses a verified contribution alone to refinalize owner RMD without a current-year history row', () => {
    // §1.408-8(c)(3), completion spec S6: a dated non-rollover contribution
    // is itself the election. Age 75 / Uniform Lifetime 24.6 => 4065.04;
    // no current-year beneficiary shortfall is needed to establish that act.
    const plan = planFor('1951-01-02')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1951, ownerBirthYear: 1945 }),
    }, 100_000)
    observedElection(plan, '2026-05-01', '2024-06-01', [2025], { referenceBalance: 100_000 })
    const account = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, { type: 'traditional' }>
    const election = account.inherited!.beneficiary!.spousalElectionFacts!
    election.affirmativeElectionDate = null
    election.affirmativeElectionYear = null
    election.nonRolloverContributionYears = [2026]
    election.nonRolloverContributionEvents = [{
      executionDate: '2026-05-01', observedAsOfDate: '2026-05-01',
      provenance: { source: 'Custodian completed non-rollover contribution', asOf: '2026-05-01' },
    }]
    expect(account.inherited!.annualDistributionHistory!.map((row) => row.taxYear)).toEqual([2025])
    const result = run(plan, 2026)
    const y = year(result, 2026)
    expect(y.spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: false })
    expect(y.spousalElectionAtYearEnd).toContainEqual(expect.objectContaining({ accountId: 'inherited', ownerTreatment: true }))
    expect(ownerObligation(result, 2026)).toMatchObject({
      requiredAmount: 100_000 / 24.6, creditedAcceptedDistributionAmount: 0,
      settledAmount: 100_000 / 24.6, unsatisfiedAmount: 0,
    })
    expect(y.rmd).toBeCloseTo(4065.04, 2)
    expect(y.inheritedDistribution).toBe(0)
    expect(y.balances.inherited).toBeCloseTo(100_000 - 100_000 / 24.6, 8)
    expect(y.taxComputation?.issues).toContainEqual(expect.objectContaining({ code: 'incomplete-spousal-election-mixed-year' }))
  })

  it('suppresses the elected Roth draw before shared basis consumption or state tax facts', () => {
    // §1.408-8(c)(3): elected owner Roths have no lifetime RMD. Same-pool
    // accounts must carry consistent elections under parsePlan; both elect.
    // A different decedent's disabled-beneficiary account supplies the actual
    // nonqualified draw: age60 divisor27.1 in2025 minus1 =>26.1 in2026;
    // 2610/26.1=100 and Pub590-B regular basis60 leaves earnings40.
    // The pass-through observer proves the elected pool never characterizes a
    // phantom draw, without replacing the production character calculation.
    const plan = planFor('1965-06-15')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryBirthYear: 1965, ownerBirthYear: 1945 }),
    }, 2620)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], { referenceBalance: 2620 })
    const original = plan.accounts[1] as Extract<Account, { type: 'traditional' }>
    // The completed 2025 beneficiary payment is explicit; no 2026 history is supplied.
    original.inherited!.annualDistributionHistory![0]!.requiredAmount = 100
    original.inherited!.annualDistributionHistory![0]!.distributedAmount = 100
    const elected = { ...original, type: 'roth' as const }
    plan.accounts[1] = elected
    const electedSecond = structuredClone(elected)
    electedSecond.id = 'second-elected-roth'
    plan.accounts.push(electedSecond)
    plan.accounts.push({
      type: 'roth', id: 'remaining-beneficiary-roth', name: 'Roth inherited from a different decedent',
      ownerPersonId: 'beneficiary', annualReturnPct: 0, kind: 'ira', balance: 2610, annualContribution: 0,
      inherited: {
        ownerDeathYear: 2024, ownerDeathDate: '2024-06-01', decedentId: 'other-decedent', decedentHadStartedRmds: false,
        beneficiary: facts({ beneficiaryBirthYear: 1965, ownerBirthYear: 1960, edbCategory: 'disabled' }),
      },
    })
    plan.inheritedRothTaxCharacterPools = ['spouse-decedent', 'other-decedent'].map((decedentId) => ({
      beneficiaryPersonId: 'beneficiary', decedentId,
      firstRothContributionTaxYear: 2024, remainingRegularContributionBasis: 60,
      conversionLayers: [], priorDistributionsConsumedAmount: 0,
      provenance: { source: 'Complete decedent Roth records', asOf: '2026-01-01' },
    }))
    expect(packForYear(2026).pack.rmd.singleLifeTable[61]).toBe(26.2)
    const parsed = parsePlan(plan)
    expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const taxInputs: TaxYearInput[] = []
    const characterizedAccounts: string[] = []
    const actualPlanner = inheritedDistributionPlanner.annualInheritedIraDistributions
    const observer = vi.spyOn(inheritedDistributionPlanner, 'annualInheritedIraDistributions')
      .mockImplementation((input) => {
        const actualCharacterize = input.characterizeInheritedRothDistribution
        return actualPlanner(actualCharacterize === undefined ? input : {
          ...input,
          characterizeInheritedRothDistribution: (distribution) => {
            characterizedAccounts.push(distribution.accountId)
            return actualCharacterize(distribution)
          },
        })
      })
    let result: ReturnType<typeof simulatePlan>
    try {
      result = simulatePlan(parsed.plan, {
        startYear: 2026, horizonEndYear: 2026,
        taxCalculator: { compute(input: TaxYearInput) { taxInputs.push(input); return 0 } },
      })
    } finally {
      observer.mockRestore()
    }
    expect(characterizedAccounts.length).toBeGreaterThan(0)
    expect(new Set(characterizedAccounts)).toEqual(new Set(['remaining-beneficiary-roth']))
    const y = year(result, 2026)
    expect(ownerObligation(result, 2026)).toMatchObject({ requiredAmount: 0, settledAmount: 0, unsatisfiedAmount: 0 })
    expect(evidence(result, 2026).executedRequiredAmount).toBe(0)
    expect(y.inheritedDistribution).toBeCloseTo(100, 8)
    expect(y.balances.inherited).toBeCloseTo(2620, 8)
    expect(y.balances['remaining-beneficiary-roth']).toBeCloseTo(2510, 8)
    expect(y.balances['second-elected-roth']).toBeCloseTo(2620, 8)
    expect(taxInputs.at(-1)?.ordinaryIncome).toBeCloseTo(40, 8)
    expect(y.magi).toBeCloseTo(40, 8)
    const stateFacts = taxInputs.at(-1)?.stateRetirementDistributions ?? []
    expect(stateFacts.filter((row) => row.accountId === 'inherited' || row.accountId === 'second-elected-roth')).toEqual([])
    expect(stateFacts.filter((row) => row.accountId === 'remaining-beneficiary-roth')
      .reduce((sum, row) => sum + row.federallyIncludedAmount, 0)).toBeCloseTo(40, 8)
    expect(plan.inheritedRothTaxCharacterPools[0]!.remainingRegularContributionBasis).toBe(60)
    expect(y.taxComputation?.issues).toContainEqual(expect.objectContaining({ code: 'incomplete-spousal-election-mixed-year' }))
  })
  it('publishes owner requirement 0 under RMD age without refunding already-paid cash', () => {
    // Spouse born 1970 → age 56 in 2026, below owner RMD start age 75.
    const plan = planFor('1970-06-15')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1970, ownerBirthYear: 1945,
      }),
    }, 99_000)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], {
      referenceBalance: 100_000,
      preElectionDistributed: 1_000,
    })
    const result = run(plan, 2026)
    const y = year(result, 2026)
    expect(y.spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: false })
    const election = y.spousalElectionAtYearEnd?.find((row) => row.accountId === 'inherited')
    expect(election).toMatchObject({
      accountId: 'inherited', status: 'evaluated', ownerTreatment: true,
    })
    const publishedReading = election?.ownerTreatment === true
      ? readings.currentYearElectionUsesOwnerRmd
      : readings.currentYearElectionLeavesBeneficiaryRequirementFinal
    expect(publishedReading).toBe(accepted)
    expect(publishedReading).not.toBe(readings.currentYearElectionLeavesBeneficiaryRequirementFinal)
    expect(ownerObligation(result, 2026)).toMatchObject({
      requiredAmount: 0,
      creditedAcceptedDistributionAmount: 1_000,
      creditedDistributionEvidence: 'section402c2j4-actual-pre-election-distribution',
      unpaidAmount: 0,
      settledAmount: 0,
      unsatisfiedAmount: 0,
    })
    // No additional owner forced take; do not report the beneficiary schedule
    // as the final owner requirement; retain already-distributed cash.
    expect(y.rmd).toBe(0)
    expect(y.inheritedDistribution).toBe(0)
    expect(y.balances.inherited).toBeCloseTo(99_000, 2)
    expect(y.taxComputation?.status).toBe('incomplete')
    expect(y.taxComputation?.issues).toContainEqual(expect.objectContaining({
      code: 'incomplete-spousal-election-mixed-year',
    }))
  })

  it('applies age-75 owner RMD 4065.04 and leaves 3065.04 unpaid after 1000 already paid', () => {
    const pack = packForYear(2026).pack
    expect(pack.rmd.uniformLifetimeTable[75]).toBe(24.6)
    const ownerRequired = 100_000 / 24.6
    expect(ownerRequired).toBeCloseTo(4065.04, 2)
    const unpaid = ownerRequired - 1_000
    expect(unpaid).toBeCloseTo(3065.04, 2)

    // dob 1951-01-02 → ageAttained 75 in 2026; live balance nets the 1000
    // already paid; reference balance keeps the prior-Dec-31 100000 base.
    const plan = planFor('1951-01-02')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1951, ownerBirthYear: 1945,
      }),
    }, 99_000)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], {
      referenceBalance: 100_000,
      preElectionDistributed: 1_000,
    })
    const result = run(plan, 2026)
    const y = year(result, 2026)
    expect(y.spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: false })
    expect(y.spousalElectionAtYearEnd).toContainEqual(expect.objectContaining({
      accountId: 'inherited', ownerTreatment: true,
    }))
    expect(ownerObligation(result, 2026)).toMatchObject({
      requiredAmount: ownerRequired,
      creditedAcceptedDistributionAmount: 1_000,
      creditedDistributionEvidence: 'section402c2j4-actual-pre-election-distribution',
      unpaidAmount: unpaid,
      settledAmount: unpaid,
      unsatisfiedAmount: 0,
    })
    // One owner settlement of the unpaid remainder — no beneficiary double take.
    expect(y.rmd).toBeCloseTo(unpaid, 2)
    expect(y.inheritedDistribution).toBe(0)
    expect(y.balances.inherited).toBeCloseTo(99_000 - unpaid, 2)
    expect(y.taxComputation?.issues).toContainEqual(expect.objectContaining({
      code: 'incomplete-spousal-election-mixed-year',
    }))
  })

  it('keeps the known owner-RMD shortfall and §4974 obligation when live balance cannot settle it', () => {
    // Same source-derived age-75 requirement.  The $1,000 accepted actual is
    // credited once; only $2,000 remains live, leaving $1,065.04 unsatisfied.
    const ownerRequired = 100_000 / 24.6
    const plan = planFor('1951-01-02')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1951, ownerBirthYear: 1945 }),
    }, 2_000)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], {
      referenceBalance: 100_000,
      preElectionDistributed: 1_000,
    })
    const result = run(plan, 2026)
    const y = year(result, 2026)
    expect(ownerObligation(result, 2026)).toMatchObject({
      requiredAmount: ownerRequired,
      creditedAcceptedDistributionAmount: 1_000,
      unpaidAmount: ownerRequired - 1_000,
      settledAmount: 2_000,
      unsatisfiedAmount: ownerRequired - 3_000,
    })
    expect(y.rmd).toBeCloseTo(2_000, 2)
    expect(y.balances.inherited).toBe(0)
    expect(y.rmdShortfallExciseDetails).toContainEqual(expect.objectContaining({
      requiredAmount: ownerRequired,
      distributedByDeadline: 3_000,
      shortfall: ownerRequired - 3_000,
    }))
  })

  it('refinalizes a completed current-election-year 5000/4000 shortfall under owner rules without erasing its trigger', () => {
    const plan = planFor('1970-06-15')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1970, ownerBirthYear: 1945, election: 'none',
      }),
    }, 100_000)
    observedElection(plan, '2026-12-31', '2024-06-01', [2025])
    const account = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, { type: 'traditional' }>
    const spouse = account.inherited!.beneficiary!
    delete spouse.spousalElectionFacts!.affirmativeElectionDate
    spouse.spousalElectionFacts!.affirmativeElectionYear = null
    account.inherited!.annualDistributionHistory!.push({
      taxYear: 2026,
      requiredAmount: 5_000,
      distributedAmount: 4_000,
      legalDistributionDeadline: '2026-12-31',
      observedAsOfDate: '2026-12-31',
      provenance: {
        source: 'Custodian completed statutory distribution record',
        asOf: '2026-12-31',
      },
    })
    account.balance = 96_000

    const first = run(plan, 2026)
    expect(year(first, 2026).spousalOwnerTreatment).toContainEqual({
      accountId: 'inherited', ownerTreatment: false,
    })
    expect(year(first, 2026).spousalElectionAtYearEnd).toContainEqual(expect.objectContaining({
      accountId: 'inherited', status: 'evaluated', ownerTreatment: true,
    }))
    // Owner under RMD age: preserve the already-executed actual $4,000 but
    // publish the final owner requirement separately from the immutable trigger.
    expect(year(first, 2026).inheritedDistribution).toBe(0)
    expect(year(first, 2026).rmd).toBe(0)
    expect(ownerObligation(first, 2026)).toMatchObject({
      requiredAmount: 0,
      creditedAcceptedDistributionAmount: 4_000,
      creditedDistributionEvidence: 'completed-current-year-beneficiary-history',
      unsatisfiedAmount: 0,
    })
    // Re-running does not invent a second trigger or cash movement.
    const second = run(plan, 2026)
    expect(year(second, 2026).rmd).toBe(0)
    expect(year(second, 2026).inheritedDistribution).toBe(0)
    expect(year(second, 2026).balances.inherited).toBeCloseTo(
      year(first, 2026).balances.inherited!, 8,
    )
    // Observed shortfall facts remain the immutable trigger evidence.
    expect(account.inherited!.annualDistributionHistory![1]).toMatchObject({
      requiredAmount: 5_000, distributedAmount: 4_000,
    })
  })

})

// The election year owes ONE §4974 obligation, the owner's. §4974(b) takes
// the minimum required distribution "as determined under regulations", and
// Treas. Reg. 1.408-8(c)(3) determines it for the calendar year of the
// election under section 401(a)(9)(A) with the spouse as owner, "and not
// section 401(a)(9)(B)" with the spouse as beneficiary; (e)(2)(i) takes the
// elected IRA out of the beneficiary's same-decedent group. The beneficiary
// figure stays on the account's evidence only as the immutable trigger.
// Owner: 100,000 / 24.6 = 4,065.04, 1,000 credited pre-election and 3,065.04
// settled. Beneficiary counterfactual: 99,000 / 14.8 (Single Life, age 75) =
// 6,689.19, which, charged as a second and unpaid obligation, is a 1,672.30
// excise. The account names its decedent, so it files under the grouped
// same-decedent identity the phase's old per-account filter never matched.
const electionYearBeneficiaryCounterfactual = 99_000 / 14.8

describeRule('treas-reg-1-408-8-c-3-spouse-treated-as-owner', {
  readings: {
    ownerObligationOnly: 0,
    ownerAndBeneficiaryObligations: electionYearBeneficiaryCounterfactual * 0.25,
  },
  accepted: 'ownerObligationOnly',
  note: 'election-year section 4974 obligation',
}, ({ accepted, readings }) => {
  it('charges no beneficiary §4974 obligation beside the paid 4065.04 owner RMD', () => {
    const pack = packForYear(2026).pack
    expect(pack.rmd.uniformLifetimeTable[75]).toBe(24.6)
    expect(pack.rmd.singleLifeTable[75]).toBe(14.8)
    const ownerRequired = 100_000 / 24.6
    expect(ownerRequired).toBeCloseTo(4065.04, 2)
    expect(electionYearBeneficiaryCounterfactual).toBeCloseTo(6689.19, 2)
    expect(readings.ownerAndBeneficiaryObligations).toBeCloseTo(1672.30, 2)

    const plan = planFor('1951-01-02')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1951, ownerBirthYear: 1945 }),
    }, 99_000)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], {
      referenceBalance: 100_000,
      preElectionDistributed: 1_000,
    })
    const result = run(plan, 2026)
    const y = year(result, 2026)
    expect(ownerObligation(result, 2026)).toMatchObject({
      requiredAmount: ownerRequired,
      creditedAcceptedDistributionAmount: 1_000,
      settledAmount: ownerRequired - 1_000,
      unsatisfiedAmount: 0,
    })
    expect(evidence(result, 2026).requiredAmount).toBeCloseTo(electionYearBeneficiaryCounterfactual, 8)
    expect(y.rmdShortfallExciseDetails).toHaveLength(1)
    expect(y.rmdShortfallExciseDetails![0]).toMatchObject({
      obligationId: expect.stringContaining('owned-iras'),
      requiredAmount: ownerRequired,
      distributedByDeadline: ownerRequired,
      tax: 0,
    })
    expect(y.rmdShortfallExciseDetails!.some((row) => row.obligationId.includes('inherited'))).toBe(false)
    expect(y.rmdShortfallExciseTax).toBe(accepted)
  })
})

describeRule('treas-reg-1-402-c-2-j-4-surviving-spouse-catch-up-recurrence', {
  readings: {
    officialAdjustedBalanceRecurrence: 10_383.68,
    currentYearOnlyOwnerRmd: 100_000 / 24.6,
  },
  accepted: 'officialAdjustedBalanceRecurrence',
  note: 'production affirmative-election catch-up gate',
}, ({ accepted, readings }) => {
  it('blocks affirmative effectiveness until official j4 catch-up 10383.68 is satisfied', () => {
    // Official S1 recurrence (proposed example illustration of final formula).
    const requiredCatchUp = 10_383.68
    const unpaidAfter10000 = 383.68
    for (const [preElection, expectOwner] of [
      [10_000, false],
      [requiredCatchUp, true],
    ] as const) {
      const plan = planFor('1958-01-01')
      inherited(plan, {
        ownerDeathYear: 2024, decedentHadStartedRmds: false,
        beneficiary: facts({
          beneficiaryBirthYear: 1958, ownerBirthYear: 1957,
          election: 'none',
        }),
      }, 100_000)
      // Complete every post-death calendar year through the election opening.
      // The official S1 facts establish actual $1,000/$0 distributions in
      // 2031/2032; before then the ten-year beneficiary schedule required
      // nothing, so the completed records are explicit zeros rather than
      // invented catch-up rows.
      observedElection(plan, '2033-06-15', '2024-06-01', [
        2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032,
      ], {
        preElectionMethod: 'tenYearRule',
        j4: {
          transaction: 'affirmativeTreatAsOwnElection',
          spouseBirthDate: '1958-01-01',
          decedentBirthDate: '1957-01-01',
          distributionYear: 2033,
          currentYearRmdReferenceBalance: 100_000,
          actualPriorYearDistributions: [
            { taxYear: 2031, amount: 1_000 },
            { taxYear: 2032, amount: 0 },
          ],
          actualPreElectionDistributionsCurrentYear: preElection,
          currentDistributionOrRemainingInterest: 0,
          provenance: {
            source: 'Official j(4) catch-up worksheet inputs',
            asOf: '2033-06-15',
          },
        },
      })
      const account = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, { type: 'traditional' }>
      const history2031 = account.inherited!.annualDistributionHistory!.find((row) => row.taxYear === 2031)!
      history2031.distributedAmount = 1_000
      expect(history2031).toMatchObject({
        requiredAmount: 0,
        distributedAmount: 1_000,
        legalDistributionDeadline: '2031-12-31',
        observedAsOfDate: '2031-12-31',
      })
      expect(account.inherited!.annualDistributionHistory!.find((row) => row.taxYear === 2032))
        .toMatchObject({ requiredAmount: 0, distributedAmount: 0 })
      const gate = gateSpousalElectionFromInheritedAccount({
        account,
        taxYear: 2033,
        determinationStage: 'endOfTaxYear',
      })
      // Extend horizon so 2033 is inside the projection; start still 2026.
      plan.household.people[0]!.longevity = { planningAge: 100, source: 'manual' }
      const parsed = parsePlan(plan)
      expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
      if (!parsed.ok) throw new Error(parsed.issues.join('; '))
      const result = simulatePlan(parsed.plan, {
        startYear: 2033, horizonEndYear: 2033, taxCalculator: noTax,
      })
      const y = result.years.find((row) => row.year === 2033)!
      if (expectOwner) {
        expect(y.spousalElectionAtYearEnd).toContainEqual(expect.objectContaining({
          accountId: 'inherited', status: 'evaluated', ownerTreatment: true,
        }))
      } else {
        // Production gate: incomplete catch-up is an exact $383.68 bar.
        expect(gate).toMatchObject({
          status: 'lateElectionCatchUpIncomplete',
          requiredAmount: asUsdCents(Math.round(requiredCatchUp * 100)),
          observedDistributedAmount: asUsdCents(Math.round(preElection * 100)),
          remainingAmount: asUsdCents(Math.round(unpaidAfter10000 * 100)),
        })
        expect(requiredCatchUp).toBe(accepted)
        expect(requiredCatchUp).not.toBe(readings.currentYearOnlyOwnerRmd)
        const blocked = y.spousalElectionAtYearEnd?.find((row) => row.accountId === 'inherited')
        expect(blocked).toEqual({ accountId: 'inherited', status: 'lateElectionCatchUpIncomplete' })
        expect(blocked).not.toHaveProperty('ownerTreatment')
        expect(y.spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: false })
        expect(y.electionYearOwnerRmdObligations?.find((row) => row.accountId === 'inherited')).toBeUndefined()
      }
    }
  })
})

describeRule('treas-reg-1-408-8-c-3-spouse-as-own-death-year-rmd', {
  readings: {
    decedentResidualWithoutOwnerRmd: { ownerRmd: 0, decedentResidual: 5_000 },
    ownerRmdWithoutDecedentResidual: { ownerRmd: 97_000 / 21.1, decedentResidual: 0 },
  },
  accepted: 'decedentResidualWithoutOwnerRmd',
  note: 'death-year election production',
}, ({ accepted, readings }) => {
  it('death-year election keeps 5000 decedent residual and publishes spouse-owner RMD 0', () => {
    // Decedent born 1945 dies 2026 post-RBD at age 81 → Uniform Lifetime 19.4.
    // Prior balance 97,000 yields residual 97,000 / 19.4 = 5,000.
    const pack = packForYear(2026).pack
    expect(pack.rmd.uniformLifetimeTable[81]).toBe(19.4)
    const residual = 97_000 / 19.4
    expect(residual).toBeCloseTo(5_000, 2)

    const plan = planFor('1947-06-15')
    inherited(plan, {
      ownerDeathYear: 2026, decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1947, ownerBirthYear: 1945,
        election: 'treat-as-own',
        treatAsOwnElectionYear: 2026,
        // Unsatisfied decedent YOD RMD → residual on inherited path.
        ownerYearOfDeathRmdSatisfied: false,
      }),
    }, 97_000)
    // A death-year account has no post-death history before the death year.
    observedElection(plan, '2026-12-31', '2026-06-01', [])
    const result = run(plan, 2027)
    const y2026 = year(result, 2026)
    expect(evidence(result, 2026).requirementKind).toBe('year-of-death-rmd')
    expect(ownerObligation(result, 2026)).toMatchObject({ requiredAmount: 0, unsatisfiedAmount: 0 })
    expect(y2026.rmd).toBe(0)
    expect(y2026.inheritedDistribution).toBeCloseTo(5_000, 2)
    expect({ ownerRmd: y2026.rmd, decedentResidual: y2026.inheritedDistribution })
      .toMatchObject(accepted)
    expect({ ownerRmd: y2026.rmd, decedentResidual: y2026.inheritedDistribution })
      .not.toMatchObject(readings.ownerRmdWithoutDecedentResidual)
    expect(year(result, 2027).spousalOwnerTreatment).toContainEqual({
      accountId: 'inherited', ownerTreatment: true,
    })
    expect(year(result, 2027).inheritedDistribution).toBe(0)
  })
})

// A pool of two elected IRAs from one decedent, worked by hand from the
// regulations, not from the planner. Treas. Reg. 1.408-8(c)(3) determines the
// RMD for the calendar year of the election under section 401(a)(9)(A) with
// the spouse as IRA owner; 1.408-8(b)(2) substitutes the IRA's own balance at
// the prior December 31 for the 1.401(a)(9)-5(b) account balance; and
// 1.408-8(e)(1)(i) calculates the requirement separately for each IRA. The
// plan checks give both IRAs identical election facts, including the one
// 100,000 j(4) reference balance, which is the first IRA's balance only.
//
//   Spouse born 1951-01-02, age attained in 2026           75
//   Applicable age for a 1951 birth                        73, so an RMD is due
//   Uniform Lifetime divisor at 75 (Pub. 590-B Table III)  24.6
//   'inherited'      100,000 / 24.6 = 4,065.0407 -> 4,065.04
//   'pooled-second'   29,600 / 24.6 = 1,203.2520 -> 1,203.25
//   Owner total      129,600 / 24.6 = 5,268.2927 -> 5,268.29
//
// Nothing was distributed before the election, so each IRA settles its own
// requirement: 'pooled-second' ends the year at 29,600 - 1,203.25 = 28,396.75,
// and the owner's one aggregated owned-IRA section 4974 obligation is 5,268.29
// required and 5,268.29 distributed, excise 0.
//
// Wrong reading, the engine before 2026-10-07: each IRA took the shared
// 100,000 reference, so 'pooled-second' owed 4,065.04, 2,861.79 too much
// (70,400 / 24.6), and the owner total was 8,130.08.
const pooledOwnBalance = 29_600 / 24.6
const pooledSharedReference = 100_000 / 24.6

describeRule('treas-reg-1-408-8-c-3-spouse-treated-as-owner', {
  readings: {
    eachIraOwnPriorDecember31Balance: pooledOwnBalance,
    poolSharedReferenceBalance: pooledSharedReference,
  },
  accepted: 'eachIraOwnPriorDecember31Balance',
  note: 'pooled election-year owner RMD balance',
}, ({ accepted, readings }) => {
  it('takes the 29,600 IRA\'s owner RMD from its own balance: 1203.25, not the pool reference\'s 4065.04', () => {
    expect(packForYear(2026).pack.rmd.uniformLifetimeTable[75]).toBe(24.6)
    expect(accepted).toBeCloseTo(1203.25, 2)
    expect(readings.poolSharedReferenceBalance).toBeCloseTo(4065.04, 2)
    const ownerTotal = 129_600 / 24.6
    expect(ownerTotal).toBeCloseTo(5268.29, 2)

    const plan = planFor('1951-01-02')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1951, ownerBirthYear: 1945 }),
    }, 100_000)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], { referenceBalance: 100_000 })
    const first = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, { type: 'traditional' }>
    plan.accounts.push({ ...structuredClone(first), id: 'pooled-second', name: 'Second IRA, same decedent', balance: 29_600 })
    const result = run(plan, 2026)
    const y = year(result, 2026)
    const obligations = y.electionYearOwnerRmdObligations ?? []
    expect(obligations.find((row) => row.accountId === 'inherited')).toMatchObject({
      requiredAmount: 100_000 / 24.6, settledAmount: 100_000 / 24.6, unsatisfiedAmount: 0,
    })
    const second = obligations.find((row) => row.accountId === 'pooled-second')
    expect(second?.requiredAmount).toBe(accepted)
    expect(second?.requiredAmount).not.toBeCloseTo(readings.poolSharedReferenceBalance, 2)
    expect(second).toMatchObject({
      creditedAcceptedDistributionAmount: 0, settledAmount: accepted, unsatisfiedAmount: 0,
    })
    expect(y.balances['pooled-second']).toBeCloseTo(28_396.75, 2)
    expect(y.rmd).toBeCloseTo(5268.29, 2)
    // The two requirements still aggregate into the owner's one section 4974
    // obligation for owned IRAs.
    expect(y.rmdShortfallExciseDetails).toHaveLength(1)
    expect(y.rmdShortfallExciseDetails![0]).toMatchObject({
      obligationId: expect.stringContaining('owned-iras'),
      tax: 0,
    })
    expect(y.rmdShortfallExciseDetails![0]!.requiredAmount).toBeCloseTo(ownerTotal, 8)
    expect(y.rmdShortfallExciseDetails![0]!.distributedByDeadline).toBeCloseTo(ownerTotal, 8)
  })
})

// A distribution taken before the election, in a pool of elected IRAs from
// one decedent, worked by hand from the regulations, not from the planner.
//
// Treas. Reg. 1.408-8(c)(3): the election-year RMD of each elected IRA is an
// owner RMD under section 401(a)(9)(A), so a distribution from the IRA in
// that calendar year, before the election or after it, counts toward it
// (1.402(c)-2(j)(4) treats a current-year pre-election distribution the same
// way when it sizes the catch-up). 1.408-8(e)(1)(i): each IRA's requirement
// is calculated separately and the total may be distributed from any one or
// more of the owner's IRAs, so a distribution counts once toward the total,
// whichever IRA it came from. 1.408-8(b)(2): each requirement is on that IRA's
// balance at the prior December 31. The projection never debits an accepted
// pre-election distribution from the balance, so the plan enters each balance
// after it, and the prior December 31 balance is that balance plus the
// distribution.
//
// The scratch case: owner born 1951-01-02, age 75 in 2026, Uniform Lifetime
// divisor 24.6. Live balances 99,000 ('inherited') and 29,600
// ('pooled-second'); the shared election facts carry a 100,000 j(4)
// reference, which names no IRA, and 1,000 distributed before the election,
// which also names no IRA.
//
//   Prior December 31 total  99,000 + 29,600 + 1,000 = 129,600
//   The unnamed 1,000 is placed on the first IRA: 100,000 and 29,600
//   (the total requirement does not depend on where it is placed: one owner,
//   one divisor)
//   'inherited'       100,000 / 24.6 = 4,065.04, credited 1,000, forced 3,065.04
//   'pooled-second'    29,600 / 24.6 = 1,203.25, credited 0,     forced 1,203.25
//   Owner total       129,600 / 24.6 = 5,268.29
//   Forced 4,268.29; with the 1,000 the year distributes 5,268.29, so the one
//   owned-IRA section 4974 obligation is 5,268.29 required and distributed.
//   Year-end balances 95,934.96 and 28,396.75.
//
// Wrong readings: crediting the 1,000 to each IRA on the live balances
// (09f50704e) forced 3,024.39 + 203.25 = 3,227.64, so the year distributed
// 4,227.64 against 5,268.29 and left 1,040.65 unmet while reporting no
// shortfall; counting it once but on the live balances forces
// 5,227.64 - 1,000 = 4,227.64 and leaves 40.65 (1,000 / 24.6) unmet.
function pooledElection(firstBalance: number, secondBalance: number, preElectionDistributed: number) {
  const plan = planFor('1951-01-02')
  inherited(plan, {
    ownerDeathYear: 2024, decedentHadStartedRmds: true,
    beneficiary: facts({ beneficiaryBirthYear: 1951, ownerBirthYear: 1945 }),
  }, firstBalance)
  observedElection(plan, '2026-06-15', '2024-06-01', [2025], { referenceBalance: 100_000, preElectionDistributed })
  const first = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, { type: 'traditional' }>
  plan.accounts.push({ ...structuredClone(first), id: 'pooled-second', name: 'Second IRA, same decedent', balance: secondBalance })
  return plan
}

function obligationFor(result: ReturnType<typeof run>, accountId: string) {
  const row = year(result, 2026).electionYearOwnerRmdObligations?.find((candidate) => candidate.accountId === accountId)
  if (!row) throw new Error(`missing owner RMD obligation for ${accountId}`)
  return row
}

describeRule('treas-reg-1-408-8-c-3-spouse-treated-as-owner', {
  readings: {
    oncePerPoolOnPriorDecember31Balances: 129_600 / 24.6 - 1_000,
    oncePerIraOnLiveBalances: 99_000 / 24.6 - 1_000 + (29_600 / 24.6 - 1_000),
    oncePerPoolOnLiveBalances: 128_600 / 24.6 - 1_000,
  },
  accepted: 'oncePerPoolOnPriorDecember31Balances',
  note: 'pooled pre-election distribution credit',
}, ({ accepted, readings }) => {
  it('counts the pool\'s 1,000 pre-election distribution once and forces 4268.29', () => {
    expect(packForYear(2026).pack.rmd.uniformLifetimeTable[75]).toBe(24.6)
    expect(accepted).toBeCloseTo(4268.29, 2)
    expect(readings.oncePerIraOnLiveBalances).toBeCloseTo(3227.64, 2)
    expect(readings.oncePerPoolOnLiveBalances).toBeCloseTo(4227.64, 2)
    const ownerTotal = 129_600 / 24.6
    expect(ownerTotal).toBeCloseTo(5268.29, 2)

    const result = run(pooledElection(99_000, 29_600, 1_000), 2026)
    const y = year(result, 2026)
    expect(obligationFor(result, 'inherited')).toMatchObject({
      requiredAmount: 100_000 / 24.6,
      creditedAcceptedDistributionAmount: 1_000,
      creditedDistributionEvidence: 'section402c2j4-actual-pre-election-distribution',
      unsatisfiedAmount: 0,
    })
    expect(obligationFor(result, 'inherited').settledAmount).toBeCloseTo(3065.04, 2)
    expect(obligationFor(result, 'pooled-second')).toMatchObject({
      requiredAmount: 29_600 / 24.6,
      creditedAcceptedDistributionAmount: 0,
      creditedDistributionEvidence: 'none',
      settledAmount: 29_600 / 24.6,
      unsatisfiedAmount: 0,
    })
    expect(y.rmd).toBeCloseTo(accepted, 8)
    expect(y.rmd).not.toBeCloseTo(readings.oncePerIraOnLiveBalances, 2)
    expect(y.rmd).not.toBeCloseTo(readings.oncePerPoolOnLiveBalances, 2)
    expect(y.balances.inherited).toBeCloseTo(95_934.96, 2)
    expect(y.balances['pooled-second']).toBeCloseTo(28_396.75, 2)
    expect(y.rmdShortfallExciseDetails).toHaveLength(1)
    expect(y.rmdShortfallExciseDetails![0]).toMatchObject({ obligationId: expect.stringContaining('owned-iras'), tax: 0 })
    expect(y.rmdShortfallExciseDetails![0]!.requiredAmount).toBeCloseTo(ownerTotal, 8)
    expect(y.rmdShortfallExciseDetails![0]!.distributedByDeadline).toBeCloseTo(ownerTotal, 8)
  })

  it('carries a pre-election distribution larger than the first IRA needs to the rest of the pool', () => {
    // 5,000 distributed before the election, live balances 95,000 and 29,600.
    // Prior December 31: 100,000 and 29,600, requirements 4,065.04 and
    // 1,203.25, total 5,268.29. The 5,000 covers 'inherited' whole and
    // 5,000 - 4,065.04 = 934.96 of 'pooled-second', which is forced
    // 1,203.25 - 934.96 = 268.29 and ends at 29,600 - 268.29 = 29,331.71.
    // The year distributes 5,000 + 268.29 = 5,268.29.
    const result = run(pooledElection(95_000, 29_600, 5_000), 2026)
    const y = year(result, 2026)
    expect(obligationFor(result, 'inherited')).toMatchObject({
      requiredAmount: 100_000 / 24.6, creditedAcceptedDistributionAmount: 100_000 / 24.6,
      unpaidAmount: 0, settledAmount: 0, unsatisfiedAmount: 0,
    })
    const second = obligationFor(result, 'pooled-second')
    expect(second.requiredAmount).toBeCloseTo(1203.25, 2)
    expect(second.creditedAcceptedDistributionAmount).toBeCloseTo(934.96, 2)
    expect(second.settledAmount).toBeCloseTo(268.29, 2)
    expect(second.creditedDistributionEvidence).toBe('section402c2j4-actual-pre-election-distribution')
    expect(y.rmd).toBeCloseTo(268.29, 2)
    expect(y.balances.inherited).toBeCloseTo(95_000, 8)
    expect(y.balances['pooled-second']).toBeCloseTo(29_331.71, 2)
    expect(y.rmdShortfallExciseDetails![0]!.requiredAmount).toBeCloseTo(5268.29, 2)
    expect(y.rmdShortfallExciseDetails![0]!.distributedByDeadline).toBeCloseTo(5268.29, 2)
    expect(y.rmdShortfallExciseDetails![0]!.tax).toBe(0)
  })

  it('credits a completed history row to the IRA it came from and does not also count the shared figure', () => {
    // 'pooled-second' reports 1,000 distributed in 2026 on a completed
    // history row, so the distribution came from it: live 28,600, prior
    // December 31 29,600, required 1,203.25, credited 1,000, forced 203.25.
    // History is preferred to the shared j(4) figure, which is not counted
    // again: 'inherited' (live and prior December 31 100,000) is required and
    // forced 4,065.04 with no credit. The year distributes
    // 1,000 + 203.25 + 4,065.04 = 5,268.29.
    const plan = pooledElection(100_000, 28_600, 1_000)
    const second = plan.accounts.find((row) => row.id === 'pooled-second') as Extract<Account, { type: 'traditional' }>
    second.inherited!.annualDistributionHistory!.push({
      taxYear: 2026, requiredAmount: 1_000, distributedAmount: 1_000,
      observedAsOfDate: '2026-12-31', legalDistributionDeadline: '2026-12-31',
      provenance: { source: 'Custodian completed statutory distribution record', asOf: '2026-12-31' },
    })
    // A completed 2026 row is admissible only once the shared election facts
    // are observed at or after it, so both IRAs carry facts as of year end.
    for (const row of plan.accounts) {
      const facts = row.type === 'traditional' ? row.inherited?.beneficiary?.spousalElectionFacts : undefined
      if (facts) facts.provenance = { ...facts.provenance, asOf: '2026-12-31' }
    }
    const result = run(plan, 2026)
    const y = year(result, 2026)
    expect(obligationFor(result, 'pooled-second')).toMatchObject({
      requiredAmount: 29_600 / 24.6, creditedAcceptedDistributionAmount: 1_000,
      creditedDistributionEvidence: 'completed-current-year-beneficiary-history', unsatisfiedAmount: 0,
    })
    expect(obligationFor(result, 'pooled-second').settledAmount).toBeCloseTo(203.25, 2)
    expect(obligationFor(result, 'inherited')).toMatchObject({
      requiredAmount: 100_000 / 24.6, creditedAcceptedDistributionAmount: 0,
      creditedDistributionEvidence: 'none', settledAmount: 100_000 / 24.6, unsatisfiedAmount: 0,
    })
    expect(y.rmd).toBeCloseTo(4268.29, 2)
    expect(y.rmdShortfallExciseDetails![0]!.requiredAmount).toBeCloseTo(5268.29, 2)
    expect(y.rmdShortfallExciseDetails![0]!.distributedByDeadline).toBeCloseTo(5268.29, 2)
  })

  it('adds a lone IRA\'s pre-election distribution back when no reference balance is given', () => {
    // One IRA, live 99,000, j(4) reference 0 (the placeholder when j(4) does
    // not apply), 1,000 distributed before the election: prior December 31
    // 100,000, required 4,065.04, credited 1,000, forced 3,065.04, year-end
    // 95,934.96. On the live balance alone it was 4,024.39 and 3,024.39.
    const plan = planFor('1951-01-02')
    inherited(plan, {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1951, ownerBirthYear: 1945 }),
    }, 99_000)
    observedElection(plan, '2026-06-15', '2024-06-01', [2025], { referenceBalance: 0, preElectionDistributed: 1_000 })
    const result = run(plan, 2026)
    expect(ownerObligation(result, 2026)).toMatchObject({
      requiredAmount: 100_000 / 24.6, creditedAcceptedDistributionAmount: 1_000, unsatisfiedAmount: 0,
    })
    expect(ownerObligation(result, 2026).settledAmount).toBeCloseTo(3065.04, 2)
    expect(year(result, 2026).balances.inherited).toBeCloseTo(95_934.96, 2)
  })
})
