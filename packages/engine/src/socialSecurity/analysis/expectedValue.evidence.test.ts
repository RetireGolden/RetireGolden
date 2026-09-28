import { expect, it } from 'vitest'

import type { FormerSpouse } from '../../model/plan.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../../rules/describeCalculation.js'
import { couplePlan, singlePersonPlan, socialSecurityIncome, validatePlan } from '../../testing/planFixtures.js'
import { neverClaimedDeceasedFactor, survivorBenefitMonthly, widowEntitlementAgeMonths } from '../survivorBenefit.js'
import { bestMaritalBenefit } from '../maritalBenefits.js'
import {
  benefitsOnlyRanking,
  expectedPvCouple,
  expectedPvSingle,
  singleBenefitInYear,
  type ExpectedValueClaimant,
  type ExpectedValueOptions,
} from './expectedValue.js'

const WORKSHEET = 'DOCS/calculations/social-security/social-security-expected-value.md'
const MUTATION = 'DOCS/calculations/social-security/social-security-expected-value.mutation.md'

// The Expected table's first two columns: the model's value and the retired model's.
const rows = worksheetExpectedRows(WORKSHEET)
const expectedOf = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const retiredOf = (label: string): number => worksheetNumber(rows.get(label)![1]!)

const matchInflation = { inflationPct: 2.5, ssCola: { mode: 'matchInflation' as const }, ssHaircut: null }
const options: ExpectedValueOptions = { startYear: 2026, discountRate: 0.02, assumptions: matchInflation }
const single = { single: true }
const dob = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) })
const claim = (years: number, months = 0) => ({ years, months })
const divorcedEx: FormerSpouse = { id: 'ex', relationship: 'divorced', dob: '1966-02-10', piaMonthly: 2_000, marriageYears: 12, remarriedAtAge: null }

const cases = {
  sA: { dob: dob('1963-06-15'), sex: 'female', piaMonthly: 1_850, claimAge: claim(67) },
  sB: { dob: dob('1963-06-15'), sex: 'female', piaMonthly: 1_850, claimAge: claim(67, 6) },
  sC: { dob: dob('1964-06-15'), sex: 'female', piaMonthly: 800, claimAge: claim(62), formerSpouses: [divorcedEx] },
  sE: { dob: dob('1909-03-03'), sex: 'male', piaMonthly: 1_000, claimAge: claim(70) },
  cAL: { dob: dob('1964-06-15'), sex: 'female', piaMonthly: 800, claimAge: claim(62) },
  cAH: { dob: dob('1964-02-10'), sex: 'male', piaMonthly: 2_000, claimAge: claim(62) },
  cBL: { dob: dob('1964-03-10'), sex: 'female', piaMonthly: 800, claimAge: claim(62) },
  cBH: { dob: dob('1964-08-20'), sex: 'male', piaMonthly: 2_400, claimAge: claim(70) },
  cCW: { dob: dob('1962-06-15'), sex: 'female', piaMonthly: 1_000, claimAge: claim(67) },
  cCH: { dob: dob('1960-06-15'), sex: 'male', piaMonthly: 3_000, claimAge: claim(70) },
  cDW: { dob: dob('1959-03-10'), sex: 'female', piaMonthly: 500, claimAge: claim(67) },
  cDH: { dob: dob('1964-02-10'), sex: 'male', piaMonthly: 2_000, claimAge: claim(62) },
  cEW: { dob: dob('1964-06-15'), sex: 'female', piaMonthly: 100, claimAge: claim(67) },
  cEH: { dob: dob('1964-01-15'), sex: 'male', piaMonthly: 1_000, claimAge: claim(70) },
} satisfies Record<string, ExpectedValueClaimant>

function expectPv(actual: number, label: string): void {
  const expected = expectedOf(label)
  expect(withinTolerance(actual, expected, { rel: 1e-12 }), `${label}: ${actual} against the worksheet's ${expected}`).toBe(true)
}

function expectAmount(actual: number, label: string): void {
  const expected = expectedOf(label)
  expect(withinTolerance(actual, expected, { abs: 1e-9 }), `${label}: ${actual} against the worksheet's ${expected}`).toBe(true)
}

describeCalculation(
  'social-security-expected-value',
  {
    example: {
      inputs: { options, cases },
      expected: {
        sA: expectedOf('S-A'),
        cA: expectedOf('C-A'),
        cA2026: expectedOf('C-A 2026 benefits'),
      },
      tolerance: { rel: 1e-12 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  () => {
    it('single cases S-A, S-B and S-E: the claim months count, and S-A and S-E equal the retired model', () => {
      expectPv(expectedPvSingle(cases.sA, single, options), 'S-A')
      expectPv(expectedPvSingle(cases.sB, single, options), 'S-B')
      expectPv(expectedPvSingle(cases.sE, single, options), 'S-E')
      expect(withinTolerance(expectedPvSingle(cases.sA, single, options), retiredOf('S-A'), { rel: 1e-12 })).toBe(true)
      expect(withinTolerance(expectedPvSingle(cases.sB, single, options), retiredOf('S-B'), { rel: 1e-6 })).toBe(false)
    })

    it('S-C: a divorced spouse is paid from the year of the first month the ex is 62 throughout, own plus the excess reduced at 765 months (707.50)', () => {
      expectPv(expectedPvSingle(cases.sC, single, options), 'S-C')
      expect(singleBenefitInYear(cases.sC, single, 2027)).toBe(560 * 12)
      expectAmount(singleBenefitInYear(cases.sC, single, 2028) / 12, 'S-C monthly from 2028')
      // In a couple the divorced record pays nothing (the ledger's single-household gate).
      expect(singleBenefitInYear(cases.sC, { single: false }, 2028)).toBe(560 * 12)
      const best = bestMaritalBenefit([divorcedEx], {
        claimantDob: cases.sC.dob, claimantClaimAge: claim(62), claimantOwnPiaMonthly: 800, claimantOwnActualMonthly: 560,
        claimantAge: 64, year: 2028, claimantIsSingle: true,
      })
      expect(best?.monthly).toBe(expectedOf('S-C monthly from 2028'))
    })

    it('S-D: a fixed 2% COLA against 2.5% inflation and a 17% haircut from 2034 lower the real value', () => {
      const drift: ExpectedValueOptions = { ...options, assumptions: { inflationPct: 2.5, ssCola: { mode: 'fixed', annualPct: 2 }, ssHaircut: { fromYear: 2034, cutPct: 17 } } }
      expectPv(expectedPvSingle(cases.sA, single, drift), 'S-D')
    })

    it('C-A, the R7 case: 690 a month while both live (25,080 in 2026) and the widow benefit reduced in January after the death', () => {
      expectPv(expectedPvCouple(cases.cAL, cases.cAH, options), 'C-A')
      // 2026 pays her own 560 plus the excess 200 x 0.65, and his own 1,400.
      expect(12 * (1_400 + 560 + 200 * 0.65)).toBe(expectedOf('C-A 2026 benefits'))
      const entitlement = widowEntitlementAgeMonths(cases.cAL.dob, 2026, 744)
      expect(entitlement).toBe(751)
      const widow = survivorBenefitMonthly({
        deceasedPiaMonthly: 2_000, deceasedActualMonthly: 1_400, deceasedEverReduced: true,
        survivorClaimAge: { years: 62, months: 7 }, survivorFraMonths: 804,
      })
      expectAmount(widow, 'C-A widow monthly, death 2026')
      expect(retiredOf('C-A')).toBeLessThan(expectedOf('C-A'))
    })

    it('C-B: a spouse benefit that starts with the worker\'s claim at 70 is unreduced (960 a month, not 780)', () => {
      expectPv(expectedPvCouple(cases.cBL, cases.cBH, options), 'C-B')
      expect(560 + (1_200 - 800)).toBe(expectedOf('C-B lower earner monthly from 2034'))
    })

    it('C-C: a worker who dies before claiming passes on his credits to the month before a December death (3,360)', () => {
      expectPv(expectedPvCouple(cases.cCW, cases.cCH, options), 'C-C')
      expectAmount(3_000 * neverClaimedDeceasedFactor(cases.cCH.dob, 2028, 12), 'C-C survivor base monthly, death 2028')
    })

    it('C-D: a death in the claim year is a death after claiming, so the widow\'s limit holds her at 1,650', () => {
      expectPv(expectedPvCouple(cases.cDW, cases.cDH, options), 'C-D')
      const widow = survivorBenefitMonthly({
        deceasedPiaMonthly: 2_000, deceasedActualMonthly: 1_400, deceasedEverReduced: true,
        survivorClaimAge: { years: 67, months: 10 }, survivorFraMonths: 798,
      })
      expectAmount(widow, 'C-D widow monthly, death 2026')
    })

    // 20 CFR 404.404 counts the worker's PIA against the family maximum, which
    // leaves room for W's whole 400 excess; before #756 the ledger's cap counted
    // his benefit with delayed credits (1,240) and paid 260.
    it('C-E: the family maximum counts the worker\'s PIA, so one spouse\'s 400 excess is paid in full', () => {
      expectPv(expectedPvCouple(cases.cEW, cases.cEH, options), 'C-E (20 CFR 404.404)')
    })

    it('ranks every claim-age pair for a couple and names a disability claimant instead of ranking', () => {
      const plan = couplePlan({ p1Dob: '1964-09-15', p2Dob: '1964-10-11' })
      plan.incomes = [socialSecurityIncome('ss-1', 1_200, 67, 'p1'), socialSecurityIncome('ss-2', 1_900, 67, 'p2')]
      const ranking = benefitsOnlyRanking(validatePlan(plan), 0.02, 2026)
      expect(ranking.rows).toHaveLength(81)
      expect(ranking.disabilityPersonIds).toEqual([])
      for (let i = 1; i < ranking.ranked.length; i++) expect(ranking.ranked[i - 1]!.expectedPv).toBeGreaterThanOrEqual(ranking.ranked[i]!.expectedPv)
      const disabled = singlePersonPlan({ dob: '1970-03-15' })
      disabled.incomes = [{ type: 'socialSecurity', id: 'ss-d', personId: 'p1', piaMonthly: 1_500, earnings: null, claimAge: { years: 67, months: 0 }, disability: { onsetAge: 55 } }]
      const refused = benefitsOnlyRanking(validatePlan(disabled), 0.02, 2026)
      expect(refused.disabilityPersonIds).toEqual(['p1'])
      expect(refused.rows).toEqual([])
    })
  },
)
