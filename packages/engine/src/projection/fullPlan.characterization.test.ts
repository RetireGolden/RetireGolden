import { describe, expect, it } from 'vitest'

import { compareScenarios } from '../scenarios/scenarios.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import {
  cashAccount,
  couplePlan,
  productionTaxCalculator,
  recurringOrdinaryIncome,
  runPlan,
  singlePersonPlan,
  socialSecurityIncome,
  taxableAccount,
  traditionalAccount,
} from '../testing/planFixtures.js'
import { compareLtcStress, summarizeProjection } from './compare.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { optimizePlan, withOptimizedConversions } from './optimizePlan.js'
import type { ProjectionResult, YearResult } from './types.js'

const federal = createFederalTaxCalculator()
const noTax = createFlatTaxCalculator(0)

function year(result: ProjectionResult, calendarYear: number): YearResult {
  const found = result.years.find((y) => y.year === calendarYear)
  if (!found) throw new Error(`missing projection year ${calendarYear}`)
  return found
}

function dollars(value: number): number {
  return Math.round(value * 100) / 100
}

function picked(y: YearResult) {
  return {
    year: y.year,
    income: dollars(y.incomes.total),
    socialSecurity: dollars(y.incomes.socialSecurity),
    healthcare: dollars(y.expenses.healthcare),
    withdrawals: dollars(y.withdrawals.total),
    rmd: dollars(y.rmd),
    qcd: dollars(y.qcd),
    rothConversion: dollars(y.rothConversion),
    tax: dollars(y.tax),
    magi: dollars(y.magi),
    investable: dollars(y.investableTotal),
    shortfall: dollars(y.shortfall),
  }
}

describe('full-plan characterization fixtures', () => {
  it('simple single retiree characterization', () => {
    const plan = singlePersonPlan({ dob: '1962-01-01', planningAge: 68, state: 'FL' })
    plan.accounts = [
      cashAccount('cash', 75_000),
      taxableAccount('taxable', 250_000, 180_000),
      traditionalAccount('ira', 300_000),
    ]
    plan.incomes = [recurringOrdinaryIncome('consulting', 20_000, 2026), socialSecurityIncome('ss', 2_500, 67)]
    plan.expenses.baseAnnual = 55_000

    const result = runPlan(plan, federal)

    // Characterization review note: this fixture is intentionally broader than
    // an oracle. It snapshots a plain single-retiree flow with taxable,
    // traditional, and cash accounts plus Social Security beginning inside the
    // short horizon. Do not treat the values below as independent proof of tax
    // correctness; update them only after reviewing the changed ledger story.
    const summary = {
      depletionYear: result.depletionYear,
      endingInvestable: dollars(result.endingInvestable),
      y2026: picked(year(result, 2026)),
      y2029: picked(year(result, 2029)),
      y2030: picked(year(result, 2030)),
    }

    expect(summary).toEqual({
      depletionYear: null,
      endingInvestable: 498_033.17,
      y2026: {
        year: 2026,
        income: 20_000,
        socialSecurity: 0,
        healthcare: 0,
        withdrawals: 35_390,
        rmd: 0,
        qcd: 0,
        rothConversion: 0,
        tax: 390,
        magi: 20_000,
        investable: 589_610,
        shortfall: 0,
      },
      y2029: {
        year: 2029,
        income: 50_000,
        socialSecurity: 30_000,
        healthcare: 2_434.8,
        withdrawals: 8_353.62,
        rmd: 0,
        qcd: 0,
        rothConversion: 0,
        tax: 918.82,
        magi: 29_677.17,
        investable: 506_386.78,
        shortfall: 0,
      },
      y2030: {
        year: 2030,
        income: 50_000,
        socialSecurity: 30_000,
        healthcare: 2_434.8,
        withdrawals: 8_353.62,
        rmd: 0,
        qcd: 0,
        rothConversion: 0,
        tax: 918.82,
        magi: 29_677.17,
        investable: 498_033.17,
        shortfall: 0,
      },
    })
  })

  it('married couple RMD and Roth conversion characterization', () => {
    const plan = couplePlan({
      p1Dob: '1953-01-01',
      p2Dob: '1955-01-01',
      p1PlanningAge: 76,
      p2PlanningAge: 78,
      state: 'FL',
    })
    plan.accounts = [
      cashAccount('cash', 80_000),
      traditionalAccount('p1-ira', 700_000, 'p1'),
      traditionalAccount('p2-ira', 400_000, 'p2'),
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 50_000, annualContribution: 0 },
    ]
    plan.incomes = [socialSecurityIncome('p1-ss', 2_500, 67), socialSecurityIncome('p2-ss', 1_800, 67, 'p2')]
    plan.expenses.baseAnnual = 90_000
    plan.strategies.rothConversion = {
      mode: 'manual',
      conversions: [
        { year: 2026, amount: 30_000 },
        { year: 2027, amount: 30_000 },
      ],
    }
    plan.strategies.qcdAnnual = 10_000

    const result = runPlan(plan, federal)

    // Characterization review note: this is the main couple-retirement flow:
    // two SS records, RMDs, QCDs, manual Roth conversions, survivor years, and
    // spending withdrawals. The values are regression guardrails for the whole
    // ledger cascade, not independently derived oracle values.
    const summary = {
      depletionYear: result.depletionYear,
      endingInvestable: dollars(result.endingInvestable),
      totals: {
        tax: dollars(result.years.reduce((sum, y) => sum + y.tax, 0)),
        rmd: dollars(result.years.reduce((sum, y) => sum + y.rmd, 0)),
        qcd: dollars(result.years.reduce((sum, y) => sum + y.qcd, 0)),
        rothConversion: dollars(result.years.reduce((sum, y) => sum + y.rothConversion, 0)),
      },
      y2026: picked(year(result, 2026)),
      y2030: picked(year(result, 2030)),
      y2033: picked(year(result, 2033)),
    }

    expect(summary).toEqual({
      depletionYear: null,
      endingInvestable: 696_614.93,
      totals: {
        tax: 56_679.47,
        rmd: 189_187.22,
        qcd: 80_000,
        rothConversion: 60_000,
      },
      y2026: {
        year: 2026,
        income: 55_728,
        socialSecurity: 55_728,
        healthcare: 4_869.6,
        withdrawals: 52_323.88,
        rmd: 26_415.09,
        qcd: 10_000,
        rothConversion: 30_000,
        tax: 3_182.28,
        magi: 78_152.32,
        investable: 1_177_676.12,
        shortfall: 0,
      },
      y2030: {
        year: 2030,
        income: 32_400,
        socialSecurity: 32_400,
        healthcare: 2_434.8,
        withdrawals: 81_178.72,
        rmd: 15_032.98,
        qcd: 10_000,
        rothConversion: 0,
        tax: 11_143.92,
        magi: 92_840.77,
        investable: 945_124.72,
        shortfall: 0,
      },
      y2033: {
        year: 2033,
        income: 32_400,
        socialSecurity: 32_400,
        healthcare: 2_434.8,
        withdrawals: 82_836.6,
        rmd: 14_771.36,
        qcd: 10_000,
        rothConversion: 0,
        tax: 12_801.8,
        magi: 100_376.6,
        investable: 696_614.93,
        shortfall: 0,
      },
    })
  })

  it('pre-65 ACA bridge characterization', () => {
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 65, state: 'FL' })
    plan.accounts = [
      cashAccount('cash', 200_000),
      traditionalAccount('ira', 200_000),
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    ]
    plan.incomes = [recurringOrdinaryIncome('consulting', 55_000, 2026)]
    plan.expenses.baseAnnual = 30_000
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: true,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.assumptions.recentAnnualMagi = 50_000
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 10_000 }] }

    const result = runPlan(plan, federal)

    // Characterization review note: this fixture pins the ACA bridge behavior
    // where first-year healthcare uses recent MAGI, then a deliberate Roth
    // conversion pushes the following year over the subsidy cliff. Keep the
    // warning assertion because it is part of the user-facing calculation story.
    const summary = {
      depletionYear: result.depletionYear,
      endingInvestable: dollars(result.endingInvestable),
      warnings: result.warnings,
      y2026: picked(year(result, 2026)),
      y2027: picked(year(result, 2027)),
      y2029: picked(year(result, 2029)),
    }

    expect(summary).toEqual({
      depletionYear: null,
      endingInvestable: 456_473.2,
      warnings: ['Some pre-65 years exceed 400% of the federal poverty line: no ACA credit (the cliff).'],
      y2026: {
        year: 2026,
        income: 55_000,
        socialSecurity: 0,
        healthcare: 4_980,
        withdrawals: 0,
        rmd: 0,
        qcd: 0,
        rothConversion: 10_000,
        tax: 5_620,
        magi: 65_000,
        investable: 414_400,
        shortfall: 0,
      },
      y2027: {
        year: 2027,
        income: 55_000,
        socialSecurity: 0,
        healthcare: 12_000,
        withdrawals: 0,
        rmd: 0,
        qcd: 0,
        rothConversion: 0,
        tax: 4_420,
        magi: 55_000,
        investable: 422_980,
        shortfall: 0,
      },
      y2029: {
        year: 2029,
        income: 55_000,
        socialSecurity: 0,
        healthcare: 2_434.8,
        withdrawals: 0,
        rmd: 0,
        qcd: 0,
        rothConversion: 0,
        tax: 4_174,
        magi: 55_000,
        investable: 456_473.2,
        shortfall: 0,
      },
    })
  })

  it('relocation scenario characterization', () => {
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 61, state: 'FL' })
    plan.accounts = [cashAccount('cash', 100_000)]
    plan.incomes = [recurringOrdinaryIncome('consulting', 100_000, 2026)]
    plan.scenarios = [{ id: 'move-ky', name: 'Move to Kentucky', patch: { household: { state: 'KY' } } }]

    const comparison = compareScenarios(plan, { startYear: 2026, taxCalculator: productionTaxCalculator() })
    const summary = comparison.rows.map((row) => ({
      name: row.name,
      error: row.error,
      lifetimeTax: dollars(row.summary.lifetimeTaxesAndPenalties),
      endingInvestable: dollars(row.summary.endingInvestable),
      diff: row.diff,
    }))

    // Characterization review note: this is a scenario-level regression for a
    // state-tax relocation. The base FL row pays only federal tax; the scenario
    // switches the same two-year income stream to modeled KY state tax.
    expect(summary).toEqual([
      {
        name: 'Base plan',
        error: null,
        lifetimeTax: 26_340,
        endingInvestable: 273_660,
        diff: [],
      },
      {
        name: 'Move to Kentucky',
        error: null,
        lifetimeTax: 33_104.8,
        endingInvestable: 266_895.2,
        diff: [{ path: 'household.state', baseValue: 'FL', scenarioValue: 'KY' }],
      },
    ])
  })

  it('insurance and LTC stress characterization', () => {
    const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 64, state: 'FL' })
    plan.accounts = [cashAccount('cash', 500_000)]
    plan.careEvents = [{ id: 'care', personId: 'p1', startAge: 62, durationYears: 2, annualCost: 60_000 }]
    plan.insurance = [
      {
        kind: 'ltc',
        id: 'ltc',
        name: 'LTC',
        owner: 'p1',
        annualPremium: 1_000,
        premiumMode: 'lifetime',
        benefitMonthly: 2_000,
        benefitPeriodYears: 'lifetime',
        eliminationPeriodDays: 0,
      },
    ]

    const comparison = compareLtcStress(plan, { startYear: 2026, taxCalculator: noTax })
    const summary = {
      noCareEstate: dollars(comparison.noCare.endingNetWorth),
      uninsuredEstate: dollars(comparison.careUninsured.endingNetWorth),
      insuredEstate: dollars(comparison.careInsured.endingNetWorth),
      rawCareShock: dollars(comparison.noCare.endingNetWorth - comparison.careUninsured.endingNetWorth),
      netPolicyValue: dollars(comparison.careInsured.endingNetWorth - comparison.careUninsured.endingNetWorth),
    }

    // Characterization review note: noCare and careUninsured strip LTC policy
    // premiums, so the raw care shock remains premium-neutral. careInsured then
    // adds three $1,000 premiums and two $24,000 annual benefits.
    expect(summary).toEqual({
      noCareEstate: 500_000,
      uninsuredEstate: 380_000,
      insuredEstate: 425_000,
      rawCareShock: 120_000,
      netPolicyValue: 45_000,
    })
  })

  it('optimized Roth exact-ledger characterization', async () => {
    const plan = singlePersonPlan({ dob: '1958-06-15', planningAge: 75, state: 'FL' })
    plan.accounts = [
      { type: 'traditional', id: 'trad', name: 'Traditional IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 500_000, annualContribution: 0 },
      { type: 'roth', id: 'roth', name: 'Roth IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
      cashAccount('cash', 150_000),
    ]
    plan.expenses.baseAnnual = 35_000
    plan.assumptions.defaultReturnPct = 4
    plan.assumptions.heirTaxRatePct = 25

    const baseline = summarizeProjection(plan, runPlan(plan, federal))
    const { schedule } = await optimizePlan(plan, { startYear: 2026, taxCalculator: federal })
    const optimizedPlan = withOptimizedConversions(plan, schedule.conversions, '2026-06-17T00:00:00.000Z')
    const exact = summarizeProjection(optimizedPlan, runPlan(optimizedPlan, federal))
    const summary = {
      status: schedule.status,
      requestedConversions: dollars(schedule.conversions.reduce((sum, c) => sum + c.amount, 0)),
      exactConversions: dollars(exact.lifetimeRothConversions),
      baselineEstate: dollars(baseline.endingAfterTaxEstate),
      exactEstate: dollars(exact.endingAfterTaxEstate),
      firstConversions: schedule.conversions.slice(0, 3).map((c) => ({ year: c.year, amount: dollars(c.amount) })),
    }

    // Characterization review note: the LP asks for more lifetime conversion
    // than the exact ledger can execute after spending/RMD flows. The accepted
    // result is judged by the exact projection, which still improves the estate.
    // Re-baselined for the OBBBA senior deduction in-solve (ground-truth 2026
    // law sync, Step 2): 2027–28 conversions now fill the 12% bracket plus the
    // $6k senior deduction (50,400 + 24,150 = 74,550) instead of stopping $6k
    // short, and the exact estate improved ~$1.2k over the blind solve.
    expect(summary).toEqual({
      status: 'optimal',
      requestedConversions: 538_917.7,
      exactConversions: 423_639.46,
      baselineEstate: 381_703.4,
      exactEstate: 444_059.14,
      firstConversions: [
        { year: 2026, amount: 62_681.5 },
        { year: 2027, amount: 74_550 },
        { year: 2028, amount: 74_550 },
      ],
    })
  })
})
