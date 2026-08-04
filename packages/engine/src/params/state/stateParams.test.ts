import { describe, expect, it } from 'vitest'

import type { FilingStatus } from '../types.js'
import { computeStateTax } from '../../tax/stateTax.js'
import type { TaxYearInput } from '../../projection/types.js'
import { packForYear, LATEST_PACK_YEAR } from '../index.js'
import { indexConformedStateStandardDeduction, LATEST_STATE_PACK_YEAR, modeledStateCodes, stateParamsFor } from './index.js'
import { stateYear2026 } from './data/year2026.js'

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

  it('NC: flat 3.99% over the $12,750 standard deduction (2026 statutory ramp step)', () => {
    expect(wages('NC', 80_000)).toBeCloseTo((80_000 - 12_750) * 0.0399, 2)
  })

  it('IL: flat 4.95%, no deduction, but retirement income is fully exempt', () => {
    expect(wages('IL', 90_000)).toBeCloseTo(90_000 * 0.0495, 2)
    // Same income as retirement distributions → fully excluded → $0.
    expect(
      computeStateTax(stateParamsFor('IL', 2026)!, input({ state: 'IL', ordinaryIncome: 90_000, retirementIncome: 90_000, agesAlive: [70] })),
    ).toBe(0)
  })

  it('CO: flat 4.4% over the federal-equivalent deduction (2026 federal figure)', () => {
    expect(wages('CO', 60_000)).toBeCloseTo((60_000 - 16_100) * 0.044, 2)
  })

  it('GA: flat 4.99% over the $15,000 deduction (2026 DOR vintage)', () => {
    expect(wages('GA', 70_000)).toBeCloseTo((70_000 - 15_000) * 0.0499, 2)
  })
})

describe('federal standard-deduction conformity tags', () => {
  // The tag is what `indexConformedStateStandardDeduction` reads, so the list
  // has to be exact in both directions. A state added to it wrongly would have
  // its own legislature's figure grow with federal inflation; a state dropped
  // from it would hold a copy of the federal deduction frozen while the federal
  // engine projects the original forward, which is the defect this guards.
  const CONFORMED = ['AZ', 'CO', 'DC', 'IA', 'ID', 'MO', 'MT', 'ND', 'NM']

  it('tags exactly the states that carry the federal figure', () => {
    const tagged = modeledStateCodes().filter(
      (code) => stateParamsFor(code, 2026)!.standardDeductionConformity === 'federal',
    )
    expect(tagged).toEqual(CONFORMED)
  })

  it('gives every tagged state the federal 2026 amount it claims to be carrying', () => {
    const federal = packForYear(2026).pack.federalTax.standardDeduction
    for (const code of CONFORMED) {
      const p = stateParamsFor(code, 2026)!
      expect(p.standardDeduction.single).toBe(federal.single)
      expect(p.standardDeduction.marriedFilingJointly).toBe(federal.marriedFilingJointly)
    }
  })

  it('leaves ME and SC untagged, since both decoupled for 2026', () => {
    for (const code of ['ME', 'SC']) {
      expect(stateParamsFor(code, 2026)!.standardDeductionConformity).toBeUndefined()
    }
  })

  it('publishes the state pack for the same year as the federal pack', () => {
    // The conformed copy is scaled by `TaxYearInput.inflationScale`, which is
    // measured from the FEDERAL pack year. That is only the right factor while
    // the two packs are published for the same year; if they ever diverge, the
    // scale has to be rebased before this test can be relaxed.
    expect(LATEST_STATE_PACK_YEAR).toBe(LATEST_PACK_YEAR)
  })
})

describe('indexConformedStateStandardDeduction', () => {
  it('is a no-op on an untagged state at any scale', () => {
    const nc = stateParamsFor('NC', 2026)!
    expect(indexConformedStateStandardDeduction(nc, 2)).toBe(nc)
    expect(indexConformedStateStandardDeduction(nc, 0.5)).toBe(nc)
  })

  it('is a no-op at a scale of exactly 1, or a scale that is not a usable factor', () => {
    const co = stateParamsFor('CO', 2026)!
    for (const scale of [1, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(indexConformedStateStandardDeduction(co, scale)).toBe(co)
    }
  })

  it('moves the deduction and nothing else', () => {
    const co = stateParamsFor('CO', 2026)!
    const indexed = indexConformedStateStandardDeduction(co, 2)
    expect(indexed.standardDeduction).toEqual({ single: 32_200, marriedFilingJointly: 64_400 })
    expect(indexed.brackets).toEqual(co.brackets)
    expect(indexed.retirementPrivate).toEqual(co.retirementPrivate)
    expect(indexed.retirementPublic).toEqual(co.retirementPublic)
    expect({ ...indexed, standardDeduction: co.standardDeduction }).toEqual(co)
  })
})
