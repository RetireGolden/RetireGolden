/**
 * Spending-layer helper tests: the required/discretionary split always sums back
 * to the migrated total, and shortfall attribution keeps deliberate cuts out of
 * the required-floor signal.
 */

import { describe, expect, it } from 'vitest'

import { attributeShortfall, splitAnnualSpendingLayers, splitLifestyle } from './layers'

describe('splitLifestyle', () => {
  it('splits a target into required floor plus discretionary that sum back to the target', () => {
    const s = splitLifestyle(240_000, 80_000)
    expect(s.requiredLifestyle).toBe(80_000)
    expect(s.discretionaryLifestyle).toBe(160_000)
    expect(s.requiredLifestyle + s.discretionaryLifestyle).toBe(240_000)
  })

  it('collapses to an all-required layer when required equals the target (migration default)', () => {
    const s = splitLifestyle(120_000, 120_000)
    expect(s.requiredLifestyle).toBe(120_000)
    expect(s.discretionaryLifestyle).toBe(0)
  })

  it('clamps a required floor above the target so layers still sum to the target', () => {
    const s = splitLifestyle(100_000, 130_000)
    expect(s.requiredLifestyle).toBe(100_000)
    expect(s.discretionaryLifestyle).toBe(0)
  })
})

describe('splitAnnualSpendingLayers', () => {
  it('keeps baseAnnual as target and adds ideal/excess above it', () => {
    const s = splitAnnualSpendingLayers({
      baseAnnualNominal: 240_000,
      requiredAnnualNominal: 80_000,
      idealAnnualNominal: 30_000,
      excessAnnualNominal: 10_000,
    })
    expect(s.requiredLifestyle).toBe(80_000)
    expect(s.targetLifestyle).toBe(160_000)
    expect(s.idealLifestyle).toBe(30_000)
    expect(s.excessLifestyle).toBe(10_000)
  })
})

describe('attributeShortfall', () => {
  it('charges a deliberate guardrail cut to target, not required', () => {
    const a = attributeShortfall({
      requiredSpending: 80_000,
      targetSpending: 240_000,
      fundedSpending: 216_000, // 10% cut to the $160k discretionary layer
      withdrawalShortfall: 0,
    })
    expect(a.requiredShortfall).toBe(0)
    expect(a.targetShortfall).toBe(24_000)
  })

  it('keeps a shortfall off the floor while discretionary absorbs it', () => {
    const a = attributeShortfall({
      requiredSpending: 80_000,
      targetSpending: 240_000,
      fundedSpending: 240_000,
      withdrawalShortfall: 100_000, // within the $160k funded discretionary
    })
    expect(a.requiredShortfall).toBe(0)
    // The whole shortfall is a target miss (target ⊇ required).
    expect(a.targetShortfall).toBe(100_000)
  })

  it('reaches the required floor only once discretionary is exhausted', () => {
    const a = attributeShortfall({
      requiredSpending: 80_000,
      targetSpending: 240_000,
      fundedSpending: 240_000,
      withdrawalShortfall: 200_000, // 160k discretionary + 40k into the floor
    })
    expect(a.targetShortfall).toBe(200_000)
    expect(a.requiredShortfall).toBe(40_000)
  })

  it('combines a deliberate cut with a residual shortfall, target ⊇ required', () => {
    const a = attributeShortfall({
      requiredSpending: 80_000,
      targetSpending: 240_000,
      fundedSpending: 200_000, // 40k deliberate cut; 120k discretionary funded
      withdrawalShortfall: 130_000, // 120k on discretionary + 10k into the floor
    })
    expect(a.targetShortfall).toBe(40_000 + 130_000)
    expect(a.requiredShortfall).toBe(10_000)
    expect(a.targetShortfall).toBeGreaterThanOrEqual(a.requiredShortfall)
  })

  it('attributes misses to target before ideal and excess upside', () => {
    const a = attributeShortfall({
      requiredSpending: 80_000,
      targetSpending: 240_000,
      idealSpending: 40_000,
      excessSpending: 20_000,
      fundedSpending: 260_000,
      withdrawalShortfall: 0,
    })
    expect(a.requiredShortfall).toBe(0)
    expect(a.targetShortfall).toBe(0)
    expect(a.idealShortfall).toBe(20_000)
    expect(a.excessShortfall).toBe(20_000)
  })
})
