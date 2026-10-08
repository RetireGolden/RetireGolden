/**
 * State treatment of Roth conversions (ME, PA, SC), Connecticut's IRA
 * distribution schedule and New Jersey's income-tested pension exclusion,
 * each priced through the annual state calculator.
 *
 * Every expected value is the state's own rule applied by hand: the amount the
 * state subtracts for the characterized rows, measured as the drop in state
 * taxable income when the same year's income is described by the rows. The
 * income itself never changes between the two runs, so the difference is the
 * subtraction and nothing else.
 */
import { describe, expect, it } from 'vitest'
import { describeRule } from '../rules/describeRule.js'
import type { TaxYearInput } from '../projection/types.js'
import { stateParamsFor } from '../params/state/index.js'
import { computeStateTaxableIncome, computeStateTaxYearResult, type StateTaxYearOptions } from './stateTax.js'
import type { StateHouseholdTaxFacts, StateRetirementDistributionFact } from './stateRetirementFacts.js'

const input = (state: string, change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state, filingStatus: 'single', ordinaryIncome: 100_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [60], ...change,
})
const row = (change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact => ({
  accountId: 'ira', ownerPersonId: 'owner', sourceKind: 'ira',
  federallyIncludedAmount: 30_000, grossDistribution: 30_000, recipientAgeYears: 70,
  recipientAgeKnown: true, cause: 'unknown', earlyDistributionDisqualifier: 'false',
  ...change,
})
/** A row that is all conversion, converted at 59 and a half or older when `atAge59Half`. */
const conversion = (amount: number, change: Partial<StateRetirementDistributionFact> = {}): StateRetirementDistributionFact =>
  row({ federallyIncludedAmount: amount, grossDistribution: amount, rothConversionAmount: amount, rothConversionAmountAtAge59HalfOrOlder: amount, ...change })
const household = (change: Partial<StateHouseholdTaxFacts> = {}): StateHouseholdTaxFacts => ({
  stateFilingStatus: 'single', federalAgi: 100_000, federallyIncludedSocialSecurity: 0,
  householdGrossSocialSecurity: 0, householdGrossRailroadBenefits: 0,
  exemptionTaxpayerCount: 1, exemptionDependentCount: 0, age65EligibleCount: 0,
  section63fQualificationCount: 0, federalExemptionCount: { known: true, value: 1 },
  claimedAsDependent: false, ...change,
})
function annual(state: string, options: StateTaxYearOptions = {}, change: Partial<TaxYearInput> = {}) {
  return computeStateTaxYearResult(input(state, change), {
    retirementDistributions: [], hsaAccounts: [], qcdEvents: [], householdFacts: household(), ...options,
  })
}
/** The drop in state taxable income when the same income is described by `rows`. */
function subtracted(
  state: string,
  rows: StateRetirementDistributionFact[],
  facts: StateHouseholdTaxFacts = household(),
  change: Partial<TaxYearInput> = {},
): number {
  const options = { householdFacts: facts }
  return annual(state, options, change).taxableIncome - annual(state, { ...options, retirementDistributions: rows }, change).taxableIncome
}

describeRule('me-1040me-roth-conversion-not-pension-income', {
  readings: {
    // Owner 70; Maine's pension deduction is up to $49,824 a person.
    // (a) $30,000 converted to a Roth IRA: no deduction.
    // (b) One row of $40,000, $25,000 of it a conversion (an RMD and a named
    //     conversion in one account's event): the $15,000 that is not.
    // (c) $30,000 converted in plan from a 401(k): no deduction either.
    form1040meInstructions: { iraConversion: 0, mixedRow: 15_000, inPlanConversion: 0 },
    // A conversion deducted like any withdrawal, as before 2026-10-06.
    conversionCountsAsPensionIncome: { iraConversion: 30_000, mixedRow: 40_000, inPlanConversion: 30_000 },
  },
  accepted: 'form1040meInstructions',
}, ({ accepted }) => {
  it('gives a conversion no pension income deduction', () => {
    expect(subtracted('ME', [conversion(30_000)])).toBe(accepted.iraConversion)
    expect(subtracted('ME', [row({ federallyIncludedAmount: 40_000, rothConversionAmount: 25_000, rothConversionAmountAtAge59HalfOrOlder: 25_000 })]))
      .toBe(accepted.mixedRow)
    expect(subtracted('ME', [conversion(30_000, { accountId: '401k', sourceKind: 'employerPlan' })])).toBe(accepted.inPlanConversion)
  })
  it('still deducts an ordinary IRA withdrawal', () => {
    expect(subtracted('ME', [row()])).toBe(30_000)
  })
})

describeRule('pa-40-roth-ira-conversion-not-taxable', {
  readings: {
    // Pennsylvania taxes at 3.07% with no standard deduction; its pack
    // excludes retirement income from 60. Owner 50:
    // (a) $40,000 converted to a Roth IRA: not taxed, $1,228 less tax.
    // (b) One row of $40,000, $30,000 of it a conversion: $30,000 comes off.
    rothIraRolloverNotTaxable: { iraConversionAt50: 40_000, mixedRowAt50: 30_000 },
    // Taxed under 60 like a withdrawal, as before 2026-10-06.
    taxedLikeAWithdrawalUnder60: { iraConversionAt50: 0, mixedRowAt50: 0 },
  },
  accepted: 'rothIraRolloverNotTaxable',
}, ({ accepted }) => {
  const at50 = { recipientAgeYears: 50, earlyDistributionDisqualifier: 'unknown' as const }
  it('does not tax an IRA converted to a Roth IRA, at any age', () => {
    expect(subtracted('PA', [conversion(40_000, at50)])).toBe(accepted.iraConversionAt50)
    expect(subtracted('PA', [row({ ...at50, federallyIncludedAmount: 40_000, rothConversionAmount: 30_000 })])).toBe(accepted.mixedRowAt50)
    expect(subtracted('PA', [conversion(40_000)])).toBe(40_000)
  })
  it('still taxes a withdrawal under 60, and leaves an in-plan rollover to the age-60 rule', () => {
    expect(subtracted('PA', [row({ ...at50, federallyIncludedAmount: 40_000 })])).toBe(0)
    expect(subtracted('PA', [conversion(40_000, { ...at50, accountId: '401k', sourceKind: 'employerPlan' })])).toBe(0)
  })
})

describeRule('sc-code-12-6-1170-roth-conversion-not-premature', {
  readings: {
    // Owner 50, so a withdrawal's early status is unknown without a date. A
    // $20,000 conversion is never penalized: the $3,000 under-65 deduction.
    // At 66 it is the $10,000 deduction either way.
    conversionNeverPremature: { at50: 3_000, at66: 10_000 },
    // Withheld as of unknown premature status, as before 2026-10-06.
    withheldAsUnknownPremature: { at50: 0, at66: 10_000 },
  },
  accepted: 'conversionNeverPremature',
}, ({ accepted }) => {
  it('counts a conversion toward the deduction whatever the owner’s age', () => {
    const young = [conversion(20_000, { recipientAgeYears: 50, earlyDistributionDisqualifier: 'unknown' })]
    expect(subtracted('SC', young)).toBe(accepted.at50)
    expect(annual('SC', { retirementDistributions: young }).warnings.map((warning) => warning.code)).not.toContain('sc-1170-premature-unknown')
    expect(subtracted('SC', [conversion(20_000, { recipientAgeYears: 66 })])).toBe(accepted.at66)
  })
  it('still withholds a withdrawal of unknown premature status', () => {
    const withdrawal = [row({ federallyIncludedAmount: 20_000, recipientAgeYears: 50, earlyDistributionDisqualifier: 'unknown' })]
    expect(subtracted('SC', withdrawal)).toBe(0)
    expect(annual('SC', { retirementDistributions: withdrawal }).warnings.map((warning) => warning.code)).toContain('sc-1170-premature-unknown')
  })
})

describeRule('ct-cgs-12-701-20-b-xxviii-xxix-ira-distribution-schedule', {
  readings: {
    // A $30,000 IRA distribution, subtracted at the schedule's percent for
    // the federal AGI. Unmarried schedule: $60,000 is under $75,000, 100%,
    // 30,000; $78,000 is in $77,500 to $79,999, 70%, 21,000; $99,000 is in
    // $95,000 to $99,999, 2.5%, 750; $120,000 is over $100,000, none. Joint
    // schedule: $112,000 is in $110,000 to $114,999, 55%, 16,500. A
    // qualifying surviving spouse at $112,000 reads the unmarried schedule:
    // none. A $30,000 conversion at $78,000: 21,000, as any IRA distribution.
    // An inherited Roth IRA whose $30,000 of earnings are taxable (no
    // five-year clock) at $60,000: none, since both clauses read "other than
    // a Roth individual retirement account".
    schedulesOfXxviiiAndXxix: {
      at60k: 30_000, at78k: 21_000, at99k: 750, at120k: 0, joint112k: 16_500, survivingSpouse112k: 0, conversionAt78k: 21_000,
      inheritedRothAt60k: 0,
    },
    // Every IRA dollar subtracted at any AGI, as before 2026-10-06.
    fullSubtractionAtAnyAgi: {
      at60k: 30_000, at78k: 30_000, at99k: 30_000, at120k: 30_000, joint112k: 30_000, survivingSpouse112k: 30_000, conversionAt78k: 30_000,
      inheritedRothAt60k: 30_000,
    },
  },
  accepted: 'schedulesOfXxviiiAndXxix',
}, ({ accepted }) => {
  const ira = [row()]
  it('subtracts IRA distributions by the unmarried schedule', () => {
    expect(subtracted('CT', ira, household({ federalAgi: 60_000 }))).toBe(accepted.at60k)
    expect(subtracted('CT', ira, household({ federalAgi: 78_000 }))).toBe(accepted.at78k)
    expect(subtracted('CT', ira, household({ federalAgi: 99_000 }))).toBe(accepted.at99k)
    expect(subtracted('CT', ira, household({ federalAgi: 120_000 }))).toBe(accepted.at120k)
  })
  it('reads the joint schedule only on a joint return', () => {
    expect(subtracted('CT', ira, household({ federalAgi: 112_000, stateFilingStatus: 'marriedFilingJointly' }), { filingStatus: 'marriedFilingJointly' }))
      .toBe(accepted.joint112k)
    expect(subtracted('CT', ira, household({ federalAgi: 112_000, stateFilingStatus: 'qualifyingSurvivingSpouse' }), { filingStatus: 'qualifyingSurvivingSpouse' }))
      .toBe(accepted.survivingSpouse112k)
  })
  it('treats a conversion as an IRA distribution, and leaves pensions to the pack rule', () => {
    expect(subtracted('CT', [conversion(30_000)], household({ federalAgi: 78_000 }))).toBe(accepted.conversionAt78k)
    // A private pension keeps the unconditional subtraction, registered as
    // approximated at ct-cgs-12-701-20-b-social-security-retirement.
    expect(subtracted('CT', [row({ accountId: 'pension', sourceKind: 'ordinaryPrivatePension' })], household({ federalAgi: 120_000 }))).toBe(30_000)
  })
  it('excepts a Roth IRA, and keeps a conversion off the traditional account', () => {
    const inheritedRoth = row({ accountId: 'roth', accountTaxTreatment: 'roth', cause: 'death' })
    expect(subtracted('CT', [inheritedRoth], household({ federalAgi: 60_000 }))).toBe(accepted.inheritedRothAt60k)
    expect(subtracted('CT', [row({ accountTaxTreatment: 'traditional' })], household({ federalAgi: 60_000 }))).toBe(accepted.at60k)
    expect(subtracted('CT', [conversion(30_000, { accountTaxTreatment: 'traditional' })], household({ federalAgi: 78_000 }))).toBe(accepted.conversionAt78k)
  })
  it('reaches a split year, whose Connecticut slice is the full-year tax on the rows times the ratio', () => {
    // Six months in Connecticut, six in Florida, $150,000 of federal AGI with
    // a $30,000 IRA distribution: the schedule allows nothing at that AGI.
    // CT-1040NR/PY taxes as a resident and prorates by Connecticut-source
    // Connecticut AGI. 150,000 taxable (the exemption phases out by $45,000):
    // 10,000 x 2% = 200; 40,000 x 4.5% = 1,800; 50,000 x 5.5% = 2,750; 50,000
    // x 6% = 3,000; 7,750. The row has no date, so half the year is
    // Connecticut's: 3,875. Until 2026-10-08 the slice was priced on the
    // coarse inputs, where the pack's full rule took its share of the private
    // retirement income off, and the year was incomplete.
    const split = { stateResidency: [{ state: 'CT', months: 6 }, { state: 'FL', months: 6 }], ordinaryIncome: 150_000 }
    const options = { retirementDistributions: [row()], householdFacts: household({ federalAgi: 150_000, connecticutAgi: 150_000 }) }
    const withRetirement = computeStateTaxYearResult(input('CT', { ...split, privateRetirementIncome: 30_000 }), options)
    expect(withRetirement.totalTax).toBeCloseTo(3_875, 6)
    expect(withRetirement.status).toBe('complete')
    // The rows decide it, not the coarse retirement bucket.
    expect(computeStateTaxYearResult(input('CT', split), options).totalTax).toBeCloseTo(3_875, 6)
  })
})

describeRule('nj-stat-54a-6-10-retirement-income-exclusion', {
  readings: {
    // NJ-1040 line 28a: the lesser of the qualifying payments (line A) and,
    // at gross income up to $100,000, $75,000 single or $100,000 joint, or
    // above it 37.5% / 50% of all payments to $125,000 and 18.75% / 25% to
    // $150,000 (line B); nothing above $150,000.
    // (a) Single, 65, all $80,000 of income a pension: min(80,000, 75,000).
    // (b) Single, 65, $110,000 including an $80,000 pension: 37.5% × 80,000.
    // (c) Single, 65, $140,000 including $80,000: 18.75% × 80,000.
    // (d) Single, 65, $200,000 including $80,000: over $150,000, nothing.
    // (e) Joint, $95,000: a $90,000 pension of the spouse who is 65, the
    //     other 60: min(90,000, 100,000).
    // (f) Joint, $120,000: $40,000 to the spouse who is 65 and $30,000 to
    //     the spouse who is 60: min(40,000, 50% × 70,000 = 35,000).
    // (g) Joint, both 65, $110,000 all pension (60,000 + 50,000):
    //     min(110,000, 50% × 110,000).
    statuteAndLine28a: {
      singleAt80k: 75_000, singleAt110k: 30_000, singleAt140k: 15_000, singleAt200k: 0,
      jointOneQualifiesAt95k: 90_000, jointOneQualifiesAt120k: 35_000, jointBothAt110k: 55_000,
    },
    // $50,000 for each household member 62 or older, with no income test,
    // as before 2026-10-06.
    fiftyThousandEachNoIncomeTest: {
      singleAt80k: 50_000, singleAt110k: 50_000, singleAt140k: 50_000, singleAt200k: 50_000,
      jointOneQualifiesAt95k: 50_000, jointOneQualifiesAt120k: 50_000, jointBothAt110k: 100_000,
    },
  },
  accepted: 'statuteAndLine28a',
}, ({ accepted }) => {
  const pension = (amount: number, change: Partial<StateRetirementDistributionFact> = {}) =>
    row({ accountId: `pension-${amount}`, sourceKind: 'ordinaryPrivatePension', federallyIncludedAmount: amount, grossDistribution: amount, recipientAgeYears: 65, ...change })
  const joint = { filingStatus: 'marriedFilingJointly' as const }
  const jointFacts = household({ stateFilingStatus: 'marriedFilingJointly' })

  it('applies the income test and the tiers to a single filer', () => {
    expect(subtracted('NJ', [pension(80_000)], household(), { ordinaryIncome: 80_000 })).toBe(accepted.singleAt80k)
    expect(subtracted('NJ', [pension(80_000)], household(), { ordinaryIncome: 110_000 })).toBe(accepted.singleAt110k)
    expect(subtracted('NJ', [pension(80_000)], household(), { ordinaryIncome: 140_000 })).toBe(accepted.singleAt140k)
    expect(subtracted('NJ', [pension(80_000)], household(), { ordinaryIncome: 200_000 })).toBe(accepted.singleAt200k)
  })

  it('counts on a joint return only the payments of a spouse who qualifies', () => {
    expect(subtracted('NJ', [pension(90_000)], jointFacts, { ...joint, ordinaryIncome: 95_000 })).toBe(accepted.jointOneQualifiesAt95k)
    expect(subtracted('NJ', [pension(40_000), pension(30_000, { ownerPersonId: 'spouse', recipientAgeYears: 60 })], jointFacts, { ...joint, ordinaryIncome: 120_000 }))
      .toBe(accepted.jointOneQualifiesAt120k)
    expect(subtracted('NJ', [pension(60_000), pension(50_000, { ownerPersonId: 'spouse' })], jointFacts, { ...joint, ordinaryIncome: 110_000 }))
      .toBe(accepted.jointBothAt110k)
  })

  it('counts a Roth conversion and a disabled recipient, and the coarse fields', () => {
    // A $60,000 conversion at 62 on $70,000 of income: min(60,000, 75,000).
    // (On $70,000 the $1,000 personal exemption leaves the base above zero
    // either way, so the difference is the exclusion alone.)
    expect(subtracted('NJ', [conversion(60_000, { recipientAgeYears: 62 })], household(), { ordinaryIncome: 70_000 })).toBe(60_000)
    // A disabled recipient of 55 qualifies as the statute's disability limb,
    // and also takes the $1,000 disabled exemption of 54A:3-1(b)5
    // (nj-stat-54a-3-1-personal-exemptions).
    expect(subtracted('NJ', [pension(40_000, { recipientAgeYears: 55, recipientDisabled: true })], household(), { ordinaryIncome: 50_000 })).toBe(41_000)
    expect(subtracted('NJ', [pension(40_000, { recipientAgeYears: 55 })], household(), { ordinaryIncome: 50_000 })).toBe(0)
    // With no characterized rows, the coarse retirement field: single, 65,
    // $80,000 all retirement income, 75,000 off.
    const pack = stateParamsFor('NJ', 2026)!
    const coarse = (privateRetirementIncome: number) => computeStateTaxableIncome(pack, input('NJ', { ordinaryIncome: 80_000, privateRetirementIncome, agesAlive: [65] }))
    expect(coarse(0) - coarse(80_000)).toBe(75_000)
  })
})

describe('New Jersey pension exclusion, part-year resident', () => {
  it('prorates the maximum and tests the year’s income', () => {
    // Single, 65, $80,000 all pension; six months in New Jersey and six in
    // Florida. The slice has $40,000 of income and of payments; the income
    // test reads the year ($80,000, under $100,000), and the $75,000 maximum
    // is prorated to $37,500 (NJ-1040 line 28a, part-year residents), so
    // $37,500 of the slice's $40,000 is excluded. The $1,000 personal
    // exemption and the $1,000 age exemption are each limited to the six
    // months resident by 54A:3-1(c), $500 apiece, so $1,500 is taxed at 1.4%:
    // $21.00. New Jersey's part-year brackets are the whole-year table
    // (partYear.rateSchedule 'unscaled'), whose first band runs to $20,000;
    // statePartYear.rules.test.ts pins that with income above the first band.
    const partYear = computeStateTaxYearResult(input('NJ', {
      ordinaryIncome: 80_000,
      privateRetirementIncome: 80_000,
      agesAlive: [65],
      peopleAged65Plus: 1,
      stateResidency: [{ state: 'NJ', months: 6 }, { state: 'FL', months: 6 }],
    }))
    expect(partYear.totalTax).toBeCloseTo(1_500 * 0.014, 6)
  })
})
