/**
 * Utah's nonrefundable credits in a projected year: the 59-10-114 additions
 * Utah MAGI needs, which the projection now supplies from the plan; the
 * election that no longer demands MAGI where MAGI cannot change the answer;
 * and the Social Security credit's phase-out on the TC-40 worksheet's line 9,
 * after the railroad retirement subtraction (decision D-UTAH-RAILROAD-MAGI).
 *
 * Expected amounts are hand calculations at Utah's 2026 flat 4.45%, with no
 * Utah standard deduction (the pack carries none), from the credit statutes
 * and worksheets the records quote.
 */
import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import type { Account } from '../model/plan.js'
import type { TaxYearInput } from '../projection/types.js'
import { stateParamsFor } from '../params/state/index.js'
import { cashAccount, runPlan, singlePersonPlan, socialSecurityIncome } from '../testing/planFixtures.js'
import { computeStateTaxYearResult, createStateTaxCalculator } from './stateTax.js'
import type { StateRetirementDistributionFact } from './stateRetirementFacts.js'
import { utahRetirementCredit, utahSocialSecurityCredit } from './stateWestExtras.js'

const pension = (source: string, amount: number): Account => ({
  type: 'pension', id: 'pension', name: 'Pension', ownerPersonId: 'p1', annualReturnPct: 0,
  startAge: 60, monthlyAmount: amount / 12, colaPct: 0, survivorPct: 0, source,
} as Account)

describe('Utah credits in a projected year', () => {
  describeRule('ut-code-59-10-114-1-additions-in-utah-magi', {
    readings: { retirementCredit: 617.11, withheldForWantOfMagi: 1_067.11 },
    accepted: 'retirementCredit',
  }, ({ accepted }) => {
    it('prices the retirement credit for a claimant born in 1950 with no stored Utah facts', () => {
      // Social Security: PIA 2,000 claimed at 67 against a full retirement
      // age of 66, +8%: 2,160 a month, 25,920 a year. Provisional income
      // 20,000 + 12,960 = 32,960; taxable 50% x 7,960 = 3,980. AGI and Utah
      // taxable income 23,980; tax before credits 23,980 x 4.45% = 1,067.11.
      // MAGI 23,980 (no excluded interest, no addition): retirement credit 450
      // (below the 25,000 single threshold); Social Security credit 4.45% x
      // 3,980 = 177.11. The larger, 450, leaves 617.11.
      const plan = singlePersonPlan({ dob: '1950-06-01', planningAge: 90, state: 'UT' })
      plan.accounts = [cashAccount('cash', 50_000), pension('ordinaryPrivatePension', 20_000)]
      plan.incomes = [socialSecurityIncome('ss', 2_000, 67)]
      const year = runPlan(plan, createStateTaxCalculator(), 2026).years[0]!
      expect(year.acceptedTaxInput?.stateHouseholdFacts?.utahSection59_10_114Additions).toBe(0)
      expect(year.tax).toBeCloseTo(accepted, 6)
      expect(year.taxComputation?.status).toBe('complete')
    })
  })

  describeRule('ut-code-59-10-1043-military-retirement-credit', {
    note: 'projection',
    readings: { creditPriced: 0, withheld: 4_450 },
    accepted: 'creditPriced',
  }, ({ accepted }) => {
    it('prices the military credit for a 60-year-old with 100,000 of military pay', () => {
      // Utah taxable 100,000; tax before credits 4,450. Military credit 4.45%
      // x 100,000 = 4,450, with no phase-out; no Social Security credit and no
      // retirement credit (born after 1952). Tax 0.
      const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70, state: 'UT' })
      plan.accounts = [cashAccount('cash', 50_000), pension('militaryRetirement', 100_000)]
      const year = runPlan(plan, createStateTaxCalculator(), 2026).years[0]!
      expect(year.tax).toBeCloseTo(accepted, 6)
      expect(year.taxComputation?.status).toBe('complete')
    })
  })

  describeRule('ut-code-59-10-1043-military-retirement-credit', {
    note: 'MAGI not needed',
    readings: { credited: 4_450, withheldForWantOfMagi: 0 },
    accepted: 'credited',
  }, ({ accepted }) => {
    it('takes the military credit with no MAGI facts when no competing credit can depend on MAGI', () => {
      // Born 1966: no retirement credit at any MAGI. No Social Security in
      // Utah taxable income: no Social Security credit at any MAGI. So the
      // election needs no MAGI, and the credit is 4.45% x 100,000 = 4,450.
      const input: TaxYearInput = { year: 2026, state: 'UT', filingStatus: 'single', ordinaryIncome: 100_000, capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [60] }
      const row: StateRetirementDistributionFact = { ownerPersonId: 'owner', sourceKind: 'militaryRetirement', federallyIncludedAmount: 100_000, recipientAgeYears: 60, cause: 'ordinary', earlyDistributionDisqualifier: 'false' }
      const result = computeStateTaxYearResult(input, {
        retirementDistributions: [row], hsaAccounts: [], qcdEvents: [],
        householdFacts: { stateFilingStatus: 'single', federalAgi: 100_000, claimantDatesOfBirth: ['1966-01-01'], socialSecurityIncludedInUtahTaxableIncome: 0 },
      })
      expect(result.taxCredit).toBeCloseTo(accepted, 6)
      expect(result.status).toBe('complete')
      const config = stateParamsFor('UT', 2026)!.utahRetirementCredits!
      expect(utahRetirementCredit({ claimantDatesOfBirth: ['1966-01-01'], utahMagi: undefined, filingStatus: undefined, config }).warnings).toEqual([])
      expect(utahRetirementCredit({ claimantDatesOfBirth: ['1950-01-01'], utahMagi: undefined, filingStatus: 'single', config }).warnings).not.toEqual([])
      expect(utahSocialSecurityCredit({ socialSecurityIncludedInUtahTaxableIncome: 0, utahMagi: undefined, filingStatus: undefined, config }).warnings).toEqual([])
    })
  })
})

describeRule('ut-tc-40-social-security-credit-railroad-magi', {
  readings: { tc40Line9: 890, statuteMagi: 1_120 },
  accepted: 'tc40Line9',
}, ({ accepted, readings }) => {
  it('phases the Social Security credit out on income after the code 78 subtraction', () => {
    // Born 1956, single: 32,000 of Social Security, a 20,000 tier II annuity
    // and 20,000 of other income. Provisional income 40,000 + 16,000 =
    // 56,000; taxable Social Security 85% x 22,000 + 4,500 = 23,200. Federal
    // AGI 63,200; Utah taxable 63,200 - 20,000 = 43,200; tax before credits
    // 1,922.40. Credit 4.45% x 23,200 = 1,032.40. Line 9 basis 43,200, below
    // 54,000: no phase-out, tax 890.00. Statute basis 63,200: 2.5% x 9,200 =
    // 230.00 off, credit 802.40, tax 1,120.00. The retirement credit (born
    // after 1952) is 0 either way.
    const input: TaxYearInput = { year: 2026, state: 'UT', filingStatus: 'single', ordinaryIncome: 40_000, capitalGains: 0, ssBenefits: 32_000, peopleAged65Plus: 0, agesAlive: [70] }
    const annuity: StateRetirementDistributionFact = { ownerPersonId: 'owner', sourceKind: 'railroadTier2', federallyIncludedAmount: 20_000, grossDistribution: 20_000, recipientAgeYears: 70, cause: 'ordinary', earlyDistributionDisqualifier: 'false' }
    const result = computeStateTaxYearResult(input, {
      retirementDistributions: [annuity], hsaAccounts: [], qcdEvents: [],
      householdFacts: {
        stateFilingStatus: 'single', federalAgi: 63_200, interestExcludedFromFederalAgi: 0, utahSection59_10_114Additions: 0,
        socialSecurityIncludedInUtahTaxableIncome: 23_200, railroadRetirementSocialSecurityOverlapIncludedInUtahTaxableIncome: 0,
        claimantDatesOfBirth: ['1956-01-01'],
      },
    })
    expect(result.taxableIncome).toBe(43_200)
    expect(result.amount).toBeCloseTo(accepted, 6)
    expect(result.status).toBe('complete')
    expect(accepted).not.toBe(readings.statuteMagi)
  })
})
