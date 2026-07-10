import { describe, expect, it } from 'vitest'

import type { FilingStatus } from '../types'
import { computeStateTax } from '../../tax/stateTax'
import type { TaxYearInput } from '../../projection/types'
import { modeledStateCodes, stateParamsFor } from './index'
import { stateYear2026 } from './data/year2026'

const FILINGS: FilingStatus[] = ['single', 'marriedFilingJointly']

function input(over: Partial<TaxYearInput>): TaxYearInput {
  return { year: 2026, filingStatus: 'single', ordinaryIncome: 0, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, ...over }
}

describe('state pack coverage', () => {
  it('models all 50 states + DC', () => {
    expect(modeledStateCodes()).toHaveLength(51)
  })

  it('each entry key matches its code and has a name', () => {
    for (const [key, p] of Object.entries(stateYear2026.states)) {
      expect(p.code).toBe(key)
      expect(p.name.length).toBeGreaterThan(0)
      expect(key).toMatch(/^[A-Z]{2}$/)
    }
  })
})

describe('state pack data validity', () => {
  for (const code of modeledStateCodes()) {
    const p = stateParamsFor(code, 2026)!
    describe(`${code}`, () => {
      it('has well-formed brackets and deductions', () => {
        for (const f of FILINGS) {
          const brackets = p.brackets[f]
          expect(p.standardDeduction[f]).toBeGreaterThanOrEqual(0)
          if (!p.hasIncomeTax) continue
          expect(brackets.length).toBeGreaterThan(0)
          expect(brackets[0]!.lowerBound).toBe(0)
          for (let i = 0; i < brackets.length; i++) {
            expect(brackets[i]!.ratePct).toBeGreaterThanOrEqual(0)
            expect(brackets[i]!.ratePct).toBeLessThan(15)
            if (i > 0) {
              // strictly ascending bounds, non-decreasing rates
              expect(brackets[i]!.lowerBound).toBeGreaterThan(brackets[i - 1]!.lowerBound)
              expect(brackets[i]!.ratePct).toBeGreaterThanOrEqual(brackets[i - 1]!.ratePct)
            }
          }
        }
      })

      it('has a coherent retirement rule', () => {
        for (const rule of [p.retirementPrivate, p.retirementPublic]) {
          expect(['none', 'full', 'capped']).toContain(rule.kind)
          if (rule.kind === 'capped') expect(rule.capPerPerson).toBeGreaterThan(0)
        }
      })

      it('no-income-tax states compute zero', () => {
        if (p.hasIncomeTax) return
        expect(computeStateTax(p, input({ state: code, ordinaryIncome: 250_000, capitalGains: 80_000 }))).toBe(0)
      })
    })
  }
})

describe('spot oracle checks (flat states, single filer, non-retirement income)', () => {
  const wages = (state: string, amount: number) =>
    computeStateTax(stateParamsFor(state, 2026)!, input({ state, ordinaryIncome: amount }))

  it('PA: flat 3.07%, no deduction', () => {
    expect(wages('PA', 100_000)).toBeCloseTo(3070, 2)
  })

  it('KY: flat 3.5% over the $3,360 standard deduction', () => {
    expect(wages('KY', 100_000)).toBeCloseTo((100_000 - 3360) * 0.035, 2)
  })

  it('NC: flat 4.25% over the $12,750 standard deduction', () => {
    expect(wages('NC', 80_000)).toBeCloseTo((80_000 - 12_750) * 0.0425, 2)
  })

  it('IL: flat 4.95%, no deduction, but retirement income is fully exempt', () => {
    expect(wages('IL', 90_000)).toBeCloseTo(90_000 * 0.0495, 2)
    // Same income as retirement distributions → fully excluded → $0.
    expect(
      computeStateTax(stateParamsFor('IL', 2026)!, input({ state: 'IL', ordinaryIncome: 90_000, retirementIncome: 90_000, agesAlive: [70] })),
    ).toBe(0)
  })

  it('CO: flat 4.4% over the federal-equivalent deduction', () => {
    expect(wages('CO', 60_000)).toBeCloseTo((60_000 - 15_750) * 0.044, 2)
  })

  it('GA: graduated table reduces to flat 5.39% over the $12,000 deduction', () => {
    expect(wages('GA', 70_000)).toBeCloseTo((70_000 - 12_000) * 0.0539, 2)
  })
})
