import { describe, expect, it } from 'vitest'

import {
  exactCentLargestRemainderSlices,
  exactCentNearestHalfUp,
  exactCentProRataNearestHalfUp,
} from './exactCentProRata.js'

describe('exactCentProRataNearestHalfUp', () => {
  it('rounds an exact half up', () => {
    expect(exactCentProRataNearestHalfUp(1n, 1n, 2n)).toBe(1n)
    expect(exactCentProRataNearestHalfUp(3n, 1n, 2n)).toBe(2n)
  })

  it('rounds below an exact half down', () => {
    expect(exactCentProRataNearestHalfUp(1n, 1n, 3n)).toBe(0n)
    expect(exactCentProRataNearestHalfUp(2n, 1n, 3n)).toBe(1n)
  })
})

describe('exactCentNearestHalfUp', () => {
  it('rounds an exact half cent up, in both directions of the neighbouring cent', () => {
    expect(exactCentNearestHalfUp(1n, 2n)).toBe(1n)
    expect(exactCentNearestHalfUp(3n, 2n)).toBe(2n)
    expect(exactCentNearestHalfUp(2_468_913n, 2n)).toBe(1_234_457n)
  })

  it('rounds a non-tie fractional cent to the nearer whole cent', () => {
    expect(exactCentNearestHalfUp(1n, 3n)).toBe(0n)
    expect(exactCentNearestHalfUp(2n, 3n)).toBe(1n)
    expect(exactCentNearestHalfUp(999_999_999n, 1_000n)).toBe(1_000_000n)
  })

  it('leaves a whole number of minor units alone', () => {
    expect(exactCentNearestHalfUp(0n, 1n)).toBe(0n)
    expect(exactCentNearestHalfUp(7n, 1n)).toBe(7n)
    expect(exactCentNearestHalfUp(400n, 4n)).toBe(100n)
  })
})

describe('exactCentLargestRemainderSlices', () => {
  it('sums to the whole when independent rounding would not', () => {
    // Each third rounds to 34, which would hand out 102 of 100. Largest
    // remainder settles the surplus against the two smallest remainders.
    const slices = exactCentLargestRemainderSlices(100n, [1n, 1n, 1n])

    expect(slices.reduce((sum, slice) => sum + slice, 0n)).toBe(100n)
    expect(slices).toEqual([34n, 33n, 33n])
  })

  it('gives the odd unit to the larger exact remainder', () => {
    // 100,001 at 1:2 is 33,333⅔ and 66,667⅓.
    expect(exactCentLargestRemainderSlices(100_001n, [1n, 2n]))
      .toEqual([33_334n, 66_667n])
  })

  it('breaks a remainder tie by position, not by weight order chance', () => {
    expect(exactCentLargestRemainderSlices(7n, [1n, 1n])).toEqual([4n, 3n])
    expect(exactCentLargestRemainderSlices(5n, [1n, 1n, 1n]))
      .toEqual([2n, 2n, 1n])
  })

  it('allocates nothing against a zero total weight or a zero amount', () => {
    expect(exactCentLargestRemainderSlices(100n, [0n, 0n])).toEqual([0n, 0n])
    expect(exactCentLargestRemainderSlices(0n, [1n, 2n])).toEqual([0n, 0n])
  })

  it('leaves a zero-weight part with nothing', () => {
    expect(exactCentLargestRemainderSlices(101n, [0n, 1n])).toEqual([0n, 101n])
  })

  it('sums to the whole across a large randomized sweep', () => {
    // The invariant the caller depends on: the parts are the whole, always,
    // whatever the weights. A drift of one cent here is a dollar that either
    // vanishes from a household or is credited to a Roth twice.
    let seed = 987_654_321n
    const next = (bound: bigint): bigint => {
      seed = (seed * 6_364_136_223_846_793_005n + 1_442_695_040_888_963_407n) &
        0xffff_ffff_ffff_ffffn
      return (seed >> 17n) % bound
    }
    for (let trial = 0; trial < 500; trial += 1) {
      const partCount = Number(next(6n)) + 1
      const weights = Array.from({ length: partCount }, () => next(1_000_000n))
      const amount = next(100_000_000n)
      const slices = exactCentLargestRemainderSlices(amount, weights)
      const total = weights.reduce((sum, weight) => sum + weight, 0n)
      expect(slices.every((slice) => slice >= 0n)).toBe(true)
      expect(slices.reduce((sum, slice) => sum + slice, 0n))
        .toBe(total <= 0n ? 0n : amount)
    }
  })
})
