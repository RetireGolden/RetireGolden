/**
 * Guardrail decision tests. Withdrawal-rate: cut above the upper band, restore
 * below the lower band, hold inside, and clamp to [0, 1]. Balance-triggered
 * (risk-based): cut below the lower dollar threshold, raise above the upper,
 * and hold whenever thresholds are missing or degenerate.
 */

import { describe, expect, it } from 'vitest'

import { nextBalanceGuardrailMultiplier, nextGuardrailMultiplier } from './guardrails.js'

describe('nextGuardrailMultiplier', () => {
  const starting = 0.04 // 4% starting withdrawal rate

  it('holds when the current rate sits inside the band', () => {
    const d = nextGuardrailMultiplier(1, 0.042, starting) // ratio 1.05, band 0.8–1.2
    expect(d.action).toBe('hold')
    expect(d.multiplier).toBe(1)
  })

  it('cuts the discretionary layer when the rate runs above the upper band', () => {
    const d = nextGuardrailMultiplier(1, 0.05, starting) // ratio 1.25 > 1.2
    expect(d.action).toBe('cut')
    expect(d.multiplier).toBeCloseTo(0.9, 10)
  })

  it('restores the discretionary layer when the rate falls below the lower band', () => {
    const d = nextGuardrailMultiplier(0.8, 0.03, starting) // ratio 0.75 < 0.8
    expect(d.action).toBe('raise')
    expect(d.multiplier).toBeCloseTo(0.9, 10)
  })

  it('never cuts below the required floor (multiplier floored at 0)', () => {
    const d = nextGuardrailMultiplier(0.05, 0.09, starting)
    expect(d.multiplier).toBe(0)
    expect(d.action).toBe('cut')
  })

  it('reports hold, not raise, once already at full discretionary spending', () => {
    const d = nextGuardrailMultiplier(1, 0.01, starting) // wants to raise but already at 1
    expect(d.multiplier).toBe(1)
    expect(d.action).toBe('hold')
  })

  it('can raise above target when the caller provides upside room', () => {
    const d = nextGuardrailMultiplier(1, 0.01, starting, {}, 1.5)
    expect(d.action).toBe('raise')
    expect(d.multiplier).toBeCloseTo(1.1, 10)
  })

  it('holds on an undefined signal (no starting portfolio)', () => {
    const d = nextGuardrailMultiplier(0.7, 0.04, 0)
    expect(d.action).toBe('hold')
    expect(d.multiplier).toBe(0.7)
  })

  it('honors custom bands and adjustment size', () => {
    const policy = { upperGuardrailPct: 110, lowerGuardrailPct: 90, adjustmentPct: 25 }
    const d = nextGuardrailMultiplier(1, 0.046, starting, policy) // ratio 1.15 > 1.10
    expect(d.action).toBe('cut')
    expect(d.multiplier).toBeCloseTo(0.75, 10)
  })
})

describe('nextBalanceGuardrailMultiplier (risk-based)', () => {
  const starting = 1_000_000
  const policy = { lowerBalanceThresholdPct: 80, upperBalanceThresholdPct: 130 }

  it('holds while the real balance stays between the thresholds', () => {
    const d = nextBalanceGuardrailMultiplier(1, 1_000_000, starting, policy)
    expect(d.action).toBe('hold')
    expect(d.multiplier).toBe(1)
  })

  it('cuts one step when the real balance falls below the lower threshold', () => {
    const d = nextBalanceGuardrailMultiplier(1, 799_000, starting, policy)
    expect(d.action).toBe('cut')
    expect(d.multiplier).toBeCloseTo(0.9, 10)
  })

  it('restores one step when the real balance rises above the upper threshold', () => {
    const d = nextBalanceGuardrailMultiplier(0.8, 1_310_000, starting, policy)
    expect(d.action).toBe('raise')
    expect(d.multiplier).toBeCloseTo(0.9, 10)
  })

  it('reports hold, not raise, once already at the multiplier ceiling', () => {
    const d = nextBalanceGuardrailMultiplier(1, 2_000_000, starting, policy)
    expect(d.action).toBe('hold')
    expect(d.multiplier).toBe(1)
  })

  it('can raise above target when the caller provides upside room', () => {
    const d = nextBalanceGuardrailMultiplier(1, 2_000_000, starting, policy, 1.5)
    expect(d.action).toBe('raise')
    expect(d.multiplier).toBeCloseTo(1.1, 10)
  })

  it('holds forever when thresholds have not been solved (inert mode)', () => {
    const d = nextBalanceGuardrailMultiplier(1, 100, starting, {})
    expect(d.action).toBe('hold')
    expect(d.multiplier).toBe(1)
  })

  it('holds on a degenerate inverted threshold pair', () => {
    const inverted = { lowerBalanceThresholdPct: 130, upperBalanceThresholdPct: 80 }
    const d = nextBalanceGuardrailMultiplier(1, 100, starting, inverted)
    expect(d.action).toBe('hold')
  })

  it('holds on an undefined signal (no starting portfolio)', () => {
    const d = nextBalanceGuardrailMultiplier(0.7, 500_000, 0, policy)
    expect(d.action).toBe('hold')
    expect(d.multiplier).toBe(0.7)
  })

  it('honors the adjustment step size', () => {
    const d = nextBalanceGuardrailMultiplier(1, 700_000, starting, { ...policy, adjustmentPct: 25 })
    expect(d.action).toBe('cut')
    expect(d.multiplier).toBeCloseTo(0.75, 10)
  })
})
