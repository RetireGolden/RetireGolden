import { describe, expect, it } from 'vitest'

import type { FilingStatus } from '../types.js'
import { computeStateTax } from '../../tax/stateTax.js'
import type { TaxYearInput } from '../../projection/types.js'
import { packForYear, LATEST_PACK_YEAR } from '../index.js'
import { conformStateStandardDeduction, LATEST_STATE_PACK_YEAR, modeledStateCodes, stateParamsFor } from './index.js'
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
  // What the tag asserts is a fact about the NUMBER sitting next to it: that
  // this state's `standardDeduction` is not a state figure at all but a copy of
  // the federal one. So the expectation is derived from the federal pack, and
  // the assertion runs over every modeled state in both directions. A state
  // added to the tag while keeping its legislature's own figure fails; a state
  // that carries the federal figure but loses the tag — and would then freeze
  // while the federal engine projects the original forward — fails too.
  //
  // What this CANNOT catch, and no test in this file can: a state whose tag and
  // whose stored amount are wrong together, i.e. one that does not really adopt
  // the federal amount but has had that amount typed in anyway. DC (decoupled
  // from the OBBBA increase) is exactly that case and is still tagged here.
  // Detecting it needs an outside authority for what the state's own 2026
  // deduction is, which is the job of an external oracle in
  // stateTax.external.golden.test.ts, not of a test that can only read this
  // pack. AZ was the other instance and is no longer: a primary-source pass on
  // 2026-08-05 found A.R.S. 43-1041(A) sets Arizona's own amounts and (H)
  // borrows only the federal indexation method, so Arizona now carries its own
  // published figure untagged.
  const federal = packForYear(2026).pack.federalTax.standardDeduction
  const carriesTheFederalFigure = (p: { standardDeduction: { single: number; marriedFilingJointly: number } }) =>
    p.standardDeduction.single === federal.single &&
    p.standardDeduction.marriedFilingJointly === federal.marriedFilingJointly

  it('tags a state if and only if its deduction is the federal figure', () => {
    const mismatched: string[] = []
    let taggedCount = 0
    for (const code of modeledStateCodes()) {
      const p = stateParamsFor(code, 2026)!
      const tagged = p.standardDeductionConformity === 'federal'
      if (tagged) taggedCount++
      if (tagged !== carriesTheFederalFigure(p)) mismatched.push(code)
    }
    expect(mismatched).toEqual([])
    // Guards the vacuous pass. An "iff" is satisfied by both sides being false
    // everywhere, so a change that dropped every tag AND moved every amount off
    // the federal figure would leave `mismatched` empty while quietly ending
    // conformity for all nine.
    expect(taggedCount).toBeGreaterThan(0)
  })

  it('leaves ME and SC untagged with a figure of their own, since both decoupled for 2026', () => {
    // The decoupling is the statutory fact; the observable consequence is that
    // their published amounts are NOT the federal ones. Assert the consequence,
    // so re-typing either amount to the federal figure fails here rather than
    // silently making the tag optional.
    for (const code of ['ME', 'SC']) {
      const p = stateParamsFor(code, 2026)!
      expect(p.standardDeductionConformity).toBeUndefined()
      expect(carriesTheFederalFigure(p)).toBe(false)
    }
  })

  it('drives conformity entirely off the tag, for every modeled state', () => {
    // The behavioural half: whatever the tag says, `conformStateStandardDeduction`
    // must act on exactly the tagged states and no others. Expectations come
    // from the federal pack — an untagged state must come back identical, and a
    // tagged one must come back with both federal amounts scaled.
    const age65 = packForYear(2026).pack.federalTax.age65Addition
    for (const code of modeledStateCodes()) {
      const p = stateParamsFor(code, 2026)!
      const conformed = conformStateStandardDeduction(p, age65, 2)
      if (p.standardDeductionConformity !== 'federal') {
        expect(conformed).toBe(p)
        continue
      }
      expect(conformed.standardDeduction).toEqual({
        single: federal.single * 2,
        marriedFilingJointly: federal.marriedFilingJointly * 2,
      })
      expect(conformed.standardDeductionAge65Addition).toEqual({
        single: age65.single * 2,
        marriedFilingJointly: age65.marriedFilingJointly * 2,
      })
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

describe('conformStateStandardDeduction', () => {
  const AGE65 = packForYear(2026).pack.federalTax.age65Addition

  it('is a no-op on an untagged state at any scale', () => {
    const nc = stateParamsFor('NC', 2026)!
    expect(conformStateStandardDeduction(nc, AGE65, 2)).toBe(nc)
    expect(conformStateStandardDeduction(nc, AGE65, 0.5)).toBe(nc)
    // Above all: no age-65 addition leaks onto a state that publishes its own
    // deduction. Whatever age relief NC gives is already in its own figures.
    expect(conformStateStandardDeduction(nc, AGE65, 1).standardDeductionAge65Addition).toBeUndefined()
  })

  it('leaves the pack-year amounts alone at a scale of 1, or one that is not a usable factor', () => {
    const co = stateParamsFor('CO', 2026)!
    for (const scale of [1, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const conformed = conformStateStandardDeduction(co, AGE65, scale)
      expect(conformed.standardDeduction).toEqual(co.standardDeduction)
      // The addition is not an indexing artefact — it is part of the federal
      // deduction in the pack year too, so it attaches even at scale 1.
      expect(conformed.standardDeductionAge65Addition).toEqual(AGE65)
    }
  })

  it('moves the deduction and the age-65 addition, and nothing else', () => {
    const co = stateParamsFor('CO', 2026)!
    const conformed = conformStateStandardDeduction(co, AGE65, 2)
    expect(conformed.standardDeduction).toEqual({ single: 32_200, marriedFilingJointly: 64_400 })
    expect(conformed.standardDeductionAge65Addition).toEqual({ single: 4_100, marriedFilingJointly: 3_300 })
    expect(conformed.brackets).toEqual(co.brackets)
    expect(conformed.retirementPrivate).toEqual(co.retirementPrivate)
    expect(conformed.retirementPublic).toEqual(co.retirementPublic)
    const rest = { ...conformed, standardDeduction: co.standardDeduction }
    delete rest.standardDeductionAge65Addition
    expect(rest).toEqual(co)
  })
})
