import { describe, expect, it } from 'vitest'

import { openIraProRataYear, splitIraDistribution } from './iraBasis'

describe('Form 8606 pro-rata rule', () => {
  it('splits a distribution by the basis fraction', () => {
    // $20k basis in a $100k IRA → 20% of any distribution is nontaxable.
    const year = openIraProRataYear(20_000, 100_000)
    expect(year.nontaxableFraction).toBeCloseTo(0.2, 10)
    const split = splitIraDistribution(year, 10_000)
    expect(split.nontaxable).toBeCloseTo(2_000, 6)
    expect(split.taxable).toBeCloseTo(8_000, 6)
    expect(split.next.basis).toBeCloseTo(18_000, 6)
  })

  it('holds the fraction fixed across multiple draws in the same year', () => {
    // The 8606 fraction is set once per year from the pre-distribution balance;
    // a second draw uses the same fraction, not a recomputed one.
    let year = openIraProRataYear(20_000, 100_000)
    const first = splitIraDistribution(year, 10_000)
    year = first.next
    const second = splitIraDistribution(year, 10_000)
    expect(second.nontaxable).toBeCloseTo(2_000, 6)
    expect(first.nontaxable + second.nontaxable).toBeCloseTo(4_000, 6)
  })

  it('a hand-worked 8606: $7,000 nondeductible into a $63,000 pre-tax IRA, convert $7,000', () => {
    // Classic backdoor: total IRA = $70,000, basis = $7,000 → basis fraction 10%.
    // Converting $7,000 is only $700 nontaxable; $6,300 is ordinary income.
    const year = openIraProRataYear(7_000, 70_000)
    const conversion = splitIraDistribution(year, 7_000)
    expect(conversion.nontaxable).toBeCloseTo(700, 6)
    expect(conversion.taxable).toBeCloseTo(6_300, 6)
    expect(conversion.next.basis).toBeCloseTo(6_300, 6)
  })

  it('never returns more basis than remains', () => {
    const year = openIraProRataYear(5_000, 5_000) // 100% basis (balance == basis)
    const split = splitIraDistribution(year, 8_000)
    expect(split.nontaxable).toBe(5_000)
    expect(split.next.basis).toBe(0)
  })

  it('no basis means everything is taxable', () => {
    const year = openIraProRataYear(0, 100_000)
    const split = splitIraDistribution(year, 10_000)
    expect(split.nontaxable).toBe(0)
    expect(split.taxable).toBe(10_000)
  })
})
