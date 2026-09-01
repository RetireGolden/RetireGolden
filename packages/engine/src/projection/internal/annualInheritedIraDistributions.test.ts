import { describe, expect, it } from 'vitest'

import type {
  Account,
  InheritedAccount,
  InheritedBeneficiary,
} from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { classifyInheritedRegime } from '../../strategies/inheritedIra.js'
import {
  annualInheritedIraDistributions,
  type AnnualInheritedIraClassCacheEntry,
} from './annualInheritedIraDistributions.js'
import { AnnualLogicalBalanceLedger } from './annualLogicalBalanceLedger.js'

const YEAR = 2026
const provenance = { source: 'test', asOf: '2026-01-01' }

function beneficiary(
  overrides: Partial<InheritedBeneficiary> = {},
): InheritedBeneficiary {
  return {
    beneficiaryClass: 'designated-individual',
    edbCategory: 'none',
    beneficiaryBirthYear: 1965,
    soleBeneficiary: true,
    election: 'none',
    ownerBirthYear: 1940,
    ownerYearOfDeathRmdSatisfied: true,
    provenance,
    ...overrides,
  }
}

function inherited(
  ownerDeathYear: number,
  decedentHadStartedRmds: boolean,
  facts: InheritedBeneficiary | undefined,
  decedentId?: string,
): InheritedAccount {
  return {
    ownerDeathYear,
    decedentHadStartedRmds,
    ...(facts === undefined ? {} : { beneficiary: facts }),
    ...(decedentId === undefined ? {} : { decedentId }),
  }
}

function account(
  id: string,
  type: 'traditional' | 'roth',
  inheritedFacts: InheritedAccount,
  balance: number,
): Extract<Account, { type: 'traditional' | 'roth' }> {
  return {
    type,
    id,
    name: id,
    ownerPersonId: 'beneficiary',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    inherited: inheritedFacts,
  }
}

function classEntry(
  value: Extract<Account, { type: 'traditional' | 'roth' }>,
): AnnualInheritedIraClassCacheEntry {
  if (value.inherited === undefined) throw new Error('expected inherited account')
  const primary = classifyInheritedRegime({
    accountType: value.type,
    accountKind: value.kind,
    inherited: value.inherited,
  })
  if (primary.kind === 'refusal') {
    return {
      accountId: value.id,
      accountType: value.type,
      ownerPersonId: value.ownerPersonId ?? 'beneficiary',
      path: 'legacy',
      ...(primary.refusal === 'legacy-planning-approximation'
        ? {}
        : { refusalReason: primary.reason }),
      primary,
      isS2: false,
    }
  }
  if (primary.regime === 'spouse-treat-as-own-transition') {
    const synthetic = classifyInheritedRegime({
      accountType: value.type,
      accountKind: value.kind,
      inherited: {
        ...value.inherited,
        beneficiary: value.inherited.beneficiary === undefined
          ? undefined
          : {
              ...value.inherited.beneficiary,
              election: 'none',
              treatAsOwnElectionYear: undefined,
            },
      },
    })
    if (synthetic.kind === 'refusal') {
      return {
        accountId: value.id,
        accountType: value.type,
        ownerPersonId: value.ownerPersonId ?? 'beneficiary',
        path: 'legacy',
        refusalReason: synthetic.reason,
        primary,
        isS2: true,
        treatAsOwnElectionYear:
          value.inherited.beneficiary?.treatAsOwnElectionYear,
      }
    }
    return {
      accountId: value.id,
      accountType: value.type,
      ownerPersonId: value.ownerPersonId ?? 'beneficiary',
      path: 'classified',
      primary,
      schedule: synthetic,
      isS2: true,
      treatAsOwnElectionYear:
        value.inherited.beneficiary?.treatAsOwnElectionYear,
    }
  }
  return {
    accountId: value.id,
    accountType: value.type,
    ownerPersonId: value.ownerPersonId ?? 'beneficiary',
    path: 'classified',
    primary,
    schedule: primary,
    isS2: false,
  }
}

function run(input: {
  year?: number
  startYear?: number
  balances: readonly { account: Readonly<Account>; balance: number }[]
  classEntries: readonly AnnualInheritedIraClassCacheEntry[]
  startOfYear?: readonly (readonly [string, number])[]
  alive?: boolean
}) {
  const year = input.year ?? YEAR
  return annualInheritedIraDistributions({
    year,
    startYear: input.startYear ?? YEAR,
    pack: packForYear(year).pack,
    primaryPersonId: 'beneficiary',
    balances: input.balances,
    startOfYearBalance: new Map(input.startOfYear ??
      input.balances.map(({ account, balance }) => [account.id, balance])),
    classCache: new Map(input.classEntries.map((entry) => [entry.accountId, entry])),
    beneficiaryState: () => ({
      alive: input.alive ?? true,
      ageAttained: year - 1965,
    }),
  })
}

describe('annualInheritedIraDistributions', () => {
  it('keeps the registered legacy refusal path on its fixed Single Life walk-back', () => {
    const facts = inherited(2019, true, undefined)
    const legacy = account('legacy', 'traditional', facts, 120_000)
    const entry = classEntry(legacy)
    expect(entry.path).toBe('legacy')
    const result = run({
      balances: [{ account: legacy, balance: 120_000 }],
      classEntries: [entry],
    })
    // Treas. Reg. §1.401(a)(9)-5(d)(3)(i), (iii) supplies the Single Life
    // Table and fixed subtract-one method. The beneficiary is age 55 in the
    // first distribution year (2020): 31.6, less six elapsed years = 25.6.
    // The labeled legacy approximation deliberately omits the separate
    // §1.401(a)(9)-5(d)(1)(ii) employee-life-expectancy greater-of arm.
    // This independent worksheet rejects Uniform Lifetime, recalculated
    // Single Life, and ten-year-only fallback readings.
    const expected = 120_000 / 25.6

    expect(result.rows[0]?.evidence).toMatchObject({
      regime: 'legacy-planning-approximation',
      matrixRow: 'X1',
      requirementKind: 'legacy',
      requiredAmount: expected,
      executedRequiredAmount: expected,
    })
    expect(result.rows[0]?.distribution).toMatchObject({
      sourceBalanceBefore: 120_000,
      sourceBalanceAfter: 120_000 - expected,
      executed: expected,
    })
  })

  it('plans classified traditional movement and applicable-plan obligation without mutating input', () => {
    const facts = inherited(2022, true, beneficiary(), 'decedent')
    const inheritedAccount = account('inherited', 'traditional', facts, 300_000)
    const balances = [
      { account: inheritedAccount, balance: 300_000 },
      {
        account: {
          type: 'cash', id: 'cash', name: 'cash', ownerPersonId: null,
          annualReturnPct: 0, balance: 10, annualContribution: 0,
        } as Account,
        balance: 10,
      },
    ]
    const before = balances.map(({ balance }) => balance)

    const result = run({
      balances,
      classEntries: [classEntry(inheritedAccount)],
    })

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]!
    // Treas. Reg. §1.401(a)(9)-5(d)(1)(ii) requires the greater of the
    // beneficiary and employee life-expectancy arms. Under (d)(3)(i), (iii),
    // the beneficiary was 58 in the first distribution year (2023): the
    // Single Life Table entry is 28.9, reduced by three elapsed years to 25.9.
    // Under (d)(3)(ii), the owner was 82 in the death year: 9.9 reduced by four
    // elapsed years is 5.9. The greater divisor is therefore independently
    // fixed at 25.9, making the 2026 amount exactly this worksheet result.
    const expected = 300_000 / 25.9
    expect(row.balanceIndex).toBe(0)
    expect(row.evidence).toMatchObject({
      accountId: 'inherited',
      matrixRow: 'R1',
      requirementKind: 'annual-rmd',
      divisor: 25.9,
      divisorArm: 'beneficiary-fixed',
      requiredAmount: expected,
      executedRequiredAmount: expected,
      voluntaryAmount: 0,
    })
    expect(row.distribution).toEqual({
      balanceIndex: 0,
      accountId: 'inherited',
      ownerPersonId: 'beneficiary',
      sourceBalanceBefore: 300_000,
      sourceBalanceAfter: 300_000 - expected,
      executed: expected,
    })
    expect(result.totals).toEqual({
      inherited: expected,
      ordinaryIncome: expected,
      rothForced: 0,
    })
    expect(result.rmdShortfallObligations).toEqual([{
      obligationId:
        'rmd-shortfall:["inherited-iras","beneficiary","decedent","traditional"]:2026:tax-2026',
      distributionCalendarYear: 2026,
      taxYear: 2026,
      taxImposedOn: '2026-12-31',
      applicablePlan: {
        kind: 'inheritedIras',
        payeePersonId: 'beneficiary',
        decedentId: 'decedent',
        iraType: 'traditional',
      },
      requirementKind: 'inheritedAnnualLifeExpectancy',
      requiredAmount: expected,
      distributedByDeadline: expected,
    }])
    expect(balances.map(({ balance }) => balance)).toEqual(before)
  })

  it('plans one logical distribution for compatible duplicate physical rows', () => {
    const facts = inherited(2022, true, beneficiary(), 'shared-decedent')
    const first = account('duplicate', 'traditional', facts, 100_000)
    const second = account('duplicate', 'traditional', facts, 200_000)
    const entry = classEntry(second)
    const physical = [
      { account: first, balance: 100_000, costBasis: 0 },
      { account: second, balance: 200_000, costBasis: 0 },
    ]
    const ledger = new AnnualLogicalBalanceLedger(physical)
    const logical = ledger.liveStates()
    const result = run({
      balances: logical,
      classEntries: [entry],
      startOfYear: [['duplicate', 300_000]],
    })

    expect(result.rows.map((row) => row.balanceIndex)).toEqual([0])
    expect(result.rows.map((row) => row.distribution?.sourceBalanceBefore))
      .toEqual([300_000])
    const executed = result.rows[0]!.evidence.executedRequiredAmount
    expect(result.totals.inherited).toBe(executed)
    expect(result.rmdShortfallObligations).toHaveLength(1)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      requiredAmount: result.rows[0]!.evidence.requiredAmount,
      distributedByDeadline: executed,
    })
    expect(physical.map((row) => row.balance)).toEqual([100_000, 200_000])

    logical[0]!.balance = result.rows[0]!.distribution!.sourceBalanceAfter
    expect(physical[0]!.balance + physical[1]!.balance)
      .toBe(300_000 - executed)
    expect(physical[0]!.balance / physical[1]!.balance).toBeCloseTo(0.5, 12)
  })

  it('rejects repeated logical IDs instead of planning physical aliases twice', () => {
    const facts = inherited(2022, true, beneficiary(), 'shared-decedent')
    const duplicate = account('duplicate', 'traditional', facts, 100_000)
    expect(() => run({
      balances: [
        { account: duplicate, balance: 100_000 },
        { account: duplicate, balance: 100_000 },
      ],
      classEntries: [classEntry(duplicate)],
    })).toThrow(
      'annual inherited-IRA input repeated logical account id "duplicate"',
    )
  })

  it('left-folds large final sweeps in balance order without regrouping', () => {
    const facts = inherited(2022, false, beneficiary({
      beneficiaryBirthYear: 1980,
      ownerBirthYear: 1960,
    }), 'fp-decedent')
    const large = account('large', 'traditional', facts, 90_000_000_000_000)
    const smallA = account('small-a', 'traditional', facts, 0.01)
    const smallB = account('small-b', 'traditional', facts, 0.01)
    const result = run({
      year: 2032,
      startYear: 2026,
      balances: [
        { account: large, balance: large.balance },
        { account: smallA, balance: smallA.balance },
        { account: smallB, balance: smallB.balance },
      ],
      classEntries: [
        classEntry(large),
        classEntry(smallA),
        classEntry(smallB),
      ],
    })
    const ordered = [90_000_000_000_000, 0.01, 0.01]
    const leftAssociated = ordered.reduce(
      (total, amount) => total + amount,
      0,
    )
    const regrouped = ordered[0]! + (ordered[1]! + ordered[2]!)

    expect(leftAssociated).not.toBe(regrouped)
    expect(result.rows.map((row) => ({
      accountId: row.accountId,
      kind: row.evidence.requirementKind,
      executed: row.distribution?.executed,
    }))).toEqual([
      { accountId: 'large', kind: 'final-sweep', executed: ordered[0] },
      { accountId: 'small-a', kind: 'final-sweep', executed: ordered[1] },
      { accountId: 'small-b', kind: 'final-sweep', executed: ordered[2] },
    ])
    expect(result.totals.inherited).toBe(leftAssociated)
    expect(result.totals.ordinaryIncome).toBe(leftAssociated)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      applicablePlan: {
        kind: 'inheritedIras',
        decedentId: 'fp-decedent',
        iraType: 'traditional',
      },
      requiredAmount: leftAssociated,
      distributedByDeadline: leftAssociated,
    })
  })

  it('keeps applicable-plan identity, first-seen order, and mixed kinds exact', () => {
    const sharedFacts = inherited(
      2022,
      false,
      beneficiary({ beneficiaryBirthYear: 1980, ownerBirthYear: 1960 }),
      'shared',
    )
    const legacyFacts = inherited(2022, true, undefined, 'shared')
    const classified = account('classified', 'traditional', sharedFacts, 100)
    const legacy = account('legacy-shared', 'traditional', legacyFacts, 100)
    const roth = account('roth-shared', 'roth', sharedFacts, 100)
    const noDecedent = account(
      'no-decedent',
      'traditional',
      inherited(2022, false, beneficiary({
        beneficiaryBirthYear: 1980,
        ownerBirthYear: 1960,
      })),
      100,
    )
    const employer = {
      ...account('employer', 'traditional', legacyFacts, 100),
      kind: 'employer' as const,
    }
    const result = run({
      year: 2032,
      startYear: 2026,
      balances: [classified, legacy, roth, noDecedent, employer].map(
        (value) => ({ account: value, balance: value.balance }),
      ),
      classEntries: [classified, legacy, roth, noDecedent, employer].map(
        classEntry,
      ),
    })

    expect(result.rmdShortfallObligations.map((obligation) => ({
      plan: obligation.applicablePlan,
      kind: obligation.requirementKind,
    }))).toEqual([
      {
        plan: {
          kind: 'inheritedIras',
          payeePersonId: 'beneficiary',
          decedentId: 'shared',
          iraType: 'traditional',
        },
        kind: 'mixedInheritedRequirements',
      },
      {
        plan: {
          kind: 'inheritedIras',
          payeePersonId: 'beneficiary',
          decedentId: 'shared',
          iraType: 'roth',
        },
        kind: 'inheritedFinalSweep',
      },
      {
        plan: {
          kind: 'inheritedIraAccount',
          payeePersonId: 'beneficiary',
          accountId: 'no-decedent',
        },
        kind: 'inheritedFinalSweep',
      },
      {
        plan: {
          kind: 'inheritedEmployerPlan',
          payeePersonId: 'beneficiary',
          accountId: 'employer',
        },
        kind: 'inheritedLegacy',
      },
    ])
  })

  it('discharges a sub-cent Roth final sweep and settles its Roth-specific obligation', () => {
    const facts = inherited(2022, false, beneficiary({
      beneficiaryBirthYear: 1980,
      roth5YearStartYear: 2010,
    }), 'roth-decedent')
    const inheritedRoth = account('roth-dust', 'roth', facts, 0.004)
    const result = run({
      year: 2032,
      startYear: 2026,
      balances: [{ account: inheritedRoth, balance: 0.004 }],
      classEntries: [classEntry(inheritedRoth)],
      startOfYear: [['roth-dust', 0.004]],
    })

    expect(result.rows[0]?.evidence).toMatchObject({
      requirementKind: 'final-sweep',
      requiredAmount: 0.004,
      executedRequiredAmount: 0,
    })
    expect(result.rows[0]?.distribution).toBeNull()
    expect(result.totals).toEqual({
      inherited: 0,
      ordinaryIncome: 0,
      rothForced: 0,
    })
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      applicablePlan: { iraType: 'roth' },
      requirementKind: 'inheritedFinalSweep',
      requiredAmount: 0.004,
      distributedByDeadline: 0.004,
    })
  })

  it('keeps three zero-cent account residues as an aggregate plan shortfall', () => {
    const facts = inherited(2022, false, beneficiary({
      beneficiaryBirthYear: 1980,
      roth5YearStartYear: 2010,
    }), 'shared-roth-decedent')
    const accounts = ['dust-a', 'dust-b', 'dust-c'].map((id) =>
      account(id, 'roth', facts, 0.004))
    const result = run({
      year: 2032,
      startYear: 2026,
      balances: accounts.map((value) => ({ account: value, balance: 0.004 })),
      classEntries: accounts.map(classEntry),
      startOfYear: accounts.map((value) => [value.id, 0.004] as const),
    })

    expect(result.rows.map((row) => row.distribution)).toEqual([
      null,
      null,
      null,
    ])
    expect(result.rmdShortfallObligations).toHaveLength(1)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      applicablePlan: {
        kind: 'inheritedIras',
        decedentId: 'shared-roth-decedent',
        iraType: 'roth',
      },
      requiredAmount: 0.012,
      distributedByDeadline: 0,
    })
  })

  it('discharges only the zero-cent remainder of an aggregate plan shortfall', () => {
    const facts = inherited(2022, false, beneficiary({
      beneficiaryBirthYear: 1980,
      roth5YearStartYear: 2010,
    }), 'mixed-cent-roth-decedent')
    const moved = account('moved-cent', 'roth', facts, 0.01)
    const dust = account('zero-cent-dust', 'roth', facts, 0.004)
    const result = run({
      year: 2032,
      startYear: 2026,
      balances: [moved, dust].map((value) => ({
        account: value,
        balance: value.balance,
      })),
      classEntries: [moved, dust].map(classEntry),
      startOfYear: [
        ['moved-cent', 0.01],
        ['zero-cent-dust', 0.004],
      ],
    })

    expect(result.rows.map((row) => row.distribution?.executed ?? 0)).toEqual([
      0.01,
      0,
    ])
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      requiredAmount: 0.014,
      distributedByDeadline: 0.014,
    })
  })

  it('keeps an executed inherited Roth sweep out of ordinary income', () => {
    const facts = inherited(2022, false, beneficiary({
      beneficiaryBirthYear: 1980,
      roth5YearStartYear: 2010,
    }), 'roth-decedent')
    const inheritedRoth = account('roth-sweep', 'roth', facts, 100)
    const result = run({
      year: 2032,
      startYear: 2026,
      balances: [{ account: inheritedRoth, balance: 100 }],
      classEntries: [classEntry(inheritedRoth)],
    })

    expect(result.rows[0]?.distribution?.executed).toBe(100)
    expect(result.totals).toEqual({
      inherited: 100,
      ordinaryIncome: 0,
      rothForced: 100,
    })
  })

  it('publishes the successor-clock row before any post-election owner-side row', () => {
    const facts = inherited(2024, true, beneficiary({
      edbCategory: 'surviving-spouse',
      election: 'treat-as-own',
      spouseUnlimitedWithdrawalRight: true,
      treatAsOwnElectionYear: 2026,
    }))
    const spouse = account('spouse', 'traditional', facts, 100_000)
    const result = run({
      balances: [{ account: spouse, balance: 100_000 }],
      classEntries: [classEntry(spouse)],
      alive: false,
    })

    expect(result.rows[0]?.evidence).toMatchObject({
      matrixRow: 'S2',
      requirementKind: 'none',
      disclosures: ['successor-clock-out-of-scope'],
    })
    expect(result.rows[0]?.distribution).toBeNull()
    expect(result.rmdShortfallObligations).toEqual([])
  })

  it('keeps the unsatisfied death-year RMD ahead of the S2 ownership flip', () => {
    // Treas. Reg. 1.408-8(c)(3) retains the decedent's unsatisfied death-year
    // RMD. Because the sole surviving spouse is 25 years younger, Treas. Reg.
    // 1.401(a)(9)-5(c)(2)(i) selects the Joint and Last Survivor Table; its
    // age-86/61 cell is 26.6, so the independent worksheet is 100,000 / 26.6.
    const facts = inherited(2026, true, beneficiary({
      edbCategory: 'surviving-spouse',
      election: 'treat-as-own',
      spouseUnlimitedWithdrawalRight: true,
      treatAsOwnElectionYear: 2026,
      ownerYearOfDeathRmdSatisfied: false,
    }))
    const spouse = account('same-year-spouse', 'traditional', facts, 100_000)
    const result = run({
      balances: [{ account: spouse, balance: 100_000 }],
      classEntries: [classEntry(spouse)],
    })

    expect(result.rows[0]?.evidence).toMatchObject({
      matrixRow: 'S2',
      requirementKind: 'year-of-death-rmd',
      classification: 'settled',
      divisor: 26.6,
      divisorArm: 'joint-life',
    })
    expect(result.rows[0]?.distribution?.executed).toBe(100_000 / 26.6)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      requirementKind: 'inheritedYearOfDeath',
    })

    const followingYear = run({
      year: 2027,
      balances: [{ account: spouse, balance: 100_000 }],
      classEntries: [classEntry(spouse)],
    })
    expect(followingYear.rows[0]?.evidence).toMatchObject({
      matrixRow: 'S2',
      requirementKind: 'none',
      requiredAmount: 0,
      executedRequiredAmount: 0,
    })
    expect(followingYear.rows[0]?.distribution).toBeNull()
    expect(followingYear.rmdShortfallObligations).toEqual([])
  })
})
