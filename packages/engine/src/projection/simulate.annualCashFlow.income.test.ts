/**
 * Stage 2 source-line capture for income streams, with the stage 4
 * reinvestment-branch transfer.
 *
 * Stage 5 identities close: reinvest-only years publish one `reinvestedYield`
 * transfer of gross (taxable + exempt) and keep spendable yield sources empty.
 */
import { describe, expect, it } from 'vitest'

import { parsePlan, type Account, type IncomeStream, type Plan } from '../model/plan.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  socialSecurityIncome,
  taxableAccount,
} from '../testing/planFixtures.js'
import { expectMoney } from '../testing/money.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearCashFlowSourceLine, YearResult } from './types.js'

const noTax = createFlatTaxCalculator(0)
const START_YEAR = 2026

function validate(plan: Plan): Plan {
  const result = parsePlan(plan)
  if (!result.ok) throw new Error(result.issues.join('; '))
  return result.plan
}

function run(plan: Plan): YearResult[] {
  return simulatePlan(validate(plan), {
    startYear: START_YEAR,
    taxCalculator: noTax,
    captureAnnualCashFlow: true,
  }).years
}

function yearOf(years: readonly YearResult[], calendarYear: number): YearResult {
  const year = years.find((row) => row.year === calendarYear)
  if (year === undefined) throw new Error(`missing year ${calendarYear}`)
  return year
}

function sourceById(year: YearResult, id: string): YearCashFlowSourceLine {
  const line = year.cashFlow?.sourceLines.find((row) => row.id === id)
  if (line === undefined) throw new Error(`missing source line ${id}`)
  return line
}

function wages(id: string, annualGross: number, personId = 'p1'): IncomeStream {
  return {
    type: 'wages',
    id,
    personId,
    annualGross,
    endAge: null,
    realGrowthPct: 0,
  }
}

function pension(ownerPersonId: string, monthlyAmount: number, survivorPct: number): Account {
  return {
    type: 'pension',
    id: 'pen-p2',
    name: 'Pension',
    ownerPersonId,
    annualReturnPct: 0,
    startAge: 65,
    monthlyAmount,
    colaPct: 0,
    survivorPct,
  }
}

describe('simulatePlan annual cash-flow income sources', () => {
  it('(a) publishes wage, SS, and pension spendable sources while both spouses are alive', () => {
    // Independent worksheet, year 2027, 0% inflation, 0% COLA, 0% tax:
    //   both born 1960-06-15 → attained 67. FRA for 1960 is 67y0m, claimFactor = 1
    //   (mid-year DOB so SSA's Jan-1 prior-year rule does not apply).
    //   payableMonths at attained 67 with claimAge 67y0m = 12.
    //   p1 wages: annualGross 40,000, retirementAge 70 (still working) → 40,000.
    //   p1 SS: piaMonthly 1,000 × 12 × 1 = 12,000.
    //   p2 SS: piaMonthly 2,000 × 12 × 1 = 24,000.
    //   p2 pension: 3,000 × 12, owner alive → 36,000, payee = p2.
    const plan = couplePlan({
      p1Dob: '1960-06-15',
      p2Dob: '1960-06-15',
      p1PlanningAge: 90,
      p2PlanningAge: 90,
      p1RetirementAge: 70,
      p2RetirementAge: null,
    })
    plan.accounts = [cashAccount('cash-1', 0), pension('p2', 3_000, 50)]
    plan.incomes = [
      wages('wage-p1', 40_000, 'p1'),
      socialSecurityIncome('ss-p1', 1_000, 67, 'p1'),
      socialSecurityIncome('ss-p2', 2_000, 67, 'p2'),
    ]
    const y2027 = yearOf(run(plan), 2027)

    expect(y2027.cashFlow).toBeDefined()
    expect(y2027.cashFlow!.reconciliation.status).toBe('reconciled')

    const wage = sourceById(y2027, 'source:wages:wage-p1')
    expect(wage.kind).toBe('wages')
    expect(wage.role).toBe('spendableSource')
    expectMoney(wage.amountPlanDollars, 40_000)
    expect(wage.identities).toEqual([
      { entityKind: 'incomeStream', incomeStreamId: 'wage-p1' },
      { entityKind: 'person', personId: 'p1' },
    ])

    const ss1 = sourceById(y2027, 'source:socialSecurity:ss-p1')
    expect(ss1.kind).toBe('socialSecurity')
    expect(ss1.role).toBe('spendableSource')
    expectMoney(ss1.amountPlanDollars, 12_000)
    expect(ss1.identities).toEqual([
      { entityKind: 'incomeStream', incomeStreamId: 'ss-p1' },
      { entityKind: 'person', personId: 'p1' },
    ])

    const ss2 = sourceById(y2027, 'source:socialSecurity:ss-p2')
    expectMoney(ss2.amountPlanDollars, 24_000)
    expect(ss2.identities).toEqual([
      { entityKind: 'incomeStream', incomeStreamId: 'ss-p2' },
      { entityKind: 'person', personId: 'p2' },
    ])

    const pen = sourceById(y2027, 'source:pension:pen-p2')
    expect(pen.kind).toBe('pension')
    expect(pen.role).toBe('spendableSource')
    expectMoney(pen.amountPlanDollars, 36_000)
    expect(pen.identities).toEqual([
      { entityKind: 'account', accountId: 'pen-p2' },
      { entityKind: 'person', personId: 'p2' },
    ])

    expectMoney(y2027.incomes.wages, 40_000)
    expectMoney(y2027.incomes.socialSecurity, 36_000)
    expectMoney(y2027.incomes.pension, 36_000)
  })

  it('(b) survivor-year pension payee and SS paid amount are the living spouse, not the deceased owner', () => {
    // Independent worksheet, year 2028 (p2's first deceased year):
    //   p2 planningAge 67 → last alive 2027 (attained 67), deceased 2028 (attained 68).
    //   Pension owner p2, startAge 65, ownerStartedBeforeDeath, survivorPct 50:
    //     36,000 × 50% = 18,000, payee = living p1.
    //   SS: both claimed at FRA 67 (mid-year 1960 DOB). Deceased actual monthly = p2 PIA 2,000.
    //   Survivor FRA for 1960 is 66y8m; attained 68 is past it, reduction factor 1.
    //   RIB-LIM passes the full 2,000 through. p1 own 12,000 < survivor 24,000 → paid 24,000 on ss-p1.
    //   p2's own stream is not payable in the deceased year (annualAmount 0).
    const plan = couplePlan({
      p1Dob: '1960-06-15',
      p2Dob: '1960-06-15',
      p1PlanningAge: 90,
      p2PlanningAge: 67,
      p1RetirementAge: 70,
      p2RetirementAge: null,
    })
    plan.accounts = [cashAccount('cash-1', 0), pension('p2', 3_000, 50)]
    plan.incomes = [
      wages('wage-p1', 40_000, 'p1'),
      socialSecurityIncome('ss-p1', 1_000, 67, 'p1'),
      socialSecurityIncome('ss-p2', 2_000, 67, 'p2'),
    ]
    const y2028 = yearOf(run(plan), 2028)

    const pen = sourceById(y2028, 'source:pension:pen-p2')
    expectMoney(pen.amountPlanDollars, 18_000)
    expect(pen.identities).toEqual([
      { entityKind: 'account', accountId: 'pen-p2' },
      { entityKind: 'person', personId: 'p1' },
    ])
    expect(pen.identities).not.toContainEqual({ entityKind: 'person', personId: 'p2' })

    const ss1 = sourceById(y2028, 'source:socialSecurity:ss-p1')
    expectMoney(ss1.amountPlanDollars, 24_000)
    expect(ss1.identities).toEqual([
      { entityKind: 'incomeStream', incomeStreamId: 'ss-p1' },
      { entityKind: 'person', personId: 'p1' },
    ])

    expect(y2028.cashFlow!.sourceLines.some((line) => line.id === 'source:socialSecurity:ss-p2')).toBe(false)
    const p2Stream = y2028.socialSecurityStreams?.find((row) => row.streamId === 'ss-p2')
    expect(p2Stream?.annualAmount).toBe(0)

    expectMoney(y2028.incomes.pension, 18_000)
    expectMoney(y2028.incomes.socialSecurity, 24_000)
    expect(y2028.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('(c) reinvested taxable yield is not a spendable source', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   taxable 100,000; interestYieldPct 4; taxExemptInterestYieldPct 1; dividends 0.
    //   taxableGross = 4,000; exempt = 1,000; gross = 5,000 = taxableYieldReinvested.
    //   reinvestDividends true → no taxableAccountYield / taxExemptInterest sources.
    //   one reinvestedYield transfer of gross 5,000 (taxable + exempt).
    //   reinvested yield is excluded from cash inflows, so surplus is 0 and
    //   spendable sources stay empty. Transfer pairing 5,000 = 5,000.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    const brokerage = taxableAccount('brokerage-1', 100_000, 100_000) as Extract<Account, { type: 'taxable' }>
    brokerage.interestYieldPct = 4
    brokerage.taxExemptInterestYieldPct = 1
    brokerage.dividendYieldPct = 0
    brokerage.reinvestDividends = true
    plan.accounts = [brokerage]
    const y2026 = yearOf(run(plan), START_YEAR)

    expectMoney(y2026.incomes.taxableYield, 4_000)
    expectMoney(y2026.incomes.taxExemptInterest, 1_000)
    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'taxableAccountYield')).toBe(false)
    expect(y2026.cashFlow!.sourceLines.some((line) => line.kind === 'taxExemptInterest')).toBe(false)
    expect(y2026.cashFlow!.reconciliation.cash.spendableSourcesPlanDollars).toBe(0)

    const transfer = y2026.cashFlow!.transferLines.find(
      (line) => line.id === 'transfer:reinvestedYield:brokerage-1',
    )
    expect(transfer).toBeDefined()
    expect(transfer!.kind).toBe('reinvestedYield')
    expectMoney(transfer!.debitPlanDollars, 5_000)
    expectMoney(transfer!.creditPlanDollars, 5_000)
    expect(transfer!.source).toEqual({ entityKind: 'accountYield', accountId: 'brokerage-1' })
    expect(transfer!.destination).toEqual({ entityKind: 'account', accountId: 'brokerage-1' })
    expect(transfer!.taxCharacter).toEqual([
      { kind: 'ordinaryIncome', amountPlanDollars: 4_000 },
      { kind: 'taxExemptIncome', amountPlanDollars: 1_000 },
    ])
    expect(y2026.cashFlow!.transferLines.filter((line) => line.kind === 'reinvestedYield')).toHaveLength(1)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('(d) distributed taxable yield and tax-exempt interest are split source kinds, not a transfer', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   same 100,000 account as (c) with reinvestDividends false.
    //   taxableAccountYield = taxableGross 4,000 (interest only; not the 5,000 gross).
    //   taxExemptInterest = 1,000. No reinvestedYield transfer.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    const brokerage = taxableAccount('brokerage-1', 100_000, 100_000) as Extract<Account, { type: 'taxable' }>
    brokerage.interestYieldPct = 4
    brokerage.taxExemptInterestYieldPct = 1
    brokerage.dividendYieldPct = 0
    brokerage.reinvestDividends = false
    plan.accounts = [brokerage]
    const y2026 = yearOf(run(plan), START_YEAR)

    const taxable = sourceById(y2026, 'source:taxableAccountYield:brokerage-1')
    expect(taxable.kind).toBe('taxableAccountYield')
    expect(taxable.role).toBe('spendableSource')
    expectMoney(taxable.amountPlanDollars, 4_000)
    expect(taxable.identities).toEqual([{ entityKind: 'account', accountId: 'brokerage-1' }])

    const exempt = sourceById(y2026, 'source:taxExemptInterest:brokerage-1')
    expect(exempt.kind).toBe('taxExemptInterest')
    expect(exempt.role).toBe('spendableSource')
    expectMoney(exempt.amountPlanDollars, 1_000)
    expect(exempt.identities).toEqual([{ entityKind: 'account', accountId: 'brokerage-1' }])

    expect(y2026.cashFlow!.transferLines.some((line) => line.kind === 'reinvestedYield')).toBe(false)
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('recurring and one-time streams carry stream identity only, with tax treatment as character', () => {
    // Independent worksheet, year 2026, 0% inflation:
    //   recurring 8,000 ordinary; one-time 5,000 capitalGain.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 60 })
    plan.accounts = [cashAccount('cash-1', 0)]
    plan.incomes = [
      {
        type: 'recurring',
        id: 'rent-1',
        label: 'Rent',
        annualAmount: 8_000,
        startYear: null,
        endYear: null,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
      {
        type: 'oneTime',
        id: 'gift-1',
        label: 'Gift',
        year: 2026,
        amount: 5_000,
        taxTreatment: 'capitalGain',
      },
    ]
    const y2026 = yearOf(run(plan), START_YEAR)

    const recurring = sourceById(y2026, 'source:recurringIncome:rent-1')
    expect(recurring.kind).toBe('recurringIncome')
    expect(recurring.role).toBe('spendableSource')
    expectMoney(recurring.amountPlanDollars, 8_000)
    expect(recurring.identities).toEqual([{ entityKind: 'incomeStream', incomeStreamId: 'rent-1' }])
    expect(recurring.taxCharacter).toEqual([{ kind: 'ordinaryIncome', amountPlanDollars: 8_000 }])

    const oneTime = sourceById(y2026, 'source:oneTimeIncome:gift-1')
    expect(oneTime.kind).toBe('oneTimeIncome')
    expectMoney(oneTime.amountPlanDollars, 5_000)
    expect(oneTime.identities).toEqual([{ entityKind: 'incomeStream', incomeStreamId: 'gift-1' }])
    expect(oneTime.taxCharacter).toEqual([{ kind: 'capitalGain', amountPlanDollars: 5_000 }])
    expect(y2026.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
