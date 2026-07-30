import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  addUsdCents,
  asPositiveUsdCents,
  asUsdCents,
  positiveUsdCentsSchema,
  subtractUsdCents,
  sumUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'

describe('exact USD cents', () => {
  it('accepts its safe-integer boundaries', () => {
    expect(usdCentsSchema.parse(0)).toBe(0)
    expect(usdCentsSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
    expect(positiveUsdCentsSchema.parse(1)).toBe(1)
    expect(positiveUsdCentsSchema.parse(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER)
  })

  it.each([-1, -0, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an inexact or out-of-range cent value: %s',
    (value) => {
      expect(usdCentsSchema.safeParse(value).success).toBe(false)
    },
  )

  it('requires positive cents where movement is requested', () => {
    expect(positiveUsdCentsSchema.safeParse(0).success).toBe(false)
    const positive = positiveUsdCentsSchema.parse(1)
    expectTypeOf(positive).toEqualTypeOf<PositiveUsdCents>()
    expectTypeOf(positive).toMatchTypeOf<UsdCents>()
  })

  it('constructs branded cents through explicit runtime boundaries', () => {
    expect(asUsdCents(0)).toBe(0)
    expect(asPositiveUsdCents(1)).toBe(1)
    expect(() => asUsdCents(-0)).toThrow()
    expect(() => asPositiveUsdCents(0)).toThrow()
  })

  it('adds, subtracts, and sums exact cents', () => {
    const one = usdCentsSchema.parse(1)
    const two = usdCentsSchema.parse(2)

    expect(addUsdCents(one, two)).toBe(3)
    expect(subtractUsdCents(two, one)).toBe(1)
    expect(sumUsdCents([one, two, usdCentsSchema.parse(0)])).toBe(3)
    expect(sumUsdCents([])).toBe(0)
  })

  it('rejects overflow and underflow rather than rounding', () => {
    const max = usdCentsSchema.parse(Number.MAX_SAFE_INTEGER)
    const one = usdCentsSchema.parse(1)
    const zero = usdCentsSchema.parse(0)

    expect(() => addUsdCents(max, one)).toThrow()
    expect(() => subtractUsdCents(zero, one)).toThrow()
    expect(() => sumUsdCents([max, one])).toThrow()
  })

  it('round-trips as an ordinary JSON integer', () => {
    const amount = positiveUsdCentsSchema.parse(12_345)
    const serialized = JSON.stringify({ amount })

    expect(serialized).toBe('{"amount":12345}')
    expect(usdCentsSchema.parse(JSON.parse(serialized).amount)).toBe(amount)
  })
})
