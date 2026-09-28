/**
 * The credit estimate's edges the worksheet cases do not reach (the slice
 * review's surviving mutants CR1, CR5 and QC2): 1937, the first covered year;
 * 1978, the first year of SSA's quarter-of-coverage amounts; and an entered
 * count of exactly 40.
 */
import { describe, expect, it } from 'vitest'

import { creditsForYear, estimateCredits } from './credits.js'

describe('creditsForYear', () => {
  it('credits 1937, the first year work was covered, at $50 a quarter, and nothing before it', () => {
    expect(creditsForYear(1937, 120)).toBe(2)
    expect(creditsForYear(1936, 120)).toBe(0)
  })

  it('counts 1978 at its own quarter-of-coverage amount, $250, not by $50 quarters', () => {
    expect(creditsForYear(1978, 600)).toBe(2)
    expect(creditsForYear(1977, 600)).toBe(4)
  })
})

describe('estimateCredits', () => {
  it('an entered count of exactly 40 is eligible, and 39 is not', () => {
    expect(estimateCredits([], 40)).toEqual({ credits: 40, eligible: true, estimated: false })
    expect(estimateCredits([], 39).eligible).toBe(false)
  })
})
