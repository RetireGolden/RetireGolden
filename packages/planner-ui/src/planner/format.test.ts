/**
 * The formatters money surfaces share.
 *
 * Cents, minor units, and grouped plain numbers were each reimplemented
 * outside this module, so the same amount could render three ways depending on
 * which surface drew it. These pin the shapes those call sites depend on, and
 * the locale: a zero-argument `toLocaleString()` lets the host's ICU default
 * decide, which would make a stored scenario name depend on the machine that
 * created it.
 */
import { describe, expect, it } from 'vitest'

import { fmtMoney, fmtMoneyCents, fmtMoneyFromCents, fmtNumber, parseAmount } from './format'

describe('fmtMoneyCents', () => {
  it('keeps a remainder whole dollars would hide', () => {
    // The reconciliation case: one cent is not zero.
    expect(fmtMoneyCents(0.01)).toBe('$0.01')
    expect(fmtMoney(0.01)).toBe('$0')
  })

  it('always shows both cent digits, and reads a negative as one', () => {
    expect(fmtMoneyCents(1234.5)).toBe('$1,234.50')
    expect(fmtMoneyCents(-1234.5)).toBe('-$1,234.50')
    expect(fmtMoneyCents(1_000_000)).toBe('$1,000,000.00')
  })

  it('says so rather than printing NaN', () => {
    expect(fmtMoneyCents(Number.NaN)).toBe('—')
    expect(fmtMoneyCents(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('fmtMoneyFromCents', () => {
  it('renders minor units exactly, padding a single-digit remainder', () => {
    expect(fmtMoneyFromCents(123_456)).toBe('$1,234.56')
    expect(fmtMoneyFromCents(5)).toBe('$0.05')
    expect(fmtMoneyFromCents(0)).toBe('$0.00')
  })

  it('writes the minus the compact formatter writes, so a copied figure parses back', () => {
    const shown = fmtMoneyFromCents(-123_456)
    expect(shown).toBe('−$1,234.56')
    // U+2212, not a hyphen.
    expect(shown.startsWith('-')).toBe(false)
    expect(parseAmount(shown)).toBeCloseTo(-1234.56, 10)
  })

  it('keeps every digit of a cent count past the safe-integer range', () => {
    // 2^53 cents and one more: a float would collapse the last digit.
    expect(fmtMoneyFromCents(9_007_199_254_740_993n)).toBe('$90,071,992,547,409.93')
  })
})

describe('fmtNumber', () => {
  it('groups without a currency symbol', () => {
    expect(fmtNumber(96_000)).toBe('96,000')
    expect(fmtNumber(-1_500)).toBe('-1,500')
    expect(fmtNumber(0)).toBe('0')
  })

  it('matches what the scenario names used to build by hand, so no stored name changed shape', () => {
    for (const amount of [0, 1, 999, 1_000, 96_000, 1_234_567]) {
      expect(fmtNumber(amount), String(amount)).toBe(amount.toLocaleString('en-US'))
    }
  })

  it('says so rather than printing NaN', () => {
    expect(fmtNumber(Number.NaN)).toBe('—')
  })
})
