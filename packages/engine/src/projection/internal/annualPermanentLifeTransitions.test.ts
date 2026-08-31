import { describe, expect, it, vi } from 'vitest'

import type { InsurancePolicy, PermanentLifePolicy } from '../../model/plan.js'
import {
  annualPermanentLifeTransitions,
  type AnnualPermanentLifeTransitionsInput,
  type PermanentLifeInsuredState,
} from './annualPermanentLifeTransitions.js'

const permanentLife = (
  id: string,
  overrides: Partial<PermanentLifePolicy> = {},
): PermanentLifePolicy => ({
  kind: 'permanentLife',
  id,
  name: id,
  insured: 'p1',
  beneficiary: 'estate',
  annualPremium: 0,
  premiumMode: 'paidUp',
  deathBenefit: 0,
  cashValue: 0,
  cashValueMode: 'flatRate',
  cashValueGrowthPct: 0,
  ...overrides,
})

const ltc = (id: string): InsurancePolicy => ({
  kind: 'ltc',
  id,
  name: id,
  owner: 'p1',
  annualPremium: 0,
  premiumMode: 'paidUp',
  benefitMonthly: 1,
  benefitPeriodYears: 1,
  eliminationPeriodDays: 0,
})

function call(
  policies: readonly InsurancePolicy[],
  overrides: Partial<AnnualPermanentLifeTransitionsInput> = {},
) {
  return annualPermanentLifeTransitions({
    policies,
    insuranceCashValues: new Map(),
    resolveInsured: () => ({ ageAttained: 60, deathAge: 90 }),
    ...overrides,
  })
}

describe('annualPermanentLifeTransitions — selection and flat-rate growth', () => {
  it('returns one transition per permanent-life policy in plan order and never resolves LTC', () => {
    const resolveInsured = vi.fn<(personId: string) => PermanentLifeInsuredState | null>(() => ({
      ageAttained: 60,
      deathAge: 90,
    }))
    const result = call(
      [permanentLife('b', { insured: 'b-person' }), ltc('care'), permanentLife('a', { insured: 'a-person' })],
      { resolveInsured },
    )

    expect(result.transitions.map((row) => row.policyId)).toEqual(['b', 'a'])
    expect(resolveInsured.mock.calls).toEqual([['b-person'], ['a-person']])
  })

  it('compounds the prior cash value with the exact inlined expression', () => {
    const previous = 13_741.129
    const [transition] = call(
      [permanentLife('whole-life', { cashValueGrowthPct: 4.875 })],
      { insuranceCashValues: new Map([['whole-life', previous]]) },
    ).transitions

    expect(transition!.cashValue).toBe(previous * (1 + 4.875 / 100))
    expect(transition!.payout).toBeNull()
  })

  it('defaults a missing cash value and missing growth percentage to zero', () => {
    const [transition] = call([
      permanentLife('whole-life', { cashValueGrowthPct: undefined }),
    ]).transitions
    expect(transition!.cashValue).toBe(0)
    expect(transition!.payout).toBeNull()
  })

  it('preserves negative zero while an insured is alive', () => {
    const [transition] = call(
      [permanentLife('whole-life')],
      { insuranceCashValues: new Map([['whole-life', -0]]) },
    ).transitions
    expect(Object.is(transition!.cashValue, -0)).toBe(true)
  })
})

describe('annualPermanentLifeTransitions — illustration schedules', () => {
  it('sorts a copy, clamps both endpoints, and interpolates between ages', () => {
    const schedule: NonNullable<PermanentLifePolicy['cashValueSchedule']> = [
      { age: 70, value: 30_000 },
      { age: 60, value: 10_000 },
    ]
    Object.freeze(schedule[0])
    Object.freeze(schedule[1])
    Object.freeze(schedule)
    const policy = permanentLife('whole-life', {
      cashValueMode: 'schedule',
      cashValueSchedule: schedule,
    })
    const at = (ageAttained: number) => call([policy], {
      resolveInsured: () => ({ ageAttained, deathAge: 90 }),
    }).transitions[0]!.cashValue

    expect(at(50)).toBe(10_000)
    expect(at(60)).toBe(10_000)
    expect(at(65)).toBe(20_000)
    expect(at(70)).toBe(30_000)
    expect(at(80)).toBe(30_000)
    expect(schedule.map(({ age }) => age)).toEqual([70, 60])
  })

  it('returns zero for an explicitly empty schedule', () => {
    const [transition] = call([
      permanentLife('whole-life', { cashValueMode: 'schedule', cashValueSchedule: [] }),
    ]).transitions
    expect(transition!.cashValue).toBe(0)
  })

  it('uses flat-rate growth when schedule mode has no schedule', () => {
    const [transition] = call(
      [permanentLife('whole-life', {
        cashValueMode: 'schedule',
        cashValueSchedule: undefined,
        cashValueGrowthPct: 5,
      })],
      { insuranceCashValues: new Map([['whole-life', 10_000]]) },
    ).transitions
    expect(transition!.cashValue).toBe(10_000 * 1.05)
  })
})

describe('annualPermanentLifeTransitions — settlement and death', () => {
  it('settles exactly at death age, pays at least face value, and zeroes cash value', () => {
    const result = call(
      [permanentLife('face-wins', { deathBenefit: 100_000 })],
      {
        insuranceCashValues: new Map([['face-wins', 80_000]]),
        resolveInsured: () => ({ ageAttained: 80, deathAge: 80 }),
      },
    )
    expect(result.transitions).toEqual([{
      policyId: 'face-wins',
      insuredPersonId: 'p1',
      cashValue: 0,
      payout: 100_000,
    }])
    expect(result.deathBenefitPaid).toBe(100_000)
  })

  it('pays cash value when it exceeds face value', () => {
    const result = call(
      [permanentLife('cash-wins', { deathBenefit: 100_000 })],
      {
        insuranceCashValues: new Map([['cash-wins', 125_000]]),
        resolveInsured: () => ({ ageAttained: 80, deathAge: 80 }),
      },
    )
    expect(result.transitions[0]!.payout).toBe(125_000)
    expect(result.deathBenefitPaid).toBe(125_000)
  })

  it('distinguishes a zero settlement payout from no settlement', () => {
    const settled = call(
      [permanentLife('zero')],
      { resolveInsured: () => ({ ageAttained: 80, deathAge: 80 }) },
    ).transitions[0]!
    const postDeath = call(
      [permanentLife('post-death')],
      { resolveInsured: () => ({ ageAttained: 81, deathAge: 80 }) },
    ).transitions[0]!

    expect(Object.is(settled.cashValue, 0)).toBe(true)
    expect(settled.payout).toBe(0)
    expect(postDeath.cashValue).toBe(0)
    expect(postDeath.payout).toBeNull()
  })

  it('folds payouts left-to-right in policy order without reassociation', () => {
    const result = call(
      [
        permanentLife('large', { deathBenefit: 10_000_000_000_000_000 }),
        permanentLife('one-a', { deathBenefit: 1 }),
        permanentLife('one-b', { deathBenefit: 1 }),
      ],
      { resolveInsured: () => ({ ageAttained: 80, deathAge: 80 }) },
    )
    let expected = 0
    expected += 10_000_000_000_000_000
    expected += 1
    expected += 1
    expect(result.deathBenefitPaid).toBe(expected)
    expect(result.deathBenefitPaid).toBe(10_000_000_000_000_000)
  })
})

describe('annualPermanentLifeTransitions — identity and mutation boundaries', () => {
  it('treats a missing insured as alive at negative infinity', () => {
    const schedule = [
      { age: 70, value: 30_000 },
      { age: 60, value: 10_000 },
    ]
    const result = call(
      [permanentLife('orphan', {
        insured: 'missing',
        deathBenefit: 1_000_000,
        cashValueMode: 'schedule',
        cashValueSchedule: schedule,
      })],
      { resolveInsured: () => null },
    )

    expect(result.transitions[0]).toEqual({
      policyId: 'orphan',
      insuredPersonId: 'missing',
      cashValue: 10_000,
      payout: null,
    })
    expect(result.deathBenefitPaid).toBe(0)
  })

  it('uses a private shadow so duplicate policy ids observe earlier writes', () => {
    const result = call(
      [
        permanentLife('duplicate', { cashValueGrowthPct: 10 }),
        permanentLife('duplicate', { cashValueGrowthPct: 10 }),
      ],
      { insuranceCashValues: new Map([['duplicate', 100]]) },
    )

    expect(result.transitions.map(({ cashValue }) => cashValue)).toEqual([
      100 * 1.1,
      100 * 1.1 * 1.1,
    ])
  })

  it('makes a settlement write visible to a later duplicate id', () => {
    const result = call(
      [
        permanentLife('duplicate', { insured: 'dying', deathBenefit: 125 }),
        permanentLife('duplicate', { insured: 'living', cashValueGrowthPct: 10 }),
      ],
      {
        insuranceCashValues: new Map([['duplicate', 150]]),
        resolveInsured: (id) => id === 'dying'
          ? { ageAttained: 80, deathAge: 80 }
          : { ageAttained: 60, deathAge: 90 },
      },
    )

    expect(result.transitions[0]!.payout).toBe(150)
    expect(result.transitions[1]!.cashValue).toBe(0)
  })

  it('does not mutate inputs and returns fresh rows and arrays on re-entry', () => {
    const policies = Object.freeze([
      Object.freeze(permanentLife('whole-life', { cashValueGrowthPct: 5 })),
    ])
    const cashValues = new Map([['whole-life', 10_000]])
    const input = {
      policies,
      insuranceCashValues: cashValues,
      resolveInsured: () => ({ ageAttained: 60, deathAge: 90 }),
    } satisfies AnnualPermanentLifeTransitionsInput

    const first = annualPermanentLifeTransitions(input)
    const second = annualPermanentLifeTransitions(input)

    expect([...cashValues]).toEqual([['whole-life', 10_000]])
    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.transitions).not.toBe(second.transitions)
    expect(first.transitions[0]).not.toBe(second.transitions[0])
  })
})
