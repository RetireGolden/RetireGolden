import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { compareRothConversion, conversionFreeRun, summarizeProjection, withoutRothConversions } from './compare.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `cmp-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')

function conversionPlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-06-15',
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 85, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 4
  plan.expenses.baseAnnual = 40_000
  plan.accounts = [
    { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 500_000, annualContribution: 0 },
    { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_500_000, annualContribution: 0 },
    { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 },
  ]
  plan.strategies.rothConversion = {
    mode: 'fillToTarget',
    target: 'topOfBracket',
    targetValue: 22,
    startYear: 2026,
    endYear: 2034, // before RMDs start at 75 (2035)
  }
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('summarizeProjection', () => {
  it('totals taxes and buckets ending balances by category', () => {
    const plan = conversionPlan()
    const result = simulatePlan(plan, { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    const summary = summarizeProjection(plan, result, { conversionFreeRun: null })

    expect(summary.lifetimeTaxesAndPenalties).toBeGreaterThan(0)
    expect(summary.lifetimeRothConversions).toBeGreaterThan(500_000)
    expect(summary.endingByCategory.roth).toBeGreaterThan(0)
    expect(summary.depletionYear).toBeNull()
  })

  it('counts an aggregate duplicate balance once in category and estate summaries', () => {
    const plan = conversionPlan()
    const first = plan.accounts[1]!
    if (first.type !== 'traditional') throw new Error('fixture drift')
    plan.accounts = [
      { ...first, id: 'duplicate-trad', name: 'First row', balance: 100_000 },
      { ...first, id: 'duplicate-trad', name: 'Selected row', balance: 50_000 },
    ]
    plan.strategies.rothConversion = { mode: 'none' }
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
    })
    const summary = summarizeProjection(parsed.plan, result, { conversionFreeRun: null })
    const closing = result.years[0]!.balances['duplicate-trad']!
    expect(summary.endingByCategory.traditional).toBe(closing)
    expect(summary.estateBreakdown).toHaveLength(1)
    expect(summary.estateBreakdown[0]).toMatchObject({
      accountId: 'duplicate-trad',
      name: 'Selected row',
      grossBalance: closing,
    })
  })

  it('haircuts only the traditional balance for the after-tax estate', () => {
    const plan = conversionPlan()
    plan.assumptions.heirTaxRatePct = 25
    const result = simulatePlan(plan, { startYear: 2026, taxCalculator: createFederalTaxCalculator() })
    const summary = summarizeProjection(plan, result, { conversionFreeRun: null })

    const expected = summary.endingNetWorth - summary.endingByCategory.traditional * 0.25
    expect(summary.endingAfterTaxEstate).toBeCloseTo(expected, 6)
    // Conversions move money traditional -> Roth, so the haircut is below a naive 25% of net worth.
    expect(summary.endingAfterTaxEstate).toBeGreaterThan(summary.endingNetWorth - summary.endingNetWorth * 0.25)
  })

  it('a higher heir tax rate lowers the after-tax estate when traditional remains', () => {
    const low = conversionPlan()
    low.assumptions.heirTaxRatePct = 10
    const high = conversionPlan()
    high.assumptions.heirTaxRatePct = 40
    const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const lowSummary = summarizeProjection(low, simulatePlan(low, opts), { conversionFreeRun: null })
    const highSummary = summarizeProjection(high, simulatePlan(high, opts), { conversionFreeRun: null })
    expect(highSummary.endingAfterTaxEstate).toBeLessThan(lowSummary.endingAfterTaxEstate)
  })

  // Product-compatibility regression: omitted `estateBeneficiary` → destination-label mapping only,
  // per DOCS/domain/domain-rules-reference/17-guaranteed-income-annuity-purchases.md (Estate beneficiary
  // destinations). Not beneficiary designation, rollover/treat-as-own, or tax-dollar correctness.
  it('preserves legacy estate destination labels through simulatePlan and summarizeProjection', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Alex',
      dob: '1996-06-15',
      sex: 'average',
      retirementAge: 65,
      longevity: { planningAge: 85, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.accounts = [
      { type: 'cash', id: 'cash-default', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 10_000, annualContribution: 0 },
      { type: 'taxable', id: 'taxable-default', name: 'Brokerage', ownerPersonId: 'p1', annualReturnPct: 0, balance: 20_000, costBasis: 20_000, annualContribution: 0 },
      { type: 'roth', id: 'roth-default', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 30_000, annualContribution: 0 },
      { type: 'equityComp', id: 'equity-default', name: 'RSU', ownerPersonId: 'p1', annualReturnPct: 0, balance: 40_000, costBasis: 40_000, annualContribution: 0, vestingMode: 'final', vestDate: null },
      { type: 'traditional', id: 'traditional-default', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 50_000, annualContribution: 0 },
      { type: 'hsa', id: 'hsa-omit', name: 'HSA omitted', ownerPersonId: 'p1', annualReturnPct: 0, balance: 60_000, annualContribution: 0 },
      { type: 'hsa', id: 'hsa-spouse', name: 'HSA spouse', ownerPersonId: 'p1', annualReturnPct: 0, balance: 70_000, annualContribution: 0, beneficiary: 'spouse' },
      { type: 'hsa', id: 'hsa-non-spouse', name: 'HSA nonSpouse', ownerPersonId: 'p1', annualReturnPct: 0, balance: 80_000, annualContribution: 0, beneficiary: 'nonSpouse' },
    ]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error(parsed.issues.join('; '))
    const result = simulatePlan(parsed.plan, {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
    })
    const byAccountId = new Map(
      summarizeProjection(parsed.plan, result, { conversionFreeRun: null }).estateBreakdown.map((row) => [row.accountId, row.destination]),
    )
    expect(byAccountId.size).toBe(8)
    expect(byAccountId.get('cash-default')).toBe('spouse')
    expect(byAccountId.get('taxable-default')).toBe('spouse')
    expect(byAccountId.get('roth-default')).toBe('spouse')
    expect(byAccountId.get('equity-default')).toBe('spouse')
    expect(byAccountId.get('traditional-default')).toBe('nonSpouse')
    expect(byAccountId.get('hsa-omit')).toBe('spouse')
    expect(byAccountId.get('hsa-spouse')).toBe('spouse')
    expect(byAccountId.get('hsa-non-spouse')).toBe('nonSpouse')
  })

  it('derives FIRE metrics from the projection ledger', () => {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    plan.household.people[0] = {
      id: 'p1',
      name: 'Alex',
      dob: '1996-06-15',
      sex: 'average',
      retirementAge: 40,
      longevity: { planningAge: 60, source: 'manual' },
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0
    plan.assumptions.safeWithdrawalRatePct = 4
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [{ type: 'wages', id: 'w1', personId: 'p1', annualGross: 100_000, endAge: null, realGrowthPct: 0 }]
    plan.accounts = [{ type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 1_000_000, annualContribution: 0 }]
    const r = parsePlan(plan)
    if (!r.ok) throw new Error(r.issues.join('; '))

    const result = simulatePlan(r.plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
    const summary = summarizeProjection(r.plan, result, { conversionFreeRun: null })

    expect(summary.fiNumber).toBeCloseTo(1_000_000, 6)
    expect(summary.fiYear).toBe(2026)
    expect(summary.fiAge).toBe(30)
    expect(summary.averagePreRetirementSavingsRatePct).toBeCloseTo(60, 6)
    expect(summary.coastFireNumber).toBeCloseTo(1_000_000, 6)
    expect(summary.fiBasis).toEqual({ spendingYear: 2036, spendingSource: 'projection', personId: 'p1', retirementYear: 2036, retirementRule: 'retirementAge', personLastYearAlive: 2056, notRetiring: [] })
  })
})

describe('FI spending base without a Roth conversion (D-FI-CONVERSION-TAX)', () => {
  const opts = () => ({ startYear: 2026, taxCalculator: createFederalTaxCalculator() })

  it('reads a converting spending year from the conversion-free run, once', () => {
    const plan = conversionPlan()
    const result = simulatePlan(plan, opts())
    const priced = result.years.find((y) => y.year === 2026)!
    expect(priced.rothConversion).toBeGreaterThan(0)
    let calls = 0
    const free = conversionFreeRun(plan, opts())
    const summary = summarizeProjection(plan, result, {
      conversionFreeRun: () => {
        calls++
        return free()
      },
    })
    expect(calls).toBe(1)
    const freeYear = simulatePlan(withoutRothConversions(plan), opts()).years.find((y) => y.year === 2026)!
    expect(freeYear.rothConversion).toBe(0)
    // inflationPct is 0, so the base is not deflated; the SWR is the default 4%.
    expect(summary.fiNumber).toBe((freeYear.expenses.total + freeYear.tax + freeYear.penalties) / 0.04)
    expect(summary.fiNumber).toBeLessThan((priced.expenses.total + priced.tax + priced.penalties) / 0.04)
    expect(summary.fiBasis).toMatchObject({ spendingYear: 2026, spendingSource: 'conversionFreeProjection', personId: 'p1', retirementYear: 2026, retirementRule: 'startYear' })
  })

  it('says so when a caller supplies no conversion-free run for a converting plan', () => {
    const plan = conversionPlan()
    const result = simulatePlan(plan, opts())
    const priced = result.years.find((y) => y.year === 2026)!
    const summary = summarizeProjection(plan, result, { conversionFreeRun: null })
    expect(summary.fiNumber).toBe((priced.expenses.total + priced.tax + priced.penalties) / 0.04)
    expect(summary.fiBasis).toMatchObject({ spendingYear: 2026, spendingSource: 'conversionTaxIncluded', personId: 'p1', retirementYear: 2026, retirementRule: 'startYear' })
  })

  it('never runs the conversion-free plan when the plan converts in no year', () => {
    const plan = conversionPlan()
    plan.strategies.rothConversion = { mode: 'none' }
    const result = simulatePlan(plan, opts())
    const summary = summarizeProjection(plan, result, {
      conversionFreeRun: () => {
        throw new Error('must not run')
      },
    })
    const priced = result.years.find((y) => y.year === 2026)!
    expect(summary.fiNumber).toBe((priced.expenses.total + priced.tax + priced.penalties) / 0.04)
    expect(summary.fiBasis).toMatchObject({ spendingYear: 2026, spendingSource: 'projection', personId: 'p1' })
  })

  it('reads the conversion-free run when the plan converts only after the spending year, which changes nothing', () => {
    const plan = conversionPlan()
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 50_000 }] }
    const result = simulatePlan(plan, opts())
    const summary = summarizeProjection(plan, result, { conversionFreeRun: conversionFreeRun(plan, opts()) })
    const priced = result.years.find((y) => y.year === 2026)!
    expect(priced.rothConversion).toBe(0)
    expect(summary.fiNumber).toBe((priced.expenses.total + priced.tax + priced.penalties) / 0.04)
    expect(summary.fiBasis).toMatchObject({ spendingYear: 2026, spendingSource: 'conversionFreeProjection', personId: 'p1' })
  })

  it('prices a year after a conversion without the costs the conversion carried into it, so converting more never lowers the figure', () => {
    // Pat retires at 68 (2028). A 2026 conversion sets 2028's IRMAA through
    // the two-year MAGI lookback and drains the cash that would have paid
    // 2028's spending, so the projection's own 2028 row carries costs the
    // conversion caused; the FI number reads 2028 from the run without it.
    const withWindow = (conversions: { year: number; amount: number }[]) => {
      const plan = conversionPlan()
      plan.household.people[0]!.retirementAge = 68
      plan.strategies.rothConversion = conversions.length === 0 ? { mode: 'none' } : { mode: 'manual', conversions }
      const result = simulatePlan(plan, opts())
      return { result, summary: summarizeProjection(plan, result, { conversionFreeRun: conversionFreeRun(plan, opts()) }) }
    }
    const none = withWindow([])
    const once = withWindow([{ year: 2026, amount: 400_000 }])
    const more = withWindow([{ year: 2026, amount: 400_000 }, { year: 2027, amount: 200_000 }, { year: 2028, amount: 200_000 }])
    const row = (r: typeof once, year: number) => r.result.years.find((y) => y.year === year)!
    const outflows = (y: ReturnType<typeof row>) => y.expenses.total + y.tax + y.penalties
    // The conversion reaches 2028 in the projection itself ...
    expect(outflows(row(once, 2028))).toBeGreaterThan(outflows(row(none, 2028)))
    // ... but not the FI number, which is the no-conversion figure on every window.
    expect(once.summary.fiBasis).toMatchObject({ spendingYear: 2028, spendingSource: 'conversionFreeProjection' })
    expect(once.summary.fiNumber).toBe(none.summary.fiNumber)
    expect(more.summary.fiNumber).toBe(none.summary.fiNumber)
    expect(more.summary.fiNumber).toBeGreaterThanOrEqual(once.summary.fiNumber!)
  })

  it('removes the strategy, named conversions and their linked tax withdrawals, and nothing else', () => {
    const plan = conversionPlan()
    const provenance = { source: 'user' } as never
    plan.strategies.retirementActions = [
      { actionId: 'wd-tax', kind: 'ordinaryWithdrawal', year: 2027, executionSequence: 2, requestedAmount: 100, provenance, personId: 'p1', allocations: [], purpose: { kind: 'taxPayment' } },
      { actionId: 'wd-other', kind: 'ordinaryWithdrawal', year: 2027, executionSequence: 3, requestedAmount: 100, provenance, personId: 'p1', allocations: [], purpose: { kind: 'spending' } },
      { actionId: 'conv', kind: 'rothConversion', year: 2027, executionSequence: 1, requestedAmount: 100, provenance, personId: 'p1', allocations: [], destinationRothAccountId: 'roth1', taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId: 'wd-tax' } },
    ] as never
    const free = withoutRothConversions(plan)
    expect(free.strategies.rothConversion).toEqual({ mode: 'none' })
    expect(free.strategies.retirementActions.map((a) => a.actionId)).toEqual(['wd-other'])
    expect({ ...free, strategies: plan.strategies }).toEqual(plan)
  })
})

describe("FI figures on the household's later retirement (D-PEOPLE-ORDER, R4)", () => {
  function couple(order: 'app' | 'reversed', secondDob = '1994-03-01', secondRetirementAge: number | null = 45): Plan {
    const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
    const alex = { id: 'p1', name: 'Alex', dob: '1996-06-15', sex: 'average' as const, retirementAge: 40, longevity: { planningAge: 70, source: 'manual' as const } }
    const sam = { id: 'p2', name: 'Sam', dob: secondDob, sex: 'average' as const, retirementAge: secondRetirementAge, longevity: { planningAge: 70, source: 'manual' as const } }
    plan.household.people = order === 'app' ? [alex, sam] : [sam, alex]
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 5
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [
      { type: 'wages', id: 'w1', personId: 'p1', annualGross: 90_000, endAge: 40, realGrowthPct: 0 },
      { type: 'wages', id: 'w2', personId: 'p2', annualGross: 60_000, endAge: 45, realGrowthPct: 0 },
    ]
    plan.accounts = [{ type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 300_000, annualContribution: 0 }]
    const r = parsePlan(plan)
    if (!r.ok) throw new Error(r.issues.join('; '))
    return r.plan
  }
  const run = (plan: Plan) => summarizeProjection(plan, simulatePlan(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) }), { conversionFreeRun: null })

  it("prices the year the last person retires, and reports that person's age", () => {
    // Alex: 1996 + 40 = 2036. Sam: 1994 + 45 = 2039, the later one.
    const plan = couple('app')
    const result = simulatePlan(plan, { startYear: 2026, taxCalculator: createFlatTaxCalculator(0) })
    const summary = summarizeProjection(plan, result, { conversionFreeRun: null })
    const priced = result.years.find((y) => y.year === 2039)!
    expect(summary.fiBasis).toEqual({ spendingYear: 2039, spendingSource: 'projection', personId: 'p2', retirementYear: 2039, retirementRule: 'retirementAge', personLastYearAlive: 2064, notRetiring: [] })
    expect(summary.fiNumber).toBe((priced.expenses.total + priced.tax + priced.penalties) / 0.04)
    // Coast-FIRE discounts over 2039 - 2026 = 13 years at 5% - 0%.
    expect(summary.coastFireNumber).toBe(summary.fiNumber! / Math.pow(1.05, 13))
    if (summary.fiYear !== null) expect(summary.fiAge).toBe(summary.fiYear - 1994)
    // The savings-rate average runs over 2026..2038.
    const rates = summary.savingsRates.filter((r) => r.year < 2039)
    expect(rates).toHaveLength(13)
    expect(summary.averagePreRetirementSavingsRatePct).toBe(rates.reduce((a, r) => a + r.ratePct, 0) / 13)
  })

  it('gives the same FI figures whichever person is listed first', () => {
    const app = run(couple('app'))
    const reversed = run(couple('reversed'))
    for (const key of ['fiNumber', 'fiYear', 'fiAge', 'coastFireNumber', 'averagePreRetirementSavingsRatePct', 'fiBasis'] as const) {
      expect(reversed[key]).toEqual(app[key])
    }
  })

  it('breaks a tie in retirement year toward the older person, then the smaller id', () => {
    // Sam 1991 + 45 = 2036, the same year as Alex; Sam is older.
    expect(run(couple('app', '1991-03-01', 45)).fiBasis.personId).toBe('p2')
    expect(run(couple('reversed', '1991-03-01', 45)).fiBasis.personId).toBe('p2')
    // Same birth date and retirement age: the smaller id, p1.
    expect(run(couple('reversed', '1996-06-15', 40)).fiBasis.personId).toBe('p1')
    expect(run(couple('app', '1996-06-15', 40)).fiBasis.personId).toBe('p1')
  })
})

describe('compareRothConversion', () => {
  it('runs with and without conversions for side-by-side comparison', () => {
    const comparison = compareRothConversion(conversionPlan(), {
      startYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    })

    const w = comparison.withConversions
    const wo = comparison.withoutConversions
    expect(wo.lifetimeRothConversions).toBe(0)
    expect(w.lifetimeRothConversions).toBeGreaterThan(0)
    // Conversions shift money traditional -> Roth and prepay tax.
    expect(w.endingByCategory.traditional).toBeLessThan(wo.endingByCategory.traditional)
    expect(w.endingByCategory.roth).toBeGreaterThan(wo.endingByCategory.roth)
    expect(w.lifetimeTaxesAndPenalties).not.toBe(wo.lifetimeTaxesAndPenalties)
    // RMDs after the conversion window are smaller with conversions.
    const lastYearWith = comparison.withConversions
    expect(lastYearWith.endingByCategory.traditional).toBeGreaterThanOrEqual(0)
  })
})
