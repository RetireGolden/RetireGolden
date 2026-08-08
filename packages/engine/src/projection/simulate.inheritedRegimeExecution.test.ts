import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { packForYear } from '../params/index.js'
import { createFlatTaxCalculator } from './flatTax.js'
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
  const result = simulatePlan(parsed.plan, {
    startYear: 2026,
    horizonEndYear,
    taxCalculator: { compute(input: TaxYearInput) { ordinaryIncome.push(input.ordinaryIncome); return 0 } },
  })
  return { result, ordinaryIncome }
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
    const result = run(plan, 2028)
    expect(evidence(result, 2026).executedRequiredAmount).toBeCloseTo(300_000 / 11.9, 2)
    expect(evidence(result, 2027).executedRequiredAmount).toBeCloseTo(year(result, 2026).balances.inherited! / 11.2, 2)
    expect(year(result, 2028).inheritedDistribution).toBe(0)
    expect(year(result, 2028).rmd).toBeCloseTo(year(result, 2027).balances.inherited! / 19.4, 2)
    expect(evidence(result, 2028).requirementKind).toBe('none')
  })

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
    const result = run(plan, 2027)
    const y2026 = year(result, 2026)
    const e2026 = evidence(result, 2026)
    expect(e2026.requirementKind).toBe('year-of-death-rmd')
    expect(e2026.divisor).toBe(19.4)
    expect(e2026.executedRequiredAmount).toBeCloseTo(300_000 / 19.4, 2)
    expect(y2026.inheritedDistribution).toBeCloseTo(300_000 / 19.4, 2)
    // No owner RMD aggregation for this account in the flip/death year.
    expect(y2026.rmd).toBe(0)
    // Following year: owner-side treatment (spouse age 80 in 2027 → ULT 20.2).
    const y2027 = year(result, 2027)
    expect(y2027.inheritedDistribution).toBe(0)
    expect(evidence(result, 2027).requirementKind).toBe('none')
    expect(y2027.rmd).toBeCloseTo(year(result, 2026).balances.inherited! / 20.2, 2)
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

  it('E7: falls back to the legacy schedule for an estate and labels the refusal', () => {
    const plan = planFor(1995)
    inherited(plan, 'traditional', {
      ownerDeathYear: 2022, decedentHadStartedRmds: true,
      beneficiary: { beneficiaryClass: 'estate', provenance: { source: 'test', asOf: '2026-01-01' } },
    })
    const result = run(plan, 2026)
    const e = evidence(result, 2026)
    expect(e.requirementKind).toBe('legacy')
    expect(e.refusalReason).toMatch(/estate|unsupported/i)
    expect(e.executedRequiredAmount).toBeGreaterThan(0)
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
    const result = run(plan, 2030)
    for (let calendarYear = 2026; calendarYear < 2030; calendarYear++) {
      const e = evidence(result, calendarYear)
      expect(e.requirementKind).toBe('legacy')
      expect(e.regime).toBe('needs-review')
      expect(e.matrixRow).toBe('X5')
      expect(e.refusalReason).toMatch(/1959|applicable age|contested/i)
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
          beneficiary: facts({ beneficiaryBirthYear: 1980, roth5YearStartYear: 2010 }),
        }, 100_000)
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
