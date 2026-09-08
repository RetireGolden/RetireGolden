import { afterEach, describe, expect, it, vi } from 'vitest'

import { packForYear } from '../params/index.js'
import * as federalTaxModule from '../tax/federalTax.js'
import { computeFederalTax } from '../tax/federalTax.js'
import { sizeRothConversion, type ConversionSizingInput, type FillTarget } from './rothConversion.js'

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
    aca: {
      actionable: true,
      taxFamilySize: 1,
      fplRegion: 'contiguous',
      fixedMagiAddbacks: 0,
      taxExemptInterest: 0,
      foreignExclusionAddback: 0,
    },
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

  it('fills taxable income to the top of the 12% bracket for one person aged 65+', () => {
    const r = sizeRothConversion(fill('topOfBracket', 12), input({ peopleAged65Plus: 1 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Source: DOCS/domain/domain-rules-reference/01-federal-income-tax-2026.md.
    // Worksheet (2026 single): top of 12% taxable $50,400 + standard deduction
    // $16,100 + §63(f) age-65 addition $2,050 + OBBBA enhanced senior deduction
    // $6,000 = $74,550. Competing misreadings: $66,500 (no age adjustments) and
    // $72,500 (senior deduction without §63(f) addition).
    // MAGI here equals the conversion amount (~$74,550), $450 below the $75k
    // §151(d)(5)(C) phase-out threshold; full $6,000 senior deduction applies—
    // phase-out slope is not exercised by this fixture.
    expect(r.amount).toBeCloseTo(74_550, 1)
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

  it('includes a foreign exclusion in Social Security phase-in while filling a bracket', () => {
    const without = sizeRothConversion(
      fill('topOfBracket', 12),
      input({ ssBenefits: 100_000, ordinaryIncomeBase: 0 }),
    )
    const withForeignExclusion = sizeRothConversion(
      fill('topOfBracket', 12),
      input({
        ssBenefits: 100_000,
        ordinaryIncomeBase: 0,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 10_000,
          taxExemptInterest: 0,
          foreignExclusionAddback: 10_000,
        },
      }),
    )
    expect(without.ok).toBe(true)
    expect(withForeignExclusion.ok).toBe(true)
    if (without.ok && withForeignExclusion.ok) {
      expect(withForeignExclusion.amount).toBeLessThan(without.amount)
    }
  })

  it('caps MAGI under an IRMAA tier threshold', () => {
    const r = sizeRothConversion(fill('irmaaTier', 1), input({ ordinaryIncomeBase: 50_000 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(59_000, 1) // 109,000 − 50,000
  })

  it('includes characterized tax-exempt interest in the IRMAA metric', () => {
    const r = sizeRothConversion(
      fill('irmaaTier', 1),
      input({
        ordinaryIncomeBase: 50_000,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 0,
          taxExemptInterest: 4_000,
          foreignExclusionAddback: 0,
        },
      }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(55_000, 1)
  })

  it('includes top-level tax-exempt interest in the IRMAA metric outside ACA years', () => {
    const base = { ordinaryIncomeBase: 50_000, aca: undefined }
    // omitted → tier overshoot: MAGI metric understates characterized exempt interest.
    const omitted = sizeRothConversion(fill('irmaaTier', 1), input(base))
    // included → smaller conversion: metric carries the addback like ledger MAGI history.
    const included = sizeRothConversion(
      fill('irmaaTier', 1),
      input({ ...base, taxExemptInterest: 10_000 }),
    )
    expect(omitted.ok).toBe(true)
    expect(included.ok).toBe(true)
    if (!omitted.ok || !included.ok) return
    expect(included.amount).toBeLessThan(omitted.amount)
    expect(omitted.amount - included.amount).toBeCloseTo(10_000, 1)
  })

  it('caps MAGI under the ACA 400% FPL cliff', () => {
    const r = sizeRothConversion(fill('acaCliff', null), input())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(15_650 * 4, 1)
  })

  it('nets signed AGI against ACA addbacks before sizing to the cliff', () => {
    const r = sizeRothConversion(
      fill('acaCliff', null),
      input({
        capitalGains: -3_000,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 20_000,
          taxExemptInterest: 0,
          foreignExclusionAddback: 20_000,
        },
      }),
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.amount).toBeCloseTo(15_650 * 4 - 17_000, 1)
  })

  it('uses ACA addbacks and refuses non-actionable cliff sizing', () => {
    const withAddbacks = sizeRothConversion(
      fill('acaCliff', null),
      input({
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 7_000,
          taxExemptInterest: 3_000,
          foreignExclusionAddback: 0,
        },
      }),
    )
    expect(withAddbacks.ok).toBe(true)
    if (withAddbacks.ok) expect(withAddbacks.amount).toBeCloseTo(15_650 * 4 - 10_000, 1)
    expect(
      sizeRothConversion(
        fill('acaCliff', null),
        input({
          aca: {
            actionable: false,
            taxFamilySize: 1,
            fplRegion: 'contiguous',
            fixedMagiAddbacks: 0,
            taxExemptInterest: 0,
            foreignExclusionAddback: 0,
          },
        }),
      ),
    ).toEqual({ ok: false, reason: 'aca_nonactionable' })
    expect(sizeRothConversion(fill('acaCliff', null), input({ aca: undefined }))).toEqual({
      ok: false,
      reason: 'aca_nonactionable',
    })
  })

  it('honors a fixed MAGI ceiling', () => {
    const r = sizeRothConversion(fill('fixedMagi', 80_000), input({ ordinaryIncomeBase: 30_000 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.amount).toBeCloseTo(50_000, 1)
  })

  it('uses signed pre-floor AGI plus tax-exempt interest for a fixed MAGI ceiling', () => {
    const r = sizeRothConversion(
      fill('fixedMagi', 80_000),
      input({
        capitalGains: -3_000,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 20_000,
          taxExemptInterest: 5_000,
          foreignExclusionAddback: 20_000,
        },
      }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // Foreign-exclusion addback is not added to IRMAA/fixed MAGI; the signed
    // capital loss offsets $3k of the characterized $5k tax-exempt interest.
    expect(r.amount).toBeCloseTo(78_000, 1)
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

  describe('foreign-exclusion addback transport into federal pricing', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('prefers top-level broad over a different nested ACA value', () => {
      const spy = vi.spyOn(federalTaxModule, 'computeFederalTax')
      const sizing = input({
        ordinaryIncomeBase: 50_000,
        foreignExclusionAddback: 5_000,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 0,
          taxExemptInterest: 0,
          foreignExclusionAddback: 20_000,
        },
      })
      sizeRothConversion(fill('irmaaTier', 1), sizing)
      expect(spy).toHaveBeenCalled()
      for (const [callInput] of spy.mock.calls) {
        expect(callInput.foreignExclusionAddback).toBe(5_000)
        expect(callInput.niitSection911A1NetAddback).toBe(5_000)
      }
    })

    it('honors explicit top-level narrow zero without falling back to broad', () => {
      const spy = vi.spyOn(federalTaxModule, 'computeFederalTax')
      const sizing = input({
        ordinaryIncomeBase: 50_000,
        foreignExclusionAddback: 10_000,
        niitSection911A1NetAddback: 0,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 0,
          taxExemptInterest: 0,
          foreignExclusionAddback: 10_000,
        },
      })
      sizeRothConversion(fill('irmaaTier', 1), sizing)
      expect(spy).toHaveBeenCalled()
      for (const [callInput] of spy.mock.calls) {
        expect(callInput.foreignExclusionAddback).toBe(10_000)
        expect(callInput.niitSection911A1NetAddback).toBe(0)
      }
    })

    it('falls back to nested ACA broad when top-level broad is omitted', () => {
      const spy = vi.spyOn(federalTaxModule, 'computeFederalTax')
      const sizing = input({
        ordinaryIncomeBase: 50_000,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 0,
          taxExemptInterest: 0,
          foreignExclusionAddback: 12_000,
        },
      })
      sizeRothConversion(fill('irmaaTier', 1), sizing)
      expect(spy).toHaveBeenCalled()
      for (const [callInput] of spy.mock.calls) {
        expect(callInput.foreignExclusionAddback).toBe(12_000)
        expect(callInput.niitSection911A1NetAddback).toBe(12_000)
      }
    })

    it('transports narrow without top-level or nested ACA broad addback', () => {
      const spy = vi.spyOn(federalTaxModule, 'computeFederalTax')
      const sizing = input({
        ordinaryIncomeBase: 50_000,
        niitSection911A1NetAddback: 20_000,
        aca: undefined,
      })
      const withoutNarrow = sizeRothConversion(
        fill('irmaaTier', 1),
        input({ ordinaryIncomeBase: 50_000, aca: undefined }),
      )
      expect(withoutNarrow.ok).toBe(true)
      spy.mockClear()

      const withNarrow = sizeRothConversion(fill('irmaaTier', 1), sizing)
      expect(withNarrow.ok).toBe(true)
      if (!withoutNarrow.ok || !withNarrow.ok) return
      expect(withNarrow.amount).toBeCloseTo(withoutNarrow.amount, 1)
      expect(spy.mock.calls.length).toBeGreaterThan(0)
      for (const [callInput] of spy.mock.calls) {
        expect(callInput.foreignExclusionAddback).toBeUndefined()
        expect(callInput.niitSection911A1NetAddback).toBe(20_000)
      }
    })

    it('propagates a distinct narrow addback without changing the sizing metric', () => {
      const spy = vi.spyOn(federalTaxModule, 'computeFederalTax')
      const sizing = input({
        ordinaryIncomeBase: 50_000,
        foreignExclusionAddback: 30_000,
        niitSection911A1NetAddback: 20_000,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 0,
          taxExemptInterest: 0,
          foreignExclusionAddback: 30_000,
        },
      })
      const withoutNarrow = sizeRothConversion(
        fill('irmaaTier', 1),
        input({
          ordinaryIncomeBase: 50_000,
          foreignExclusionAddback: 30_000,
          aca: sizing.aca,
        }),
      )
      expect(withoutNarrow.ok).toBe(true)
      spy.mockClear()

      const withNarrow = sizeRothConversion(fill('irmaaTier', 1), sizing)
      expect(withNarrow.ok).toBe(true)
      if (!withoutNarrow.ok || !withNarrow.ok) return
      // IRMAA/fixed MAGI omit the foreign addback; NIIT input transport is orthogonal.
      expect(withNarrow.amount).toBeCloseTo(withoutNarrow.amount, 1)
      expect(spy.mock.calls.length).toBeGreaterThan(0)
      for (const [callInput] of spy.mock.calls) {
        expect(callInput.foreignExclusionAddback).toBe(30_000)
        expect(callInput.niitSection911A1NetAddback).toBe(20_000)
      }
    })

    it('keeps ACA-local addbacks on the ACA cliff metric', () => {
      const spy = vi.spyOn(federalTaxModule, 'computeFederalTax')
      const sizing = input({
        foreignExclusionAddback: 0,
        niitSection911A1NetAddback: 0,
        aca: {
          actionable: true,
          taxFamilySize: 1,
          fplRegion: 'contiguous',
          fixedMagiAddbacks: 7_000,
          taxExemptInterest: 3_000,
          foreignExclusionAddback: 7_000,
        },
      })
      const r = sizeRothConversion(fill('acaCliff', null), sizing)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      expect(r.amount).toBeCloseTo(15_650 * 4 - 10_000, 1)
      expect(spy).toHaveBeenCalled()
      for (const [callInput] of spy.mock.calls) {
        expect(callInput.foreignExclusionAddback).toBe(0)
        expect(callInput.niitSection911A1NetAddback).toBe(0)
      }
    })
  })
})
