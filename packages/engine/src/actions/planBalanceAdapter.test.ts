import { describe, expect, it } from 'vitest'
import { asUsdCents } from './money.js'
import {
  ledgerCentTotalToPlanDollars,
  ledgerCentsToPlanDollars,
  planDollarsToFlooredLedgerCents,
  planDollarsToLedgerCents,
  signedLedgerCentTotalToPlanDollars,
} from './planBalanceAdapter.js'

describe('Plan dollar / exact-cent adapter', () => {
  it.each([
    [0, 0],
    [0.0049, 0],
    [0.005, 1],
    [1.005, 101],
    [2.675, 268],
    [90_071_992_547_409.9, 9_007_199_254_740_990],
  ])('rounds the decimal spelling of %s dollars to %s cents', (dollars, cents) => {
    expect(planDollarsToLedgerCents(dollars)).toBe(cents)
  })

  it('rejects balances that round outside the safe-cent range', () => {
    expect(() => planDollarsToLedgerCents(90_071_992_547_410)).toThrow(RangeError)
  })

  it.each([-1, -0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid Plan dollar balance %s',
    (dollars) => {
      expect(() => planDollarsToLedgerCents(dollars)).toThrow(RangeError)
    },
  )

  it('returns only Plan dollar values that round-trip to the same cents', () => {
    expect(ledgerCentsToPlanDollars(asUsdCents(268))).toBe(2.68)
    const nearMaximum = asUsdCents(Number.MAX_SAFE_INTEGER - 1)
    expect(planDollarsToLedgerCents(ledgerCentsToPlanDollars(nearMaximum))).toBe(
      nearMaximum,
    )
  })

  it('rejects safe integer cents that lose precision as Plan dollars', () => {
    expect(() =>
      ledgerCentsToPlanDollars(asUsdCents(Number.MAX_SAFE_INTEGER)),
    ).toThrow(RangeError)
  })

  it('round-trips representable aggregate cents and rejects a one-cent loss', () => {
    expect(ledgerCentTotalToPlanDollars(10_000_000_000_000_000n)).toBe(
      100_000_000_000_000,
    )
    expect(() =>
      ledgerCentTotalToPlanDollars(18_014_398_509_481_979n),
    ).toThrow(RangeError)
  })

  it('crosses signed aggregate cents exactly without producing negative zero', () => {
    expect(signedLedgerCentTotalToPlanDollars(12_345n)).toBe(123.45)
    expect(signedLedgerCentTotalToPlanDollars(-12_345n)).toBe(-123.45)
    const zero = signedLedgerCentTotalToPlanDollars(0n)
    expect(zero).toBe(0)
    expect(Object.is(zero, -0)).toBe(false)
    expect(() =>
      signedLedgerCentTotalToPlanDollars(-18_014_398_509_481_979n),
    ).toThrow(RangeError)
  })

  it('truncates a spending capacity where the measurement rounds half-up', () => {
    // The pair that matters. A balance whose third decimal is at or above five
    // rounds UP as a measurement, which is half a cent the account does not
    // hold; as a capacity it has to truncate, or a movement sized against it
    // cannot be funded.
    expect(planDollarsToLedgerCents(23_945.147679)).toBe(2_394_515)
    expect(planDollarsToFlooredLedgerCents(23_945.147679)).toBe(2_394_514)
    expect(ledgerCentsToPlanDollars(planDollarsToFlooredLedgerCents(23_945.147679)))
      .toBeLessThanOrEqual(23_945.147679)
  })

  it('leaves an exact whole-cent balance alone', () => {
    // The boundary the truncation must not move: an account already on the
    // cent grid can fund every cent of itself, so both directions agree and a
    // gift can drain it to a hard zero.
    expect(planDollarsToFlooredLedgerCents(23_945.14)).toBe(2_394_514)
    expect(planDollarsToFlooredLedgerCents(0)).toBe(0)
    expect(ledgerCentsToPlanDollars(planDollarsToFlooredLedgerCents(23_945.14)))
      .toBe(23_945.14)
  })

  it('never reports more than the balance holds, at any scale', () => {
    for (const dollars of [
      0.004, 0.005, 0.009, 1.005, 99.999, 1_234.567, 1_000_000.005,
    ]) {
      const capacity = ledgerCentsToPlanDollars(planDollarsToFlooredLedgerCents(dollars))
      expect(capacity).toBeLessThanOrEqual(dollars)
      expect(dollars - capacity).toBeLessThan(0.01)
    }
  })

  it('rejects the same inputs the rounding conversion rejects', () => {
    expect(() => planDollarsToFlooredLedgerCents(-1)).toThrow(RangeError)
    expect(() => planDollarsToFlooredLedgerCents(Number.NaN)).toThrow(RangeError)
  })
})
