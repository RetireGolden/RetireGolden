import { describe, expect, it, vi } from 'vitest'

import type {
  InsurancePolicy,
  LtcPolicy,
  PermanentLifePolicy,
} from '../../model/plan.js'
import {
  annualInsurancePremiumRows,
  type AnnualInsurancePremiumRowsInput,
} from './annualInsurancePremiumRows.js'

const life = (
  id: string,
  overrides: Partial<PermanentLifePolicy> = {},
): PermanentLifePolicy => ({
  kind: 'permanentLife',
  id,
  name: id,
  insured: 'insured',
  beneficiary: 'estate',
  annualPremium: 1_000,
  premiumMode: 'lifetime',
  deathBenefit: 100_000,
  cashValue: 0,
  cashValueMode: 'flatRate',
  ...overrides,
})

const ltc = (id: string, overrides: Partial<LtcPolicy> = {}): LtcPolicy => ({
  kind: 'ltc',
  id,
  name: id,
  owner: 'owner',
  annualPremium: 2_000,
  premiumMode: 'lifetime',
  benefitMonthly: 5_000,
  benefitPeriodYears: 3,
  eliminationPeriodDays: 90,
  ...overrides,
})

function call(
  policies: readonly InsurancePolicy[],
  overrides: Partial<AnnualInsurancePremiumRowsInput> = {},
) {
  return annualInsurancePremiumRows({
    policies,
    resolveSubject: () => ({ alive: true, ageAttained: 64 }),
    ...overrides,
  })
}

describe('annualInsurancePremiumRows — eligibility', () => {
  it('charges lifetime premiums for the LTC owner and permanent-life insured', () => {
    const resolveSubject = vi.fn((personId: string) => ({
      alive: personId !== 'nobody',
      ageAttained: 64,
    }))
    const rows = call([
      ltc('care', { owner: 'owner-a', annualPremium: 2_345 }),
      life('whole', { insured: 'insured-b', annualPremium: 4_567 }),
    ], { resolveSubject })

    expect(resolveSubject.mock.calls).toEqual([['owner-a'], ['insured-b']])
    expect(rows).toEqual([
      {
        amount: 2_345,
        record: {
          policyId: 'care',
          subjectPersonId: 'owner-a',
          amount: 2_345,
        },
      },
      {
        amount: 4_567,
        record: {
          policyId: 'whole',
          subjectPersonId: 'insured-b',
          amount: 4_567,
        },
      },
    ])
  })

  it('does not resolve or charge paid-up policies, and skips dead subjects', () => {
    const resolveSubject = vi.fn((personId: string) => ({
      alive: personId !== 'dead',
      ageAttained: 60,
    }))
    const rows = call([
      life('paid', { insured: 'must-not-resolve', premiumMode: 'paidUp' }),
      life('dead-policy', { insured: 'dead' }),
      life('living-policy', { insured: 'living' }),
    ], { resolveSubject })

    expect(resolveSubject.mock.calls).toEqual([['dead'], ['living']])
    expect(rows.map(({ record }) => record.policyId)).toEqual(['living-policy'])
  })

  it('charges until-age premiums only while age is strictly below the end age', () => {
    const policy = life('term', {
      premiumMode: 'untilAge',
      premiumEndAge: 65,
    })
    const at = (ageAttained: number) => call([policy], {
      resolveSubject: () => ({ alive: true, ageAttained }),
    }).length

    expect(at(64)).toBe(1)
    expect(at(65)).toBe(0)
    expect(at(66)).toBe(0)
  })

  it('retains the inlined fallback when an until-age policy has no end age', () => {
    const rows = call([
      life('legacy', {
        premiumMode: 'untilAge',
        premiumEndAge: undefined,
      }),
    ], {
      resolveSubject: () => ({ alive: true, ageAttained: 110 }),
    })
    expect(rows.map(({ record }) => record.policyId)).toEqual(['legacy'])
  })
})

describe('annualInsurancePremiumRows — order and occurrence cardinality', () => {
  it('preserves eligible occurrences in plan order, including duplicate ids and zero amounts', () => {
    const rows = call([
      life('duplicate', { annualPremium: 10 }),
      life('excluded', { premiumMode: 'paidUp', annualPremium: 20 }),
      ltc('duplicate', { annualPremium: 0 }),
      life('last', { annualPremium: 30 }),
    ])

    expect(rows.map(({ record }) => record.policyId)).toEqual([
      'duplicate',
      'duplicate',
      'last',
    ])
    expect(rows.map(({ amount }) => amount)).toEqual([10, 0, 30])
    expect(rows).toHaveLength(3)
  })

  it('supports the caller exact left fold without aggregation or underproduction', () => {
    const rows = call([
      life('large', { annualPremium: 10_000_000_000_000_000 }),
      life('cancel', { annualPremium: 0 }),
      life('unit', { annualPremium: 1 }),
    ])
    // Use the returned order with a cancellation-sensitive prior accumulator.
    let folded = -10_000_000_000_000_000
    for (const row of rows) folded += row.amount

    expect(rows.map(({ amount }) => amount)).toEqual([
      10_000_000_000_000_000,
      0,
      1,
    ])
    expect(folded).toBe(1)
    expect(rows.slice(0, -1).reduce((sum, row) => sum + row.amount, -10_000_000_000_000_000)).toBe(0)
  })

  it('does not mutate inputs and returns fresh rows and record objects', () => {
    const policies = Object.freeze([
      Object.freeze(life('whole', { annualPremium: 999 })),
    ])
    const input: AnnualInsurancePremiumRowsInput = {
      policies,
      resolveSubject: () => ({ alive: true, ageAttained: 60 }),
    }

    const first = annualInsurancePremiumRows(input)
    const second = annualInsurancePremiumRows(input)

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first[0]).not.toBe(second[0])
    expect(first[0]!.record).not.toBe(second[0]!.record)
    expect(policies[0]!.annualPremium).toBe(999)
  })
})
