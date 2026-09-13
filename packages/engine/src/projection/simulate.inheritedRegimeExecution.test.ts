import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { rmdShortfallObligationId, type RmdApplicablePlan } from '../rmd/rmdShortfallExcise.js'
import { packForYear } from '../params/index.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput } from './types.js'
import { classifyInheritedRegime, inheritedRequirementForYear } from '../strategies/inheritedIra.js'

const noTax = createFlatTaxCalculator(0)
let sequence = 0
const id = () => `inherited-execution-${++sequence}`

type Beneficiary = NonNullable<Extract<Account, { type: 'traditional' }>['inherited']>['beneficiary']

function planFor(beneficiaryBirthYear: number, planningAge = 100): Plan {
  const plan = createEmptyPlan({ newId: id, now: () => new Date('2026-01-01T00:00:00.000Z') })
  plan.household.people[0] = {
    id: 'beneficiary', name: 'Beneficiary', dob: `${beneficiaryBirthYear}-06-15`,
    sex: 'average', retirementAge: null, longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [{ type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 1_000_000, annualContribution: 0 } as Account]
  return plan
}

function facts(overrides: Partial<NonNullable<Beneficiary>> = {}): NonNullable<Beneficiary> {
  return {
    beneficiaryClass: 'designated-individual', edbCategory: 'none', beneficiaryBirthYear: 1995,
    soleBeneficiary: true, ownerBirthYear: 1970,
    provenance: { source: 'test', asOf: '2026-01-01' },
    ...overrides,
  }
}

function inherited(
  plan: Plan,
  type: 'traditional' | 'roth',
  inheritedFacts: Record<string, unknown>,
  balance = 300_000,
  annualReturnPct: number | null = null,
) {
  plan.accounts.push({
    type, id: 'inherited', name: 'Inherited IRA', ownerPersonId: 'beneficiary', annualReturnPct,
    kind: 'ira', balance, annualContribution: 0, inherited: inheritedFacts,
  } as Account)
}

/** Dated custodian evidence supplements a coarse strategy election year. */
function observedElection(plan: Plan, date: string, deathDate: string, priorYears: number[] = []) {
  const account = plan.accounts.find((row) => row.id === 'inherited') as Extract<Account, {type:'traditional'}>
  const inherited = account.inherited!
  inherited.decedentId = 'spouse-decedent'
  inherited.ownerDeathDate = deathDate
  inherited.annualDistributionHistory = priorYears.map((taxYear) => ({
    taxYear, requiredAmount: inherited.decedentHadStartedRmds ? 1000 : 0, distributedAmount: inherited.decedentHadStartedRmds ? 1000 : 0, observedAsOfDate: `${taxYear}-12-31`,
    legalDistributionDeadline: `${taxYear}-12-31`,
    provenance: {source:'Custodian completed statutory distribution record', asOf:`${taxYear}-12-31`},
  }))
  inherited.beneficiary!.spousalElectionFacts = {
    directSpouseNamedOnIra: 'verifiedYes', affirmativeElectionDate: date,
    affirmativeElectionYear: Number(date.slice(0,4)), nonRolloverContributionYears: [], lateElectionCatchUp:null,
    preElectionDistributionMethod: 'lifeExpectancyRule',
    section402c2j4Inputs: {
      transaction:'affirmativeTreatAsOwnElection', spouseBirthDate:plan.household.people[0]!.dob,
      decedentBirthDate:`${inherited.beneficiary!.ownerBirthYear}-01-01`,
      distributionYear:Number(date.slice(0,4)), currentYearRmdReferenceBalance:0,
      actualPriorYearDistributions:[], actualPreElectionDistributionsCurrentYear:0,
      currentDistributionOrRemainingInterest:0, provenance:{source:'Custodian life-expectancy method evidence',asOf:date},
    },
    provenance:{source:'Executed custodian owner redesignation',asOf:date},
  }
}

function cashAccount(plan: Plan): Extract<Account, { type: 'cash' }> {
  const account = plan.accounts.find((candidate): candidate is Extract<Account, { type: 'cash' }> => candidate.type === 'cash')
  if (!account) throw new Error('missing cash account')
  return account
}

function run(plan: Plan, horizonEndYear?: number) {
  const parsed = parsePlan(plan)
  expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return simulatePlan(parsed.plan, { startYear: 2026, horizonEndYear, taxCalculator: noTax })
}

function runCapturingOrdinaryIncome(plan: Plan, horizonEndYear?: number) {
  const parsed = parsePlan(plan)
  expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  const ordinaryIncome: number[] = []
  const taxInputs: TaxYearInput[] = []
  const result = simulatePlan(parsed.plan, {
    startYear: 2026,
    horizonEndYear,
    taxCalculator: { compute(input: TaxYearInput) { ordinaryIncome.push(input.ordinaryIncome); taxInputs.push(input); return 0 } },
  })
  return { result, ordinaryIncome, taxInputs }
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

describe('WS4 inherited-regime execution fixtures', () => {
  it('R1: executes each non-relief annual amount from the verified Single Life schedule before the final sweep', () => {
    // The pack confirms the spec's referenced age-59 table entry. With the
    // specified 1965 beneficiary, however, the 2023 lookup age is 58, so the
    // 2026 divisor is 28.9 - 3 = 25.9 rather than the age-59 25.0 result.
    const pack = packForYear(2026).pack
    expect(pack.rmd.singleLifeTable[59]).toBe(28.0)
    expect(pack.rmd.singleLifeTable[58]).toBe(28.9)

    const plan = planFor(1965)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1965,
        ownerBirthYear: 1940,
        ownerYearOfDeathRmdSatisfied: true,
      }),
    })
    const { result, ordinaryIncome } = runCapturingOrdinaryIncome(plan, 2032)

    for (const [calendarYear, divisor] of [
      [2026, 25.9], [2027, 24.9], [2028, 23.9], [2029, 22.9], [2030, 21.9], [2031, 20.9],
    ] as const) {
      const e = evidence(result, calendarYear)
      const priorYearEnd = calendarYear === 2026 ? 300_000 : year(result, calendarYear - 1).balances.inherited!
      expect(e.regime).toBe('ten-year-with-annual-rmds')
      expect(e.matrixRow).toBe('R1')
      expect(e.requirementKind).toBe('annual-rmd')
      expect(e.divisorArm).toBe('beneficiary-fixed')
      expect(e.divisor).toBe(divisor)
      expect(e.executedRequiredAmount).toBeCloseTo(priorYearEnd / divisor, 2)
      expect(year(result, calendarYear).inheritedDistribution).toBeCloseTo(e.executedRequiredAmount, 8)
      expect(ordinaryIncome.some((amount) => Math.abs(amount - e.executedRequiredAmount) < 0.005)).toBe(true)
    }

    const finalYear = evidence(result, 2032)
    expect(finalYear.requirementKind).toBe('final-sweep')
    expect(finalYear.executedRequiredAmount).toBeCloseTo(year(result, 2031).balances.inherited!, 2)
    expect(year(result, 2032).balances.inherited).toBeCloseTo(0, 2)
  })

  it('E1 S1: executes the post-RBD spouse redetermined arm, not the shorter owner arm', () => {
    const plan = planFor(1947)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1947, ownerBirthYear: 1945, edbCategory: 'surviving-spouse', election: 'remain-beneficiary', ownerYearOfDeathRmdSatisfied: true }),
    }, 300_000, 10)
    const { result, ordinaryIncome } = runCapturingOrdinaryIncome(plan, 2027)
    for (const [calendarYear, divisor] of [[2026, 11.9], [2027, 11.2]] as const) {
      const y = year(result, calendarYear)
      const e = evidence(result, calendarYear)
      const priorYearEnd = calendarYear === 2026 ? 300_000 : year(result, 2026).balances.inherited!
      expect(e.regime).toBe('spouse-remain-beneficiary')
      expect(e.divisorArm).toBe('spouse-redetermined')
      expect(e.divisor).toBe(divisor)
      expect(e.executedRequiredAmount).toBeCloseTo(priorYearEnd / divisor, 2)
      // The published current-year balance includes the 10% growth applied after
      // execution, so it is not a lawful annual-RMD base.
      expect(e.executedRequiredAmount).not.toBeCloseTo(y.balances.inherited! / divisor, 2)
      expect(ordinaryIncome.some((amount) => Math.abs(amount - e.executedRequiredAmount) < 0.005)).toBe(true)
      expect(y.penalties).toBe(0)
    }
  })

  it('E2 R2: has no annual distribution and sweeps the live balance in year ten', () => {
    const plan = planFor(1995)
    inherited(plan, 'traditional', { ownerDeathYear: 2022, decedentHadStartedRmds: false, beneficiary: facts() })
    const result = run(plan, 2032)
    for (let calendarYear = 2026; calendarYear < 2032; calendarYear++) {
      expect(year(result, calendarYear).inheritedDistribution).toBe(0)
      expect(evidence(result, calendarYear).requirementKind).toBe('none')
    }
    const y2032 = year(result, 2032)
    expect(evidence(result, 2032).requirementKind).toBe('final-sweep')
    expect(y2032.inheritedDistribution).toBeCloseTo(300_000, 2)
    expect(y2032.penalties).toBe(0)
  })

  it('E3 R3: continues the minor-child fixed schedule through majority and sweeps after the tail', () => {
    const plan = planFor(2010, 100)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2020, decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryBirthYear: 2010, ownerBirthYear: 1975, edbCategory: 'minor-child' }),
    })
    const result = run(plan, 2041)
    expect(evidence(result, 2026).divisor).toBe(68.9) // Single Life(11) 73.9, fixed minus five
    expect(evidence(result, 2026).executedRequiredAmount).toBeCloseTo(300_000 / 68.9, 2)
    for (let calendarYear = 2026; calendarYear <= 2031; calendarYear++) {
      expect(evidence(result, calendarYear).requirementKind).toBe('annual-rmd')
    }
    expect(evidence(result, 2041).requirementKind).toBe('final-sweep')
    expect(year(result, 2041).balances.inherited).toBeCloseTo(0, 2)
  })

  it('E4 K1: parses and executes its final Roth sweep outside ordinary income and penalties', () => {
    const plan = planFor(1980)
    inherited(plan, 'roth', {
      ownerDeathYear: 2022, decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryBirthYear: 1980, roth5YearStartYear: 2010 }),
    })
    const { result, ordinaryIncome } = runCapturingOrdinaryIncome(plan, 2032)
    expect(year(result, 2026).inheritedDistribution).toBe(0)
    const y2032 = year(result, 2032)
    expect(evidence(result, 2032).requirementKind).toBe('final-sweep')
    expect(y2032.inheritedDistribution).toBeCloseTo(300_000, 2)
    expect(ordinaryIncome.every((amount) => amount === 0)).toBe(true)
    expect(y2032.withdrawals.roth).toBeCloseTo(y2032.inheritedDistribution, 2)
    expect(y2032.penalties).toBe(0)
  })

  it('E5 K2: defers Roth spouse distributions then uses Single Life(71) = 18.0', () => {
    const plan = planFor(1960)
    inherited(plan, 'roth', {
      ownerDeathYear: 2022, decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryBirthYear: 1960, ownerBirthYear: 1958, edbCategory: 'surviving-spouse', election: 'remain-beneficiary', roth5YearStartYear: 2012 }),
    })
    const { result, ordinaryIncome } = runCapturingOrdinaryIncome(plan, 2031)
    for (let calendarYear = 2026; calendarYear <= 2030; calendarYear++) expect(year(result, calendarYear).inheritedDistribution).toBe(0)
    const e = evidence(result, 2031)
    expect(e.divisor).toBe(18.0)
    expect(e.executedRequiredAmount).toBeCloseTo(300_000 / 18.0, 2)
    expect(ordinaryIncome.every((amount) => amount === 0)).toBe(true)
  })

  it('E6 S2: flips from the S0 schedule to the spouse owner-RMD path in the election year', () => {
    const plan = planFor(1947)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1947, ownerBirthYear: 1945, edbCategory: 'surviving-spouse', election: 'treat-as-own', spouseUnlimitedWithdrawalRight: true, treatAsOwnElectionYear: 2028, ownerYearOfDeathRmdSatisfied: true }),
    })
    observedElection(plan, '2027-12-31', '2024-06-01', [2025])
    const result = run(plan, 2028)
    expect(evidence(result, 2026).executedRequiredAmount).toBeCloseTo(300_000 / 11.9, 2)
    expect(evidence(result, 2027).executedRequiredAmount).toBeCloseTo(year(result, 2026).balances.inherited! / 11.2, 2)
    expect(year(result, 2028).inheritedDistribution).toBe(0)
    expect(year(result, 2028).rmd).toBeCloseTo(year(result, 2027).balances.inherited! / 19.4, 2)
    expect(evidence(result, 2028).requirementKind).toBe('none')
  })

  describeRule('treas-reg-1-408-8-c-3-spouse-as-own-death-year-rmd', {
    readings: {
      regulationKeepsTheDecedentRmdAndSuppressesOwnerRmd: {
        decedentRmd: 300_000 / 19.4,
        ownerRmd: 0,
      },
      rejectedOwnerTreatmentForTheDeathYear: {
        decedentRmd: 0,
        // Spouse born 1947-06-15 is age 79 in the 2026 death year → ULT 21.1
        // (20.2 is her age-80/2027 divisor and would not discriminate this reading).
        ownerRmd: 300_000 / 21.1,
      },
    },
    accepted: 'regulationKeepsTheDecedentRmdAndSuppressesOwnerRmd',
    note: 'same-calendar-year treat-as-own election',
  }, ({ accepted, readings }) => {
    it('E6b S2 same-year flip: keeps the decedent year-of-death RMD and suppresses owner RMD', () => {
      // §1.408-8(c)(3): election year equals ownerDeathYear → spouse takes no
      // owner RMD that year but must take the decedent's unsatisfied YOD RMD.
      // Owner born 1945, dies 2026 post-RBD → death-year age 81 → ULT 19.4.
      const ultAge81 = packForYear(2026).pack.rmd.uniformLifetimeTable[81]
      expect(ultAge81).toBe(19.4)
      const plan = planFor(1947)
      inherited(plan, 'traditional', {
        ownerDeathYear: 2026,
        decedentHadStartedRmds: true,
        beneficiary: facts({
          beneficiaryBirthYear: 1947,
          ownerBirthYear: 1945,
          edbCategory: 'surviving-spouse',
          election: 'treat-as-own',
          spouseUnlimitedWithdrawalRight: true,
          treatAsOwnElectionYear: 2026,
          // ownerYearOfDeathRmdSatisfied omitted → unsatisfied.
        }),
      }, 300_000)
      observedElection(plan, '2026-12-31', '2026-06-01')
      const result = run(plan, 2027)
      const y2026 = year(result, 2026)
      const e2026 = evidence(result, 2026)
      expect(e2026.regime).toBe('spouse-remain-beneficiary')
      expect(e2026.matrixRow).toBe('S0')
      expect(e2026.requirementKind).toBe('year-of-death-rmd')
      expect(e2026.divisor).toBe(19.4)
      expect(e2026.executedRequiredAmount).toBeCloseTo(accepted.decedentRmd, 2)
      expect(y2026.inheritedDistribution).toBeCloseTo(accepted.decedentRmd, 2)
      // No owner RMD aggregation for this account in the flip/death year.
      expect(y2026.rmd).toBe(accepted.ownerRmd)
      expect(y2026.rmd).not.toBeCloseTo(readings.rejectedOwnerTreatmentForTheDeathYear.ownerRmd, 2)
      // Following year: owner-side treatment (spouse age 80 in 2027 → ULT 20.2).
      const y2027 = year(result, 2027)
      expect(y2027.inheritedDistribution).toBe(0)
      expect(evidence(result, 2027).requirementKind).toBe('none')
      expect(y2027.rmd).toBeCloseTo(year(result, 2026).balances.inherited! / 20.2, 2)
    })
  })

  it('S2 post-election: SEPP distributes from the flipped account', () => {
    const plan = planFor(1970)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2024,
      decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1970,
        ownerBirthYear: 1945,
        edbCategory: 'surviving-spouse',
        election: 'treat-as-own',
        spouseUnlimitedWithdrawalRight: true,
        treatAsOwnElectionYear: 2028,
        ownerYearOfDeathRmdSatisfied: true,
      }),
    }, 500_000)
    const account = plan.accounts.find((candidate) => candidate.id === 'inherited')
    if (account?.type !== 'traditional') throw new Error('fixture drift')
    observedElection(plan, '2027-12-31', '2024-06-01', [2025])
    account.sepp = { startAge: 56, method: 'rmd' }
    const result = run(plan, 2028)
    // Pre-election: inherited gate still bars SEPP on the inherited block.
    expect(year(result, 2027).sepp).toBe(0)
    // Post-election: spouse's own IRA — active series distributes.
    expect(year(result, 2028).sepp).toBeGreaterThan(0)
  })

  it('blocks scheduled contributions to an inherited Roth', () => {
    const plan = planFor(1980)
    inherited(plan, 'roth', {
      ownerDeathYear: 2022,
      decedentHadStartedRmds: false,
      beneficiary: facts({
        beneficiaryBirthYear: 1980,
        ownerBirthYear: 1950,
        edbCategory: 'none',
        roth5YearStartYear: 2010,
      }),
    }, 100_000)
    const roth = plan.accounts.find((a) => a.id === 'inherited')
    if (roth?.type !== 'roth') throw new Error('fixture drift')
    roth.annualContribution = 7_000
    // Wages so a non-inherited Roth would contribute.
    plan.incomes = [{
      type: 'wages',
      id: 'w',
      personId: 'beneficiary',
      annualGross: 80_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const result = run(plan, 2026)
    expect(year(result, 2026).contributions).toBe(0)
    expect(year(result, 2026).balances.inherited).toBe(100_000)
  })

  it('E7: refuses an unestablished estate schedule without a fabricated legacy distribution', () => {
    const plan = planFor(1995)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2022, decedentHadStartedRmds: true,
      beneficiary: { beneficiaryClass: 'estate', provenance: { source: 'test', asOf: '2026-01-01' } },
    })
    const result = run(plan, 2026)
    const e = evidence(result, 2026)
    expect(e.requirementKind).toBe('none')
    expect(e.refusalReason).toMatch(/estate|unsupported/i)
    expect(e.refusalCode).toBe('entity-beneficiary')
    expect(e.executedRequiredAmount).toBe(0)
    expect(e.limitation).toBe('non-designated-schedule-not-established')
  })

  it.each(['E1', 'E3', 'E6'] as const)('E8 %s: evidence exactly reconciles each inherited distribution', (fixture) => {
    const plan = fixture === 'E3' ? planFor(2010) : planFor(1947)
    const inheritedFacts = fixture === 'E3'
      ? { ownerDeathYear: 2020, decedentHadStartedRmds: false, beneficiary: facts({ beneficiaryBirthYear: 2010, ownerBirthYear: 1975, edbCategory: 'minor-child' }) }
      : { ownerDeathYear: 2024, decedentHadStartedRmds: true, beneficiary: facts({ beneficiaryBirthYear: 1947, ownerBirthYear: 1945, edbCategory: 'surviving-spouse', election: fixture === 'E6' ? 'treat-as-own' : 'remain-beneficiary', ...(fixture === 'E6' ? { spouseUnlimitedWithdrawalRight: true, treatAsOwnElectionYear: 2028 } : {}), ownerYearOfDeathRmdSatisfied: true }) }
    inherited(plan, 'traditional', inheritedFacts)
    for (const y of run(plan, 2031).years) {
      const total = (y.inheritedAccounts ?? []).reduce((sum, row) => sum + row.executedRequiredAmount, 0)
      expect(total).toBeCloseTo(y.inheritedDistribution, 8)
      expect(y.withdrawals.traditional).toBeGreaterThanOrEqual(y.inheritedDistribution - 0.01)
    }
  })

  it('E8: keeps voluntary inherited-traditional draws out of the forced-only distribution total', () => {
    const plan = planFor(1947)
    cashAccount(plan).balance = 1
    plan.expenses.baseAnnual = 100_000
    inherited(plan, 'traditional', {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1947, ownerBirthYear: 1945, edbCategory: 'surviving-spouse', election: 'remain-beneficiary', ownerYearOfDeathRmdSatisfied: true }),
    })
    const { result, ordinaryIncome } = runCapturingOrdinaryIncome(plan, 2026)
    const y = year(result, 2026)
    const e = evidence(result, 2026)
    expect(e.voluntaryAmount).toBeGreaterThan(0)
    expect(y.inheritedDistribution).toBeCloseTo(e.executedRequiredAmount, 8)
    expect(ordinaryIncome.some((amount) =>
      Math.abs(amount - (e.executedRequiredAmount + e.voluntaryAmount)) < 0.005,
    )).toBe(true)
  })

  it('E9: preserves the two-field legacy amounts at three annual Single Life walk-back points', () => {
    const plan = planFor(1976)
    inherited(plan, 'traditional', { ownerDeathYear: 2022, decedentHadStartedRmds: true })
    const result = run(plan, 2028)
    // The legacy helper's age walk-back lands at 36.0 in 2026.  The changing
    // divisor and changing opening balance deliberately leave this exact amount level.
    const expected = [
      300_000 / 36,
      300_000 / 36,
      300_000 / 36,
    ]
    expect([2026, 2027, 2028].map((calendarYear) => year(result, calendarYear).inheritedDistribution)).toEqual(expected)
  })

  it('E10: enters owner RMD rules at the S2 identity flip after a synthetic refusal', () => {
    const plan = planFor(1950)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2020, decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryBirthYear: 1950, ownerBirthYear: 1959, edbCategory: 'surviving-spouse', election: 'treat-as-own', spouseUnlimitedWithdrawalRight: true, treatAsOwnElectionYear: 2030 }),
    })
    observedElection(plan, '2029-12-31', '2020-06-01', [2021,2022,2023,2024,2025,2026,2027,2028,2029])
    const result = run(plan, 2030)
    for (let calendarYear = 2026; calendarYear < 2030; calendarYear++) {
      const e = evidence(result, calendarYear)
      expect(e.requirementKind).toBe('legacy')
      expect(e.regime).toBe('needs-review')
      expect(e.matrixRow).toBe('X5')
      expect(e.refusalReason).toMatch(/1959|applicable age|contested/i)
      expect(e.refusalCode).toBe('needs-review')
    }
    const y2030 = year(result, 2030)
    expect(year(result, 2030).inheritedDistribution).toBe(0)
    expect(evidence(result, 2030).requirementKind).toBe('none') // inherited path ceded to owned-IRA logic
    expect(y2030.rmd).toBeCloseTo(year(result, 2029).balances.inherited! / 20.2, 2)
  })

  it('E11 K1: voluntary inherited Roth draws stay outside the beneficiary owned-Roth ordering pool', () => {
    const rothDrawPlan = (withInherited: boolean): Plan => {
      const plan = planFor(1980)
      cashAccount(plan).balance = 0
      plan.expenses.baseAnnual = 110_000
      if (withInherited) {
        inherited(plan, 'roth', {
          ownerDeathYear: 2022, decedentHadStartedRmds: false,
          decedentId: 'qualified-decedent',
          beneficiary: facts({ beneficiaryBirthYear: 1980, roth5YearStartYear: 2010 }),
        }, 100_000)
        plan.inheritedRothTaxCharacterPools = [{
          beneficiaryPersonId: 'beneficiary', decedentId: 'qualified-decedent',
          firstRothContributionTaxYear: 2010, remainingRegularContributionBasis: 'unknown',
          conversionLayers: 'unknown', priorDistributionsConsumedAmount: 0,
          provenance: { source: 'Decedent Roth opening statement', asOf: '2026-01-01' },
        }]
      }
      plan.accounts.push({
        type: 'roth', id: 'owned-roth', name: 'Owned Roth IRA', ownerPersonId: 'beneficiary', annualReturnPct: null,
        kind: 'ira', balance: 10_000, contributionBasis: 1_000, annualContribution: 0,
      } as Account)
      return plan
    }
    const inheritedRun = runCapturingOrdinaryIncome(rothDrawPlan(true), 2026)
    const controlRun = runCapturingOrdinaryIncome(rothDrawPlan(false), 2026)
    const inheritedYear = year(inheritedRun.result, 2026)
    const controlYear = year(controlRun.result, 2026)
    const e = evidence(inheritedRun.result, 2026)
    expect(e.regime).toBe('roth-ten-year-no-annual')
    expect(e.voluntaryAmount).toBeCloseTo(100_000, 2)
    expect(inheritedYear.inheritedDistribution).toBe(0)
    expect(inheritedYear.penalties).toBeCloseTo(controlYear.penalties, 8)
    expect(inheritedRun.ordinaryIncome).toEqual(controlRun.ordinaryIncome)
  })

  it('P5: emits successor-scope evidence and stops forcing after the beneficiary dies', () => {
    const plan = planFor(1980, 60)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1980, ownerBirthYear: 1945 }),
    })
    const parsed = parsePlan(plan)
    expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    // Age 47 is the last alive year, so every 2028+ row is successor scope.
    const result = simulatePlan(parsed.plan, {
      startYear: 2026,
      horizonEndYear: 2030,
      deathAgeByPersonId: { beneficiary: 47 },
      taxCalculator: noTax,
    })
    for (const calendarYear of [2028, 2029, 2030]) {
      const y = year(result, calendarYear)
      const e = evidence(result, calendarYear)
      expect(e.requirementKind).toBe('none')
      expect(e.disclosures).toContain('successor-clock-out-of-scope')
      expect(e.refusalReason).toMatch(/successor.*out of scope/i)
      expect(e.refusalCode).toBe('successor-clock-out-of-scope')
      expect(e.executedRequiredAmount).toBe(0)
      expect(y.inheritedDistribution).toBe(0)
    }
  })

  it('P6: marks the R1 relief-year amount notice-waived for non-execution', () => {
    const inheritedFacts = {
      ownerDeathYear: 2020,
      decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1980, ownerBirthYear: 1945 }),
    }
    const classification = classifyInheritedRegime({
      accountType: 'traditional',
      accountKind: 'ira',
      inherited: inheritedFacts,
    })
    expect(classification.kind).toBe('regime')
    if (classification.kind !== 'regime') throw new Error('expected R1 classification')

    const requirement = inheritedRequirementForYear({
      pack: packForYear(2023).pack,
      classification,
      inherited: inheritedFacts,
      year: 2023,
      priorYearEndBalance: 300_000,
    })
    expect(requirement.kind).toBe('annual-rmd')
    expect(requirement.requiredAmount).toBeGreaterThan(0)
    expect(requirement.noticeWaived).toBe(true)

    const plan = planFor(1980)
    inherited(plan, 'traditional', inheritedFacts)
    const parsed = parsePlan(plan)
    expect(parsed.ok, parsed.ok ? '' : parsed.issues.join('\n')).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: 2024,
      horizonEndYear: 2024,
      taxCalculator: noTax,
    })
    const executed = evidence(result as ReturnType<typeof run>, 2024)
    // Matrix §4: published relief-year evidence survives, but forcing skips it.
    expect(executed.noticeWaived).toBe(true)
    expect(executed.executedRequiredAmount).toBe(0)
    expect(year(result as ReturnType<typeof run>, 2024).inheritedDistribution).toBe(0)
  })

  it('P7: stamps pre-horizon year-of-death RMD limitation on the legacy refusal path', () => {
    const plan = planFor(1950)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2019,
      decedentHadStartedRmds: true,
      beneficiary: facts({
        beneficiaryBirthYear: 1950,
        ownerBirthYear: 1940,
        ownerYearOfDeathRmdSatisfied: false,
      }),
    })
    const result = run(plan, 2026)
    const row = evidence(result, 2026)
    expect(row.regime).toBe('legacy-planning-approximation')
    expect(row.limitation).toBe('pre-horizon-year-of-death-rmd-unresolved')
  })
})


describe('inherited Roth shared annual production ledger', () => {
  function sharedPoolPlan() {
    const plan = planFor(1965)
    const inheritedFacts = {
      ownerDeathYear: 2024, ownerDeathDate: '2024-06-01', decedentId: 'decedent',
      decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryBirthYear: 1965, ownerBirthYear: 1960,
        edbCategory: 'disabled' }),
    }
    inherited(plan, 'roth', inheritedFacts, 2610, 0)
    const first = plan.accounts[1]!
    plan.accounts.push({ ...first, id: 'inherited-two' } as Account)
    plan.inheritedRothTaxCharacterPools = [{
      beneficiaryPersonId: 'beneficiary', decedentId: 'decedent',
      firstRothContributionTaxYear: 2024, remainingRegularContributionBasis: 60,
      conversionLayers: [], priorDistributionsConsumedAmount: 0,
      provenance: { source: 'Complete decedent Roth records', asOf: '2026-01-01' },
    }]
    return plan
  }

  it('consumes one shared 60 basis across two 100 mandatory draws and survives annual replay', () => {
    // 26 CFR 1.401(a)(9)-9 Single Life Table: age60=27.1 in 2025,
    // reduced once to26.1 in2026 =>2610/26.1=100 each. Pub590-B inherited
    // Roth ordering consumes regular contributions first:200-60=140 ordinary.
    const plan = sharedPoolPlan()
    const first = runCapturingOrdinaryIncome(plan, 2026)
    expect(year(first.result, 2026).inheritedDistribution).toBeCloseTo(200, 8)
    expect(first.ordinaryIncome.at(-1)).toBeCloseTo(140, 8)
    expect(year(first.result, 2026).magi).toBeCloseTo(140, 8)
    expect(year(first.result, 2026).balances.inherited).toBeCloseTo(2510, 8)
    expect(year(first.result, 2026).balances['inherited-two']).toBeCloseTo(2510, 8)
    expect(year(first.result, 2026).taxComputation?.status).toBe('complete')
    expect(first.taxInputs.at(-1)?.stateRetirementDistributions?.reduce((sum, row) => sum + row.federallyIncludedAmount, 0)).toBeCloseTo(140, 8)
    expect(year(first.result, 2026).penalties).toBe(0)
    const replay = runCapturingOrdinaryIncome(plan, 2026)
    expect(replay.ordinaryIncome.at(-1)).toBeCloseTo(140, 8)
    expect(plan.inheritedRothTaxCharacterPools[0]!.remainingRegularContributionBasis).toBe(60)
  })

  it('mandatory and voluntary inherited Roth withdrawals consume the same annual basis pool', () => {
    // Same worksheet as above; 200 mandatory plus100 spending shortfall is300
    // gross. Pub590-B ordering leaves300-60=240 earnings included in AGI.
    const plan = sharedPoolPlan()
    cashAccount(plan).balance = 0
    plan.expenses.baseAnnual = 300
    const result = runCapturingOrdinaryIncome(plan, 2026)
    expect(year(result.result, 2026).withdrawals.roth).toBeCloseTo(300, 8)
    expect(result.ordinaryIncome.at(-1)).toBeCloseTo(240, 8)
    expect(year(result.result, 2026).magi).toBeCloseTo(240, 8)
    expect(year(result.result, 2026).penalties).toBe(0)
  })

  it('preserves known qualified clocks with unknown basis without inventing ordinary income', () => {
    const plan = sharedPoolPlan()
    plan.inheritedRothTaxCharacterPools[0]!.firstRothContributionTaxYear = 2020
    plan.inheritedRothTaxCharacterPools[0]!.remainingRegularContributionBasis = 'unknown'
    plan.inheritedRothTaxCharacterPools[0]!.conversionLayers = 'unknown'
    const result = runCapturingOrdinaryIncome(plan, 2026)
    expect(year(result.result, 2026).inheritedDistribution).toBeCloseTo(200, 8)
    expect(result.ordinaryIncome.at(-1)).toBe(0)
  })
})


describe('Verified non-designated five-year production routing', () => {
  for (const startYear of [2026, 2027]) {
    it(`sweeps the remaining benefit in ${startYear} under the single deadline obligation`, () => {
      // IRC 401(a)(9)(B)(ii), Treasury 1.401(a)(9)-3: a pre-RBD
      // non-designated beneficiary exhausts the benefit by death year + 5;
      // a balance remaining after that deadline remains fully distributable.
      const plan = planFor(1966)
      inherited(plan, 'traditional', {
        ownerDeathYear: 2021, ownerDeathDate: '2021-06-01',
        decedentHadStartedRmds: false,
        beneficiary: facts({ beneficiaryClass: 'estate', ownerBirthYear: 1960 }),
        verifiedNonDesignatedRegime: {
          classification: 'non-designated-beneficiary', schedule: 'five-year',
          provenance: { source: 'Custodian verified estate beneficiary and pre-RBD death', asOf: '2026-01-01' },
        },
      }, 1000)
      const parsed = parsePlan(plan)
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      const result = simulatePlan(parsed.plan, { startYear, horizonEndYear: startYear, taxCalculator: noTax })
      const row = result.years[0]!
      const inheritedRow = row.inheritedAccounts?.find((item) => item.accountId === 'inherited')
      expect(inheritedRow).toMatchObject({ regime: 'non-designated-five-year', requiredAmount: 1000, executedRequiredAmount: 1000 })
      expect(row.rmdShortfallExciseTax ?? 0).toBe(0)
      expect(result.endingInvestable).toBe(1_001_000)
    })
  }
})


describe('annual inherited gate production discriminators', () => {
  it('routes an observed deemed shortfall to ownership without a legacy affirmative election', () => {
    const plan = planFor(1947)
    inherited(plan, 'traditional', { ownerDeathYear: 2024, decedentHadStartedRmds: true,
      beneficiary: facts({ beneficiaryBirthYear: 1947, ownerBirthYear: 1945,
        edbCategory: 'surviving-spouse', election: 'none', spouseUnlimitedWithdrawalRight: true,
        ownerYearOfDeathRmdSatisfied: true }) }, 100000)
    observedElection(plan, '2025-12-31', '2024-06-01', [2025])
    const account = plan.accounts.find(row => row.id === 'inherited') as Extract<Account, {type:'traditional'}>
    const spouse = account.inherited!.beneficiary!
    delete spouse.spousalElectionFacts!.affirmativeElectionDate
    spouse.spousalElectionFacts!.affirmativeElectionYear = null
    account.inherited!.annualDistributionHistory![0]!.requiredAmount = 5000
    account.inherited!.annualDistributionHistory![0]!.distributedAmount = 4000
    for (const eligible of [true, false]) {
      spouse.soleBeneficiary = eligible
      const result = run(plan, 2026)
      if (eligible) {
        expect(year(result, 2026).spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: true })
        expect(evidence(result, 2026)).toMatchObject({ matrixRow: 'S2', requiredAmount: 0, executedRequiredAmount: 0 })
        expect(year(result, 2026).inheritedDistribution).toBe(0)
        expect(year(result, 2026).rmd).toBeGreaterThan(0)
      } else {
        expect(year(result, 2026).spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: false })
        expect(year(result, 2026).rmd).toBe(0)
      }
    }
  })
  it('keeps confirmed five-year annual minima zero before the full deadline sweep', () => {
    const plan = planFor(1966)
    inherited(plan, 'traditional', { ownerDeathYear: 2026, ownerDeathDate: '2026-06-01',
      decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryClass: 'estate', ownerBirthYear: 1960 }),
      verifiedNonDesignatedRegime: { classification: 'non-designated-beneficiary', schedule: 'five-year',
        provenance: { source: 'Verified estate and pre-RBD death', asOf: '2026-12-31' } } }, 10000)
    const result = run(plan, 2031)
    for (const calendarYear of [2027, 2028, 2029, 2030]) {
      expect(evidence(result, calendarYear)).toMatchObject({ regime: 'non-designated-five-year',
        requiredAmount: 0, executedRequiredAmount: 0 })
      expect(year(result, calendarYear).inheritedDistribution).toBe(0)
    }
    expect(evidence(result, 2031)).toMatchObject({ requiredAmount: 10000, executedRequiredAmount: 10000 })
  })
  it('refuses an unknown trust and contradictory post-RBD five-year assertion without a fabricated schedule', () => {
    for (const verified of [false, true]) {
      const plan = planFor(1966)
      inherited(plan, 'traditional', { ownerDeathYear: 2021, ownerDeathDate: '2021-06-01',
        decedentHadStartedRmds: verified,
        beneficiary: facts({ beneficiaryClass: 'trust', ownerBirthYear: 1940 }),
        ...(verified ? { verifiedNonDesignatedRegime: { classification: 'non-designated-beneficiary' as const,
          schedule: 'five-year' as const, provenance: { source: 'Asserted regime contradicts post-RBD death', asOf: '2026-01-01' } } } : {}) }, 10000)
      if (verified) {
        const parsed = parsePlan(plan)
        expect(parsed.ok).toBe(false)
        if (!parsed.ok) expect(parsed.issues.join(' ')).toMatch(/pre-RBD|decedentHadStartedRmds/)
        continue
      }
      const result = run(plan, 2026)
      expect(evidence(result, 2026)).toMatchObject({ matrixRow: 'X3', requirementKind: 'none',
        executedRequiredAmount: 0, limitation: 'non-designated-schedule-not-established' })
      expect(evidence(result, 2026).refusalReason).toBeDefined()
      expect(year(result, 2026).inheritedDistribution).toBe(0)
    }
  })
})


it('publishes a midyear executed spouse redesignation through the year-end gate while preserving opening cash routing', () => {
  const plan = planFor(1947)
  inherited(plan, 'traditional', { ownerDeathYear: 2024, decedentHadStartedRmds: true,
    beneficiary: facts({ beneficiaryBirthYear: 1947, ownerBirthYear: 1945,
      edbCategory: 'surviving-spouse', election: 'none', spouseUnlimitedWithdrawalRight: true,
      ownerYearOfDeathRmdSatisfied: true }) }, 100000)
  observedElection(plan, '2026-06-30', '2024-06-01', [2025])
  const result = run(plan, 2027)
  expect(year(result, 2026).spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: false })
  expect(year(result, 2026).inheritedDistribution).toBeGreaterThan(0)
  expect(year(result, 2026).spousalElectionAtYearEnd).toContainEqual(expect.objectContaining({
    accountId: 'inherited', status: 'evaluated', ownerTreatment: true,
  }))
  // Section1.408-8(c)(3): annual opening cash alone cannot certify the
  // election-year owner's RMD once a later executed act changes treatment.
  expect(year(result, 2026).taxComputation?.status).toBe('incomplete')
  expect(year(result, 2026).taxComputation?.issues).toContainEqual(expect.objectContaining({
    code: 'incomplete-spousal-election-mixed-year', year: 2026,
  }))
  expect(result.warnings).toContainEqual(expect.stringContaining(
    'inherited: ownership became effective during the year; the annual opening-beneficiary cash schedule does not resolve election-year owner RMD and tax ordering.',
  ))
  expect(year(result, 2027).spousalOwnerTreatment).toContainEqual({ accountId: 'inherited', ownerTreatment: true })
  expect(year(result, 2027).inheritedDistribution).toBe(0)
})


describe('asserted completed-deadline Plan evidence reaches the annual tax ledger', () => {
  function completedPlan(openingBenefit: number | 'unknown' = 10000, observedAsOfDate = '2027-12-31') {
    const plan = planFor(1966)
    inherited(plan, 'traditional', { ownerDeathYear: 2021, ownerDeathDate: '2021-06-01',
      decedentHadStartedRmds: false,
      beneficiary: facts({ beneficiaryClass: 'estate', ownerBirthYear: 1960 }),
      verifiedNonDesignatedRegime: { classification: 'non-designated-beneficiary', schedule: 'five-year',
        provenance: { source: 'Verified estate designation and pre-RBD owner death', asOf: '2027-12-31' } },
      completedDeadlineObservation: { taxYear: 2027, openingBenefit, distributedByDeadline: 0,
        legalDistributionDeadline: '2027-12-31', observedAsOfDate,
        provenance: { source: 'Custodian completed-year statement:10000 retained, no distribution', asOf: '2027-12-31' } },
    }, 10000)
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    return parsed.plan
  }
  it('assesses2500 or1000 after legal correction without replaying cash or ordinary income', () => {
    const applicablePlan: RmdApplicablePlan = { kind: 'inheritedIraAccount', payeePersonId: 'beneficiary', accountId: 'inherited' }
    const obligationId = rmdShortfallObligationId(applicablePlan, 2027)
    for (const corrected of [false, true]) {
      const taxInputs: TaxYearInput[] = []
      const result = simulatePlan(completedPlan(), { startYear: 2027, horizonEndYear: 2027,
        taxCalculator: { compute(input) { taxInputs.push(input); return 0 } },
        ...(corrected ? { rmdShortfallReliefElections: [{ obligationId, correctiveDistribution: {
          amount: 10000, receivedOn: '2028-03-01', sourceApplicablePlan: applicablePlan,
          form5329FiledOn: '2028-04-01', returnReflectsReducedTax: true,
        } }] } : {}),
      })
      const annual = year(result, 2027)
      expect(annual.inheritedDistribution).toBe(0)
      expect(annual.withdrawals.traditional).toBe(0)
      expect(annual.rmdShortfallExciseTax).toBe(corrected ? 1000 : 2500)
      expect(taxInputs.at(-1)?.ordinaryIncome).toBe(0)
      expect(annual.balances.inherited).toBe(10000)
    }
  })
  it('publishes incomplete history instead of certifying an unknown or premature observation', () => {
    for (const plan of [completedPlan('unknown'), completedPlan(10000, '2027-12-30')]) {
      const result = simulatePlan(plan, { startYear: 2027, horizonEndYear: 2027, taxCalculator: noTax })
      expect(year(result, 2027).inheritedDistribution).toBe(0)
      expect(evidence(result, 2027).limitation).toBeDefined()
      expect(result.warnings.join(' ')).toMatch(/deadline|AnnualHistory|observation/i)
    }
  })
})
