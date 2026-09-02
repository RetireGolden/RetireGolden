import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import type { RothBasisState } from '../../strategies/rothBasis.js'
import {
  annualFundingWithdrawalEffects,
  recharacterizeAnnualFundingWithdrawalHsaCap,
  type AnnualFundingWithdrawalEffectAccount,
} from './annualFundingWithdrawalEffects.js'

/**
 * Contract tests for a behavior-preserving extraction. The statutory money
 * math below is independently recomputed from the named rule-registry records;
 * account order, owner-wide pooling, and legacy HSA treatment are explicitly
 * projection conventions, so those assertions characterize the reviewed
 * pre-extraction ledger rather than claiming a statutory oracle.
 */

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
    // Independent worksheet: IRC 72(t)(1), registry record
    // irc-72-t-1-additional-tax-on-includible-portion, applies 10% only to the
    // $60 and $40 taxable shares: $6 + $4 = $10. The employer-plan $100 is
    // waived by irc-72-t-2-A-v-rule-of-55; inherited/S2 identity stays a
    // separately named projection convention/residual.
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
    // Independent worksheet: the modeled $100 cap pays $70 then $30 in plan
    // order, leaving $20 nonqualified. IRC 223(f)(2)/(4) makes that $20
    // ordinary and adds 20% ($4); the legacy pre-65 proxy adds 20% of its $10
    // ($2), while the attained-age-65 record waives its additional tax. Thus
    // qualified = 70 + 30 + 10 + 10 + 10 = $130; total penalty = $6.
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

  it('refreshes only cap-dependent HSA character during the funding fixed point', () => {
    const hsaAccount: AnnualFundingWithdrawalEffectAccount = {
      kind: 'hsa',
      sourceAccountId: 'hsa',
      withdrawalTreatment: 'capByMedicalExpenses',
      ownerAgeAttained: 50,
    }
    const previous = run(
      [
        {
          kind: 'traditional',
          sourceAccountId: 'traditional',
          account: traditionalAccount('traditional'),
          ownerAgeAttained: 50,
          ownerRetirementAge: null,
          treatAsOwnEffective: false,
        },
        hsaAccount,
      ],
      new Map([
        ['traditional', 100],
        ['hsa', 100],
      ]),
      { hsaQualifiedCap: 25 },
    )

    const refreshed = recharacterizeAnnualFundingWithdrawalHsaCap(previous, {
      accounts: [hsaAccount],
      withdrawalsByAccountId: new Map([['hsa', 100]]),
      hsaQualifiedCap: 60,
    })

    expect(refreshed.traditional).toBe(previous.traditional)
    expect(refreshed.roth).toBe(previous.roth)
    expect(refreshed.hsa).toMatchObject({
      qualified: 60,
      nonQualified: 40,
      taxableOrdinary: 40,
      penalty: 8,
      capConsumed: 60,
    })
    expect(refreshed.penaltyExcludingRmdShortfallExcise).toBe(18)
  })

  it('aggregates Roth accounts by first-seen pool and splits one ordered withdrawal', () => {
    // Independent worksheet: IRC 408A(d)(4)(B) ordering consumes the $100
    // contribution basis, then the $50 2024 conversion, then $50 earnings from
    // the $200 draw. Record irc-408A-d-3-F-roth-conversion-recapture exposes
    // the $40 taxable conversion share to 10% ($4); nonqualified earnings add
    // $50 ordinary and $5 additional tax, for $9 total. Pooling two Roth-IRA
    // rows before that worksheet is the preserved projection convention.
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
