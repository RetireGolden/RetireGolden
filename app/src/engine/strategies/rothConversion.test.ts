import { describe, expect, it } from 'vitest'

import { packForYear } from '../params'
import { computeFederalTax } from '../tax/federalTax'
import { sizeRothConversion, type ConversionSizingInput, type FillTarget } from './rothConversion'

const pack = packForYear(2026).pack

function input(partial: Partial<ConversionSizingInput> = {}): ConversionSizingInput {
  return {
    year: 2026,
    pack,
    filingStatus: 'single',
    ordinaryIncomeBase: 0,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    householdSize: 1,
    inflationScale: 1,
    ...partial,
  }
}

function fill(target: FillTarget['target'], targetValue: number | null, years = { startYear: 2026, endYear: 2026 }): FillTarget {
  return { mode: 'fillToTarget', target, targetValue, ...years }
}

describe('sizeRothConversion', () => {
  it('fills taxable income to the top of the 12% bracket', () => {
    const r = sizeRothConversion(fill('topOfBracket', 12), input())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Taxable = c − 16,100 standard deduction; top of 12% = 50,400 -> c = 66,500.
    expect(r.amount).toBeCloseTo(66_500, 1)
  })

  it('accounts for Social Security phase-in when filling a bracket', () => {
    const r = sizeRothConversion(fill('topOfBracket', 22), input({ ssBenefits: 30_000, ordinaryIncomeBase: 10_000 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // The solver's defining property: taxable income lands on the ceiling.
    const detail = computeFederalTax({
      year: 2026,
      filingStatus: 'single',
      ordinaryIncome: 10_000 + r.amount,
      capitalGains: 0,
      ssBenefits: 30_000,
      peopleAged65Plus: 0,
    })
    expect(detail.taxableIncome).toBeCloseTo(105_700, 0) // top of 22%
  })

  it('caps MAGI under an IRMAA tier threshold', () => {
    const r = sizeRothConversion(fill('irmaaTier', 1), input({ ordinaryIncomeBase: 50_000 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(59_000, 1) // 109,000 − 50,000
  })

  it('caps MAGI under the ACA 400% FPL cliff', () => {
    const r = sizeRothConversion(fill('acaCliff', null), input())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(15_650 * 4, 1)
  })

  it('honors a fixed MAGI ceiling', () => {
    const r = sizeRothConversion(fill('fixedMagi', 80_000), input({ ordinaryIncomeBase: 30_000 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(50_000, 1)
  })

  it('reports when income already exceeds the ceiling', () => {
    const r = sizeRothConversion(fill('irmaaTier', 1), input({ ordinaryIncomeBase: 150_000 }))
    expect(r).toEqual({ ok: false, reason: 'already_over_ceiling' })
  })

  it('rejects unknown brackets and the open-ended top bracket', () => {
    expect(sizeRothConversion(fill('topOfBracket', 13), input())).toEqual({ ok: false, reason: 'bad_target' })
    expect(sizeRothConversion(fill('topOfBracket', 37), input())).toEqual({ ok: false, reason: 'bad_target' })
    expect(sizeRothConversion(fill('irmaaTier', 9), input())).toEqual({ ok: false, reason: 'bad_target' })
    expect(sizeRothConversion(fill('fixedMagi', null), input())).toEqual({ ok: false, reason: 'bad_target' })
  })
})
