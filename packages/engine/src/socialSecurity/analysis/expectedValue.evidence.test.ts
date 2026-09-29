import { expect, it } from 'vitest'

import type { FormerSpouse, IncomeStream } from '../../model/plan.js'
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

// The Expected table's first two columns: the model's value, and the retired
// model's on the 2022 table (the record of what slice 4 replaced; since
// D-LIFE-TABLE-2023 it is two changes back, not a value to reproduce).
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
    it('single cases S-A, S-B and S-E: the claim months count, and a man of 117 is paid at 117, 118 and 119, and not at 120', () => {
      expectPv(expectedPvSingle(cases.sA, single, options), 'S-A')
      expectPv(expectedPvSingle(cases.sB, single, options), 'S-B')
      expectPv(expectedPvSingle(cases.sE, single, options), 'S-E')
      // Six months of credits past full retirement age: S-B is not S-A.
      expect(withinTolerance(expectedPvSingle(cases.sB, single, options), expectedOf('S-A'), { rel: 1e-6 })).toBe(false)
      // S-E's closed form: 12,600 x [1 + 0.159543/1.02 + 0.159543 x 0.11752/1.0404], paid at 117, 118 and 119, nothing at 120.
      expectPv(12_600 * (1 + 0.159543 / 1.02 + (0.159543 * 0.11752) / 1.0404), 'S-E')
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

    // C-F, example-couple's Social Security: both work before full retirement
    // age, so the earnings test withholds, the months withheld are credited
    // from the full-retirement-age month (only months of the reduction period),
    // and after a death the widow's limit is on the deceased's credited benefit.
    it('C-F: example-couple, the earnings test on both people\'s wages and the widow\'s limit on the deceased\'s credited benefit', () => {
      const plan = couplePlan({ p1Dob: '1962-04-15', p2Dob: '1964-09-02', p1PlanningAge: 92, p2PlanningAge: 95, p1RetirementAge: 66, p2RetirementAge: 64 })
      plan.household.people[0]!.sex = 'male'
      plan.household.people[1]!.sex = 'female'
      plan.assumptions = { ...plan.assumptions, ...matchInflation }
      plan.incomes = [
        { type: 'wages', id: 'wages-alex', personId: 'p1', annualGross: 140_000, endAge: null, realGrowthPct: 0 },
        { type: 'wages', id: 'wages-sam', personId: 'p2', annualGross: 85_000, endAge: null, realGrowthPct: 0 },
        socialSecurityIncome('ss-alex', 2_900, 70, 'p1'),
        socialSecurityIncome('ss-sam', 1_950, 67, 'p2'),
      ]
      const ranking = benefitsOnlyRanking(validatePlan(plan), 0.02, 2026)
      const pv = (alex: number, sam: number): number =>
        ranking.rows.find((row) => row.claimByPersonId.p1 === alex && row.claimByPersonId.p2 === sam)!.expectedPv
      expectPv(pv(70, 63), 'C-F 70/63')
      expectPv(pv(70, 64), 'C-F 70/64')
      expectPv(pv(70, 62), 'C-F 70/62')
      for (const alex of [64, 65]) {
        for (let sam = 62; sam <= 70; sam++) expectPv(pv(alex, sam), `C-F ${alex}/${sam}`)
      }
      // The highest value is 70/63 at 2% and 69/63 at 4%: the months of the claim
      // year before entitlement are paid and never charged (403(f)(1)(A)).
      expect(ranking.ranked[0]!.claimByPersonId).toEqual({ p1: 70, p2: 63 })
      const atFour = benefitsOnlyRanking(validatePlan(plan), 0.04, 2026)
      expect(atFour.ranked[0]!.claimByPersonId).toEqual({ p1: 69, p2: 63 })
      const pv4 = (alex: number, sam: number): number =>
        atFour.rows.find((row) => row.claimByPersonId.p1 === alex && row.claimByPersonId.p2 === sam)!.expectedPv
      expectPv(pv4(69, 63), 'C-F 69/63 at 4%')
      expectPv(pv4(69, 64), 'C-F 69/64 at 4%')
      expect(ranking.rows.find((row) => row.claimByPersonId.p1 === 70 && row.claimByPersonId.p2 === 62)!.withheldBy).toEqual(['p2'])
      expect(ranking.rows.find((row) => row.claimByPersonId.p1 === 70 && row.claimByPersonId.p2 === 63)!.withheldBy).toEqual(['p2'])
      expect(ranking.rows.find((row) => row.claimByPersonId.p1 === 70 && row.claimByPersonId.p2 === 64)!.withheldBy).toEqual([])
      // Paid in full, as the value was until D-SS-ANALYSIS-EARNINGS-TEST, 70/62
      // ranked first at 864,531.25.
      expect(pv(70, 62)).toBeLessThan(864_531.25)
    })

    // C-G: a couple member's deceased first husband. Her remarriage at 61 is
    // deemed not to have occurred, so the widow(er) benefit on his record is
    // paid while her current husband lives, as the ledger pays it.
    it('C-G: a couple member is paid on a deceased former spouse\'s record (3,000 a month from her claim at 67)', () => {
      const plan = couplePlan({ p1Dob: '1962-03-20', p2Dob: '1964-02-10', p1PlanningAge: 95, p2PlanningAge: 95 })
      plan.household.people[0]!.sex = 'male'
      plan.household.people[1]!.sex = 'female'
      plan.assumptions = { ...plan.assumptions, ...matchInflation }
      const firstHusband: FormerSpouse = { id: 'first', relationship: 'deceased', dob: '1958-05-10', piaMonthly: 3_000, marriageYears: 20, remarriedAtAge: 61 }
      plan.incomes = [
        socialSecurityIncome('ss-h', 2_200, 67, 'p1'),
        { ...socialSecurityIncome('ss-j', 1_200, 67, 'p2'), formerSpouses: [firstHusband] } as IncomeStream,
      ]
      const ranking = benefitsOnlyRanking(validatePlan(plan), 0.02, 2026)
      const pv = (h: number, j: number): number =>
        ranking.rows.find((row) => row.claimByPersonId.p1 === h && row.claimByPersonId.p2 === j)!.expectedPv
      expectPv(pv(67, 67), 'C-G 67/67')
      expectPv(pv(70, 62), 'C-G 70/62')
      expect(ranking.ranked[0]!.claimByPersonId).toEqual({ p1: 70, p2: 62 })
      // Her first husband's record unpriced, as the value was until D-SS-ANALYSIS-EARNINGS-TEST: 594,699.99.
      expect(pv(67, 67)).toBeGreaterThan(594_699.99 + 200_000)
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
