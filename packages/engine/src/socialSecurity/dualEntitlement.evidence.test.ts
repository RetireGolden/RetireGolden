import { expect, it } from 'vitest'

import type { FormerSpouse, IncomeStream, Plan } from '../model/plan.js'
import { simulatePlan } from '../projection/simulate.js'
import { basePlan, cash, noTax, validate } from '../projection/simulate.test-support.js'
import {
  describeCalculation,
  withinTolerance,
  worksheetExpectedRows,
  worksheetNumber,
} from '../rules/describeCalculation.js'
import {
  claimStartMonthIndex,
  divorcedExFirstMonthIndex,
  spouseDualEntitlementMonthly,
  spouseEntitlementAgeMonths,
  spouseReductionFactorAtAgeMonths,
} from './dualEntitlement.js'

const WORKSHEET = 'DOCS/calculations/social-security/dual-entitlement-composition.md'
const MUTATION = 'DOCS/calculations/social-security/dual-entitlement-composition.mutation.md'

// The Expected table's "Before" and "After" columns, read from the worksheet.
const rows = worksheetExpectedRows(WORKSHEET)
const before = (label: string): number => worksheetNumber(rows.get(label)![0]!)
const after = (label: string): number => worksheetNumber(rows.get(label)![1]!)

type Person = Plan['household']['people'][number]
const claim62 = { years: 62, months: 0 }

function person(id: string, dob: string): Person {
  return { id, name: id, dob, sex: 'average', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }
}

/** The year's household Social Security and the claimant's own stream (`ss-a`). */
function run(people: Person[], incomes: IncomeStream[], year: number, filingStatus: Plan['household']['filingStatus']) {
  const plan = basePlan()
  plan.household.filingStatus = filingStatus
  plan.household.people = people
  plan.incomes = incomes
  plan.accounts = [cash(5_000_000)]
  const row = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax }).years.find((entry) => entry.year === year)!
  const claimant = row.socialSecurityStreams!.find((stream) => stream.streamId === 'ss-a')!
  return { household: row.incomes.socialSecurity, claimant: claimant.preWithholdingAnnual, source: claimant.source }
}

function couple(claimantDob: string, claimantPia: number, workerDob: string, workerPia: number, workerClaimYears: number, year: number) {
  return run(
    [person('a', claimantDob), person('b', workerDob)],
    [
      { type: 'socialSecurity', id: 'ss-a', personId: 'a', piaMonthly: claimantPia, earnings: null, claimAge: claim62 },
      { type: 'socialSecurity', id: 'ss-b', personId: 'b', piaMonthly: workerPia, earnings: null, claimAge: { years: workerClaimYears, months: 0 } },
    ],
    year,
    'marriedFilingJointly',
  )
}

function divorced(claimantDob: string, claimantPia: number, exDob: string, exPia: number, marriageYears: number, year: number) {
  const ex: FormerSpouse = { id: 'ex', relationship: 'divorced', dob: exDob, piaMonthly: exPia, marriageYears, remarriedAtAge: null }
  return run(
    [person('a', claimantDob)],
    [{ type: 'socialSecurity', id: 'ss-a', personId: 'a', piaMonthly: claimantPia, earnings: null, claimAge: claim62, formerSpouses: [ex] }],
    year,
    'single',
  )
}

function expectWithin(actual: number, expected: number, label: string): void {
  expect(
    withinTolerance(actual, expected, { abs: 0.005 }),
    `${label} ${actual} is not within 0.005 of the worksheet's ${expected}`,
  ).toBe(true)
}

describeCalculation(
  'dual-entitlement-composition',
  {
    example: {
      inputs: {
        caseA: { claimant: '1964-03-10 PIA 800 at 62', worker: '1964-08-20 PIA 2,400 at 70', year: 2034 },
        caseB: { claimant: '1964-06-15 PIA 800 at 62, single', ex: '1966-02-10 PIA 2,000, 12 years', year: 2028 },
        caseC: { claimant: '1965-04-12 PIA 700 at 62', worker: '1963-11-02 PIA 2,200 at 65', year: 2028 },
        caseD: { claimant: '1964-12-18 PIA 900 at 62, single', ex: '1967-05-25 PIA 2,400, 15 years', year: 2029 },
        caseE: { claimant: '1964-01-02 PIA 800 at 62', worker: '1964-01-02 PIA 4,000 at 62', year: 2027 },
        caseF: { ownPia: 1_000, ownActual: 2_600 / 3, spouseBase: 1_500, spouseFactor: 5 / 6 },
        caseG: { ownPia: 1_000, ownActual: 1_240, spouseBase: 1_500, spouseFactor: 1 },
        caseH: { ownPia: 1_000, ownActual: 1_240, spouseBase: 1_100, spouseFactor: 1 },
      },
      expected: {
        spouseStartMonths: { A: 845, B: 765, C: 763, D: 774 },
        caseAHousehold: after('A, 2034 household'),
        caseAClaimant: after('A, 2034 claimant'),
        caseB: after('B, 2028'),
        caseCHousehold: after('C, 2028 household'),
        caseCClaimant: after('C, 2028 claimant'),
        caseD: after('D, 2029'),
        caseEClaimant: after('E, 2027 claimant'),
        caseF: after('F, monthly'),
        caseG: after('G, monthly'),
        caseH: after('H, monthly'),
        beforeAClaimant: before('A, 2034 claimant'),
        beforeB: before('B, 2028'),
        beforeCClaimant: before('C, 2028 claimant'),
        beforeD: before('D, 2029'),
        beforeF: before('F, monthly'),
      },
      tolerance: { abs: 0.005 },
    },
    worksheet: WORKSHEET,
    mutation: MUTATION,
  },
  ({ example }) => {
    const expected = example.expected as Record<string, number> & { spouseStartMonths: Record<string, number> }
    const inputs = example.inputs as Record<string, Record<string, number>>

    it('the spouse benefit starts at the later of the own claim and the worker\'s start (845, 765, 763, 774 months)', () => {
      const dob = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) })
      expect(spouseEntitlementAgeMonths(dob('1964-03-10'), 744, claimStartMonthIndex(dob('1964-08-20'), 840))).toBe(expected.spouseStartMonths.A)
      expect(spouseEntitlementAgeMonths(dob('1964-06-15'), 744, divorcedExFirstMonthIndex(dob('1966-02-10')))).toBe(expected.spouseStartMonths.B)
      expect(spouseEntitlementAgeMonths(dob('1965-04-12'), 744, claimStartMonthIndex(dob('1963-11-02'), 780))).toBe(expected.spouseStartMonths.C)
      expect(spouseEntitlementAgeMonths(dob('1964-12-18'), 744, divorcedExFirstMonthIndex(dob('1967-05-25')))).toBe(expected.spouseStartMonths.D)
      // A worker who claimed first leaves the start at the claimant's own claim.
      expect(spouseEntitlementAgeMonths(dob('1964-03-10'), 744, claimStartMonthIndex(dob('1962-01-20'), 744))).toBe(744)
      // At or after FRA the spouse factor is 1, even past 70.
      expect(spouseReductionFactorAtAgeMonths(dob('1964-03-10'), 845)).toBe(1)
    })

    it('case A: a husband who claims at 70 starts her spouse benefit then, unreduced (960 a month, not 780)', () => {
      const result = couple('1964-03-10', 800, '1964-08-20', 2_400, 70, 2034)
      expect(result.source).toBe('spousal')
      expectWithin(result.claimant, expected.caseAClaimant!, 'caseA claimant')
      expectWithin(result.household, expected.caseAHousehold!, 'caseA household')
      expect(withinTolerance(result.claimant, expected.beforeAClaimant!, example.tolerance)).toBe(false)
    })

    it('the ex must be 62 throughout the first month: born on the 1st or 2nd, the birth month; otherwise the month after', () => {
      // POMS RS 00202.005 B.2.a. An ex born in February 1966 attains 62 on the day
      // before the birthday in 2028: born the 1st, on January 31 (62 throughout
      // February); born the 2nd, on February 1 (62 throughout February); born
      // the 15th, on February 14 (62 throughout only March).
      const february2028 = 2028 * 12 + 1
      expect(divorcedExFirstMonthIndex({ year: 1966, month: 2, day: 1 })).toBe(february2028)
      expect(divorcedExFirstMonthIndex({ year: 1966, month: 2, day: 2 })).toBe(february2028)
      expect(divorcedExFirstMonthIndex({ year: 1966, month: 2, day: 15 })).toBe(february2028 + 1)
      // The worker's own claim month, under the plan's claim-age convention, is
      // the month the claim age is attained.
      expect(claimStartMonthIndex({ year: 1966, month: 2, day: 15 }, 744)).toBe(february2028)
      expect(claimStartMonthIndex({ year: 1966, month: 2, day: 1 }, 744)).toBe(february2028 - 1)
    })

    it('case B: a divorced spouse is paid her own benefit plus the excess reduced when the ex is first 62 throughout a month (707.50, not 650)', () => {
      const result = divorced('1964-06-15', 800, '1966-02-10', 2_000, 12, 2028)
      expectWithin(result.household, expected.caseB!, 'caseB')
      expect(withinTolerance(result.household, expected.beforeB!, example.tolerance)).toBe(false)
    })

    it('case C: a husband who claims at 65 starts her spouse benefit at 763 months (781.67, not 715)', () => {
      const result = couple('1965-04-12', 700, '1963-11-02', 2_200, 65, 2028)
      expectWithin(result.claimant, expected.caseCClaimant!, 'caseC claimant')
      expectWithin(result.household, expected.caseCHousehold!, 'caseC household')
      expect(withinTolerance(result.claimant, expected.beforeCClaimant!, example.tolerance)).toBe(false)
    })

    it('case D: the check\'s divorced case (867.50 a month, not 780)', () => {
      const result = divorced('1964-12-18', 900, '1967-05-25', 2_400, 15, 2029)
      expectWithin(result.household, expected.caseD!, 'caseD')
      expect(withinTolerance(result.household, expected.beforeD!, example.tolerance)).toBe(false)
    })

    it('case E: simultaneous early claims keep the reduced own plus reduced excess (16,080)', () => {
      expectWithin(couple('1964-01-02', 800, '1964-01-02', 4_000, 62, 2027).claimant, expected.caseEClaimant!, 'caseE')
    })

    it('cases F, G and H: the helper, with an early own benefit and with delayed credits', () => {
      const f = inputs.caseF!
      const g = inputs.caseG!
      const monthlyF = spouseDualEntitlementMonthly({ ownPiaMonthly: f.ownPia!, ownActualMonthly: f.ownActual!, spouseBaseMonthly: f.spouseBase!, spouseFactor: f.spouseFactor! })
      expectWithin(monthlyF, expected.caseF!, 'caseF')
      expect(withinTolerance(monthlyF, expected.beforeF!, example.tolerance)).toBe(false)
      expectWithin(
        spouseDualEntitlementMonthly({ ownPiaMonthly: g.ownPia!, ownActualMonthly: g.ownActual!, spouseBaseMonthly: g.spouseBase!, spouseFactor: g.spouseFactor! }),
        expected.caseG!,
        'caseG',
      )
      // Case H: the own benefit with delayed credits above the combined amount
      // without them is paid, with no spouse benefit (the outer comparison).
      const h = inputs.caseH!
      expectWithin(
        spouseDualEntitlementMonthly({ ownPiaMonthly: h.ownPia!, ownActualMonthly: h.ownActual!, spouseBaseMonthly: h.spouseBase!, spouseFactor: h.spouseFactor! }),
        expected.caseH!,
        'caseH',
      )
      // No excess pays the own benefit alone.
      expect(spouseDualEntitlementMonthly({ ownPiaMonthly: 1_600, ownActualMonthly: 1_120, spouseBaseMonthly: 1_500, spouseFactor: 0.65 })).toBe(1_120)
    })
  },
)
