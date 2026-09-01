import { describe, expect, it } from 'vitest'

import type { Account, CareEvent, InsurancePolicy } from '../../model/plan.js'
import type { PersonYearState } from '../types.js'
import {
  annualDebtServiceRows,
  annualLongTermCarePlan,
} from './annualDebtAndLongTermCare.js'

function debt(
  interestPct: number,
  monthlyPayment: number,
): Extract<Account, { type: 'debt' }> {
  return {
    type: 'debt',
    id: 'duplicate-debt',
    name: 'Duplicate debt',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 100,
    interestPct,
    monthlyPayment,
  }
}

function policy(
  id: string,
  benefitMonthly: number,
  benefitPeriodYears: number | 'lifetime',
): Extract<InsurancePolicy, { kind: 'ltc' }> {
  return {
    kind: 'ltc',
    id,
    name: id,
    owner: 'p1',
    annualPremium: 0,
    premiumMode: 'lifetime',
    benefitMonthly,
    benefitPeriodYears,
    eliminationPeriodDays: 0,
  }
}

describe('annual debt and long-term-care plans', () => {
  it('plans duplicate debt IDs against ordered shadow writes', () => {
    const result = annualDebtServiceRows({
      accounts: [debt(10, 30 / 12), debt(25, 40 / 12)],
      balances: new Map([['duplicate-debt', 100]]),
      year: 2026,
    })

    expect(result).toStrictEqual([
      {
        accountId: 'duplicate-debt',
        ownerPersonId: 'p1',
        amount: 30,
        nextBalance: 80.00000000000001,
      },
      {
        accountId: 'duplicate-debt',
        ownerPersonId: 'p1',
        amount: 40,
        nextBalance: 60.000000000000014,
      },
    ])
  })

  it('uses ordered policy-ID writes and preserves reporting order', () => {
    const event: CareEvent = {
      id: 'care-1',
      personId: 'p1',
      startAge: 70,
      durationYears: 2,
      annualCost: 100,
    }
    const person: PersonYearState = {
      personId: 'p1',
      ageAttained: 70,
      alive: true,
    }
    const result = annualLongTermCarePlan({
      careEvents: [event],
      policies: [
        policy('duplicate-policy', 40 / 12, 1),
        policy('duplicate-policy', 99 / 12, 1),
        policy('other-policy', 60 / 12, 'lifetime'),
      ],
      benefitYearsUsed: new Map(),
      resolvePerson: () => person,
      healthInflFactor: 1,
      year: 2026,
      startYear: 2026,
      capturePersonRows: true,
    })

    expect(result).toStrictEqual({
      careCost: 100,
      ltcBenefit: 100,
      benefitYearWrites: [
        { policyId: 'duplicate-policy', yearsUsed: 1 },
        { policyId: 'other-policy', yearsUsed: 1 },
      ],
      personRows: [{
        personId: 'p1',
        careEventIds: ['care-1'],
        payingPolicyIds: ['duplicate-policy', 'other-policy'],
        gross: 100,
        benefit: 100,
        net: 0,
      }],
    })
  })

  it('does not allocate reporting maps when capture is disabled', () => {
    const result = annualLongTermCarePlan({
      careEvents: [],
      policies: [],
      benefitYearsUsed: new Map(),
      resolvePerson: () => {
        throw new Error('unreachable')
      },
      healthInflFactor: 1,
      year: 2026,
      startYear: 2026,
      capturePersonRows: false,
    })

    expect(result.personRows).toStrictEqual([])
  })

  it('preserves care-event order and floating-point association', () => {
    const person: PersonYearState = {
      personId: 'p1',
      ageAttained: 70,
      alive: true,
    }
    const events = [1e16, 1, 2].map((annualCost, index): CareEvent => ({
      id: `care-fp-${index}`,
      personId: 'p1',
      startAge: 70,
      durationYears: 1,
      annualCost,
    }))

    const result = annualLongTermCarePlan({
      careEvents: events,
      policies: [],
      benefitYearsUsed: new Map(),
      resolvePerson: () => person,
      healthInflFactor: 1,
      year: 2026,
      startYear: 2026,
      capturePersonRows: true,
    })

    expect(result.careCost).toBe(10_000_000_000_000_002)
    expect(result.personRows[0]).toStrictEqual({
      personId: 'p1',
      careEventIds: ['care-fp-0', 'care-fp-1', 'care-fp-2'],
      payingPolicyIds: [],
      gross: 10_000_000_000_000_002,
      benefit: 0,
      net: 10_000_000_000_000_002,
    })
  })
})
