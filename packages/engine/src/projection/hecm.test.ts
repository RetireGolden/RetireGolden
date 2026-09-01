/**
 * HECM line-of-credit instrument through the exact ledger (annuity-pension-
 * and-home-equity decisions, step 4): guarded no-op without a HECM, the
 * last-resort shortfall backstop, line/loan growth, the non-recourse floor in
 * net worth, sale payoff, and the Pfau coordinated-vs-last-resort direction
 * fixture on a crash-then-recover market series.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { setAcaYearContract } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'

let counter = 0
const testIds = () => `hecm-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

/** Single 62-year-old (born 1964), flat dollars, no healthcare noise pre-65. */
function basePlan(planningAge = 85): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1964-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.accounts = []
  plan.incomes = []
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function cash(balance: number, id = 'cash1'): Account {
  return { type: 'cash', id, name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance, annualContribution: 0 }
}

function home(hecm: Extract<Account, { type: 'property' }>['hecm'], value = 500_000): Account {
  return {
    type: 'property',
    id: 'home1',
    name: 'Home',
    ownerPersonId: null,
    annualReturnPct: null,
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    hecm,
  }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

const run = (plan: Plan, opts: Partial<SimulateOptions> = {}) =>
  simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax, ...opts })

describe('guarded default', () => {
  it('plans without a HECM report zero draws and loan balances', () => {
    const plan = basePlan()
    plan.accounts = [cash(100_000), home(undefined)]
    const result = run(plan)
    for (const y of result.years) {
      expect(y.hecmDraw).toBe(0)
      expect(y.hecmLoanBalance).toBe(0)
    }
    expect(result.years[0]!.netWorth).toBeCloseTo(100_000 + 500_000, 0)
  })

  it('validation requires a primary residence for a HECM', () => {
    const plan = basePlan()
    plan.accounts = [
      cash(100_000),
      {
        ...(home({ openYear: 2026, growthRatePct: 7.5, drawPolicy: 'lastResort' }) as Extract<Account, { type: 'property' }>),
        primaryResidence: undefined,
      },
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('primary residence')
  })
})

describe('last-resort backstop', () => {
  it('draws tax-free to cover a portfolio shortfall, accruing the loan', () => {
    // $50k cash against $40k/yr spending: 2026 is covered ($10k left), 2027
    // runs $30k short → the line covers it; 2028 draws the full $40k.
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      cash(50_000),
      home({ openYear: 2026, principalLimitPct: 40, growthRatePct: 7.5, upfrontCostPct: 2, drawPolicy: 'lastResort' }),
    ]
    const result = run(plan)
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.hecmDraw).toBe(0)
    // Upfront costs (2% of $500k = $10k) financed into the loan, grown 7.5%.
    expect(y2026.hecmLoanBalance).toBeCloseTo(10_000 * 1.075, 0)
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.hecmDraw).toBeCloseTo(30_000, 0)
    expect(y2027.shortfall).toBeCloseTo(0, 0)
    // Loan = (prior + draw) grown: (10,750 + 30,000) × 1.075.
    expect(y2027.hecmLoanBalance).toBeCloseTo((10_750 + 30_000) * 1.075, 0)
    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(y2028.hecmDraw).toBeCloseTo(40_000, 0)
    // Draws are loan proceeds, never income or MAGI.
    expect(y2027.magi).toBeCloseTo(0, 0)
    // No depletion while the line covers spending.
    expect(result.depletionYear === null || result.depletionYear > 2028).toBe(true)
  })

  it('a true shortfall returns once the line is exhausted', () => {
    // Tiny line (5% of $200k = $10k) against $40k/yr spending with no savings:
    // the backstop drains immediately and shortfalls resume.
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      cash(1_000),
      home({ openYear: 2026, principalLimitPct: 5, growthRatePct: 7.5, drawPolicy: 'lastResort' }, 200_000),
    ]
    const result = run(plan)
    expect(result.depletionYear).not.toBeNull()
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.hecmDraw).toBeCloseTo(10_000, 0)
    expect(y2026.shortfall).toBeCloseTo(40_000 - 1_000 - 10_000, 0)
  })
})

describe('non-recourse floor and estate interaction', () => {
  it('never charges net worth more than the home is worth', () => {
    // Full-line draw at open, 7.5% loan growth against a flat home value:
    // the loan passes $200k long before the plan ends, but net worth only
    // ever gives up the home (the heirs owe nothing beyond it).
    const plan = basePlan(85)
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      cash(30_000),
      home({ openYear: 2026, principalLimitPct: 40, growthRatePct: 7.5, drawPolicy: 'lastResort' }, 200_000),
    ]
    const result = run(plan)
    const last = result.years[result.years.length - 1]!
    expect(last.hecmLoanBalance).toBeGreaterThan(200_000)
    // investable is 0 (long depleted); the home nets to exactly zero.
    expect(last.netWorth).toBeCloseTo(last.investableTotal, 0)
  })

  it('a home sale repays the loan non-recourse and closes the line', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      cash(50_000),
      {
        ...(home({ openYear: 2026, principalLimitPct: 40, growthRatePct: 7.5, drawPolicy: 'lastResort' }) as Extract<
          Account,
          { type: 'property' }
        >),
        plannedSaleYear: 2029,
      },
    ]
    const result = run(plan)
    const saleYear = result.years.find((y) => y.year === 2029)!
    // Line closed at sale: no loan remains.
    expect(saleYear.hecmLoanBalance).toBe(0)
    // Proceeds arrived net of the payoff: cash grew by less than the full value.
    const y2030 = result.years.find((y) => y.year === 2030)!
    expect(y2030.hecmDraw).toBe(0)
    expect(saleYear.balances['home1']).toBe(0)
    // Net worth continuity: the sale converts home equity (value − loan) to
    // cash, so net worth moves only by spending flows and the final year's
    // loan accrual — never by re-adding forgiven (non-recourse) debt.
    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(Math.abs(saleYear.netWorth - (y2028.netWorth - 40_000))).toBeLessThan(
      y2028.hecmLoanBalance * 0.075 + 1_000,
    )
  })
})

describe('coordinated draw policy (Pfau direction fixture)', () => {
  function marketPlan(drawPolicy: 'coordinated' | 'lastResort' | null): Plan {
    // Horizon to 75 (2039): long enough for the recovery to compound past the
    // loan's accrual, short enough that the strategies still differ at the end
    // (over a long-enough horizon every strategy here eventually exhausts).
    const plan = basePlan(75)
    plan.assumptions.defaultReturnPct = 6
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      {
        type: 'taxable',
        id: 'brok1',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 400_000,
        costBasis: 400_000,
        annualContribution: 0,
      },
      home(
        drawPolicy === null
          ? undefined
          : { openYear: 2026, principalLimitPct: 40, growthRatePct: 7.5, drawPolicy },
        600_000,
      ),
    ]
    return plan
  }
  // Crash in 2026 (−36 shock on a +6 base → −30%), sharp recovery, then flat.
  const crash = { returnShockPct: [-36, 30, 30, 0, 0, 0, 0, 0, 0, 0] }

  it('deterministic runs without a market series never draw proactively', () => {
    const result = run(marketPlan('coordinated'))
    for (const y of result.years.slice(0, 5)) expect(y.hecmDraw).toBe(0)
  })

  it('counts each remaining coordinated-line capacity once across repeated down years', () => {
    // Independent repository-model worksheet. `DOCS/features/README.md`
    // defines a HECM line as a coordinated buffer after a down-market year;
    // `DOCS/features/year-cash-flow.md` requires accepted draws to publish as
    // property-attributed `loanProceeds`, paired economically with debt.
    //
    //   home1: 40% × $100,000 = $40,000 line capacity. Its duplicate row
    //          shares that one id-keyed line and adds no second capacity.
    //   home2: 10% × $100,000 = $10,000 independent line capacity.
    //   2027: $30,000 spending consumes $30,000 of home1.
    //   2028: home1 has $10,000 remaining and home2 has $10,000, so accepted
    //         loan proceeds / debt increase are $20,000 and the remaining
    //         portfolio funding is $30,000 − $20,000 = $10,000.
    //
    // The distinct second line also distinguishes per-line-id admission from
    // an incorrect plan-wide "first coordinated line only" boolean.
    const plan = basePlan(64)
    plan.expenses.baseAnnual = 30_000
    const sharedLine = home({
      openYear: 2025,
      principalLimitPct: 40,
      growthRatePct: 0,
      upfrontCostPct: 0,
      drawPolicy: 'coordinated',
    }, 100_000)
    const distinctLine = {
      ...home({
        openYear: 2025,
        principalLimitPct: 10,
        growthRatePct: 0,
        upfrontCostPct: 0,
        drawPolicy: 'coordinated',
      }, 100_000),
      id: 'home2',
      name: 'Independent second HECM line',
    }
    plan.accounts = [
      {
        type: 'taxable',
        id: 'brok1',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 1_000_000,
        costBasis: 1_000_000,
        annualContribution: 0,
      },
      sharedLine,
      { ...sharedLine, name: 'Duplicate property row sharing the HECM line' },
      distinctLine,
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    expect(
      parsed.plan.accounts
        .filter((account) => account.type === 'property')
        .map((account) => account.id),
    ).toEqual(['home1', 'home1', 'home2'])

    const result = simulatePlan(parsed.plan, {
      startYear: 2026,
      horizonEndYear: 2028,
      taxCalculator: noTax,
      market: { returnShockPct: [-10, -10, 0] },
      captureAnnualCashFlow: true,
    })
    const firstDrawYear = result.years.find((candidate) => candidate.year === 2027)!
    const secondDrawYear = result.years.find((candidate) => candidate.year === 2028)!
    const firstSources = firstDrawYear.cashFlow!.sourceLines.filter(
      (line) => line.kind === 'hecmCoordinatedDraw',
    )
    const secondSources = secondDrawYear.cashFlow!.sourceLines.filter(
      (line) => line.kind === 'hecmCoordinatedDraw',
    )

    expect(firstDrawYear.hecmDraw).toBe(30_000)
    expect(firstDrawYear.hecmLoanBalance).toBe(30_000)
    expect(firstDrawYear.withdrawals.total).toBe(0)
    expect(firstSources).toEqual([
      {
        id: 'source:hecmCoordinatedDraw:home1',
        kind: 'hecmCoordinatedDraw',
        role: 'loanProceeds',
        amountPlanDollars: 30_000,
        identities: [
          { entityKind: 'propertyAccount', propertyAccountId: 'home1' },
        ],
      },
    ])
    expect(secondDrawYear.hecmDraw).toBe(20_000)
    expect(secondDrawYear.hecmLoanBalance).toBe(50_000)
    expect(secondDrawYear.withdrawals.total).toBe(10_000)
    expect(secondDrawYear.shortfall).toBe(0)
    expect(secondSources).toEqual([
      {
        id: 'source:hecmCoordinatedDraw:home1',
        kind: 'hecmCoordinatedDraw',
        role: 'loanProceeds',
        amountPlanDollars: 10_000,
        identities: [
          { entityKind: 'propertyAccount', propertyAccountId: 'home1' },
        ],
      },
      {
        id: 'source:hecmCoordinatedDraw:home2',
        kind: 'hecmCoordinatedDraw',
        role: 'loanProceeds',
        amountPlanDollars: 10_000,
        identities: [
          { entityKind: 'propertyAccount', propertyAccountId: 'home2' },
        ],
      },
    ])
    expect(firstDrawYear.cashFlow!.reconciliation.status).toBe('reconciled')
    expect(secondDrawYear.cashFlow!.reconciliation.cash.differencePlanDollars).toBe(0)
    expect(secondDrawYear.cashFlow!.reconciliation.status).toBe('reconciled')
  })

  it('uses the first HECM-bearing duplicate row as the shared line policy', () => {
    // Duplicate ids alias one line. The row that first supplies that line's
    // HECM configuration is therefore authoritative for both annual growth and
    // draw policy; a later alias cannot opt the shared line into coordinated
    // draws. This is the same first-row rule documented by hecmLineOpenings and
    // propertyEventsAndGrowth.
    const plan = basePlan(64)
    plan.expenses.baseAnnual = 30_000
    const lastResortLine = home({
      openYear: 2025,
      principalLimitPct: 40,
      growthRatePct: 0,
      upfrontCostPct: 0,
      drawPolicy: 'lastResort',
    }, 100_000)
    plan.accounts = [
      {
        type: 'taxable',
        id: 'brok1',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 1_000_000,
        costBasis: 1_000_000,
        annualContribution: 0,
      },
      lastResortLine,
      {
        ...lastResortLine,
        name: 'Later alias with divergent policy',
        hecm: { ...lastResortLine.hecm!, drawPolicy: 'coordinated' },
      },
    ]

    const result = run(plan, {
      horizonEndYear: 2027,
      market: { returnShockPct: [-10, 0] },
    })

    expect(result.years.find((candidate) => candidate.year === 2027)!.hecmDraw).toBe(0)
  })

  it('a mildly negative shock in a positive-return year does not trigger a coordinated draw', () => {
    // −1 shock on a +6% expected return is still a +5% portfolio year: the
    // coordinated policy keys on the realized portfolio return, not the raw
    // additive shock, so no draw fires in 2027.
    const mild = { returnShockPct: [-1, 0, 0] }
    const result = run(marketPlan('coordinated'), { market: mild })
    expect(result.years.find((y) => y.year === 2027)!.hecmDraw).toBe(0)
    // A shock deep enough to turn the year negative (−7 on +6) does fire.
    const losing = { returnShockPct: [-7, 0, 0] }
    const withLoss = run(marketPlan('coordinated'), { market: losing })
    expect(withLoss.years.find((y) => y.year === 2027)!.hecmDraw).toBeGreaterThan(0)
  })

  it('coordinated draws in the year after a down year; last-resort waits for exhaustion', () => {
    const coordinated = run(marketPlan('coordinated'), { market: crash })
    const lastResort = run(marketPlan('lastResort'), { market: crash })
    expect(coordinated.years.find((y) => y.year === 2027)!.hecmDraw).toBeCloseTo(40_000, 0)
    expect(lastResort.years.find((y) => y.year === 2027)!.hecmDraw).toBe(0)
  })

  it('fully reconciles taxable withdrawal feedback while sizing a coordinated draw', () => {
    const plan = basePlan(63)
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      {
        type: 'traditional',
        id: 'trad1',
        name: '401k',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'employer',
        balance: 500_000,
        annualContribution: 0,
      },
      home({
        openYear: 2025,
        principalLimitPct: 40,
        growthRatePct: 0,
        upfrontCostPct: 0,
        drawPolicy: 'coordinated',
      }, 600_000),
    ]

    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: createFlatTaxCalculator(50),
      market: { returnShockPct: [-10, 0] },
    })
    const year = result.years.find((candidate) => candidate.year === 2027)!

    expect(year.hecmDraw).toBeCloseTo(40_000, 2)
    expect(year.withdrawals.total).toBeCloseTo(0, 2)
    expect(year.tax).toBeCloseTo(0, 2)
  })

  it('sizes a coordinated draw to converged post-ACA-credit need without creating surplus debt', () => {
    const plan = basePlan(63)
    plan.household.people[0]!.dob = '1963-01-01'
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [
      {
        type: 'recurring',
        id: 'pension1',
        label: 'Pension',
        annualAmount: 30_000,
        startYear: 2026,
        endYear: 2026,
        inflationAdjusted: false,
        taxTreatment: 'ordinary',
      },
    ]
    plan.accounts = [
      {
        type: 'taxable',
        id: 'brok1',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 400_000,
        costBasis: 400_000,
        annualContribution: 0,
      },
      home(
        {
          openYear: 2025,
          principalLimitPct: 40,
          growthRatePct: 0,
          upfrontCostPct: 0,
          drawPolicy: 'coordinated',
        },
        600_000,
      ),
    ]
    setAcaYearContract(plan, { year: 2026 })
    // Keep 2025 free of a legacy premium while preserving the explicit 2026
    // enrollment contract that participates in the funding fixed point.
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0

    const result = simulatePlan(validate(plan), {
      startYear: 2025,
      horizonEndYear: 2026,
      taxCalculator: noTax,
      market: { returnShockPct: [-10, 0] },
    })
    const prior = result.years.find((y) => y.year === 2025)!
    const year = result.years.find((y) => y.year === 2026)!
    const postCreditNeed = 40_000 + year.aca!.economicNetPremium - 30_000
    const grossPremiumNeed = 40_000 + year.aca!.grossEnrollmentPremium - 30_000

    expect(year.aca?.readiness).toBe('actionable')
    expect(year.aca?.modeledAllowablePtc).toBeGreaterThan(0)
    expect(year.hecmDraw).toBeCloseTo(postCreditNeed, 2)
    expect(year.hecmDraw).toBeLessThan(grossPremiumNeed - 1_000)
    expect(year.withdrawals.total).toBeCloseTo(0, 2)
    expect(year.surplusInvested).toBeCloseTo(0, 2)
    expect(year.balances['brok1']).toBeCloseTo(prior.balances['brok1']!, 2)
  })

  it('coordinated preserves more wealth than last-resort, which beats no HECM (Pfau direction)', () => {
    const coordinated = run(marketPlan('coordinated'), { market: crash })
    const lastResort = run(marketPlan('lastResort'), { market: crash })
    const noHecm = run(marketPlan(null), { market: crash })
    const endNetWorth = (r: ReturnType<typeof run>) => r.years[r.years.length - 1]!.netWorth
    // Drawing after the crash keeps depressed shares invested for the
    // recovery, and the recovered growth outruns the loan's 7.5% accrual.
    expect(endNetWorth(coordinated)).toBeGreaterThan(0)
    expect(endNetWorth(coordinated)).toBeGreaterThan(endNetWorth(lastResort))
    // Any line beats none once the portfolio would otherwise run dry.
    const shortfallTotal = (r: ReturnType<typeof run>) => r.years.reduce((sum, y) => sum + y.shortfall, 0)
    expect(shortfallTotal(lastResort)).toBeLessThanOrEqual(shortfallTotal(noHecm))
  })
})
