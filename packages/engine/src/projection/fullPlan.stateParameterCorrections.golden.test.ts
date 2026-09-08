import { describe, expect, it } from 'vitest'

import { createStateTaxCalculator } from '../tax/stateTax.js'
import { expectMoney } from '../testing/money.js'
import {
  cashAccount,
  couplePlan,
  recurringOrdinaryIncome,
  runPlan,
  singlePersonPlan,
} from '../testing/planFixtures.js'

const stateOnly = createStateTaxCalculator()
const STARTING_CASH = 100_000

const FIXTURES = [
  {
    evidenceLabel: 'de-code-30-1102-a-14-rate-schedule',
    state: 'DE',
    filingStatus: 'single' as const,
    income: 33_250,
    expectedTax: 1_278.5,
    worksheet:
      '33,250 − 3,250 deduction = 30,000 taxable; 3,000×2.2% + 5,000×3.9% + 10,000×4.8% + 5,000×5.2% + 5,000×5.55% = 1,278.50 (30 Del. C. §1102(a)(14)).',
  },
  {
    evidenceLabel: 'de-code-30-1102-a-14-rate-schedule',
    state: 'DE',
    filingStatus: 'marriedFilingJointly' as const,
    income: 36_500,
    expectedTax: 1_278.5,
    worksheet:
      '36,500 − 6,500 deduction = 30,000 taxable; same §1102(a)(14) band schedule => 1,278.50.',
  },
  {
    evidenceLabel: 'hi-hrs-235-2-4-a-2-f-2026-standard-deduction',
    state: 'HI',
    filingStatus: 'single' as const,
    income: 10_000,
    expectedTax: 28,
    worksheet:
      '10,000 − 8,000 TY2026 standard deduction = 2,000 taxable × 1.4% first bracket = 28 (HRS §235-2.4(a)(2)(F)).',
  },
  {
    evidenceLabel: 'hi-hrs-235-2-4-a-2-f-2026-standard-deduction',
    state: 'HI',
    filingStatus: 'marriedFilingJointly' as const,
    income: 20_000,
    expectedTax: 56,
    worksheet:
      '20,000 − 16,000 TY2026 standard deduction = 4,000 taxable × 1.4% = 56 (HRS §235-2.4(a)(2)(F)).',
  },
  {
    evidenceLabel: 'ri-dot-adv-2025-22-2026-deduction-and-rate-schedule',
    state: 'RI',
    filingStatus: 'single' as const,
    income: 220_000,
    expectedTax: 9_374.64,
    worksheet:
      '220,000 − 11,200 deduction = 208,800 taxable; 82,050×3.75% + 104,400×4.75% + 22,350×5.99% = 9,374.64 (ADV 2025-22).',
  },
  {
    evidenceLabel: 'ri-dot-adv-2025-22-2026-deduction-and-rate-schedule',
    state: 'RI',
    filingStatus: 'marriedFilingJointly' as const,
    income: 220_000,
    expectedTax: 8_703.76,
    worksheet:
      '220,000 − 22,400 deduction = 197,600 taxable; same ADV thresholds with an $11,150 top slice => 8,703.76.',
  },
  {
    evidenceLabel: 'ut-code-59-10-104-2026-individual-rate',
    state: 'UT',
    filingStatus: 'single' as const,
    income: 20_000,
    expectedTax: 890,
    worksheet:
      '20,000 × 4.45% flat rate = 890 (2026 Utah S.B. 60 / §59-10-104).',
  },
  {
    evidenceLabel: 'ut-code-59-10-104-2026-individual-rate',
    state: 'UT',
    filingStatus: 'marriedFilingJointly' as const,
    income: 20_000,
    expectedTax: 890,
    worksheet:
      '20,000 × 4.45% flat rate = 890 (2026 Utah S.B. 60 / §59-10-104).',
  },
  {
    evidenceLabel: 'ORACLE-013 — 2026 deduction + retained 2025 Schedule X/Y (integration)',
    state: 'CA',
    filingStatus: 'single' as const,
    income: 105_707,
    expectedTax: 5_738.73,
    worksheet:
      '105,707 − 5,706 deduction = 100,001 taxable; 2025 Schedule X above the table range => 5,738.731 modeled subtotal. Not a settled ca-ftb-2026-540-es-standard-deduction-only test.',
  },
  {
    evidenceLabel: 'ORACLE-013 — 2026 deduction + retained 2025 Schedule X/Y (integration)',
    state: 'CA',
    filingStatus: 'marriedFilingJointly' as const,
    income: 111_413,
    expectedTax: 3_069.84,
    worksheet:
      '111,413 − 11,412 deduction = 100,001 taxable; 2025 Schedule Y above the table range => 3,069.84 modeled subtotal. Not a settled ca-ftb-2026-540-es-standard-deduction-only test.',
  },
  {
    evidenceLabel: 'mn-dor-2026-rate-schedule-and-standard-deduction',
    state: 'MN',
    filingStatus: 'single' as const,
    income: 50_000,
    expectedTax: 1_876.61,
    worksheet:
      '50,000 − 15,300 TY2026 deduction = 34,700 taxable; DOR TY2026 breakpoints => 1,876.605.',
  },
  {
    evidenceLabel: 'mn-dor-2026-rate-schedule-and-standard-deduction',
    state: 'MN',
    filingStatus: 'marriedFilingJointly' as const,
    income: 80_600,
    expectedTax: 2_693.85,
    worksheet:
      '80,600 − 30,600 TY2026 deduction = 50,000 taxable; DOR TY2026 breakpoints => 2,693.85.',
  },
] as const

describe('state 2026 parameter corrections — plan integration', () => {
  it.each(FIXTURES)('$evidenceLabel ($state $filingStatus)', (fixture) => {
    // State-only calculator: year.tax is the modeled state subtotal, not a return.
    const plan =
      fixture.filingStatus === 'marriedFilingJointly'
        ? couplePlan({
            p1Dob: '1966-01-01',
            p2Dob: '1966-01-01',
            p1PlanningAge: 60,
            p2PlanningAge: 60,
            state: fixture.state,
          })
        : singlePersonPlan({ dob: '1966-01-01', planningAge: 60, state: fixture.state })
    plan.accounts = [cashAccount('cash', STARTING_CASH)]
    plan.incomes = [recurringOrdinaryIncome('ordinary', fixture.income, 2026)]
    plan.expenses.baseAnnual = 0

    const result = runPlan(plan, stateOnly, 2026)
    const year = result.years[0]!

    expect(year.year).toBe(2026)
    expectMoney(year.incomes.recurring, fixture.income)
    expectMoney(year.tax, fixture.expectedTax)
    const surplus = fixture.income - fixture.expectedTax
    expectMoney(year.surplusInvested, surplus)
    expectMoney(year.balances['cash']!, STARTING_CASH + surplus)
  })
})
