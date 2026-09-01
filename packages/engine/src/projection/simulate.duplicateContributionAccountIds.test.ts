import { describe, expect, it } from 'vitest'

import { parsePlan, type Account } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026

function scheduledTaxableAccount(
  id: string,
  name: string,
  balance: number,
  costBasis: number,
  annualAmount: number,
): Extract<Account, { type: 'taxable' }> {
  return {
    id,
    name,
    type: 'taxable',
    ownerPersonId: 'p1',
    balance,
    costBasis,
    annualReturnPct: 0,
    annualContribution: 0,
    contributionSchedule: [{
      annualAmount,
      fromAge: null,
      toAge: null,
      escalationPct: 0,
    }],
  }
}

function employerAccount(
  id: string,
  name: string,
  balance: number,
  annualContribution: number,
): Extract<Account, { type: 'traditional' }> {
  return {
    id,
    name,
    type: 'traditional',
    kind: 'employer',
    ownerPersonId: 'p1',
    balance,
    annualReturnPct: 0,
    annualContribution,
    employerMatch: { matchPct: 100, capPctOfPay: 6 },
  }
}

describe('simulatePlan duplicate contribution account ids', () => {
  it('credits each positional contribution row without collapsing its requested amount', () => {
    // Independent one-year ledger worksheet, with no income, spending, tax,
    // inflation, or growth:
    //   opening investable = 1,000 cash + 10 + 30 + 20 accounts = 1,060
    //   requested deposits = 100 first duplicate + 50 distinct + 200 second
    //                      = 350
    //   funding cash       = 1,000 - 350 = 650
    //   closing rows       = 110, 80, 220; total remains 1,060
    // Duplicate unreferenced account ids are accepted Plan input. Published
    // balances intentionally remain last-row-wins, while investableTotal counts
    // every positional row. The contribution and cash-flow streams must retain
    // both duplicate rows and their distinct 100/200 amounts.
    const plan = singlePersonPlan({
      dob: '1980-01-01',
      planningAge: 60,
    })
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.inflationPct = 0
    plan.expenses.baseAnnual = 0
    plan.accounts = [
      {
        id: 'funding-cash',
        name: 'Funding cash',
        type: 'cash',
        ownerPersonId: 'p1',
        balance: 1_000,
        annualReturnPct: 0,
        annualContribution: 0,
      },
      scheduledTaxableAccount('duplicate-contribution', 'First duplicate', 10, 4, 100),
      scheduledTaxableAccount('distinct-contribution', 'Distinct third row', 30, 6, 50),
      scheduledTaxableAccount('duplicate-contribution', 'Second duplicate', 20, 8, 200),
    ]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    const year = simulatePlan(parsed.plan, {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.contributions).toBe(350)
    expect(year.balances).toEqual({
      'funding-cash': 650,
      'duplicate-contribution': 220,
      'distinct-contribution': 80,
    })
    expect(year.investableTotal).toBe(1_060)
    expect(year.investableTotal - Object.values(year.balances).reduce((sum, value) => sum + value, 0))
      .toBe(110)

    expect(year.cashFlow!.sourceLines).toEqual([{
      id: 'source:needBasedPortfolioWithdrawal:funding-cash',
      kind: 'needBasedPortfolioWithdrawal',
      role: 'portfolioFunding',
      amountPlanDollars: 350,
      identities: [
        { entityKind: 'account', accountId: 'funding-cash' },
        { entityKind: 'person', personId: 'p1' },
      ],
    }])
    expect(year.cashFlow!.useLines.map((line) => ({
      id: line.id,
      requested: line.requestedPlanDollars,
      funded: line.fundedPlanDollars,
      unfunded: line.unfundedPlanDollars,
      identities: line.identities,
    }))).toEqual([
      {
        id: 'use:contribution:distinct-contribution',
        requested: 50,
        funded: 50,
        unfunded: 0,
        identities: [
          { entityKind: 'account', accountId: 'distinct-contribution' },
          { entityKind: 'person', personId: 'p1' },
        ],
      },
      {
        id: 'use:contribution:duplicate-contribution',
        requested: 100,
        funded: 100,
        unfunded: 0,
        identities: [
          { entityKind: 'account', accountId: 'duplicate-contribution' },
          { entityKind: 'person', personId: 'p1' },
        ],
      },
      {
        id: 'use:contribution:duplicate-contribution',
        requested: 200,
        funded: 200,
        unfunded: 0,
        identities: [
          { entityKind: 'account', accountId: 'duplicate-contribution' },
          { entityKind: 'person', personId: 'p1' },
        ],
      },
    ])
    expect(year.cashFlow!.useLines
      .filter((line) => line.id === 'use:contribution:duplicate-contribution')
      .reduce((sum, line) => sum + line.fundedPlanDollars, 0)).toBe(300)
    expect(year.cashFlow!.transferLines.map((line) => ({
      id: line.id,
      kind: line.kind,
      debit: line.debitPlanDollars,
      credit: line.creditPlanDollars,
      destination: line.destination,
      lineage: line.lineage,
    }))).toEqual([
      {
        id: 'transfer:employeeContribution:distinct-contribution',
        kind: 'employeeContribution',
        debit: 50,
        credit: 50,
        destination: { entityKind: 'account', accountId: 'distinct-contribution' },
        lineage: [{
          lineId: 'use:contribution:distinct-contribution',
          relationship: 'sameDollarLaterStage',
        }],
      },
      {
        id: 'transfer:employeeContribution:duplicate-contribution',
        kind: 'employeeContribution',
        debit: 100,
        credit: 100,
        destination: { entityKind: 'account', accountId: 'duplicate-contribution' },
        lineage: [{
          lineId: 'use:contribution:duplicate-contribution',
          relationship: 'sameDollarLaterStage',
        }],
      },
      {
        id: 'transfer:employeeContribution:duplicate-contribution',
        kind: 'employeeContribution',
        debit: 200,
        credit: 200,
        destination: { entityKind: 'account', accountId: 'duplicate-contribution' },
        lineage: [{
          lineId: 'use:contribution:duplicate-contribution',
          relationship: 'sameDollarLaterStage',
        }],
      },
    ])
    expect(year.cashFlow!.reconciliation).toEqual(expect.objectContaining({
      status: 'notReconciled',
      reasonCodes: ['duplicateLineId', 'invalidLineage'],
      diagnostics: [
        {
          reasonCode: 'duplicateLineId',
          lineIds: ['use:contribution:duplicate-contribution'],
        },
        {
          reasonCode: 'duplicateLineId',
          lineIds: ['transfer:employeeContribution:duplicate-contribution'],
        },
        {
          reasonCode: 'invalidLineage',
          lineIds: [
            'transfer:employeeContribution:duplicate-contribution',
            'use:contribution:duplicate-contribution',
          ],
          expectedPlanDollars: 100,
          actualPlanDollars: 200,
          differencePlanDollars: 100,
        },
      ],
      cash: expect.objectContaining({
        portfolioFundingPlanDollars: 350,
        contributionsPlanDollars: 350,
        differencePlanDollars: 0,
      }),
      uses: expect.objectContaining({
        requestedUsesPlanDollars: 350,
        fundedUsesPlanDollars: 350,
        differencePlanDollars: 0,
      }),
      transfers: expect.objectContaining({
        debitsPlanDollars: 350,
        creditsPlanDollars: 350,
        differencePlanDollars: 0,
      }),
    }))
  })

  it('allocates employee limits and employer match by row for duplicate employer-plan ids', () => {
    // Independent one-year ledger worksheet. Notice 2025-67 publishes the
    // 2026 IRC 402(g) elective-deferral limit of 24,500; the matching
    // authoritative repository record is in contributionAndDeferralLimits.ts.
    //   employee deferrals: 10,000 + 1,000 + 13,500 = 24,500 §402(g) cap
    //   employer match:      6,000 + 1,000 + 6,000  = 13,000
    //   opening balances:    10 + 30 + 20           = 60
    //   wage surplus:        100,000 - 24,500       = 75,500
    //   closing investable:  60 + 100,000 + 13,000  = 113,060
    const plan = singlePersonPlan({ dob: '1980-01-01', planningAge: 60 })
    plan.incomes = [{
      id: 'wages',
      type: 'wages',
      personId: 'p1',
      annualGross: 100_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    plan.accounts = [
      {
        id: 'funding-cash',
        name: 'Funding cash',
        type: 'cash',
        ownerPersonId: 'p1',
        balance: 0,
        annualReturnPct: 0,
        annualContribution: 0,
      },
      employerAccount('duplicate-employer', 'First employer row', 10, 10_000),
      employerAccount('distinct-employer', 'Distinct employer row', 30, 1_000),
      employerAccount('duplicate-employer', 'Second employer row', 20, 20_000),
    ]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    const year = simulatePlan(parsed.plan, {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.contributions).toBe(24_500)
    expect(year.employerMatch).toBe(13_000)
    expect(year.balances).toEqual({
      'funding-cash': 75_500,
      'duplicate-employer': 19_520,
      'distinct-employer': 2_030,
    })
    expect(year.investableTotal).toBe(113_060)
    expect(year.investableTotal - Object.values(year.balances).reduce((sum, value) => sum + value, 0))
      .toBe(16_010)

    const runtimeContributionOccurrences = year.retirementRuntimeSource!.runtimeOccurrences
      .filter((occurrence) =>
        occurrence.kind === 'employerPlanEmployeeContribution' ||
        occurrence.kind === 'employerPlanEmployerMatch')
    expect(runtimeContributionOccurrences.map((occurrence) => [
      occurrence.kind,
      occurrence.grossAmountPlanDollars,
      occurrence.producerOccurrenceKey,
    ])).toEqual([
      [
        'employerPlanEmployeeContribution',
        1_000,
        JSON.stringify(['employerPlanEmployeeContribution', 'distinct-employer', 2]),
      ],
      [
        'employerPlanEmployeeContribution',
        10_000,
        JSON.stringify(['employerPlanEmployeeContribution', 'duplicate-employer', 1]),
      ],
      [
        'employerPlanEmployeeContribution',
        13_500,
        JSON.stringify(['employerPlanEmployeeContribution', 'duplicate-employer', 3]),
      ],
      [
        'employerPlanEmployerMatch',
        1_000,
        JSON.stringify(['employerPlanEmployerMatch', 'distinct-employer', 2]),
      ],
      [
        'employerPlanEmployerMatch',
        6_000,
        JSON.stringify(['employerPlanEmployerMatch', 'duplicate-employer', 1]),
      ],
      [
        'employerPlanEmployerMatch',
        6_000,
        JSON.stringify(['employerPlanEmployerMatch', 'duplicate-employer', 3]),
      ],
    ])
    expect(new Set(runtimeContributionOccurrences.map((occurrence) =>
      occurrence.producerOccurrenceKey)).size).toBe(6)

    expect(year.cashFlow!.useLines
      .filter((line) => line.kind === 'contribution')
      .map((line) => ({
        id: line.id,
        requested: line.requestedPlanDollars,
        funded: line.fundedPlanDollars,
        unfunded: line.unfundedPlanDollars,
        identities: line.identities,
      }))).toEqual([
      {
        id: 'use:contribution:distinct-employer',
        requested: 1_000,
        funded: 1_000,
        unfunded: 0,
        identities: [
          { entityKind: 'account', accountId: 'distinct-employer' },
          { entityKind: 'person', personId: 'p1' },
        ],
      },
      {
        id: 'use:contribution:duplicate-employer',
        requested: 10_000,
        funded: 10_000,
        unfunded: 0,
        identities: [
          { entityKind: 'account', accountId: 'duplicate-employer' },
          { entityKind: 'person', personId: 'p1' },
        ],
      },
      {
        id: 'use:contribution:duplicate-employer',
        requested: 20_000,
        funded: 13_500,
        unfunded: 6_500,
        identities: [
          { entityKind: 'account', accountId: 'duplicate-employer' },
          { entityKind: 'person', personId: 'p1' },
        ],
      },
    ])
    expect(year.cashFlow!.transferLines
      .filter((line) => line.kind === 'employeeContribution' || line.kind === 'employerMatch')
      .map((line) => ({
        id: line.id,
        kind: line.kind,
        debit: line.debitPlanDollars,
        credit: line.creditPlanDollars,
        destination: line.destination,
      }))).toEqual([
      {
        id: 'transfer:employeeContribution:distinct-employer',
        kind: 'employeeContribution',
        debit: 1_000,
        credit: 1_000,
        destination: { entityKind: 'account', accountId: 'distinct-employer' },
      },
      {
        id: 'transfer:employeeContribution:duplicate-employer',
        kind: 'employeeContribution',
        debit: 10_000,
        credit: 10_000,
        destination: { entityKind: 'account', accountId: 'duplicate-employer' },
      },
      {
        id: 'transfer:employeeContribution:duplicate-employer',
        kind: 'employeeContribution',
        debit: 13_500,
        credit: 13_500,
        destination: { entityKind: 'account', accountId: 'duplicate-employer' },
      },
      {
        id: 'transfer:employerMatch:distinct-employer',
        kind: 'employerMatch',
        debit: 1_000,
        credit: 1_000,
        destination: { entityKind: 'account', accountId: 'distinct-employer' },
      },
      {
        id: 'transfer:employerMatch:duplicate-employer',
        kind: 'employerMatch',
        debit: 6_000,
        credit: 6_000,
        destination: { entityKind: 'account', accountId: 'duplicate-employer' },
      },
      {
        id: 'transfer:employerMatch:duplicate-employer',
        kind: 'employerMatch',
        debit: 6_000,
        credit: 6_000,
        destination: { entityKind: 'account', accountId: 'duplicate-employer' },
      },
    ])
  })

  it('keeps high-earner Roth catch-up routing and match bases positional for duplicate ids', () => {
    // Notice 2025-67 sets the 2026 §402(g) limit at 24,500 and the ordinary
    // age-50 §414(v) catch-up at 8,000; the repository's authoritative values
    // are the 2026 records in contributionAndDeferralLimits.ts. With prior-year
    // FICA wages above the §414(v)(7) threshold, the second traditional row's
    // 8,000 catch-up must land on the Roth sibling while remaining in that
    // source row's employer-match base:
    //   first duplicate: 20,000 pre-tax; match base 20,000
    //   second duplicate: 4,500 pre-tax + 8,000 redirected; match base 12,500
    //   Roth sibling:     8,000 designated Roth; match base 0
    const plan = singlePersonPlan({ dob: '1976-01-01', planningAge: 60 })
    plan.incomes = [{
      id: 'wages',
      type: 'wages',
      personId: 'p1',
      annualGross: 200_000,
      endAge: null,
      realGrowthPct: 0,
    }]
    const first = employerAccount('duplicate-employer', 'First source row', 10, 20_000)
    const second = employerAccount('duplicate-employer', 'Second source row', 20, 20_000)
    first.priorCalendarYearFicaWages = 200_000
    second.priorCalendarYearFicaWages = 200_000
    first.employerMatch = { matchPct: 100, capPctOfPay: 100 }
    second.employerMatch = { matchPct: 100, capPctOfPay: 100 }
    plan.accounts = [
      {
        id: 'funding-cash',
        name: 'Funding cash',
        type: 'cash',
        ownerPersonId: 'p1',
        balance: 0,
        annualReturnPct: 0,
        annualContribution: 0,
      },
      first,
      second,
      {
        id: 'roth-sibling',
        name: 'Roth 401(k)',
        type: 'roth',
        kind: 'employer',
        ownerPersonId: 'p1',
        balance: 0,
        annualReturnPct: 0,
        annualContribution: 0,
      },
    ]

    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))

    const year = simulatePlan(parsed.plan, {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureAnnualCashFlow: true,
    }).years[0]!

    expect(year.contributions).toBe(32_500)
    expect(year.employerMatch).toBe(32_500)
    expect(year.balances['roth-sibling']).toBe(8_000)
    expect(year.cashFlow!.useLines
      .filter((line) => line.kind === 'contribution')
      .map((line) => [line.id, line.requestedPlanDollars, line.fundedPlanDollars]))
      .toEqual([
        ['use:contribution:duplicate-employer', 20_000, 20_000],
        ['use:contribution:duplicate-employer', 12_000, 4_500],
        ['use:contribution:roth-sibling', 8_000, 8_000],
      ])
    expect(year.cashFlow!.transferLines
      .filter((line) => line.kind === 'employerMatch')
      .map((line) => [line.id, line.creditPlanDollars]))
      .toEqual([
        ['transfer:employerMatch:duplicate-employer', 20_000],
        ['transfer:employerMatch:duplicate-employer', 12_500],
      ])
  })
})
