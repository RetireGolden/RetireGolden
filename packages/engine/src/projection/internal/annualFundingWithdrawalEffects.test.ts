import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import type { RothBasisState } from '../../strategies/rothBasis.js'
import {
  annualFundingWithdrawalEffects,
  type AnnualFundingWithdrawalEffectAccount,
} from './annualFundingWithdrawalEffects.js'

type TraditionalAccount = Extract<Account, { type: 'traditional' }>

const traditionalAccount = (
  id: string,
  kind: TraditionalAccount['kind'] = 'ira',
  inherited = false,
): TraditionalAccount => ({
  type: 'traditional',
  id,
  name: id,
  ownerPersonId: 'p1',
  annualReturnPct: 0,
  kind,
  balance: 1_000,
  annualContribution: 0,
  ...(inherited
    ? {
        inherited: {
          ownerDeathYear: 2024,
          decedentHadStartedRmds: false,
        },
      }
    : {}),
})

const run = (
  accounts: readonly AnnualFundingWithdrawalEffectAccount[],
  withdrawalsByAccountId: ReadonlyMap<string, number>,
  overrides: Readonly<{
    traditionalTaxableByAccountId?: ReadonlyMap<string, number>
    rothBasisByPool?: ReadonlyMap<string, RothBasisState>
    year?: number
    hsaQualifiedCap?: number
  }> = {},
) => annualFundingWithdrawalEffects({
  accounts,
  withdrawalsByAccountId,
  traditionalTaxableByAccountId:
    overrides.traditionalTaxableByAccountId ?? new Map(),
  rothBasisByPool: overrides.rothBasisByPool ?? new Map(),
  year: overrides.year ?? 2026,
  hsaQualifiedCap: overrides.hsaQualifiedCap ?? 0,
})

describe('annualFundingWithdrawalEffects', () => {
  it('penalizes only taxable traditional dollars and applies inherited, S2, and Rule-of-55 identity', () => {
    const inherited = traditionalAccount('inherited', 'ira', true)
    const accounts: AnnualFundingWithdrawalEffectAccount[] = [
      {
        kind: 'traditional',
        sourceAccountId: 'owned-ira',
        account: traditionalAccount('owned-ira'),
        ownerAgeAttained: 50,
        ownerRetirementAge: null,
        treatAsOwnEffective: false,
      },
      {
        kind: 'traditional',
        sourceAccountId: 'employer-55',
        account: traditionalAccount('employer-55', 'employer'),
        ownerAgeAttained: 56,
        ownerRetirementAge: 55,
        treatAsOwnEffective: false,
      },
      {
        kind: 'traditional',
        sourceAccountId: 'inherited',
        account: inherited,
        ownerAgeAttained: 50,
        ownerRetirementAge: null,
        treatAsOwnEffective: false,
      },
      {
        kind: 'traditional',
        sourceAccountId: 's2-owned',
        account: { ...inherited, id: 's2-owned', name: 's2-owned' },
        ownerAgeAttained: 50,
        ownerRetirementAge: null,
        treatAsOwnEffective: true,
      },
    ]

    const result = run(
      accounts,
      new Map([
        ['owned-ira', 100],
        ['employer-55', 100],
        ['inherited', 100],
        ['s2-owned', 100],
      ]),
      {
        traditionalTaxableByAccountId: new Map([
          ['owned-ira', 60],
          ['s2-owned', 40],
        ]),
      },
    )

    expect(result.traditional).toEqual({
      rows: [
        { sourceAccountId: 'owned-ira', amount: 6 },
        { sourceAccountId: 's2-owned', amount: 4 },
      ],
      penalty: 10,
    })
    expect(result.penaltyExcludingRmdShortfallExcise).toBe(10)
  })

  it('allocates one HSA medical cap in account order and preserves legacy treatment', () => {
    const accounts: AnnualFundingWithdrawalEffectAccount[] = [
      {
        kind: 'hsa',
        sourceAccountId: 'cap-first',
        withdrawalTreatment: 'capByMedicalExpenses',
        ownerAgeAttained: 50,
      },
      {
        kind: 'hsa',
        sourceAccountId: 'cap-second',
        withdrawalTreatment: 'capByMedicalExpenses',
        ownerAgeAttained: 50,
      },
      {
        kind: 'hsa',
        sourceAccountId: 'qualified',
        withdrawalTreatment: 'assumeAllQualified',
        ownerAgeAttained: 50,
      },
      {
        kind: 'hsa',
        sourceAccountId: 'legacy',
        withdrawalTreatment: undefined,
        ownerAgeAttained: 50,
      },
      {
        kind: 'hsa',
        sourceAccountId: 'legacy-65',
        withdrawalTreatment: undefined,
        ownerAgeAttained: 65,
      },
    ]

    const result = run(
      accounts,
      new Map([
        ['cap-first', 70],
        ['cap-second', 50],
        ['qualified', 10],
        ['legacy', 10],
        ['legacy-65', 10],
      ]),
      { hsaQualifiedCap: 100 },
    )

    expect(result.hsa.rows).toEqual([
      {
        sourceAccountId: 'cap-first',
        taken: 70,
        qualified: 70,
        nonQualified: 0,
        taxableOrdinary: 0,
        penalty: 0,
        capConsumed: 70,
      },
      {
        sourceAccountId: 'cap-second',
        taken: 50,
        qualified: 30,
        nonQualified: 20,
        taxableOrdinary: 20,
        penalty: 4,
        capConsumed: 30,
      },
      {
        sourceAccountId: 'qualified',
        taken: 10,
        qualified: 10,
        nonQualified: 0,
        taxableOrdinary: 0,
        penalty: 0,
        capConsumed: 0,
      },
      {
        sourceAccountId: 'legacy',
        taken: 10,
        qualified: 10,
        nonQualified: 0,
        taxableOrdinary: 0,
        penalty: 2,
        capConsumed: 0,
      },
      {
        sourceAccountId: 'legacy-65',
        taken: 10,
        qualified: 10,
        nonQualified: 0,
        taxableOrdinary: 0,
        penalty: 0,
        capConsumed: 0,
      },
    ])
    expect(result.hsa).toMatchObject({
      taxableOrdinary: 20,
      penalty: 6,
      qualified: 130,
      nonQualified: 20,
      capConsumed: 100,
    })
  })

  it('aggregates Roth accounts by first-seen pool and splits one ordered withdrawal', () => {
    const basis: RothBasisState = {
      contributionBasis: 100,
      conversionLayers: [{ year: 2024, amount: 50, taxableAmount: 40 }],
    }
    const accounts: AnnualFundingWithdrawalEffectAccount[] = [
      {
        kind: 'roth',
        sourceAccountId: 'roth-a',
        poolKey: 'rothira:p1',
        ownerAgeAttained: 50,
      },
      {
        kind: 'roth',
        sourceAccountId: 'inherited-roth',
        poolKey: null,
        ownerAgeAttained: 50,
      },
      {
        kind: 'roth',
        sourceAccountId: 'roth-b',
        poolKey: 'rothira:p1',
        ownerAgeAttained: 50,
      },
      {
        kind: 'roth',
        sourceAccountId: 'missing-basis',
        poolKey: 'roth:missing',
        ownerAgeAttained: 50,
      },
    ]
    const originalBasis = structuredClone(basis)

    const result = run(
      accounts,
      new Map([
        ['roth-a', 120],
        ['inherited-roth', 999],
        ['roth-b', 80],
        ['missing-basis', 25],
      ]),
      { rothBasisByPool: new Map([['rothira:p1', basis]]) },
    )

    expect(result.roth.rows.map((row) => row.poolKey)).toEqual([
      'rothira:p1',
      'roth:missing',
    ])
    expect(result.roth.rows[0]).toEqual({
      poolKey: 'rothira:p1',
      taken: 200,
      ownerAgeAttained: 50,
      split: {
        contributions: 100,
        conversions: 50,
        earnings: 50,
        penalty: 9,
        taxableOrdinary: 50,
        next: { contributionBasis: 0, conversionLayers: [] },
      },
    })
    expect(result.roth.rows[1]).toEqual({
      poolKey: 'roth:missing',
      taken: 25,
      ownerAgeAttained: 50,
      split: null,
    })
    expect(result.roth).toMatchObject({ taxableOrdinary: 50, penalty: 9 })
    expect(result.penaltyExcludingRmdShortfallExcise).toBe(9)
    expect(basis).toEqual(originalBasis)
  })

  it('ignores zero and negative candidate rows without mutating caller maps', () => {
    const withdrawals = new Map([
      ['zero', 0],
      ['negative', -10],
    ])
    const taxable = new Map([['negative', 8]])
    const beforeWithdrawals = [...withdrawals]
    const beforeTaxable = [...taxable]

    const result = annualFundingWithdrawalEffects({
      accounts: [
        {
          kind: 'traditional',
          sourceAccountId: 'zero',
          account: traditionalAccount('zero'),
          ownerAgeAttained: 50,
          ownerRetirementAge: null,
          treatAsOwnEffective: false,
        },
        {
          kind: 'traditional',
          sourceAccountId: 'negative',
          account: traditionalAccount('negative'),
          ownerAgeAttained: 50,
          ownerRetirementAge: null,
          treatAsOwnEffective: false,
        },
      ],
      withdrawalsByAccountId: withdrawals,
      traditionalTaxableByAccountId: taxable,
      rothBasisByPool: new Map(),
      year: 2026,
      hsaQualifiedCap: 0,
    })

    expect(result.penaltyExcludingRmdShortfallExcise).toBe(0)
    expect(result.traditional.rows).toEqual([])
    expect([...withdrawals]).toEqual(beforeWithdrawals)
    expect([...taxable]).toEqual(beforeTaxable)
  })
})
