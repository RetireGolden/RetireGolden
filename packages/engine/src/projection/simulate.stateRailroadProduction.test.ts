import { describe, expect, it } from 'vitest'
import type { Account, Plan } from '../model/plan.js'
import {
  couplePlan,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  singlePersonPlan,
  socialSecurityIncome,
  validatePlan,
} from '../testing/planFixtures.js'
import { stateParamsFor } from '../params/state/index.js'
import { computeStateTaxDetailResult, createStateTaxCalculator, type StateTaxComputationResult } from '../tax/stateTax.js'
import { simulatePlan } from './simulate.js'
import type { TaxYearInput } from './types.js'

describe('actual railroad gross in Maryland pension exclusion', () => {
  it('offsets the 40600 pension maximum by SS20000 plus RRB5000 without optional cash-flow capture', () => {
    // Maryland pension exclusion worksheet: min(50000,40600-20000-5000)=15600.
    // Source: Maryland Comptroller pension exclusion worksheet, the TY2026
    // parameter pack's published maximum. Gross RRB, including TierII, offsets it.
    const plan = singlePersonPlan({ dob: '1958-01-02', planningAge: 85, state: 'MD' })
    // January2 avoids the SSA January1 prior-birth-year rule;1958 FRA is66y8m.
    const ss = socialSecurityIncome('ss', 20000 / 12, 66)
    if (ss.type !== 'socialSecurity') throw new Error('Expected SS fixture')
    ss.claimAge = { years: 66, months: 8 }
    plan.incomes = [ss]
    plan.accounts = [
      { type: 'pension', id: 'qualified', name: 'Qualified pension', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 65, monthlyAmount: 50000 / 12, colaPct: 0,
        survivorPct: 0, source: 'employerPlan' },
      { type: 'pension', id: 'rrb', name: 'Railroad TierII', ownerPersonId: 'p1',
        annualReturnPct: null, startAge: 65, monthlyAmount: 5000 / 12, colaPct: 0,
        survivorPct: 0, source: 'railroadTier2' },
    ] as Account[]
    const result = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
      taxCalculator: createStateTaxCalculator() })
    const input = result.years[0]!.acceptedTaxInput!
    expect(input.stateHouseholdFacts).toMatchObject({ householdGrossSocialSecurity: 20000,
      householdGrossRailroadBenefits: 5000 })
    const params = stateParamsFor('MD', 2026)!
    const options = { householdFacts: input.stateHouseholdFacts,
      retirementDistributions: input.stateRetirementDistributions }
    const actual = computeStateTaxDetailResult(params, input, options)
    const withoutPensionExclusion = computeStateTaxDetailResult({ ...params,
      retirementPrivate: { ...params.retirementPrivate, capPerPerson: 0 } }, input, options)
    expect(withoutPensionExclusion.taxableIncome - actual.taxableIncome).toBeCloseTo(15600, 6)
    expect(actual.warnings.some((warning) => warning.code === 'md-pension-benefit-offset-unknown')).toBe(false)
  })
})

describe('45 U.S.C. 231m(a) from the plan to the state return', () => {
  // A pension tagged Railroad Tier II, priced through simulatePlan, runs
  // through the state-facts adapter and the household railroad aggregates
  // into each state's return. 231m(a) bars any state tax on it, so each
  // plan's state tax is the same plan's without the annuity. The cases hold
  // every other figure still: the other income is fixed (no spending, no
  // accounts to draw), and in Utah Social Security is 85% included federally
  // either way (IRC 86(a)(2)) and Utah MAGI stays under the joint $90,000 of
  // Utah Code 59-10-1042(4) either way, so the annuity reaches Utah's figures
  // only through the 59-10-114(2)(d) subtraction.
  const tierTwo = (): Account => ({ type: 'pension', id: 'rrb', name: 'Railroad Tier II',
    ownerPersonId: 'p1', annualReturnPct: null, startAge: 60, monthlyAmount: 20000 / 12,
    colaPct: 0, survivorPct: 0, source: 'railroadTier2' })
  const privatePension = (): Account => ({ type: 'pension', id: 'corp', name: 'Company pension',
    ownerPersonId: 'p1', annualReturnPct: null, startAge: 60, monthlyAmount: 40000 / 12,
    colaPct: 0, survivorPct: 0, source: 'ordinaryPrivatePension' })
  // The state calculator the ledger composes, read with its state detail.
  const stateCalculator: { computeResult(input: TaxYearInput): StateTaxComputationResult } = createStateTaxCalculator()
  const priced = (plan: Plan) => {
    const year = simulatePlan(validatePlan(plan), { startYear: 2026, horizonEndYear: 2026,
      taxCalculator: productionTaxCalculator() }).years[0]!
    return { year, input: year.acceptedTaxInput!, state: stateCalculator.computeResult(year.acceptedTaxInput!) }
  }
  const withAndWithout = (build: () => Plan) => {
    const plan = build()
    plan.accounts = [...plan.accounts, tierTwo()]
    return { annuity: priced(plan), none: priced(build()) }
  }
  const expectRailroadCarried = (input: TaxYearInput) => {
    expect(input.stateRetirementDistributions).toContainEqual(expect.objectContaining({
      accountId: 'rrb', sourceKind: 'railroadTier2', federallyIncludedAmount: 20000 }))
    expect(input.stateHouseholdFacts).toMatchObject({ householdGrossRailroadBenefits: 20000,
      railroadRetirementActBenefitsPaid: 20000, railroadRetirementActBenefitsIncludedInFederalAgi: 20000,
      federallyIncludedRailroadTier1: 0 })
  }

  it('Utah: the Social Security credit is kept beside each railroad subtraction', () => {
    // Joint, both 70, 50,000 other income and a 1,500 PIA claimed at 62
    // (13,350 of benefits in 2026, 11,347.50 included federally). Utah
    // taxable income 81,347.50 - 20,000 = 61,347.50 with the annuity, the
    // same without. A tier II annuity is not a Social Security benefit (IRC
    // 86(d)(1)), so the 59-10-114(2)(d) subtraction removes none of the
    // 11,347.50 and the 59-10-1042(2) credit is 4.45% of it, 504.96. The
    // engine had left that credit base unknown whenever a railroad pension
    // existed, dropping the credit and marking the year incomplete.
    const build = () => {
      const plan = couplePlan({ p1Dob: '1956-01-01', p2Dob: '1956-01-01', p1PlanningAge: 95,
        p2PlanningAge: 95, state: 'UT' })
      plan.incomes = [recurringOrdinaryIncome('other', 50000), socialSecurityIncome('ss', 1500, 62)]
      plan.stateTaxFacts.householdYearFacts = [{ year: 2026, utahSection59_10_114Additions: 0 }]
      return plan
    }
    const { annuity, none } = withAndWithout(build)
    expectRailroadCarried(annuity.input)
    expect(annuity.input.stateHouseholdFacts).toMatchObject({ federalAgi: 81347.5,
      federallyIncludedSocialSecurity: 11347.5, socialSecurityIncludedInUtahTaxableIncome: 11347.5,
      railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome: 0 })
    expect(annuity.state.taxableIncome).toBeCloseTo(61347.5, 6)
    expect(annuity.state.taxCredit).toBeCloseTo(11347.5 * 0.0445, 6)
    expect(annuity.state.warnings.map((warning) => warning.code)).not.toContain('ut-ss-rrb-overlap-unknown')
    expect(annuity.year.taxComputation?.status).toBe('complete')
    expect(annuity.state.taxableIncome).toBeCloseTo(none.state.taxableIncome, 6)
    expect(annuity.state.taxCredit).toBeCloseTo(none.state.taxCredit, 6)
    expect(annuity.state.amount).toBeCloseTo(none.state.amount, 6)
    // Tier 1 and the other annuities too: a railroad pension is priced as
    // pension income, outside the Social Security the credit base holds.
    for (const source of ['railroadTier1', 'railroadRetirementAct'] as const) {
      const plan = build()
      plan.accounts = [...plan.accounts, { ...tierTwo(), source } as Account]
      const other = priced(plan)
      expect(other.year.taxComputation?.status, source).toBe('complete')
      expect(other.state.taxCredit, source).toBeCloseTo(none.state.taxCredit, 6)
      expect(other.state.amount, source).toBeCloseTo(none.state.amount, 6)
    }
  })

  it('Pennsylvania, which subtracted nothing before: 3.07% of the other income only', () => {
    const build = () => {
      const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 95, state: 'PA' })
      plan.incomes = [recurringOrdinaryIncome('other', 80000)]
      return plan
    }
    const { annuity, none } = withAndWithout(build)
    expectRailroadCarried(annuity.input)
    expect(annuity.state.amount).toBeCloseTo(80000 * 0.0307, 6)
    expect(annuity.year.taxComputation?.status).toBe('complete')
    expect(annuity.state.amount).toBeCloseTo(none.state.amount, 6)
  })

  it('New Jersey at 65: the annuity stays out of the pension exclusion pool', () => {
    // A 40,000 company pension and 50,000 of other income. The pension sits
    // inside the exclusion cap the engine loads for a person 62 or older,
    // with room to spare; were the annuity in that pool too, its dollars
    // would fill the room and come off a second time.
    const build = () => {
      const plan = singlePersonPlan({ dob: '1961-01-01', planningAge: 95, state: 'NJ' })
      plan.incomes = [recurringOrdinaryIncome('other', 50000)]
      plan.accounts = [privatePension()]
      return plan
    }
    const { annuity, none } = withAndWithout(build)
    expectRailroadCarried(annuity.input)
    expect(annuity.year.taxComputation?.status).toBe('complete')
    expect(annuity.state.taxableIncome).toBeCloseTo(none.state.taxableIncome, 6)
    expect(annuity.state.amount).toBeCloseTo(none.state.amount, 6)
  })
})
