import { describe, expect, it } from 'vitest'

import {
  applyHudModeledDraw,
  applyHudYearEndComponents,
  captureHudModeledDebtFromLoanBalance,
  cloneHecmLineStateForRollback,
  commitHudYearEndFromComputed,
  computeHudYearEndFromServicing,
  initializeHudObservedBaseline,
} from './hecmLineState.js'

function hudLine(overrides: Partial<{
  principalLimit: number
  loanBalance: number
  observedServicingBaseline: number
  modeledDebt: number
}> = {}) {
  const line = {
    principalLimit: 500_000,
    loanBalance: 100_000,
    calculationMode: 'hudValidated' as const,
    observedServicingBaseline: 100_000,
    modeledDebt: 0,
    ...overrides,
  }
  return line
}

describe('hecmLineState — observed vs modeled debt', () => {
  it('initializes opening baseline with zero modeled debt', () => {
    const line = { principalLimit: 1, loanBalance: 0, calculationMode: 'hudValidated' as const }
    initializeHudObservedBaseline(line, 129_982.5)
    expect(line).toMatchObject({
      loanBalance: 129_982.5,
      observedServicingBaseline: 129_982.5,
      modeledDebt: 0,
    })
  })

  it('preserves a same-year modeled draw through complete servicer replacement (r1-3)', () => {
    const line = hudLine()
    applyHudModeledDraw(line, 10_000)
    expect(line.loanBalance).toBe(110_000)
    const growth = 1.065
    const yearEnd = computeHudYearEndFromServicing(line, growth, {
      status: 'complete',
      endingLoanBalance: 100_501.147426,
      totalMipAccrued: 501.147426,
    })
    expect(yearEnd.observedServicingBaseline).toBeCloseTo(100_501.147426, 5)
    expect(yearEnd.modeledDebt).toBeCloseTo(10_650, 2)
    expect(yearEnd.loanBalance).toBeCloseTo(111_151.147426, 5)
  })

  it('infers modeled debt when the caller only mutates loanBalance', () => {
    const line = hudLine({ loanBalance: 110_000 })
    captureHudModeledDebtFromLoanBalance(line)
    expect(line.modeledDebt).toBe(10_000)
    expect(line.loanBalance).toBe(110_000)
  })

  it('books coordinated and backstop draws explicitly in modeledDebt', () => {
    const line = hudLine()
    applyHudModeledDraw(line, 6_000)
    applyHudModeledDraw(line, 4_000)
    expect(line.modeledDebt).toBe(10_000)
    expect(line.observedServicingBaseline).toBe(100_000)
    expect(line.loanBalance).toBe(110_000)
  })

  it('legacy lines still increment loanBalance when applyHudModeledDraw is routed', () => {
    const line = { principalLimit: 200_000, loanBalance: 25_000 }
    applyHudModeledDraw(line, 5_000)
    expect(line.loanBalance).toBe(30_000)
    expect(line).not.toHaveProperty('modeledDebt')
  })

  it('applies disclosed growthRatePct estimate when the ledger is incomplete (r1-4)', () => {
    const line = hudLine()
    const growth = 1.065
    const yearEnd = computeHudYearEndFromServicing(line, growth, {
      status: 'timingEvidenceIncomplete',
    })
    expect(yearEnd.observedServicingBaseline).toBeCloseTo(106_500, 2)
    expect(yearEnd.modeledDebt).toBe(0)
    expect(yearEnd.loanBalance).toBeCloseTo(106_500, 2)
    expect(yearEnd.incompleteReason).toBe('timingEvidenceIncomplete')
  })

  it('carries modeled debt into the next year and compounds it separately from observed MIP', () => {
    const line = hudLine({
      observedServicingBaseline: 100_501.147426,
      modeledDebt: 10_650,
      loanBalance: 111_151.147426,
    })
    const growth = 1.065
    const yearEnd = computeHudYearEndFromServicing(line, growth, {
      status: 'complete',
      endingLoanBalance: 101_004.806,
      totalMipAccrued: 503.658574,
    })
    expect(yearEnd.observedServicingBaseline).toBeCloseTo(101_004.806, 3)
    expect(yearEnd.modeledDebt).toBeCloseTo(11_342.25, 2)
    expect(yearEnd.loanBalance).toBeCloseTo(112_347.056, 2)
  })

  it('clones HUD component fields for rollback', () => {
    const line = hudLine({ modeledDebt: 10_650 })
    const clone = cloneHecmLineStateForRollback(line)
    expect(clone).toEqual(line)
    expect(clone).not.toBe(line)
  })

  it('commits shadow row outputs onto a live line once', () => {
    const live = hudLine({ loanBalance: 110_000, principalLimit: 400_000 })
    commitHudYearEndFromComputed(live, 1.065, {
      observedServicingBaseline: 100_501.147426,
      modeledDebt: 10_650,
      loanBalance: 111_151.147426,
    })
    expect(live.principalLimit).toBeCloseTo(400_000 * 1.065, 6)
    expect(live.loanBalance).toBeCloseTo(111_151.147426, 5)
    expect(live.observedServicingBaseline).toBeCloseTo(100_501.147426, 5)
    expect(live.modeledDebt).toBeCloseTo(10_650, 2)
  })

  it('shadow and live close share one ending total via applyHudYearEndComponents', () => {
    const shadow = hudLine({ loanBalance: 110_000 })
    const ending = applyHudYearEndComponents(
      shadow,
      1.065,
      100_501.147426,
      10_650,
    )
    const live = hudLine({ loanBalance: 110_000, principalLimit: shadow.principalLimit })
    commitHudYearEndFromComputed(live, 1.065, ending)
    expect(live.loanBalance).toBeCloseTo(shadow.loanBalance, 8)
    expect(live.observedServicingBaseline).toBe(shadow.observedServicingBaseline)
    expect(live.modeledDebt).toBe(shadow.modeledDebt)
  })
})

describe('hecmLineState — twelve monthly MIP assessments on 100000 baseline', () => {
  it('matches the stipulated H1 ending balance before any modeled draw', () => {
    const baseline = 100_000 * (1 + 0.005 / 12) ** 12
    expect(baseline).toBeCloseTo(100_501.147426, 5)
  })
})
