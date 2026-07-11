/**
 * Ledger integration for opt-in asset allocation
 * (asset-allocation-and-return-model-v2, steps 1–4): blended growth,
 * class-yield taxable drag, glidepath compilation, and annual rebalancing
 * with taxable gain realization. Allocation-free behavior is covered by the
 * existing golden/characterization suites (feature-off is unchanged).
 */

import { describe, expect, it } from 'vitest'

import type { AssetAllocationPolicy, Plan } from '../model/plan.js'
import {
  recurringOrdinaryIncome,
  runPlan,
  productionTaxCalculator,
  singlePersonPlan,
  taxableAccount,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const zeroTax: TaxCalculator = { compute: () => 0 }

const W = (usStocks: number, intlStocks: number, bonds: number, cash: number) => ({ usStocks, intlStocks, bonds, cash })

function planWith(accounts: Plan['accounts'], mutate?: (plan: Plan) => void): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
  plan.accounts = accounts
  mutate?.(plan)
  return validatePlan(plan)
}

function allocated<T extends { type: string }>(account: T, allocation: AssetAllocationPolicy): T {
  return { ...account, allocation }
}

describe('step 1: blended deterministic growth', () => {
  it("an allocated account's growth equals the weighted class blend", () => {
    // Defaults: usStocks 7%, bonds 4% ⇒ 60/40 blends to 5.8%. Traditional has
    // no yield carve-out, so the balance grows at exactly the blend.
    const plan = planWith([
      allocated(traditionalAccount('trad', 100_000), { mode: 'static', rebalancing: 'annual', weights: W(60, 0, 40, 0) }),
    ])
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    expect(r.years[0]!.balances['trad']).toBeCloseTo(100_000 * 1.058, 6)
  })

  it('allocation supersedes the account annualReturnPct and the plan default', () => {
    const plan = planWith(
      [allocated({ ...traditionalAccount('trad', 100_000), annualReturnPct: 20 }, { mode: 'static', rebalancing: 'annual', weights: W(0, 0, 100, 0) })],
      (p) => {
        p.assumptions.defaultReturnPct = 15
      },
    )
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    expect(r.years[0]!.balances['trad']).toBeCloseTo(104_000, 6)
  })

  it('a reinvesting allocated taxable account still compounds at the full blend', () => {
    // Yield is carved out of price growth and reinvested back in, so total
    // growth equals the blend; basis rises by the reinvested yield.
    const plan = planWith([
      allocated(taxableAccount('brok', 100_000, 100_000), { mode: 'static', rebalancing: 'annual', weights: W(60, 0, 40, 0) }),
    ])
    // Clear the fixture's explicit zero yields so the class blend drives them.
    const account = plan.accounts[0]! as Extract<Plan['accounts'][number], { type: 'taxable' }>
    account.interestYieldPct = undefined
    account.dividendYieldPct = undefined
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    expect(r.years[0]!.balances['brok']).toBeCloseTo(100_000 * 1.058, 6)
  })

  it('single-factor market shocks hit only the non-cash share of an allocated account', () => {
    const allCash = planWith([
      allocated(traditionalAccount('trad', 100_000), { mode: 'static', rebalancing: 'annual', weights: W(0, 0, 0, 100) }),
    ])
    const r = simulatePlan(allCash, { startYear: 2026, taxCalculator: zeroTax, market: { returnShockPct: [-50] } })
    // 100% cash: no shock; grows at the cash class return (2.5%).
    expect(r.years[0]!.balances['trad']).toBeCloseTo(102_500, 6)

    const half = planWith([
      allocated(traditionalAccount('trad', 100_000), { mode: 'static', rebalancing: 'annual', weights: W(50, 0, 0, 50) }),
    ])
    const r2 = simulatePlan(half, { startYear: 2026, taxCalculator: zeroTax, market: { returnShockPct: [-10] } })
    // usStocks 7 − 10 shock = −3 on half; cash 2.5 on half ⇒ blend −0.25%.
    expect(r2.years[0]!.balances['trad']).toBeCloseTo(100_000 * (1 + (0.5 * -3 + 0.5 * 2.5) / 100), 6)
  })

  it('per-class shock series drive allocated accounts, single factor drives the rest', () => {
    const plan = planWith([
      allocated(traditionalAccount('trad', 100_000), { mode: 'static', rebalancing: 'annual', weights: W(50, 0, 50, 0) }),
      { ...traditionalAccount('plain', 100_000, 'p1', 'employer'), annualReturnPct: null },
    ], (p) => {
      p.assumptions.defaultReturnPct = 5
    })
    const r = simulatePlan(plan, {
      startYear: 2026,
      taxCalculator: zeroTax,
      market: { returnShockPct: [2], classReturnShockPct: { usStocks: [10], bonds: [-4] } },
    })
    // Allocated: (7+10)/2 + (4−4)/2 = 8.5%; plain: 5 + 2 = 7% (own return null ⇒ default 5).
    expect(r.years[0]!.balances['trad']).toBeCloseTo(108_500, 6)
    expect(r.years[0]!.balances['plain']).toBeCloseTo(107_000, 6)
  })
})

describe('step 2: class yields feed the taxable drag fields', () => {
  it('bond-heavy and stock-heavy taxable accounts diverge in after-tax growth', () => {
    const build = (weights: ReturnType<typeof W>) =>
      planWith(
        [(() => {
          const a = allocated(taxableAccount('brok', 500_000, 500_000), { mode: 'static', rebalancing: 'annual', weights }) as Extract<Plan['accounts'][number], { type: 'taxable' }>
          a.interestYieldPct = undefined
          a.dividendYieldPct = undefined
          a.qualifiedRatio = undefined
          return a
        })()],
        (p) => {
          p.incomes = [recurringOrdinaryIncome('job', 80_000)]
          p.expenses.baseAnnual = 40_000
        },
      )
    const bondHeavy = runPlan(build(W(10, 0, 90, 0)), productionTaxCalculator())
    const stockHeavy = runPlan(build(W(90, 0, 10, 0)), productionTaxCalculator())
    const y0 = (r: typeof bondHeavy) => r.years[0]!
    // The bond-heavy account throws off ordinary interest; the stock-heavy one
    // mostly qualified dividends — so its tax bill is lower.
    expect(y0(bondHeavy).incomes.taxableInterest).toBeGreaterThan(y0(stockHeavy).incomes.taxableInterest)
    expect(y0(stockHeavy).incomes.qualifiedDividends).toBeGreaterThan(y0(bondHeavy).incomes.qualifiedDividends)
    expect(y0(bondHeavy).tax).toBeGreaterThan(y0(stockHeavy).tax)
  })

  it('explicit account yield fields override the class blend', () => {
    const plan = planWith([
      allocated(taxableAccount('brok', 500_000, 500_000), { mode: 'static', rebalancing: 'annual', weights: W(0, 0, 100, 0) }),
    ])
    // Fixture sets explicit interestYieldPct: 0 — the 4% bond yield must not apply.
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    expect(r.years[0]!.incomes.taxableInterest).toBe(0)
  })
})

describe('step 3: glidepaths compile to per-year allocations', () => {
  it('linear path hits its endpoints (deterministic golden)', () => {
    const plan = planWith([
      allocated(traditionalAccount('trad', 100_000), {
        mode: 'linear',
        rebalancing: 'annual',
        from: W(100, 0, 0, 0),
        to: W(0, 0, 100, 0),
        startYear: 2026,
        endYear: 2028,
      }),
    ])
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    // 2026 at 100% stocks (7%), 2027 at 50/50 (5.5%), 2028 at 100% bonds (4%).
    expect(r.years[0]!.balances['trad']).toBeCloseTo(100_000 * 1.07, 6)
    expect(r.years[1]!.balances['trad']).toBeCloseTo(100_000 * 1.07 * 1.055, 6)
    expect(r.years[2]!.balances['trad']).toBeCloseTo(100_000 * 1.07 * 1.055 * 1.04, 5)
  })

  it('staged path steps on its stage years (deterministic golden)', () => {
    const plan = planWith([
      allocated(traditionalAccount('trad', 100_000), {
        mode: 'staged',
        rebalancing: 'annual',
        stages: [
          { fromYear: 2026, weights: W(100, 0, 0, 0) },
          { fromYear: 2028, weights: W(0, 0, 100, 0) },
        ],
      }),
    ])
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    expect(r.years[0]!.balances['trad']).toBeCloseTo(100_000 * 1.07, 6)
    expect(r.years[1]!.balances['trad']).toBeCloseTo(100_000 * 1.07 * 1.07, 6)
    expect(r.years[2]!.balances['trad']).toBeCloseTo(100_000 * 1.07 * 1.07 * 1.04, 5)
  })

  it('custom targets interpolate between years', () => {
    const plan = planWith([
      allocated(traditionalAccount('trad', 100_000), {
        mode: 'custom',
        rebalancing: 'annual',
        targets: [
          { year: 2026, weights: W(100, 0, 0, 0) },
          { year: 2030, weights: W(0, 0, 100, 0) },
        ],
      }),
    ])
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    // 2028 is halfway: 50/50 ⇒ 5.5%.
    const expected2027 = 100_000 * 1.07 * (1 + (0.75 * 7 + 0.25 * 4) / 100)
    expect(r.years[1]!.balances['trad']).toBeCloseTo(expected2027, 5)
    expect(r.years[2]!.balances['trad']).toBeCloseTo(expected2027 * 1.055, 4)
  })
})

describe('step 4: annual rebalancing realizes taxable gains', () => {
  // Everyone stays under 65 for the whole horizon so no Medicare premiums force
  // withdrawals — every realized gain in these plans comes from rebalancing.
  const driftedTaxable = (rebalancing: 'annual' | 'none') => {
    const plan = singlePersonPlan({ dob: '1972-01-01', planningAge: 60 })
    const a = allocated(taxableAccount('brok', 200_000, 100_000), { mode: 'static', rebalancing, weights: W(50, 0, 50, 0) }) as Extract<Plan['accounts'][number], { type: 'taxable' }>
    a.interestYieldPct = 0
    a.dividendYieldPct = 0
    plan.accounts = [a]
    return validatePlan(plan)
  }

  it('taxable rebalance realizes gains through the basis machinery', () => {
    const r = simulatePlan(driftedTaxable('annual'), { startYear: 2026, taxCalculator: zeroTax })
    // Year 1: 50/50 grows at 7/4 ⇒ weights drift to ~50.71/49.29. Year 2's
    // January rebalance sells the overweight slice; the realized share is the
    // account's unrealized-gain ratio at that point (basis 100k on 211k).
    const balanceAfterYear1 = 200_000 * (1 + (0.5 * 7 + 0.5 * 4) / 100)
    const driftedStockWeight = (0.5 * 1.07) / (0.5 * 1.07 + 0.5 * 1.04)
    const expectedSale = (driftedStockWeight - 0.5) * balanceAfterYear1
    const gainRatio = 1 - 100_000 / balanceAfterYear1
    expect(r.years[0]!.realizedGains).toBe(0)
    expect(r.years[1]!.realizedGains).toBeCloseTo(expectedSale * gainRatio, 4)
  })

  it("rebalancing: 'none' opts out — no gains, weights keep drifting", () => {
    const r = simulatePlan(driftedTaxable('none'), { startYear: 2026, taxCalculator: zeroTax })
    for (const y of r.years) expect(y.realizedGains).toBe(0)
    // Drifting weights compound faster than the rebalanced 5.5% blend.
    const rebalanced = simulatePlan(driftedTaxable('annual'), { startYear: 2026, taxCalculator: zeroTax })
    const last = r.years.length - 1
    expect(r.years[last]!.balances['brok']!).toBeGreaterThan(rebalanced.years[last]!.balances['brok']!)
  })

  it('traditional and Roth rebalances are tax-free', () => {
    const plan = planWith([
      allocated(traditionalAccount('trad', 200_000), { mode: 'static', rebalancing: 'annual', weights: W(50, 0, 50, 0) }),
    ])
    const r = simulatePlan(plan, { startYear: 2026, taxCalculator: zeroTax })
    for (const y of r.years) expect(y.realizedGains).toBe(0)
  })

  it('rebalance gains flow into the tax year (production calculator)', () => {
    const withRebalance = driftedTaxable('annual')
    const without = driftedTaxable('none')
    const mutate = (p: Plan) => {
      p.incomes = [recurringOrdinaryIncome('job', 120_000)]
      p.expenses.baseAnnual = 50_000
    }
    mutate(withRebalance)
    mutate(without)
    const taxed = runPlan(withRebalance, productionTaxCalculator())
    const untaxed = runPlan(without, productionTaxCalculator())
    // Year 2 carries the first rebalance sale; with income filling the
    // brackets the realized gain must show up as extra tax.
    expect(taxed.years[1]!.tax).toBeGreaterThan(untaxed.years[1]!.tax)
  })
})
