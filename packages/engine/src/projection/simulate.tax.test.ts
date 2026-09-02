import { describe, expect, it } from 'vitest'

import {
  type Account,
  type Plan,
} from '../model/plan.js'
import { computeFederalTax, createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'
import {
  basePlan,
  cash,
  currentYearAca,
  noTax,
  taxable,
  testIds,
  traditional,
  validate,
  wages,
} from './simulate.test-support.js'

describe('taxes (flat test double)', () => {
  it('grosses up traditional withdrawals to cover the tax on them', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 80_000
    plan.accounts = [traditional(5_000_000)]
    const flat20 = createFlatTaxCalculator(20)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat20 })

    const y1 = result.years[0]!
    // Need w such that w = 80k + 0.2w -> w = 100k.
    expect(y1.withdrawals.traditional).toBeCloseTo(100_000, 0)
    expect(y1.tax).toBeCloseTo(20_000, 0)
    expect(y1.shortfall).toBe(0)
  })

  it('taxes wages and invests the after-tax surplus', () => {
    const plan = basePlan()
    plan.incomes = [wages(100_000)]
    plan.expenses.baseAnnual = 50_000
    plan.accounts = [cash(0)]
    const flat25 = createFlatTaxCalculator(25)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat25 })

    const y1 = result.years[0]!
    expect(y1.tax).toBeCloseTo(25_000, 6)
    expect(y1.surplusInvested).toBeCloseTo(25_000, 6)
    expect(y1.balances[plan.accounts[0]!.id]).toBeCloseTo(25_000, 6)
  })
})
describe('federal tax integration', () => {
  it('keeps taxable-exhausted traditional funding self-consistent after the quick tax loop would miss it', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [traditional(2_000_000)]
    // A 50% marginal rate needs more than eight simple fixed-point iterations
    // from zero to settle this $100k traditional-only spending draw.
    const flat50 = createFlatTaxCalculator(50)
    let taxEvaluations = 0
    const countedFlat50 = {
      compute: (input: Parameters<typeof flat50.compute>[0]) => {
        taxEvaluations += 1
        return flat50.compute(input)
      },
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: countedFlat50 })

    const y1 = result.years[0]!
    const recomputedTax = flat50.compute({
      year: y1.year,
      filingStatus: 'single',
      ordinaryIncome: y1.withdrawals.traditional,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 0,
    })
    expect(Math.abs(y1.tax - recomputedTax)).toBeLessThan(0.005)
    expect(Math.abs(y1.withdrawals.traditional - (y1.expenses.total + y1.tax))).toBeLessThan(0.005)
    expect(taxEvaluations).toBeGreaterThan(10) // quick pass plus bracket expansion and bisection
  })

  it('uses the fallback with the production federal calculator for a high traditional draw', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 500_000
    plan.accounts = [traditional(5_000_000)]
    const federal = createFederalTaxCalculator()
    let taxEvaluations = 0
    const countedFederal = {
      compute: (input: Parameters<typeof federal.compute>[0]) => {
        taxEvaluations += 1
        return federal.compute(input)
      },
    }

    const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: countedFederal })
    const y1 = result.years[0]!
    expect(Math.abs(y1.withdrawals.traditional - (y1.expenses.total + y1.tax + y1.penalties))).toBeLessThanOrEqual(0.005)
    expect(taxEvaluations).toBeGreaterThan(10)
  })

  it('warns and keeps the closest ledger when a discontinuous calculator has no fixed point', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [traditional(2_000_000)]
    const discontinuous = {
      compute: ({ ordinaryIncome }: { ordinaryIncome: number }) => ordinaryIncome < 150_000 ? 100_000 : 0,
    }

    const result = simulatePlan(validate(plan), { startYear: 2026, horizonEndYear: 2026, taxCalculator: discontinuous })

    expect(result.years).toHaveLength(1)
    expect(result.warnings.some((warning) => warning.includes('could not reconcile within half a cent'))).toBe(true)
  })

  it('falls back to gross premium with typed diagnostics when the ACA fixed point cannot converge', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [traditional(2_000_000)]
    const discontinuous = {
      compute: ({ ordinaryIncome }: { ordinaryIncome: number }) =>
        ordinaryIncome < 170_000 ? 100_000 : 0,
    }
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: discontinuous,
    }).years[0]!

    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('fixed-point-nonconvergent')
    expect(year.aca?.convergence.grossPremiumFallback).toBe(true)
    expect(year.expenses.healthcare).toBe(12_000)
    expect(Number.isFinite(year.withdrawals.total)).toBe(true)
  })

  it('funds gross premium when subsidized and cliff fixed points both exist', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.baseAnnual = 53_000
    plan.accounts = [traditional(500_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!

    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('conflicting-cliff-fixed-points')
    expect(year.aca?.convergence.iterations).toBeLessThanOrEqual(
      year.aca?.convergence.maxIterations ?? 0,
    )
    expect(year.expenses.healthcare).toBe(12_000)
  })

  it('probes and funds the gross basin when the first accepted root is subsidized', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.baseAnnual = 45_000
    plan.accounts = [traditional(500_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(10),
    }).years[0]!

    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('conflicting-cliff-fixed-points')
    expect(year.aca?.convergence.iterations).toBeLessThanOrEqual(
      year.aca?.convergence.maxIterations ?? 0,
    )
    expect(year.expenses.healthcare).toBe(12_000)
    expect(year.withdrawals.traditional).toBeCloseTo(63_333.33, 1)
  })

  it('fully solves the tax-bearing subsidized basin before accepting a gross cliff root', () => {
    const plan = basePlan()
    currentYearAca(plan)
    plan.expenses.baseAnnual = 51_000
    plan.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
      state: 'known',
      amount: 50_000,
    }
    // Cash covers the first $50k of either root. The lower basin still needs a
    // tax-bearing traditional draw, whose 30% feedback takes more than the
    // quick pass to settle; the gross basin needs a larger draw and crosses the
    // cliff once the known tax-exempt-interest addback is included in ACA MAGI.
    plan.accounts = [cash(50_000), traditional(500_000)]
    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(30),
    }).years[0]!

    expect(year.aca?.readiness).toBe('nonActionable')
    expect(year.aca?.supportCodes).toContain('conflicting-cliff-fixed-points')
    expect(year.expenses.healthcare).toBe(12_000)
  })

  it('self-consistently grosses up traditional withdrawals under real brackets', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1960-06-15' // 66 in 2026
    plan.household.people[0]!.retirementAge = null
    plan.expenses.baseAnnual = 60_000
    plan.accounts = [traditional(2_000_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    expect(y1.shortfall).toBe(0)
    // Spending now includes the automatic Part B premium at 66.
    expect(y1.withdrawals.traditional).toBeCloseTo(y1.expenses.total + y1.tax, 1)
    expect(y1.expenses.healthcare).toBeCloseTo(202.9 * 12, 6)
    // The converged tax matches the detailed engine for the income actually realized.
    const check = computeFederalTax({
      year: 2026,
      filingStatus: 'single',
      ordinaryIncome: y1.withdrawals.traditional,
      capitalGains: 0,
      ssBenefits: 0,
      peopleAged65Plus: 1,
    })
    expect(Math.abs(y1.tax - check.totalTax)).toBeLessThan(0.005)
    // ~$4.6k: 12% bracket after standard + 65 addition + senior deduction.
    expect(y1.tax).toBeGreaterThan(3_000)
    expect(y1.tax).toBeLessThan(8_000)
  })

  it('keeps low-income retirees with SS at zero federal tax', () => {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1958-06-15' // 68 in 2026, FRA cohort 66+8mo
    plan.household.people[0]!.retirementAge = null
    plan.expenses.baseAnnual = 30_000
    plan.incomes = [
      { type: 'socialSecurity', id: testIds(), personId: 'p1', piaMonthly: 2000, earnings: null, claimAge: { years: 67, months: 0 } },
    ]
    plan.accounts = [cash(500_000)]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    // SS ≈ 24k+ and small cash top-ups -> provisional income below the threshold.
    expect(result.years[0]!.tax).toBe(0)
  })
})

describe('tax-exempt interest generation and characterization', () => {
  it('generates tax-exempt yield as cash excluded from taxable yield and ordinary income', () => {
    const brokerageId = testIds()
    const make = (reinvestDividends: boolean) => {
      const plan = basePlan()
      plan.assumptions.defaultReturnPct = 0
      plan.accounts = [
        {
          ...taxable(100_000, 100_000),
          id: brokerageId,
          taxExemptInterestYieldPct: 3,
          reinvestDividends,
        },
      ]
      return plan
    }
    const noReinvest = simulatePlan(validate(make(false)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(noReinvest.incomes.taxExemptInterest).toBeCloseTo(3_000, 6)
    expect(noReinvest.incomes.total).toBeCloseTo(3_000, 6)
    expect(noReinvest.taxableYield).toBe(0)
    expect(noReinvest.incomes.taxableInterest).toBe(0)
    expect(noReinvest.incomes.taxableYield).toBe(0)
    expect(noReinvest.tax).toBe(0)
    // Surplus is deposited before the growth pass carves distributed yield from
    // balance, so the 3% carve hits (100k principal + 3k yield) and leaves
    // brokerage $90 below opening principal.
    expect(noReinvest.balances[brokerageId]).toBeCloseTo(99_910, 6)
    expect(noReinvest.surplusInvested).toBeCloseTo(3_000, 6)

    const withReinvest = simulatePlan(validate(make(true)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: noTax,
    }).years[0]!
    expect(withReinvest.incomes.taxExemptInterest).toBeCloseTo(3_000, 6)
    // Total return already includes the distributed income: the growth pass
    // prices the account at (return − yield) and the reinvest add-back restores
    // the gross, so a 0% total return with a reinvested 3% distribution ends
    // the year flat at 100,000 — not at 103,000, which would count the coupon
    // on top of a total return that already contains it.
    expect(withReinvest.balances[brokerageId]).toBeCloseTo(100_000, 6)
    expect(withReinvest.surplusInvested).toBeCloseTo(0, 6)

    const spendPlan = make(true)
    spendPlan.expenses.oneTimeGoals = [{ id: 'goal', label: 'Spend', year: 2027, amount: 50_000 }]
    const spendYear = simulatePlan(validate(spendPlan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: noTax,
    }).years.find((y) => y.year === 2027)!
    expect(spendYear.withdrawals.taxable).toBeCloseTo(50_000, 6)
    // The −1,500 realized loss is the reinvested-basis signature: year-one's
    // 3,000 of reinvested exempt interest raised cost basis to 103,000 against
    // a 100,000 balance (0% total return), so a 50,000 sale realizes
    // 50,000 × (1 − 103,000/100,000) = −1,500. A zero gain here would mean the
    // reinvested coupon never reached basis and the sale was taxed on it again.
    expect(spendYear.realizedGains).toBeCloseTo(-1_500, 6)
  })

  it('raises taxable Social Security through the section 86 cascade without entering ordinary income', () => {
    const make = (withExemptYield: boolean) => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1964-06-15' // 62 in 2026 so benefits pay
      plan.incomes = [
        { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 12_900, taxTreatment: 'ordinary' },
        {
          type: 'socialSecurity',
          id: testIds(),
          personId: 'p1',
          piaMonthly: 2_000,
          earnings: null,
          claimAge: { years: 62, months: 0 },
        },
      ]
      plan.accounts = withExemptYield
        ? [
            {
              ...taxable(100_000, 100_000),
              taxExemptInterestYieldPct: 13,
              reinvestDividends: false,
            },
            cash(400_000),
          ]
        : [cash(500_000)]
      return plan
    }
    const withoutExempt = simulatePlan(validate(make(false)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    const withExempt = simulatePlan(validate(make(true)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    const agiProxy = (year: typeof withExempt) => year.magi - year.taxExemptInterest
    // MAGI = ordinary (ex-SS) + realized gains + qualified dividends + taxable SS
    // + characterized tax-exempt interest (simulate.ts magiHistory).
    const taxableSsFromYear = (year: typeof withExempt) =>
      year.magi -
      year.taxExemptInterest -
      year.incomes.oneTime -
      year.incomes.taxableYield -
      year.incomes.qualifiedDividends -
      year.realizedGains

    expect(withoutExempt.incomes.socialSecurity).toBeGreaterThan(0)
    expect(taxableSsFromYear(withoutExempt)).toBeCloseTo(0, 6)
    expect(taxableSsFromYear(withExempt)).toBeGreaterThan(taxableSsFromYear(withoutExempt) + 500)
    expect(withExempt.tax).toBeGreaterThan(withoutExempt.tax)
    const agiDelta = agiProxy(withExempt) - agiProxy(withoutExempt)
    expect(agiDelta).toBeCloseTo(taxableSsFromYear(withExempt) - taxableSsFromYear(withoutExempt), 6)
    expect(withExempt.incomes.taxExemptInterest).toBeCloseTo(13_000, 6)
    expect(withExempt.incomes.taxableYield).toBe(0)
  })

  it('lets a known ACA contract override generated tax-exempt interest for characterization only', () => {
    const make = (yieldPct: number | null) => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1964-01-01'
      currentYearAca(plan)
      plan.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
        state: 'known',
        amount: 5_000,
      }
      plan.incomes = [
        { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 20_000, taxTreatment: 'ordinary' },
      ]
      plan.accounts =
        yieldPct === null
          ? [cash(100_000)]
          : [
              {
                ...taxable(100_000, 100_000),
                taxExemptInterestYieldPct: yieldPct,
                reinvestDividends: false,
              },
            ]
      return plan
    }
    const sim = (plan: ReturnType<typeof make>) =>
      simulatePlan(validate(plan), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }).years[0]!

    const withoutYield = sim(make(null))
    const attestedAlone = 5_000
    const withLowYield = sim(make(3))
    // max → 5_000; attestedAlone → 5_000; sum → 8_000; generated-governs → 3_000.
    expect(withLowYield.taxExemptInterest).toBe(attestedAlone)
    expect(withLowYield.aca?.magiComponents.taxExemptInterest).toBe(attestedAlone)
    expect(withLowYield.magi).toBeCloseTo(
      withLowYield.aca!.magiComponents.federalAgi +
        withLowYield.aca!.magiComponents.nontaxableSocialSecurity +
        attestedAlone +
        withLowYield.aca!.magiComponents.foreignExclusionAddback +
        withLowYield.aca!.magiComponents.requiredFilerDependentMagi,
      6,
    )
    expect(withLowYield.incomes.taxExemptInterest).toBeCloseTo(3_000, 6)
    expect(withLowYield.surplusInvested - withoutYield.surplusInvested).toBeCloseTo(3_000, 6)
    expect(withLowYield.taxExemptInterest).not.toBe(8_000)

    const withHighYield = sim(make(8))
    const maxGenerated = 8_000
    // max → 8_000; attestedAlone → 5_000; sum → 13_000.
    expect(withHighYield.taxExemptInterest).toBe(maxGenerated)
    expect(withHighYield.aca?.magiComponents.taxExemptInterest).toBe(maxGenerated)
    expect(withHighYield.incomes.taxExemptInterest).toBeCloseTo(maxGenerated, 6)
    expect(withHighYield.taxExemptInterest).not.toBe(attestedAlone)
    expect(withHighYield.taxExemptInterest).not.toBe(13_000)
  })

  it('upgrades an unknown ACA tax-exempt contract when the plan attests a yield field', () => {
    const make = (withYieldField: boolean) => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1964-01-01'
      currentYearAca(plan)
      plan.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
        state: 'unknown',
        amount: null,
      }
      plan.incomes = [
        { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 20_000, taxTreatment: 'ordinary' },
      ]
      plan.accounts = withYieldField
        ? [
            {
              ...taxable(100_000, 100_000),
              taxExemptInterestYieldPct: 2,
              reinvestDividends: false,
            },
          ]
        : [cash(100_000)]
      return plan
    }
    const blocked = simulatePlan(validate(make(false)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(blocked.aca?.supportCodes).toContain('tax-exempt-interest-unknown')
    expect(blocked.aca?.readiness).toBe('nonActionable')
    expect(blocked.aca?.householdMagi).toBeNull()

    const actionable = simulatePlan(validate(make(true)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(actionable.aca?.supportCodes).not.toContain('tax-exempt-interest-unknown')
    expect(actionable.aca?.supportCodes).toContain('tax-exempt-interest-plan-derived')
    expect(actionable.aca?.readiness).toBe('actionable')
    expect(actionable.aca?.householdMagi).toBeCloseTo(
      actionable.aca!.magiComponents.federalAgi +
        actionable.aca!.magiComponents.nontaxableSocialSecurity +
        2_000 +
        actionable.aca!.magiComponents.foreignExclusionAddback +
        actionable.aca!.magiComponents.requiredFilerDependentMagi,
      6,
    )
    expect(actionable.incomes.taxExemptInterest).toBeCloseTo(2_000, 6)
  })

  it('preserves byte-identical ledgers when the yield field is absent', () => {
    const plan = basePlan()
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 15_000, taxTreatment: 'ordinary' },
      {
        type: 'socialSecurity',
        id: testIds(),
        personId: 'p1',
        piaMonthly: 1_800,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ]
    plan.accounts = [cash(500_000), taxable(200_000, 180_000)]
    const clone = structuredClone(plan)
    const baseline = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    })
    const identical = simulatePlan(validate(clone), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    })
    expect(JSON.stringify(identical.years)).toBe(JSON.stringify(baseline.years))
    const year = baseline.years[0]!
    expect(year.incomes.taxExemptInterest).toBe(0)
    expect(year.taxExemptInterest).toBe(0)
    expect(year.tax).toBe(0)
    expect(year.magi).toBeCloseTo(15_000, 6)
    expect(year.withdrawals.total).toBeCloseTo(25_000, 6)

    const disabled = basePlan()
    disabled.household.people[0]!.dob = '1964-06-15'
    disabled.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 1_000,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    disabled.accounts = [cash(100_000)]
    disabled.incomes = [
      { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 20_000, taxTreatment: 'ordinary' },
    ]
    const disabledWithContract = structuredClone(disabled)
    currentYearAca(disabledWithContract)
    disabledWithContract.expenses.healthcare.applyAcaCredit = false
    disabledWithContract.expenses.healthcare.acaYears![0]!.taxExemptInterest = {
      state: 'known',
      amount: 5_000,
    }
    expect(
      simulatePlan(validate(disabledWithContract), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }),
    ).toEqual(
      simulatePlan(validate(disabled), {
        startYear: 2026,
        horizonEndYear: 2026,
        taxCalculator: createFederalTaxCalculator(),
      }),
    )
  })

  it('does not change NIIT, AMT, or senior-deduction tax when only tax-exempt interest is present', () => {
    const make = (withExemptYield: boolean) => {
      const plan = basePlan()
      plan.incomes = [
        { type: 'oneTime', id: testIds(), label: 'Income', year: 2026, inflationAdjusted: false, amount: 30_000, taxTreatment: 'ordinary' },
      ]
      plan.accounts = withExemptYield
        ? [
            {
              ...taxable(100_000, 100_000),
              taxExemptInterestYieldPct: 50,
              reinvestDividends: false,
            },
          ]
        : [cash(100_000)]
      return plan
    }
    const withoutExempt = simulatePlan(validate(make(false)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    const withExempt = simulatePlan(validate(make(true)), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFederalTaxCalculator(),
    }).years[0]!
    expect(withExempt.incomes.taxExemptInterest).toBeCloseTo(50_000, 6)
    expect(withExempt.tax).toBeCloseTo(withoutExempt.tax, 6)
    expect(withExempt.amt).toBeCloseTo(withoutExempt.amt, 6)
  })
})

describe('tax-depth review fixes (PR #38)', () => {
  it('never converts an inherited account (it follows the 10-year rule)', () => {
    const plan = basePlan()
    plan.accounts = [
      { type: 'traditional', id: 'inh', name: 'Inherited', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0, inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: false } } as Account,
      { type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
      cash(100_000),
    ]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 50_000 }] }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.rothConversion).toBe(0) // inherited can't be a conversion source
    expect(y2027.balances['inh']).toBe(300_000) // untouched (no forced dist, no conversion)
  })

  it('sizes fill-to-target conversions against itemized deductions when larger', () => {
    const make = (itemize: boolean): Plan => {
      const plan = basePlan()
      plan.accounts = [
        { type: 'traditional', id: 't', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_000_000, annualContribution: 0 } as Account,
        { type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
        cash(200_000),
      ]
      plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 12, startYear: 2026, endYear: 2026 }
      if (itemize) plan.strategies.itemizedDeductions = { stateAndLocalTaxes: 30_000, mortgageInterest: 20_000, charitable: 10_000 }
      return validate(plan)
    }
    const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const withItemized = simulatePlan(make(true), opts).years.find((y) => y.year === 2026)!.rothConversion
    const standard = simulatePlan(make(false), opts).years.find((y) => y.year === 2026)!.rothConversion
    // A larger deduction leaves more room under the 12% bracket top, so more converts.
    expect(withItemized).toBeGreaterThan(standard + 1_000)
  })

  it('does not over-trim a fill-to-target conversion when surplus inflows can pay its tax (PR #144)', () => {
    // Big pension inflow ($80k) far exceeds spending ($10k), so ~$70k of surplus
    // cash is available to pay a conversion's tax without touching the $50k cash
    // floor. The floor should barely trim the conversion; before the fix the
    // surplus inflow was clamped out of the headroom and the conversion was
    // trimmed to almost nothing.
    const make = (floor: number): Plan => {
      const plan = basePlan()
      plan.strategies.taxableSafetyNetFloor = floor
      plan.expenses.baseAnnual = 10_000
      plan.incomes = [
        { type: 'recurring', id: testIds(), label: 'Pension', annualAmount: 80_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
      ]
      plan.accounts = [
        { type: 'traditional', id: 't', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 1_000_000, annualContribution: 0 } as Account,
        { type: 'roth', id: 'r', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
        cash(50_000),
      ]
      plan.strategies.rothConversion = { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 24, startYear: 2026, endYear: 2026 }
      return validate(plan)
    }
    const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
    const noFloor = simulatePlan(make(0), opts).years.find((y) => y.year === 2026)!.rothConversion
    const withFloor = simulatePlan(make(50_000), opts).years.find((y) => y.year === 2026)!.rothConversion
    expect(noFloor).toBeGreaterThan(50_000)
    expect(withFloor).toBeGreaterThan(noFloor * 0.9)
  })
})

describe('capital loss carryforward', () => {
  const fed = createFederalTaxCalculator()

  /** Pre-65 single filer: $120k ordinary pension + a one-time $50k long-term gain
   *  in 2026. Income covers low spending from cash, so the only realized gain is
   *  the one-time sale (no withdrawal gains) — keeps the assertions deterministic. */
  function carryforwardPlan(carryforward: number): Plan {
    const plan = basePlan()
    plan.household.people[0] = {
      id: 'p1', name: 'Pat', dob: '1962-06-15', sex: 'average',
      retirementAge: 64, longevity: { planningAge: 90, source: 'manual' },
    }
    plan.household.capitalLossCarryforward = carryforward
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [
      { type: 'recurring', id: testIds(), label: 'Pension', annualAmount: 120_000, startYear: 2026, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
      { type: 'oneTime', id: testIds(), label: 'Stock sale', year: 2026, inflationAdjusted: false, amount: 50_000, taxTreatment: 'capitalGain' },
    ]
    plan.accounts = [cash(500_000)]
    return plan
  }

  const yearOf = (plan: Plan, year: number) =>
    simulatePlan(validate(plan), { startYear: 2026, taxCalculator: fed }).years.find((y) => y.year === year)!

  it('absorbs realized gains and trims ordinary income, cutting year-one tax and MAGI', () => {
    const withCf = yearOf(carryforwardPlan(60_000), 2026)
    const without = yearOf(carryforwardPlan(0), 2026)
    // The $50k gain otherwise stacks at 15% (ordinary fills past the 0% threshold);
    // the $3k ordinary offset lands in the 22% bracket.
    expect(without.tax - withCf.tax).toBeCloseTo(50_000 * 0.15 + 3_000 * 0.22, 0)
    // Cascade: MAGI falls by the absorbed gain plus the ordinary offset.
    expect(without.magi - withCf.magi).toBeCloseTo(53_000, 0)
    expect(withCf.capitalLossUsedAgainstGains).toBe(50_000)
    expect(withCf.capitalLossUsedAgainstOrdinary).toBe(3_000)
    expect(withCf.capitalLossCarryforwardRemaining).toBe(7_000)
  })

  it('depletes the remaining pool by $3k/yr against ordinary income', () => {
    const plan = carryforwardPlan(60_000)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: fed })
    const remaining = (yr: number) => result.years.find((y) => y.year === yr)!.capitalLossCarryforwardRemaining
    expect(remaining(2026)).toBe(7_000) // 60k − 50k gain − 3k ordinary
    expect(remaining(2027)).toBe(4_000)
    expect(remaining(2028)).toBe(1_000)
    expect(remaining(2029)).toBe(0)
  })

  it('is inert when there is no carryforward (regression)', () => {
    const result = simulatePlan(validate(carryforwardPlan(0)), { startYear: 2026, taxCalculator: fed })
    for (const y of result.years) {
      expect(y.capitalLossUsedAgainstGains).toBe(0)
      expect(y.capitalLossUsedAgainstOrdinary).toBe(0)
      expect(y.capitalLossCarryforwardRemaining).toBe(0)
    }
  })

  it('adds a current taxable-sale loss to the pool exactly once', () => {
    const plan = basePlan()
    plan.household.people[0] = {
      id: 'p1',
      name: 'Pat',
      dob: '1966-06-15',
      sex: 'average',
      retirementAge: 67,
      longevity: { planningAge: 70, source: 'manual' },
    }
    plan.expenses.baseAnnual = 70_000
    plan.incomes = [{
      type: 'recurring',
      id: testIds(),
      label: 'Ordinary income',
      annualAmount: 50_000,
      startYear: 2026,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    }]
    plan.accounts = [taxable(20_000, 40_000)]

    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: noTax,
    })
    const [first, second] = result.years

    expect(first).toMatchObject({
      realizedGains: -20_000,
      magi: 47_000,
      capitalLossUsedAgainstGains: 0,
      capitalLossUsedAgainstOrdinary: 3_000,
      capitalLossCarryforwardRemaining: 17_000,
    })
    expect(second).toMatchObject({
      realizedGains: 0,
      magi: 47_000,
      capitalLossUsedAgainstGains: 0,
      capitalLossUsedAgainstOrdinary: 3_000,
      capitalLossCarryforwardRemaining: 14_000,
    })
  })

  it('caps a current loss once for conversion-floor probes and final tax', () => {
    const observed: {
      netCapital: number
      rawCapital: number | undefined
    }[] = []
    const observingTax: TaxCalculator = {
      compute(input) {
        observed.push({
          netCapital: input.capitalGains,
          rawCapital: input.realizedCapitalGainsBeforeCarryforward,
        })
        return 0
      },
    }
    const plan = basePlan()
    plan.accounts = [
      taxable(100_000, 200_000),
      {
        type: 'annuity',
        id: testIds(),
        name: 'Loss-funded SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 10_000 / 12,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: 2026,
          premium: 100_000,
          fundingAccountId: '',
          taxQualification: 'nonQualified',
        },
      },
      {
        type: 'traditional',
        id: testIds(),
        name: 'Traditional',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 500_000,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: testIds(),
        name: 'Roth',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
    ]
    const taxableAccount = plan.accounts[0]!
    const annuity = plan.accounts[1]!
    if (annuity.type !== 'annuity') throw new Error('expected annuity fixture')
    annuity.purchase!.fundingAccountId = taxableAccount.id
    plan.strategies.taxableSafetyNetFloor = 1
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: 2026,
      endYear: 2026,
    }

    const year = simulatePlan(validate(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: observingTax,
    }).years[0]!

    expect(year.rothConversion).toBeGreaterThan(0)
    expect(year.capitalLossCarryforwardRemaining).toBe(97_000)
    expect(observed.some((input) => input.rawCapital === -100_000)).toBe(true)
    expect(observed.some((input) => input.netCapital === -3_000)).toBe(true)
    expect(
      observed.every((input) => input.netCapital >= -3_000),
    ).toBe(true)
  })
})

