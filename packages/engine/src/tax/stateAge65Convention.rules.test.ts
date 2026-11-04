/**
 * The age-65 count dated by each state's own convention (RetireGolden #823).
 *
 * Wisconsin's 2025 Form 1 instructions ("Age", page 3): "If your birthday
 * falls on January 1, 2026, you are considered to be a year older as of
 * December 31, 2025." Line 10b gives the $250 age addition to a taxpayer or
 * spouse "65 or older on December 31". So a claimant born January 1, 1962 is
 * 65 for 2026 and one born January 2, 1962 is not. New Jersey's NJ-1040
 * instructions count "65 or older on the last day of the tax year", the plain
 * December 31 age, so the same January 1 birthday is 64 there for 2026.
 *
 * Every expected amount is a hand calculation from the 2026 figures the
 * records register (Wisconsin: $700 per exemption, $250 per age-65 addition,
 * Form 1-ES single schedule 3.5% to $15,110, 4.4% to $51,950, 5.3% above),
 * not a copy of helper output.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, type Plan } from '../model/plan.js'
import { householdFactsForYear } from '../projection/internal/stateRetirementFactsAdapter.js'
import { buildAnnualStateHouseholdFacts } from '../projection/internal/annualStateHouseholdFacts.js'
import type { TaxYearInput } from '../projection/types.js'
import { describeRule } from '../rules/describeRule.js'
import { cashAccount, runPlan, singlePersonPlan } from '../testing/planFixtures.js'
import { computeStateTaxYearResult, createStateTaxCalculator } from './stateTax.js'
import type { StateHouseholdTaxFacts } from './stateRetirementFacts.js'

const JANUARY_FIRST = '1962-01-01'
const JANUARY_SECOND = '1962-01-02'

function onePersonPlan(dob: string, state = 'WI'): Plan {
  const plan = createEmptyPlan({ newId: () => 'p', now: () => new Date('2026-01-01') })
  plan.household.state = state
  plan.household.filingStatus = 'single'
  plan.household.people[0]!.dob = dob
  plan.stateTaxFacts.householdYearFacts = [{
    year: 2026, exemptionTaxpayerCount: 1, exemptionDependentCount: 0, claimedAsDependent: false,
  }]
  return plan
}

/** The household facts the projection hands a state for 2026, from the adapter. */
function adapterFacts(dob: string, state = 'WI'): StateHouseholdTaxFacts {
  return householdFactsForYear(onePersonPlan(dob, state), 2026, { claimantPersonIds: ['p'] })!
}

const input = (state: string, change: Partial<TaxYearInput> = {}): TaxYearInput => ({
  year: 2026, state, filingStatus: 'single', ordinaryIncome: 80_000,
  capitalGains: 0, ssBenefits: 0, peopleAged65Plus: 0, agesAlive: [64], ...change,
})

function stateYear(state: string, facts: StateHouseholdTaxFacts, change: Partial<TaxYearInput> = {}) {
  return computeStateTaxYearResult(input(state, change), {
    retirementDistributions: [], hsaAccounts: [], qcdEvents: [],
    // A zero standard deduction isolates the exemptions in taxable income.
    standardDeductionAllowedOverride: 0,
    householdFacts: { federalAgi: 80_000, ...facts },
  })
}

describe('the age-65 count under each convention', () => {
  it('derives both counts from the claimant, and they differ only for a January 1 birthday', () => {
    // 1962-01-01: December 31, 2026 is the day before the 65th birthday, so
    // the plain age is 64 and the age attained the day before a birthday is 65.
    expect(adapterFacts(JANUARY_FIRST)).toMatchObject({
      age65EligibleCountByConvention: { lastDayOfTaxYear: 0, dayBeforeBirthday: 1 },
    })
    // 1962-01-02 turns 65 on January 2, 2027: 64 under both.
    expect(adapterFacts(JANUARY_SECOND)).toMatchObject({
      age65EligibleCountByConvention: { lastDayOfTaxYear: 0, dayBeforeBirthday: 0 },
    })
    // A derived count is never published as the asserted count.
    expect(adapterFacts(JANUARY_FIRST).age65EligibleCount).toBeUndefined()
  })

  it('gives the annual household facts the same counts as householdFactsForYear', () => {
    for (const dob of [JANUARY_FIRST, JANUARY_SECOND, '1961-06-30', '1990-01-01']) {
      const plan = onePersonPlan(dob)
      const annual = buildAnnualStateHouseholdFacts({
        plan, taxYear: 2026, socialSecurityStreams: [], claimantPersonIds: ['p'],
        federal: { agi: 80_000, taxableIncome: 80_000, deductionUsed: 0, taxableSocialSecurity: 0, taxExemptInterest: 0 },
      }).householdFacts
      const adapter = householdFactsForYear(plan, 2026, { claimantPersonIds: ['p'] })!
      expect(annual.age65EligibleCount).toBe(adapter.age65EligibleCount)
      expect(annual.age65EligibleCountByConvention).toEqual(adapter.age65EligibleCountByConvention)
    }
  })

  it('reads a stored count as the plan asserts it, under every convention', () => {
    const plan = onePersonPlan(JANUARY_FIRST)
    plan.stateTaxFacts.householdYearFacts = [{ year: 2026, age65EligibleCount: 0, exemptionTaxpayerCount: 1, exemptionDependentCount: 0, claimedAsDependent: false }]
    const facts = householdFactsForYear(plan, 2026, { claimantPersonIds: ['p'] })!
    expect(facts.age65EligibleCount).toBe(0)
    expect(facts.age65EligibleCountByConvention).toBeUndefined()
    const annual = buildAnnualStateHouseholdFacts({
      plan, taxYear: 2026, socialSecurityStreams: [], claimantPersonIds: ['p'],
      federal: { agi: 80_000, taxableIncome: 80_000, deductionUsed: 0, taxableSocialSecurity: 0, taxExemptInterest: 0 },
    }).householdFacts
    expect(annual.age65EligibleCount).toBe(0)
    expect(annual.age65EligibleCountByConvention).toBeUndefined()
    // Wisconsin then gives the $700 exemption only: 80,000 - 700.
    expect(stateYear('WI', facts).taxableIncome).toBe(79_300)
  })

  it('reads a caller\'s own count over the derived one, even when the two values agree', () => {
    // The caller spreads the projected facts and asserts the count. For the
    // January 1 birthday the derived December 31 count is also 0, and the
    // assertion still wins over the dayBeforeBirthday count of 1: $700 only.
    expect(stateYear('WI', { ...adapterFacts(JANUARY_FIRST), age65EligibleCount: 0 }).taxableIncome).toBe(79_300)
    // An asserted 1 for the January 2 birthday takes the $250: 80,000 - 950.
    expect(stateYear('WI', { ...adapterFacts(JANUARY_SECOND), age65EligibleCount: 1 }).taxableIncome).toBe(79_050)
  })

  it('derives the count from dates of birth alone, under the state\'s convention, when no count is supplied', () => {
    // A caller's facts with the claimants' dates of birth and the exemption
    // counts but neither count field (both optional in the plan schema).
    const datesOnly = (dob: string): StateHouseholdTaxFacts => ({
      claimantDatesOfBirth: [dob], exemptionTaxpayerCount: 1, exemptionDependentCount: 0, claimedAsDependent: false,
    })
    // Wisconsin, dayBeforeBirthday: $950 for the January 1 birthday, $700 for January 2.
    expect(stateYear('WI', datesOnly(JANUARY_FIRST)).taxableIncome).toBe(79_050)
    expect(stateYear('WI', datesOnly(JANUARY_SECOND)).taxableIncome).toBe(79_300)
    expect(stateYear('WI', datesOnly(JANUARY_FIRST)).warnings.map((warning) => warning.code)).not.toContain('wi-exemption-counts-unknown')
    // Illinois, the December 31 default: both 64, the $2,925 basic allowance only.
    const illinois = stateYear('IL', datesOnly(JANUARY_FIRST))
    expect(illinois.taxableIncome).toBe(80_000 - 2_925)
    expect(illinois.warnings.map((warning) => warning.code)).not.toContain('il-exemption-counts-unknown')
    // A claimant born in 1961 is 65 under both: $2,925 + $1,000.
    expect(stateYear('IL', datesOnly('1961-06-30')).taxableIncome).toBe(80_000 - 3_925)
  })
})

describeRule('wi-2026-rates-standard-deduction-exemptions', {
  note: 'age-65 addition for a January 1 birthday',
  readings: { formOneJanuaryFirstRule: 950, ageOnDecember31: 700 },
  accepted: 'formOneJanuaryFirstRule',
}, ({ accepted, readings }) => {
  it('gives a claimant born January 1, 1962 the $250 age addition for 2026', () => {
    // $700 for the taxpayer + $250 at 65 = $950; taxable 80,000 - 950 = 79,050.
    const year = stateYear('WI', adapterFacts(JANUARY_FIRST))
    expect(80_000 - year.taxableIncome).toBe(accepted)
    // 3.5% x 15,110 + 4.4% x 36,840 + 5.3% x (79,050 - 51,950)
    // = 528.85 + 1,620.96 + 1,436.30 = 3,586.11.
    expect(year.amount).toBeCloseTo(3_586.11, 6)
  })

  it('gives a claimant born January 2, 1962 no age addition for 2026', () => {
    // 64 on December 31, 2026 under either reading: 80,000 - 700 = 79,300,
    // and 250 x 5.3% = 13.25 more tax: 3,599.36.
    const year = stateYear('WI', adapterFacts(JANUARY_SECOND))
    expect(80_000 - year.taxableIncome).toBe(readings.ageOnDecember31)
    expect(year.amount).toBeCloseTo(3_599.36, 6)
  })

  it('reaches the projection: the January 1 birthday pays $13.25 less Wisconsin tax for 2026', () => {
    // Same plan, birthdays a day apart; both are 64 at the federal year-end
    // test and identical in every other respect, so the only difference is the
    // $250 Wisconsin age addition at 5.3%.
    const wisconsinTax = (dob: string) => {
      const plan = singlePersonPlan({ dob, planningAge: 66, state: 'WI' })
      plan.household.people[0]!.retirementAge = 75
      plan.accounts = [cashAccount('cash', 200_000)]
      plan.incomes = [{ type: 'wages', id: 'job', personId: 'p1', annualGross: 90_000, endAge: null, realGrowthPct: 0 }]
      plan.stateTaxFacts.householdYearFacts = [{ year: 2026, exemptionTaxpayerCount: 1, exemptionDependentCount: 0, claimedAsDependent: false }]
      return runPlan(plan, createStateTaxCalculator(), 2026).years[0]!.tax
    }
    expect(wisconsinTax(JANUARY_SECOND) - wisconsinTax(JANUARY_FIRST)).toBeCloseTo(250 * 0.053, 6)
  })
})

describe('states that keep the year-end age', () => {
  it('New Jersey counts the plain December 31 age, so the January 1 birthday takes no $1,000 age exemption', () => {
    // NJ-1040: "65 or older on the last day of the tax year". Both claimants
    // are 64 on December 31, 2026: the $1,000 taxpayer exemption only.
    const njYear = (dob: string) => computeStateTaxYearResult(input('NJ'), {
      retirementDistributions: [], hsaAccounts: [], qcdEvents: [],
      householdFacts: { federalAgi: 80_000, ...adapterFacts(dob, 'NJ') },
    })
    expect(80_000 - njYear(JANUARY_FIRST).taxableIncome).toBe(1_000)
    expect(80_000 - njYear(JANUARY_SECOND).taxableIncome).toBe(1_000)
  })

  it('Illinois keeps reading the year-end count', () => {
    // No Illinois convention is declared: both birthdays give the $2,925
    // basic allowance and no $1,000 age addition.
    const first = stateYear('IL', adapterFacts(JANUARY_FIRST, 'IL'))
    const second = stateYear('IL', adapterFacts(JANUARY_SECOND, 'IL'))
    expect(first.taxableIncome).toBe(second.taxableIncome)
  })
})

describe('a claimant whose date of birth is not known fails closed on both paths', () => {
  // A joint couple: p is 64 at the end of 2026 under either convention (born
  // 1962-01-02) and the spouse's date of birth does not parse (1960-02-30),
  // or the claimant list names a person the household does not hold. No age
  // count can be derived for the couple, so Wisconsin withholds its personal
  // exemption and Massachusetts its personal and age exemptions; neither may
  // count the known claimant alone.
  function couple(state: string, spouseDob: string): Plan {
    const plan = onePersonPlan(JANUARY_SECOND, state)
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({ ...plan.household.people[0]!, id: 's', name: 'Spouse', dob: spouseDob })
    plan.stateTaxFacts.householdYearFacts = [{
      year: 2026, stateFilingStatus: 'marriedFilingJointly', exemptionTaxpayerCount: 2, exemptionDependentCount: 0, claimedAsDependent: false,
    }]
    return plan
  }
  const bothPaths = (plan: Plan, claimantPersonIds: string[]): StateHouseholdTaxFacts[] => [
    householdFactsForYear(plan, 2026, { claimantPersonIds })!,
    buildAnnualStateHouseholdFacts({
      plan, taxYear: 2026, socialSecurityStreams: [], claimantPersonIds,
      federal: { agi: 80_000, taxableIncome: 80_000, deductionUsed: 0, taxableSocialSecurity: 0, taxExemptInterest: 0 },
    }).householdFacts,
  ]
  const codes = (result: { warnings: readonly { code: string }[] }) => result.warnings.map((warning) => warning.code)

  it('keeps an unparsable date of birth, so no count is derived from the claimant who is known', () => {
    for (const facts of bothPaths(couple('WI', '1960-02-30'), ['p', 's'])) {
      expect(facts.claimantDatesOfBirth).toEqual([JANUARY_SECOND, '1960-02-30'])
      expect(facts.age65EligibleCount).toBeUndefined()
      expect(facts.age65EligibleCountByConvention).toBeUndefined()
    }
  })

  it('leaves the dates of birth out when a claimant names no household person', () => {
    for (const facts of bothPaths(couple('WI', '1960-06-30'), ['p', 'ghost'])) {
      expect(facts.claimantDatesOfBirth).toBeUndefined()
      expect(facts.age65EligibleCountByConvention).toBeUndefined()
    }
  })

  it('withholds the Wisconsin exemption for the couple on both paths', () => {
    for (const [plan, ids] of [[couple('WI', '1960-02-30'), ['p', 's']], [couple('WI', '1960-06-30'), ['p', 'ghost']]] as const) {
      for (const facts of bothPaths(plan, [...ids])) {
        const year = stateYear('WI', facts, { filingStatus: 'marriedFilingJointly' })
        // No exemption at all ($700 x 2 withheld), and the year says why.
        expect(year.taxableIncome).toBe(80_000)
        expect(codes(year)).toContain('wi-exemption-counts-unknown')
      }
    }
  })

  it('withholds the Massachusetts exemptions for the couple on both paths, which a known count gives', () => {
    // Control: the same couple with both dates known (64 and 66) takes the
    // $8,800 joint exemption plus $700 for the one claimant 65 or older.
    const known = bothPaths(couple('MA', '1960-06-30'), ['p', 's'])[1]!
    const knownYear = computeStateTaxYearResult(input('MA', { filingStatus: 'marriedFilingJointly' }), {
      retirementDistributions: [], hsaAccounts: [], qcdEvents: [], householdFacts: { federalAgi: 80_000, ...known },
    })
    expect(codes(knownYear)).not.toContain('ma-personal-exemption-incomplete')
    expect(80_000 - knownYear.taxableIncome).toBe(9_500)
    for (const [plan, ids] of [[couple('MA', '1960-02-30'), ['p', 's']], [couple('MA', '1960-06-30'), ['p', 'ghost']]] as const) {
      for (const facts of bothPaths(plan, [...ids])) {
        // Without the standard-deduction override, which returns before the
        // Massachusetts exemptions are reached.
        const year = computeStateTaxYearResult(input('MA', { filingStatus: 'marriedFilingJointly' }), {
          retirementDistributions: [], hsaAccounts: [], qcdEvents: [], householdFacts: { federalAgi: 80_000, ...facts },
        })
        expect(codes(year)).toContain('ma-personal-exemption-incomplete')
      }
    }
  })

  it('derives no count from a supplied list with one date that does not parse', () => {
    const facts: StateHouseholdTaxFacts = {
      claimantDatesOfBirth: ['1950-01-01', '1960-02-30'], exemptionTaxpayerCount: 2, exemptionDependentCount: 0, claimedAsDependent: false,
    }
    expect(codes(stateYear('WI', facts, { filingStatus: 'marriedFilingJointly' }))).toContain('wi-exemption-counts-unknown')
    expect(codes(stateYear('IL', facts, { filingStatus: 'marriedFilingJointly' }))).toContain('il-exemption-counts-unknown')
  })
})
