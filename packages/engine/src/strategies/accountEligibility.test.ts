import { describe, expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import {
  acceptsContributions,
  followsOwnerRmds,
  hsaNonQualifiedPenaltyRate,
  isAggregatedIra,
  isConvertibleToRoth,
  isEquityCompVested,
  isSpendableInYear,
  traditionalWithdrawalPenaltyRate,
  type EquityCompAccount,
  type TraditionalAccount,
} from './accountEligibility.js'

function ownedIra(over: Partial<TraditionalAccount> = {}): TraditionalAccount {
  return {
    type: 'traditional',
    id: 'ira',
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance: 100_000,
    annualContribution: 0,
    ...over,
  }
}

function inheritedIra(): TraditionalAccount {
  return ownedIra({ inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false } })
}

function equityComp(over: Partial<EquityCompAccount> = {}): EquityCompAccount {
  return {
    type: 'equityComp',
    id: 'eq',
    name: 'RSU',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 50_000,
    costBasis: 10_000,
    annualContribution: 0,
    vestingMode: 'cliff',
    vestDate: '2030-01-01',
    ...over,
  }
}

describe('contributions / convertibility / RMD eligibility', () => {
  it('inherited traditional accounts cannot contribute, convert, or follow owner RMDs', () => {
    const inherited = inheritedIra()
    expect(acceptsContributions(inherited)).toBe(false)
    expect(isConvertibleToRoth(inherited)).toBe(false)
    expect(followsOwnerRmds(inherited)).toBe(false)
    expect(isAggregatedIra(inherited)).toBe(false)
  })

  it('owned traditional IRAs contribute, convert, follow RMDs, and aggregate for 8606', () => {
    const owned = ownedIra()
    expect(acceptsContributions(owned)).toBe(true)
    expect(isConvertibleToRoth(owned)).toBe(true)
    expect(followsOwnerRmds(owned)).toBe(true)
    expect(isAggregatedIra(owned)).toBe(true)
  })

  it('employer traditional plans convert but do not aggregate for the IRA 8606 rule', () => {
    const employer = ownedIra({ kind: 'employer' })
    expect(isConvertibleToRoth(employer)).toBe(true)
    expect(isAggregatedIra(employer)).toBe(false)
  })

  it('a Roth account is neither convertible nor RMD-bearing', () => {
    const roth: Account = {
      type: 'roth',
      id: 'r',
      name: 'Roth',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      kind: 'ira',
      balance: 1,
      annualContribution: 0,
    }
    expect(isConvertibleToRoth(roth)).toBe(false)
    expect(followsOwnerRmds(roth)).toBe(false)
    expect(acceptsContributions(roth)).toBe(true)
  })
})

describe('equity-comp vesting / spendability', () => {
  it('final-vesting equity comp is always spendable', () => {
    expect(isEquityCompVested(equityComp({ vestingMode: 'final' }), 2026)).toBe(true)
    expect(isSpendableInYear(equityComp({ vestingMode: 'final' }), 2026)).toBe(true)
  })

  it('cliff-vesting equity comp is unavailable before its vest year', () => {
    const rsu = equityComp({ vestDate: '2030-01-01' })
    expect(isEquityCompVested(rsu, 2029)).toBe(false)
    expect(isEquityCompVested(rsu, 2030)).toBe(true)
    expect(isSpendableInYear(rsu, 2029)).toBe(false)
  })

  it('non-equity accounts are always spendable', () => {
    expect(isSpendableInYear(ownedIra(), 2026)).toBe(true)
  })
})

describe('early-withdrawal penalties', () => {
  it('charges 10% on a traditional IRA before 60', () => {
    expect(traditionalWithdrawalPenaltyRate(ownedIra(), { ownerAgeAttained: 55, ownerRetirementAge: 55 })).toBe(0.1)
  })

  it('waives the penalty from age 60 on', () => {
    expect(traditionalWithdrawalPenaltyRate(ownedIra(), { ownerAgeAttained: 60, ownerRetirementAge: 50 })).toBe(0)
  })

  it('applies the Rule of 55 to an employer plan separated from at 55+', () => {
    const employer = ownedIra({ kind: 'employer' })
    expect(traditionalWithdrawalPenaltyRate(employer, { ownerAgeAttained: 57, ownerRetirementAge: 55 })).toBe(0)
    // But not before the separation (retirement) age.
    expect(traditionalWithdrawalPenaltyRate(employer, { ownerAgeAttained: 54, ownerRetirementAge: 55 })).toBe(0.1)
  })

  it('never penalizes an inherited account regardless of age', () => {
    expect(traditionalWithdrawalPenaltyRate(inheritedIra(), { ownerAgeAttained: 40, ownerRetirementAge: null })).toBe(0)
  })

  it('penalizes non-qualified HSA withdrawals 20% before 65 only', () => {
    expect(hsaNonQualifiedPenaltyRate(64)).toBe(0.2)
    expect(hsaNonQualifiedPenaltyRate(65)).toBe(0)
  })
})
