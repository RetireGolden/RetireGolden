/**
 * A state's own rule for U.S. military retired pay and Survivor Benefit Plan
 * annuities, in the states whose rule the engine missed before 2026-10-07:
 * the full subtractions of Wisconsin, Indiana, Minnesota, Louisiana, Maine,
 * Michigan, Oklahoma and Pennsylvania; the capped ones of Colorado, Maryland,
 * Georgia, New Mexico and Montana; Kansas without a plan code; the District of
 * Columbia's and Missouri's treatment of a survivor annuity; and the
 * premature-distribution status South Carolina and Delaware test.
 *
 * Each worked case is a single filer in 2026 unless it says otherwise. The
 * readings are the amount the rows take off state taxable income (or the
 * state tax), under the rule and under how the engine priced it before.
 * Expected amounts are hand calculations from the quoted law and the 2026
 * figures the state records register, not copies of helper output; every
 * monetary assertion enters the annual state calculator, and the last suite
 * runs the projection.
 */
import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import type { Account } from '../model/plan.js'
import type { TaxYearInput } from '../projection/types.js'
import { inferEarlyDistributionDisqualifier } from '../projection/internal/stateRetirementFactsAdapter.js'
import { cashAccount, runPlan, singlePersonPlan } from '../testing/planFixtures.js'
import { computeStateTaxYearResult, createStateTaxCalculator } from './stateTax.js'
import type { StateHouseholdTaxFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'

const input = (state: string, change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state, filingStatus: 'single', ordinaryIncome: 100_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [60], ...change,
})
/** A 20,000 dollar military retirement row, fully included federally, paid to a 60-year-old. */
const fact = (change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
  accountId: 'pension', ownerPersonId: 'owner', sourceKind: 'militaryRetirement',
  federallyIncludedAmount: 20_000, grossDistribution: 20_000, recipientAgeYears: 60,
  recipientAgeKnown: true, cause: 'ordinary', earlyDistributionDisqualifier: 'false',
  ...change,
})
const household = (change: Partial<StateHouseholdTaxFacts> = {}): StateHouseholdTaxFacts => ({
  stateFilingStatus: 'single', federalAgi: 100_000, federallyIncludedSocialSecurity: 0,
  householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
  exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0,
  section63fQualificationCount: 0, federalExemptionCount: { known: true, value: 1 },
  claimedAsDependent: false, ...change,
})
interface YearOptions {
  readonly age?: number
  readonly year?: number
  readonly facts?: Partial<StateHouseholdTaxFacts>
}
/** The state result for a single filer whose ordinary income is `income`, `rows` part of it. */
function stateYear(state: string, income: number, rows: readonly StateRetirementDistributionFact[], options: YearOptions = {}) {
  return computeStateTaxYearResult(input(state, { year: options.year ?? 2026, ordinaryIncome: income, agesAlive: [options.age ?? 60] }), {
    retirementDistributions: [...rows], hsaAccounts: [], qcdEvents: [],
    householdFacts: household({ federalAgi: income, ...options.facts }),
  })
}
/** How much the rows take off state taxable income. */
function subtracted(state: string, income: number, rows: readonly StateRetirementDistributionFact[], options: YearOptions = {}): number {
  return stateYear(state, income, [], options).taxableIncome - stateYear(state, income, rows, options).taxableIncome
}
const survivor = (change: Partial<StateRetirementDistributionFact> = {}) => fact({ sourceKind: 'militarySurvivor', ...change })
const privatePension = (amount: number, age: number) => fact({ accountId: 'private', sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: amount, grossDistribution: amount, recipientAgeYears: age })

describe('full subtractions', () => {
  describeRule('wi-stat-71-05-1-am-military-retirement-subtraction', {
    readings: { scheduleSbLines12And16: 44_000, line16Only: 24_000 },
    accepted: 'scheduleSbLines12And16',
  }, ({ accepted, readings }) => {
    it('subtracts military pay on line 12 and leaves the line 16 room to the private pension', () => {
      // At 70: line 12 takes the 20,000 military pension; line 16 takes 24,000
      // of the 30,000 private pension, which has "not been removed" on line
      // 12. 20,000 + 24,000 = 44,000. Pooled, as before, line 16 alone: 24,000.
      const rows = [fact({ recipientAgeYears: 70 }), privatePension(30_000, 70)]
      const facts = { wisconsinIncomeForStandardDeduction: 140_000 }
      expect(subtracted('WI', 160_000, rows, { age: 70, facts })).toBe(accepted)
      expect(accepted).not.toBe(readings.line16Only)
    })
    it('prices a 20,000 dollar military pension at 60 on a 160,000 dollar return', () => {
      // Wisconsin income for the standard deduction is 140,000, above the
      // 136,453 single zero point, so no deduction; exemption 700. Taxable
      // 139,300: 3.5% x 15,110 = 528.85; 4.4% x 36,840 = 1,620.96; 5.3% x
      // 87,350 = 4,629.55; total 6,779.36. Before, nothing came off at 60:
      // 159,300, 20,000 more at 5.3%, 7,839.36.
      const year = stateYear('WI', 160_000, [fact()], { facts: { wisconsinIncomeForStandardDeduction: 140_000 } })
      expect(year.status).toBe('complete')
      expect(year.taxableIncome).toBe(139_300)
      expect(year.amount).toBeCloseTo(6_779.36, 6)
    })
    it('subtracts a Survivor Benefit Plan annuity the same way', () => {
      expect(subtracted('WI', 160_000, [survivor()], { facts: { wisconsinIncomeForStandardDeduction: 140_000 } })).toBe(20_000)
    })
  })

  describeRule('ic-6-3-2-4-military-retirement-deduction', {
    readings: { deductedInFull: 708, likeEveryOtherIndianaPension: 1_770 },
    accepted: 'deductedInFull',
  }, ({ accepted }) => {
    it('deducts military retirement and survivor benefits in full at any age', () => {
      // 60,000 of income, 36,000 of it the pension, at 45. Indiana is 2.95% on
      // the base with no deduction modeled: 24,000 x 2.95% = 708.00. With no
      // deduction: 60,000 x 2.95% = 1,770.00.
      for (const row of [fact({ federallyIncludedAmount: 36_000, recipientAgeYears: 45 }), survivor({ federallyIncludedAmount: 36_000, recipientAgeYears: 45 })]) {
        const year = stateYear('IN', 60_000, [row], { age: 45 })
        expect(year.taxableIncome, row.sourceKind).toBe(24_000)
        expect(year.amount, row.sourceKind).toBeCloseTo(accepted, 6)
      }
      // Every other public pension keeps Indiana's none.
      expect(subtracted('IN', 60_000, [fact({ sourceKind: 'stateLocalPublic', federallyIncludedAmount: 36_000 })])).toBe(0)
    })
  })

  describeRule('mn-stat-290-0132-subd-21-military-retirement-subtraction', {
    readings: { subtracted: 30_000, taxedInFull: 0 },
    accepted: 'subtracted',
  }, ({ accepted }) => {
    it('subtracts military retirement pay and a survivor annuity in full', () => {
      expect(subtracted('MN', 100_000, [fact({ federallyIncludedAmount: 30_000 })])).toBe(accepted)
      expect(subtracted('MN', 100_000, [survivor({ federallyIncludedAmount: 30_000, recipientAgeYears: 45 })], { age: 45 })).toBe(accepted)
    })
    it('prices 30,000 of military pay on a 100,000 dollar return', () => {
      // Taxable 100,000 - 30,000 - 15,300 = 54,700: 5.35% x 33,310 =
      // 1,782.085; 6.8% x 21,390 = 1,454.52; total 3,236.605.
      expect(stateYear('MN', 100_000, [fact({ federallyIncludedAmount: 30_000 })]).amount).toBeCloseTo(3_236.605, 6)
    })
  })

  describeRule('me-mrs-36-5122-2-m-2-1-b-military-retirement-deduction', {
    readings: { divisionsAAndB: 99_824, oneCappedPool: 49_824 },
    accepted: 'divisionsAAndB',
  }, ({ accepted, readings }) => {
    it('deducts military pay in full outside the 49,824 dollar division (a) maximum', () => {
      // At 70: (b) 50,000 of military pay; (a) the lesser of the 50,000 private
      // pension and 49,824. 99,824. One pool capped at 49,824, as before: 49,824.
      // On 300,000 of income the standard deduction is phased out either way.
      const rows = [fact({ federallyIncludedAmount: 50_000, recipientAgeYears: 70 }), privatePension(50_000, 70)]
      expect(subtracted('ME', 300_000, rows, { age: 70 })).toBe(accepted)
      expect(accepted).not.toBe(readings.oneCappedPool)
      // A surviving spouse is a primary recipient.
      expect(subtracted('ME', 300_000, [survivor({ federallyIncludedAmount: 100_000 })])).toBe(100_000)
    })
  })

  describeRule('mi-mcl-206-30-1-e-i-armed-forces-retirement-deduction', {
    readings: { maximumReducedByTheMilitaryDeduction: 67_610, maximumLeftWhole: 80_000 },
    accepted: 'maximumReducedByTheMilitaryDeduction',
  }, ({ accepted, readings }) => {
    it('deducts military pay in full and lowers the general maximum by it', () => {
      // At 70: (1)(e)(i) 30,000 of military pay; the (1)(f)(iv) maximum of
      // 67,610 reduced by it to 37,610, all taken by the 50,000 private
      // pension. 30,000 + 37,610 = 67,610. Left whole: 30,000 + 50,000 = 80,000.
      const rows = [fact({ federallyIncludedAmount: 30_000, recipientAgeYears: 70 }), privatePension(50_000, 70)]
      expect(subtracted('MI', 100_000, rows, { age: 70 })).toBe(accepted)
      expect(accepted).not.toBe(readings.maximumLeftWhole)
    })
    it('takes 100,000 of military pay off in full, where the pooled maximum took 67,610', () => {
      expect(subtracted('MI', 100_000, [fact({ federallyIncludedAmount: 100_000, recipientAgeYears: 70 })], { age: 70 })).toBe(100_000)
      // A survivor annuity stays under the general maximum.
      expect(subtracted('MI', 100_000, [survivor({ federallyIncludedAmount: 100_000, recipientAgeYears: 70 })], { age: 70 })).toBe(67_610)
    })
  })

  describeRule('ok-stat-68-2358-e-17-armed-forces-retirement-exclusion', {
    readings: { line4AndLine6: 60_000, sharedTenThousand: 10_000 },
    accepted: 'line4AndLine6',
  }, ({ accepted, readings }) => {
    it('excludes military pay in full and leaves the 10,000 dollar exclusion to the private pension', () => {
      // At 70: line 4 the 50,000 of military pay, line 6 10,000 of the 50,000
      // private pension. 60,000. One shared 10,000, as before: 10,000.
      const rows = [fact({ federallyIncludedAmount: 50_000, recipientAgeYears: 70 }), privatePension(50_000, 70)]
      expect(subtracted('OK', 100_000, rows, { age: 70 })).toBe(accepted)
      expect(accepted).not.toBe(readings.sharedTenThousand)
      // A survivor annuity keeps the 10,000 limb.
      expect(subtracted('OK', 100_000, [survivor({ federallyIncludedAmount: 50_000 })])).toBe(10_000)
    })
  })

  describeRule('pa-code-61-101-6-c-3-uniformed-services-retired-pay', {
    readings: { notCompensationAtAnyAge: 40_000, excludedFromSixtyOnly: 0 },
    accepted: 'notCompensationAtAnyAge',
  }, ({ accepted }) => {
    it('excludes retired pay at 45; a survivor annuity keeps the age-60 rule', () => {
      expect(subtracted('PA', 100_000, [fact({ federallyIncludedAmount: 40_000, recipientAgeYears: 45 })], { age: 45 })).toBe(accepted)
      expect(subtracted('PA', 100_000, [survivor({ federallyIncludedAmount: 40_000, recipientAgeYears: 45 })], { age: 45 })).toBe(0)
      expect(subtracted('PA', 100_000, [survivor({ federallyIncludedAmount: 40_000 })])).toBe(40_000)
    })
  })

  describeRule('la-rs-47-44-2-social-security-federal-retirement', {
    note: 'military',
    readings: { section44Point2AndTheAge65Exemption: 62_324, age65ExemptionOnly: 12_324 },
    accepted: 'section44Point2AndTheAge65Exemption',
  }, ({ accepted, readings }) => {
    it('excludes military pay under 47:44.2 and leaves the 12,324 dollar exemption to the private pension', () => {
      // At 65: 47:44.2 the 50,000 of military pay; 47:44.1 the lesser of the
      // 50,000 private pension and 12,324. 62,324. Before, one 12,324 pool.
      const rows = [fact({ federallyIncludedAmount: 50_000, recipientAgeYears: 65 }), privatePension(50_000, 65)]
      expect(subtracted('LA', 100_000, rows, { age: 65 })).toBe(accepted)
      expect(accepted).not.toBe(readings.age65ExemptionOnly)
      // Code 04E: a Survivor Benefit Plan annuity too, at any age.
      expect(subtracted('LA', 100_000, [survivor({ federallyIncludedAmount: 50_000, recipientAgeYears: 45 })], { age: 45 })).toBe(50_000)
    })
  })
})

describe('capped and age-tested subtractions', () => {
  describeRule('co-crs-39-22-104-4-y-military-retirement-subtraction', {
    readings: { under55Limb: 15_000, nothingUnder55: 0 },
    accepted: 'under55Limb',
  }, ({ accepted }) => {
    it('subtracts 15,000 under 55, the pension subtraction from 55, and nothing military-specific from 2029', () => {
      const row = (age: number) => fact({ federallyIncludedAmount: 100_000, recipientAgeYears: age })
      // (4)(y): under 55, the lesser of 100,000 and 15,000.
      expect(subtracted('CO', 100_000, [row(45)], { age: 45 })).toBe(accepted)
      // (4)(f)(I): 55 to 64, 20,000 with no Social Security; 65 and older, 24,000.
      expect(subtracted('CO', 100_000, [row(60)])).toBe(20_000)
      expect(subtracted('CO', 100_000, [row(65)], { age: 65 })).toBe(24_000)
      // (4)(f)(II): a survivor annuity under 55 is a pension received because
      // of a death: 20,000.
      expect(subtracted('CO', 100_000, [survivor({ federallyIncludedAmount: 100_000, recipientAgeYears: 45 })], { age: 45 })).toBe(20_000)
      // (4)(y)(I) ends with income tax years before January 1, 2029.
      expect(subtracted('CO', 100_000, [row(45)], { age: 45, year: 2029 })).toBe(0)
    })
    it('prices 100,000 of military pay at 45', () => {
      // Federal-conformed deduction 16,100: 100,000 - 15,000 - 16,100 = 68,900
      // x 4.4% = 3,031.60. Before: 83,900 x 4.4% = 3,691.60.
      expect(stateYear('CO', 100_000, [fact({ federallyIncludedAmount: 100_000, recipientAgeYears: 45 })], { age: 45 }).amount).toBeCloseTo(3_031.6, 6)
    })
  })

  describeRule('md-tg-10-207-q-military-retirement-subtraction', {
    readings: { subtractionThenPensionExclusion: 60_600, nothing: 0 },
    accepted: 'subtractionThenPensionExclusion',
  }, ({ accepted }) => {
    it('subtracts 12,500 under 55, 20,000 from 55, and opens the rest to the pension exclusion at 65', () => {
      const row = (age: number) => fact({ federallyIncludedAmount: 100_000, recipientAgeYears: age })
      expect(subtracted('MD', 100_000, [row(45)], { age: 45 })).toBe(12_500)
      expect(subtracted('MD', 100_000, [row(60)])).toBe(20_000)
      // At 65: 20,000, then the lesser of the other 80,000 and the 40,600
      // maximum less no Social Security or railroad benefits. 60,600.
      expect(subtracted('MD', 100_000, [row(65)], { age: 65 })).toBe(accepted)
      // Death benefits are military retirement income.
      expect(subtracted('MD', 100_000, [survivor({ federallyIncludedAmount: 100_000 })])).toBe(20_000)
    })
  })

  const georgiaWages = (wages: number) => ({ ownerStateTaxFacts: [{ ownerPersonId: 'owner', wages }] })
  describeRule('ga-code-48-7-27-a-5-1-military-retirement-exclusion', {
    readings: { withGeorgiaEarnings: 35_000, baseOnly: 17_500 },
    accepted: 'withGeorgiaEarnings',
  }, ({ accepted, readings }) => {
    const row = fact({ federallyIncludedAmount: 100_000 })
    it('excludes 17,500 under 62, and 35,000 with more than 17,500 of wages', () => {
      expect(subtracted('GA', 100_000, [row], { facts: georgiaWages(20_000) })).toBe(accepted)
      expect(subtracted('GA', 100_000, [row], { facts: georgiaWages(17_500) })).toBe(readings.baseOnly)
      expect(subtracted('GA', 100_000, [row], { facts: georgiaWages(0) })).toBe(readings.baseOnly)
    })
    it('gives nothing military-specific from 62, and the general 65,000 from 65', () => {
      expect(subtracted('GA', 100_000, [fact({ federallyIncludedAmount: 100_000, recipientAgeYears: 62 })], { age: 62, facts: georgiaWages(0) })).toBe(0)
      expect(subtracted('GA', 100_000, [fact({ federallyIncludedAmount: 100_000, recipientAgeYears: 65 })], { age: 65, facts: georgiaWages(0) })).toBe(65_000)
    })
    it('excludes a survivor annuity in full at any age', () => {
      expect(subtracted('GA', 200_000, [survivor({ federallyIncludedAmount: 100_000 })])).toBe(100_000)
      expect(subtracted('GA', 200_000, [survivor({ federallyIncludedAmount: 100_000, recipientAgeYears: 70 })], { age: 70 })).toBe(100_000)
    })
    it('withholds the second 17,500 when the wages are unknown, and says so', () => {
      const year = stateYear('GA', 100_000, [row])
      expect(stateYear('GA', 100_000, []).taxableIncome - year.taxableIncome).toBe(17_500)
      expect(year.warnings.map((warning) => warning.code)).toContain('state-military-facts-unknown')
    })
  })

  describeRule('ga-code-48-7-27-a-5-1-military-retirement-exclusion', {
    note: 'HB 266 from 2027',
    readings: { hb266: 65_000, the2026Rule: 17_500 },
    accepted: 'hb266',
  }, ({ accepted }) => {
    it('excludes up to 65,000 under 65 with no earned-income test, from 2027', () => {
      const row = (age: number) => fact({ federallyIncludedAmount: 100_000, recipientAgeYears: age })
      expect(subtracted('GA', 100_000, [row(60)], { year: 2027 })).toBe(accepted)
      expect(subtracted('GA', 100_000, [row(63)], { age: 63, year: 2027 })).toBe(accepted)
      // From 65 the general exclusion of HB 463, 70,000 in 2027.
      expect(subtracted('GA', 100_000, [row(65)], { age: 65, year: 2027 })).toBe(70_000)
      expect(subtracted('GA', 100_000, [row(60)], { facts: georgiaWages(0) })).toBe(17_500)
    })
  })

  describeRule('nm-nmsa-7-2-5-13-armed-forces-retirement-exemption', {
    readings: { thirtyThousand: 30_000, nothing: 0 },
    accepted: 'thirtyThousand',
  }, ({ accepted }) => {
    it('exempts 30,000 per retiree or surviving spouse', () => {
      expect(subtracted('NM', 100_000, [fact({ federallyIncludedAmount: 100_000 })])).toBe(accepted)
      expect(subtracted('NM', 100_000, [fact({ federallyIncludedAmount: 20_000 })])).toBe(20_000)
      expect(subtracted('NM', 100_000, [survivor({ federallyIncludedAmount: 100_000, recipientAgeYears: 70 })], { age: 70 })).toBe(accepted)
    })
  })

  const montana = (rows: readonly StateRetirementDistributionFact[], options: YearOptions & { wages?: number } = {}) =>
    subtracted('MT', 100_000, rows, { ...options, facts: { montanaNetTaxableLtcg: 0, ...(options.wages === undefined ? {} : { ownerStateTaxFacts: [{ ownerPersonId: 'owner', wages: options.wages }] }) } })
  describeRule('mt-mca-15-30-2120-3-n-military-retirement-subtraction', {
    readings: { lawForAResidentFrom2025: 50_000, engineFromThePaymentsStart: 0 },
    accepted: 'lawForAResidentFrom2025',
    produced: 'engineFromThePaymentsStart',
  }, ({ accepted, produced }) => {
    it('subtracts the lesser of 50% and the wages on the return, and 50% of a survivor benefit', () => {
      const retired = fact({ federallyIncludedAmount: 100_000, paymentsBeganYear: 2025 })
      expect(montana([retired], { wages: 20_000 })).toBe(20_000)
      expect(montana([retired], { wages: 80_000 })).toBe(50_000)
      expect(montana([retired], { wages: 0 })).toBe(0)
      expect(montana([survivor({ federallyIncludedAmount: 100_000, paymentsBeganYear: 2025 })])).toBe(50_000)
    })
    it('allows five consecutive years from the later of 2024 and the first payment', () => {
      const benefit = (paymentsBeganYear: number) => survivor({ federallyIncludedAmount: 100_000, paymentsBeganYear })
      expect(montana([benefit(2010)], { year: 2028 })).toBe(50_000)
      expect(montana([benefit(2010)], { year: 2029 })).toBe(0)
      expect(montana([benefit(2026)], { year: 2030 })).toBe(50_000)
      expect(montana([benefit(2026)], { year: 2031 })).toBe(0)
    })
    it('reads the window from the first payment, not from a later move to Montana', () => {
      // A survivor paid since 2020 who became a Montana resident in 2025: (9)
      // allows 2025 to 2029. The plan holds no residency start, so the engine
      // reads the recipient as resident before the pay began: 2024 to 2028,
      // and nothing in 2029.
      expect(montana([survivor({ federallyIncludedAmount: 100_000, paymentsBeganYear: 2020 })], { year: 2029 })).toBe(produced)
      expect(produced).not.toBe(accepted)
    })
    it('withholds the subtraction when the first payment year is unknown, and says so', () => {
      const year = stateYear('MT', 100_000, [survivor({ federallyIncludedAmount: 100_000 })], { facts: { montanaNetTaxableLtcg: 0 } })
      expect(year.taxableIncome).toBe(stateYear('MT', 100_000, [], { facts: { montanaNetTaxableLtcg: 0 } }).taxableIncome)
      expect(year.warnings.map((warning) => warning.code)).toContain('state-military-facts-unknown')
    })
  })
})

describe('Kansas, the District of Columbia and Missouri', () => {
  describeRule('ks-stat-79-32-117-public-pension-exclusion', {
    note: 'military retirement without a plan code',
    readings: { theSourceNamesTheSystem: 100_000, withheldForWantOfACode: 0 },
    accepted: 'theSourceNamesTheSystem',
  }, ({ accepted }) => {
    it('subtracts a military retirement row with no plan code, and still asks for one on a survivor annuity', () => {
      const year = stateYear('KS', 200_000, [fact({ federallyIncludedAmount: 100_000 })])
      expect(year.status).toBe('complete')
      expect(stateYear('KS', 200_000, []).taxableIncome - year.taxableIncome).toBe(accepted)
      const sbp = stateYear('KS', 100_000, [survivor({ federallyIncludedAmount: 100_000 })])
      expect(sbp.warnings.map((warning) => warning.code)).toContain('ks-plan-code-unknown')
      expect(subtracted('KS', 200_000, [survivor({ federallyIncludedAmount: 100_000, planSystemCode: 'US-MILITARY' })])).toBe(100_000)
    })
  })

  describeRule('dc-code-47-1803-03-government-survivor-exclusion', {
    note: 'Survivor Benefit Plan',
    readings: { federalSurvivorBenefit: 100_000, taxedLikeRetiredPay: 0 },
    accepted: 'federalSurvivorBenefit',
  }, ({ accepted }) => {
    it('excludes a Survivor Benefit Plan annuity from 62, with no issuer fact', () => {
      expect(subtracted('DC', 200_000, [survivor({ federallyIncludedAmount: 100_000, recipientAgeYears: 62 })], { age: 62 })).toBe(accepted)
      expect(subtracted('DC', 100_000, [survivor({ federallyIncludedAmount: 100_000, recipientAgeYears: 61 })], { age: 61 })).toBe(0)
      // Military retired pay itself is taxed.
      expect(subtracted('DC', 100_000, [fact({ federallyIncludedAmount: 100_000, recipientAgeYears: 62 })], { age: 62 })).toBe(0)
    })
  })

  describeRule('mo-rsmo-143-121-3-12-military-retirement-and-survivor-benefits', {
    readings: { publicPensionSubtraction: 48_967, fullMilitarySubtraction: 50_000 },
    accepted: 'publicPensionSubtraction',
  }, ({ accepted, readings }) => {
    it('subtracts a survivor annuity as a public pension, capped, and the retiree\'s own pay in full', () => {
      // 143.124.5: the lesser of 50,000 and the 48,967 maximum less a zero
      // Social Security exemption. 143.121.3(12) reaches only the retiree's
      // own service. Missouri income is not needed for the public subtraction.
      expect(subtracted('MO', 100_000, [survivor({ federallyIncludedAmount: 50_000 })])).toBe(accepted)
      expect(accepted).not.toBe(readings.fullMilitarySubtraction)
      expect(subtracted('MO', 100_000, [fact({ federallyIncludedAmount: 50_000 })])).toBe(50_000)
      expect(subtracted('MO', 100_000, [fact({ sourceKind: 'federalCivilService', federallyIncludedAmount: 50_000 })])).toBe(48_967)
    })
  })
})

describe('premature-distribution status of military pay', () => {
  describeRule('sc-code-12-6-1171-military-retirement', {
    note: 'never premature',
    readings: { notPremature: 'false', unknownUnder59AndAHalf: 'unknown' },
    accepted: 'notPremature',
  }, ({ accepted }) => {
    it('marks a military row not subject to the penalty at any age, unless the plan asserts it is', () => {
      expect(inferEarlyDistributionDisqualifier({ minimumAgeAtDistributionYears: 45, military: true })).toBe(accepted)
      expect(inferEarlyDistributionDisqualifier({ minimumAgeAtDistributionYears: 45 })).toBe('unknown')
      expect(inferEarlyDistributionDisqualifier({ explicit: 'true', minimumAgeAtDistributionYears: 45, military: true })).toBe('true')
      // South Carolina 12-6-1171 then deducts the pay in full at 45.
      const row = fact({ federallyIncludedAmount: 60_000, recipientAgeYears: 45, earlyDistributionDisqualifier: accepted })
      expect(subtracted('SC', 100_000, [row], { age: 45 })).toBe(60_000)
    })
  })

  describeRule('de-early-distribution-gate', {
    note: 'military pension under 60',
    readings: { militaryLimb: 12_500, withheld: 0 },
    accepted: 'militaryLimb',
  }, ({ accepted }) => {
    it('gives the under-60 military limb to a pension the projection marks not premature', () => {
      // 1106(b)(3): under 60, the greater of 2,000 of pension and 12,500 of
      // U.S. military pension.
      const status = inferEarlyDistributionDisqualifier({ minimumAgeAtDistributionYears: 45, military: true })
      const year = stateYear('DE', 100_000, [fact({ recipientAgeYears: 45, earlyDistributionDisqualifier: status })], { age: 45 })
      expect(year.status).toBe('complete')
      expect(stateYear('DE', 100_000, [], { age: 45 }).taxableIncome - year.taxableIncome).toBe(accepted)
    })
  })
})

describe('through the projection', () => {
  const pension = (source: string, amount: number, startAge: number): Account => ({
    type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0,
    startAge, monthlyAmount: amount / 12, colaPct: 0, survivorPct: 0, source,
  } as Account)
  const year = (state: string, age: number, source: string, wages = 0) => {
    const plan = singlePersonPlan({ dob: `${2026 - age}-01-01`, planningAge: Math.max(60, age + 1), state })
    plan.household.people[0]!.retirementAge = 75
    plan.accounts = [cashAccount('cash', 50_000), pension(source, 100_000, 45)]
    if (wages > 0) plan.incomes = [{ type: 'wages', id: 'job', personId: 'p1', annualGross: wages, endAge: null, realGrowthPct: 0 }]
    return runPlan(plan, createStateTaxCalculator(), 2026).years[0]!
  }
  it('takes Georgia wages from the wage stream: 35,000 off with 20,000 of wages at 60', () => {
    // 100,000 of military pay + 20,000 of wages - 35,000 - 15,000 deduction =
    // 70,000 x 4.99% = 3,493.00.
    expect(year('GA', 60, 'militaryRetirement', 20_000).tax).toBeCloseTo(3_493, 6)
  })
  it('takes the Montana window from the pension\'s start: 50,000 of survivor benefit off at 60', () => {
    // Paid since 2011, so the window is 2024 to 2028. 100,000 - 50,000 -
    // 16,100 = 33,900 x 4.7% = 1,593.30.
    expect(year('MT', 60, 'militarySurvivor').tax).toBeCloseTo(1_593.3, 6)
  })
  it('marks military pay not premature, so South Carolina deducts it at 45 and the year is complete', () => {
    const sc = year('SC', 45, 'militaryRetirement')
    expect(sc.acceptedTaxInput?.stateRetirementDistributions?.[0]?.earlyDistributionDisqualifier).toBe('false')
    expect(sc.tax).toBe(0)
    expect(sc.taxComputation?.status).toBe('complete')
  })
  it('subtracts Wisconsin military pay in full at 60', () => {
    expect(year('WI', 60, 'militaryRetirement').tax).toBe(0)
  })
})
