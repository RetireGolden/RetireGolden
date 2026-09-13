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
