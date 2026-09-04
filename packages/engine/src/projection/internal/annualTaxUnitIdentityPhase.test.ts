/**
 * Malformed-direct-call guard for the annual tax-unit identity phase.
 *
 * The phase already omits tax-unit evidence, rather than throwing, when a
 * direct `simulatePlan` caller hands a person id that satisfies the Plan's
 * legacy string schema but not action identity's nonblank contract (see the
 * `asPersonId` catch in `annualTaxUnitIdentityPhase.ts`). This file pins the
 * matching guarantee for the household-state path: `deriveActionStructuralId`
 * throws a `TypeError` on a JSON-unserializable part (`undefined` included)
 * where the retired `JSON.stringify` minter would have silently coerced it.
 * A validated Plan can never reach this — `household.state` is a
 * length-2 string — so this is reachable only through a malformed direct
 * call, exactly the scenario the sibling catch already documents.
 */
import { describe, expect, it } from 'vitest'

import type { Household } from '../../model/plan.js'
import {
  annualTaxUnitIdentityPhase,
  clearTaxUnitIdentityMemo,
  TAX_UNIT_MEMO_BOUNDS,
  taxUnitIdentityMemoSize,
  taxUnitMemoKey,
} from './annualTaxUnitIdentityPhase.js'

describe('annualTaxUnitIdentityPhase malformed direct input', () => {
  it('omits tax-unit evidence instead of throwing when household.state is not a string', () => {
    const household = {
      filingStatus: 'single',
      hasQualifyingDependent: false,
      state: undefined,
      stateMoves: [],
      capitalLossCarryforward: 0,
      people: [],
    } as unknown as Household

    const result = annualTaxUnitIdentityPhase({
      year: 2026,
      household,
      filingStatusForYear: 'single',
      peopleStates: [{ personId: 'p1', alive: true }],
      retirementActions: [],
    })

    expect(result.annualActionTaxUnit).toBeNull()
    expect(result.conversionFundingTaxUnitEvidence).toBeNull()
  })
})

const BASE_MEMBERS = ['p1'] as const

/** A validly-typed household resolving to a single filing unit. */
function baseInput(overrides: {
  year?: number
  state?: string
} = {}) {
  const household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: overrides.state ?? 'KY',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [],
  } as unknown as Household

  return {
    year: overrides.year ?? 2026,
    household,
    filingStatusForYear: 'single' as const,
    peopleStates: [{ personId: 'p1', alive: true }],
    retirementActions: [],
  }
}

describe('taxUnitMemoKey refusal branches', () => {
  it('accepts a canonical year, filing status, member set and segment list', () => {
    const key = taxUnitMemoKey(
      2026,
      'single',
      BASE_MEMBERS,
      'KY',
      [{ state: 'KY', months: 12 }],
    )
    expect(key).toBe(
      JSON.stringify([2026, 'single', BASE_MEMBERS, 'KY', [['KY', 12]]]),
    )
  })

  it('refuses a negative-zero year rather than keying it as zero', () => {
    expect(taxUnitMemoKey(-0, 'single', BASE_MEMBERS, 'KY', [])).toBeNull()
  })

  it('refuses a negative-zero segment month count', () => {
    const key = taxUnitMemoKey(2026, 'single', BASE_MEMBERS, 'KY', [
      { state: 'KY', months: -0 },
    ])
    expect(key).toBeNull()
  })

  it('refuses a non-finite year', () => {
    expect(taxUnitMemoKey(Number.NaN, 'single', BASE_MEMBERS, 'KY', []))
      .toBeNull()
    expect(
      taxUnitMemoKey(Number.POSITIVE_INFINITY, 'single', BASE_MEMBERS, 'KY', []),
    ).toBeNull()
  })

  it('refuses a non-string member id', () => {
    const members = [1] as unknown as readonly string[]
    expect(taxUnitMemoKey(2026, 'single', members, 'KY', [])).toBeNull()
  })

  it('refuses a non-string household state', () => {
    const state = undefined as unknown as string
    expect(taxUnitMemoKey(2026, 'single', BASE_MEMBERS, state, [])).toBeNull()
  })

  it('refuses a residency segment carrying other than its two own keys', () => {
    const segments = [
      { state: 'KY', months: 12, extra: true },
    ] as unknown as readonly { state: string; months: number }[]
    expect(taxUnitMemoKey(2026, 'single', BASE_MEMBERS, 'KY', segments))
      .toBeNull()
  })

  it('refuses a residency segment with a non-canonical months value', () => {
    const segments = [{ state: 'KY', months: Number.NaN }]
    expect(taxUnitMemoKey(2026, 'single', BASE_MEMBERS, 'KY', segments))
      .toBeNull()
  })

  it('refuses a key longer than the cap without hashing it wrong', () => {
    const longMember = 'p'.repeat(TAX_UNIT_MEMO_BOUNDS.maxKeyLength)
    expect(
      taxUnitMemoKey(2026, 'single', [longMember], 'KY', []),
    ).toBeNull()
  })

  it('never lets two structurally distinct inputs share a key', () => {
    const keys = new Set([
      taxUnitMemoKey(2026, 'single', BASE_MEMBERS, 'KY', []),
      taxUnitMemoKey(2027, 'single', BASE_MEMBERS, 'KY', []),
      taxUnitMemoKey(2026, 'qualifyingSurvivingSpouse', BASE_MEMBERS, 'KY', []),
      taxUnitMemoKey(2026, 'single', ['p2'], 'KY', []),
      taxUnitMemoKey(2026, 'single', BASE_MEMBERS, 'OH', []),
      taxUnitMemoKey(2026, 'single', BASE_MEMBERS, 'KY', [
        { state: 'KY', months: 12 },
      ]),
      taxUnitMemoKey(2026, 'single', ['p1', 'p2'], 'KY', []),
      taxUnitMemoKey(2026, 'single', ['p1,p2'], 'KY', []),
    ])
    expect(keys.size).toBe(8)
  })
})

describe('annualTaxUnitIdentityPhase memo hit/miss equivalence', () => {
  it('answers a warm call exactly as the cold derivation, and only mints one entry', () => {
    clearTaxUnitIdentityMemo()
    const cold = annualTaxUnitIdentityPhase(baseInput())
    const sizeAfterCold = taxUnitIdentityMemoSize()
    const warm = annualTaxUnitIdentityPhase(baseInput())
    const sizeAfterWarm = taxUnitIdentityMemoSize()

    expect(cold.annualActionTaxUnit).not.toBeNull()
    expect(warm.annualActionTaxUnit).toEqual(cold.annualActionTaxUnit)
    expect(sizeAfterCold).toBe(1)
    expect(sizeAfterWarm).toBe(1)
  })

  it('mints distinct, non-colliding identities for distinct years', () => {
    clearTaxUnitIdentityMemo()
    const year2026 = annualTaxUnitIdentityPhase(baseInput({ year: 2026 }))
    const year2027 = annualTaxUnitIdentityPhase(baseInput({ year: 2027 }))

    const unit2026 = year2026.annualActionTaxUnit
    const unit2027 = year2027.annualActionTaxUnit
    if (unit2026 === null || unit2027 === null) {
      throw new Error('expected both years to mint a tax unit')
    }
    expect(unit2026.taxUnitId).not.toBe(unit2027.taxUnitId)
    expect(unit2026.taxUnitEvidenceId).not.toBe(unit2027.taxUnitEvidenceId)
    expect(unit2026.stateFilingStatusId).not.toBe(unit2027.stateFilingStatusId)
  })

  it('mints distinct identities for distinct residency states in the same year', () => {
    clearTaxUnitIdentityMemo()
    const ky = annualTaxUnitIdentityPhase(baseInput({ state: 'KY' }))
    const oh = annualTaxUnitIdentityPhase(baseInput({ state: 'OH' }))

    const unitKy = ky.annualActionTaxUnit
    const unitOh = oh.annualActionTaxUnit
    if (unitKy === null || unitOh === null) {
      throw new Error('expected both states to mint a tax unit')
    }
    // The state-independent identity is unaffected...
    expect(unitKy.taxUnitId).toBe(unitOh.taxUnitId)
    // ...but the state-aware identities must not collide.
    expect(unitKy.taxUnitEvidenceId).not.toBe(unitOh.taxUnitEvidenceId)
    expect(unitKy.stateFilingStatusId).not.toBe(unitOh.stateFilingStatusId)
  })

  it('degrades to null rather than caching under a negative-zero year', () => {
    clearTaxUnitIdentityMemo()
    const result = annualTaxUnitIdentityPhase(baseInput({ year: -0 }))

    expect(result.annualActionTaxUnit).toBeNull()
    expect(taxUnitIdentityMemoSize()).toBe(0)
  })

  it('stays bounded and keeps answering correctly across a clear', () => {
    clearTaxUnitIdentityMemo()
    const first = annualTaxUnitIdentityPhase(baseInput({ year: 2000 }))
      .annualActionTaxUnit
    for (
      let offset = 1;
      offset <= TAX_UNIT_MEMO_BOUNDS.maxEntries;
      offset += 1
    ) {
      annualTaxUnitIdentityPhase(baseInput({ year: 2000 + offset }))
    }

    expect(taxUnitIdentityMemoSize())
      .toBeLessThanOrEqual(TAX_UNIT_MEMO_BOUNDS.maxEntries)
    const rederived = annualTaxUnitIdentityPhase(baseInput({ year: 2000 }))
      .annualActionTaxUnit
    expect(rederived).toEqual(first)
  })
})
