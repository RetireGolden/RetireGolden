import { describe, expect, it } from 'vitest'

import type { FilingStatus } from '../types.js'
import { computeStateTax } from '../../tax/stateTax.js'
import type { TaxYearInput } from '../../projection/types.js'
import { packForYear, LATEST_PACK_YEAR } from '../index.js'
import {
  conformStateStandardDeduction,
  LATEST_STATE_PACK_YEAR,
  modeledStateCodes,
  STATE_ENACTED_YEARS,
  stateEnactedYearFor,
  stateParamsFor,
} from './index.js'
import type { StateEnactedFigures } from './types.js'
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

  it('leaves ME and SC without whole-federal basic conformity, since both decoupled for 2026', () => {
    // The basic decoupling is the statutory fact; the observable consequence is
    // that their published amounts are NOT the federal ones. Assert the
    // consequence, so re-typing either amount to the federal figure fails here
    // rather than silently making the tag optional. Maine still adopts the
    // federal age-65 addition through the independent policy; South Carolina
    // does not.
    for (const code of ['ME', 'SC']) {
      const p = stateParamsFor(code, 2026)!
      expect(p.standardDeductionConformity).toBeUndefined()
      expect(carriesTheFederalFigure(p)).toBe(false)
    }
    expect(stateParamsFor('ME', 2026)!.standardDeductionAge65AdditionConformity).toBe('federal')
    expect(stateParamsFor('SC', 2026)!.standardDeductionAge65AdditionConformity).toBeUndefined()
  })

  it('drives conformity entirely off the adoption policies, for every modeled state', () => {
    // The behavioural half: whatever the tags say, `conformStateStandardDeduction`
    // must act on exactly the states that borrow a federal component and no
    // others. Expectations come from the federal pack — a state with neither
    // policy must come back identical; whole-federal basic scales both amounts;
    // age-addition-only preserves the published basic and attaches the addition.
    const age65 = packForYear(2026).pack.federalTax.age65Addition
    for (const code of modeledStateCodes()) {
      const p = stateParamsFor(code, 2026)!
      const conformed = conformStateStandardDeduction(p, age65, 2)
      const federalBasic = p.standardDeductionConformity === 'federal'
      const federalAdditional =
        federalBasic || p.standardDeductionAge65AdditionConformity === 'federal'
      if (!federalBasic && !federalAdditional) {
        expect(conformed).toBe(p)
        continue
      }
      if (federalBasic) {
        expect(conformed.standardDeduction).toEqual({
          single: federal.single * 2,
          marriedFilingJointly: federal.marriedFilingJointly * 2,
        })
      } else {
        expect(conformed.standardDeduction).toEqual(p.standardDeduction)
      }
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

describe('figures enacted for a year after the latest state figures', () => {
  const enacted = STATE_ENACTED_YEARS.flatMap((year) => Object.keys(year.states).map((code) => [year.year, code] as const))
  const entryFor = (year: number, code: string): StateEnactedFigures =>
    STATE_ENACTED_YEARS.find((enactedYear) => enactedYear.year === year)!.states[code]!
  const SCHEDULES = ['brackets', 'bracketsHeadOfHousehold', 'bracketsMarriedFilingSeparately'] as const

  it('names only years after the latest state figures, ascending, so none is ever silently shadowed', () => {
    const years = STATE_ENACTED_YEARS.map((year) => year.year)
    expect(years).toEqual([...new Set(years)].sort((a, b) => a - b))
    for (const year of years) expect(year).toBeGreaterThan(LATEST_STATE_PACK_YEAR)
  })

  it('loads the enacted figures verified from the statutes, and no Georgia or South Carolina rate', () => {
    // What is loaded, by year and state, with the fields each entry names.
    // This is not a claim that no other state has enacted a later figure: the
    // survey of all 51 jurisdictions, recorded state by state in
    // DOCS/domain/state-tax-research/later-years-survey-2026-09-28.md, covers
    // the rest.
    const loaded = enacted.map(([year, code]) => `${year} ${code}: ${Object.keys(entryFor(year, code)).join(', ')}`)
    expect(loaded).toEqual([
      '2027 IN: brackets',
      '2027 MS: brackets',
      '2027 MT: brackets, bracketsHeadOfHousehold, bracketsMarriedFilingSeparately, montanaLtcg',
      '2027 NE: brackets',
      '2027 NC: brackets',
      '2027 HI: brackets, bracketsHeadOfHousehold',
      '2027 NY: brackets',
      '2027 RI: brackets, rhodeIslandSocialSecurityModification',
      '2027 GA: retirementPrivate, retirementPublic',
      '2027 VA: standardDeduction',
      '2027 MD: marylandPublicSafetySubtraction',
      '2027 DE: delawareUnder60Pension, delawareMilitaryPension60Plus',
      '2027 ME: standardDeduction, standardDeductionConformity, standardDeductionAge65AdditionConformity',
      '2028 MS: brackets',
      '2028 HI: standardDeduction',
      '2028 RI: brackets',
      '2028 VA: standardDeduction',
      '2028 MD: marylandPublicSafetySubtraction',
      '2028 WA: hasIncomeTax, taxesSocialSecurity, capitalGainsAsOrdinary, capitalGainsTaxablePct, standardDeduction, standardDeductionStatutoryIndexing, directQcdPolicy, brackets',
      '2028 DE: delawareUnder60Pension, delawareMilitaryPension60Plus',
      '2029 MS: brackets',
      '2029 HI: brackets, bracketsHeadOfHousehold',
      '2029 RI: brackets',
      '2029 MD: marylandPublicSafetySubtraction',
      '2029 DE: delawareUnder60Pension, delawareMilitaryPension60Plus',
      '2029 IL: illinoisPersonalExemption',
      '2030 MS: brackets',
      '2030 NC: brackets',
      '2030 HI: standardDeduction',
      '2030 VA: standardDeduction',
      '2030 MD: marylandPublicSafetySubtraction',
      '2030 DC: standardDeduction, standardDeductionConformity, standardDeductionAge65AdditionConformity, standardDeductionStatutoryIndexing',
      '2030 CA: californiaMilitaryExclusions',
      '2031 HI: standardDeduction',
      '2031 CA: brackets',
      '2032 OR: oregonRetirementIncomeCredit',
      '2033 NC: brackets',
      '2033 NY: brackets',
    ])
    // Georgia's and South Carolina's rate cuts are conditional, so no year of
    // either changes a rate schedule (Georgia's 2027 entry is its retirement
    // exclusion only).
    for (const code of ['GA', 'SC']) {
      for (const year of [2027, 2030, 2035]) {
        for (const schedule of SCHEDULES) expect(stateParamsFor(code, year)![schedule], `${code} ${year} ${schedule}`).toEqual(stateParamsFor(code, 2026)![schedule])
      }
    }
    expect(stateParamsFor('GA', 2027)!.standardDeduction).toEqual(stateParamsFor('GA', 2026)!.standardDeduction)
    expect(stateEnactedYearFor('SC', 2027)).toBeNull()
  })

  it('replaces only the fields each entry names, and only from the enacted year on', () => {
    for (const [year, code] of enacted) {
      const entry = entryFor(year, code)
      const named = Object.keys(entry) as (keyof StateEnactedFigures)[]
      expect(named.length, `${year} ${code}`).toBeGreaterThan(0)
      const before = stateParamsFor(code, year - 1)!
      const after = stateParamsFor(code, year)!
      // The year before reads the state's previous enacted year, or the pack.
      const previous = enacted.filter(([earlierYear, earlierCode]) => earlierCode === code && earlierYear < year).at(-1)?.[0] ?? null
      expect(stateEnactedYearFor(code, year - 1)).toBe(previous)
      expect(stateEnactedYearFor(code, year)).toBe(year)
      // Carried forward nominally after the enacted year, as a pack's figures
      // are, until the state's next enacted year (or for good).
      const next = enacted.find(([laterYear, laterCode]) => laterCode === code && laterYear > year)?.[0]
      const heldTo = next === undefined ? year + 5 : next - 1
      expect(stateEnactedYearFor(code, heldTo)).toBe(year)
      expect(stateParamsFor(code, heldTo)).toEqual(after)
      // Each named field is the entry's (a field named as null has ended); at
      // least one of them changes; every other field is what the year before had.
      for (const key of named) {
        if (entry[key] === null) expect(Object.hasOwn(after, key), `${year} ${code} ${key} ended`).toBe(false)
        else expect(after[key], `${year} ${code} ${key}`).toEqual(entry[key])
      }
      expect(named.some((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key])), `${year} ${code} changes nothing`).toBe(true)
      const withoutNamed = (params: object): Record<string, unknown> => {
        const copy: Record<string, unknown> = { ...params }
        for (const key of named) delete copy[key]
        return copy
      }
      expect(withoutNamed(after)).toEqual(withoutNamed(before))
      for (const schedule of SCHEDULES) {
        const value = after[schedule]
        if (value === undefined) continue
        const tables = Array.isArray(value) ? [value] : FILINGS.map((status) => value[status])
        for (const brackets of tables) {
          expect(brackets[0]!.lowerBound).toBe(0)
          for (let i = 1; i < brackets.length; i++) expect(brackets[i]!.lowerBound).toBeGreaterThan(brackets[i - 1]!.lowerBound)
        }
      }
    }
  })

  it('reads each field from the latest entry at or before the year that names it, else from the pack', () => {
    const codes = [...new Set(enacted.map(([, code]) => code))]
    const lastYear = Math.max(...enacted.map(([year]) => year)) + 2
    for (const code of codes) {
      for (let year = LATEST_STATE_PACK_YEAR + 1; year <= lastYear; year++) {
        const expected: Record<string, unknown> = { ...stateYear2026.states[code]! }
        for (const [enactedYear, enactedCode] of enacted) {
          if (enactedCode !== code || enactedYear > year) continue
          for (const [key, value] of Object.entries(entryFor(enactedYear, code))) {
            if (value === null) delete expected[key]
            else expected[key] = value
          }
        }
        expect(stateParamsFor(code, year), `${code} ${year}`).toEqual(expected)
      }
    }
  })

  it('sets every filing status schedule its state carries whenever an entry changes a schedule', () => {
    for (const [year, code] of enacted) {
      const entry = entryFor(year, code)
      if (!SCHEDULES.some((schedule) => entry[schedule] !== undefined)) continue
      const pack = stateYear2026.states[code]!
      // The single and joint schedules always, and the head-of-household and
      // separate-filer schedules wherever the pack carries one, so no status
      // is left on the old rates beside the new ones.
      expect(entry.brackets, `${year} ${code} brackets`).toBeDefined()
      for (const status of FILINGS) expect(entry.brackets![status].length, `${year} ${code} ${status}`).toBeGreaterThan(0)
      for (const schedule of SCHEDULES) {
        if (pack[schedule] !== undefined) expect(entry[schedule], `${year} ${code} ${schedule}`).toBeTruthy()
      }
    }
  })

  it('reads a lower-case state code as its upper-case code', () => {
    expect(stateEnactedYearFor('nc', 2027)).toBe(2027)
    expect(stateParamsFor('nc', 2027)).toEqual(stateParamsFor('NC', 2027))
    expect(stateParamsFor('nc', 2027)!.brackets).not.toEqual(stateParamsFor('nc', 2026)!.brackets)
    expect(stateEnactedYearFor('mt', 2031)).toBe(2027)
    expect(stateParamsFor('mt', 2031)).toEqual(stateParamsFor('MT', 2031))
  })

  it('returns the pack entry itself for every state and year it does not touch', () => {
    for (const code of modeledStateCodes()) {
      if (stateEnactedYearFor(code, 2027) !== null) continue
      expect(stateParamsFor(code, 2027)).toBe(stateYear2026.states[code])
    }
    for (const code of modeledStateCodes()) expect(stateParamsFor(code, 2026)).toBe(stateYear2026.states[code])
  })

  it('never reaches back before the year it names', () => {
    for (const [, code] of enacted) {
      expect(stateParamsFor(code, 2025)).toBe(stateYear2026.states[code])
      expect(stateEnactedYearFor(code, 2025)).toBeNull()
    }
  })
})

describe('conformStateStandardDeduction', () => {
  const AGE65 = packForYear(2026).pack.federalTax.age65Addition

  it('is a no-op on a state with neither federal adoption policy at any scale', () => {
    const nc = stateParamsFor('NC', 2026)!
    expect(nc.standardDeductionConformity).toBeUndefined()
    expect(nc.standardDeductionAge65AdditionConformity).toBeUndefined()
    expect(conformStateStandardDeduction(nc, AGE65, 2)).toBe(nc)
    expect(conformStateStandardDeduction(nc, AGE65, 0.5)).toBe(nc)
    // Above all: no age-65 addition leaks onto a state that publishes its own
    // deduction and does not adopt the federal additional amount.
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
