/**
 * Integration coverage for the TIPS income floor through the exact ledger
 * (social-security-bridge-and-tips-ladder, step 2): ladder cash flows and
 * their real-vs-nominal bookkeeping, purchase funding (book value from cash,
 * pro-rata gains from taxable), TIPS taxation (coupons + inflation accretion
 * federally ordinary, principal tax-free, state-exempt as U.S. government
 * interest), the taxable-Social-Security interaction, and the feature-off
 * byte-identical guarantee.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan, type TipsLadder } from '../model/plan'
import { EMBEDDED_REAL_YIELD_CURVE } from '../params'
import { buildLadder } from '../ladder/ladderMath'
import { createStateTaxCalculator } from '../tax/stateTax'
import { createFlatTaxCalculator } from './flatTax'
import { simulatePlan } from './simulate'

let counter = 0
const testIds = () => `floor-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

/** Single person, born 1966 → age 60 in 2026 (pre-65, pre-RMD); flat dollars by default. */
function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 95, source: 'manual' },
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

function ladder(overrides: Partial<TipsLadder> = {}): TipsLadder {
  return {
    id: 'lad1',
    name: 'Income floor',
    purpose: 'floor',
    startYear: 2027,
    endYear: 2031,
    annualRealAmount: 10_000,
    ...overrides,
  }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

const run = (plan: Plan, taxCalculator = noTax) => simulatePlan(validate(plan), { startYear: 2026, taxCalculator })

describe('TIPS ladder cash flows', () => {
  it('delivers the target real income in every payout year (flat dollars)', () => {
    const plan = basePlan()
    plan.accounts = [cash(50_000)]
    plan.incomeFloor = { ladders: [ladder()] }
    const result = run(plan)
    for (let year = 2027; year <= 2031; year++) {
      expect(result.years.find((y) => y.year === year)!.incomes.tipsLadder).toBeCloseTo(10_000, 6)
    }
    // Before the payout window the (already-owned) ladder pays coupons only.
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.incomes.tipsLadder).toBeGreaterThan(0)
    expect(y2026.incomes.tipsLadder).toBeLessThan(1_500)
    // After the window the ladder is exhausted.
    expect(result.years.find((y) => y.year === 2032)!.incomes.tipsLadder).toBe(0)
  })

  it('keeps the payout constant in REAL terms under inflation (the classic bug source)', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 3
    plan.accounts = [cash(50_000)]
    plan.incomeFloor = { ladders: [ladder()] }
    const result = run(plan)
    for (let year = 2027; year <= 2031; year++) {
      const nominal = result.years.find((y) => y.year === year)!.incomes.tipsLadder
      const deflated = nominal / Math.pow(1.03, year - 2026)
      expect(deflated).toBeCloseTo(10_000, 6)
    }
  })

  it('freezes unmatured principal in the estate after the last death (MC horizons past death)', () => {
    // Person dies at 64 (2030) mid-ladder; the horizon runs to 2040 like a
    // stochastic-longevity Monte Carlo grid. Rungs must stop maturing at death
    // — the remaining face rides in net worth, not evaporate offset-by-offset.
    const plan = basePlan()
    plan.household.people[0]!.longevity = { planningAge: 64, source: 'manual' }
    plan.accounts = [cash(50_000)]
    plan.incomeFloor = { ladders: [ladder({ startYear: 2027, endYear: 2038 })] }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax, horizonEndYear: 2040 })
    const y2031 = result.years.find((y) => y.year === 2031)!
    const y2039 = result.years.find((y) => y.year === 2039)!
    expect(y2031.ladderValue).toBeGreaterThan(0)
    // Flat dollars: the frozen estate value never decays after death…
    expect(y2039.ladderValue).toBeCloseTo(y2031.ladderValue, 6)
    // …and no post-death year pays ladder cash.
    for (const y of result.years) {
      if (y.year > 2030) expect(y.incomes.tipsLadder).toBe(0)
    }
    expect(result.endingNetWorth).toBeGreaterThanOrEqual(y2039.ladderValue)
  })

  it('an empty ladder list is byte-identical to no incomeFloor at all', () => {
    const withNone = basePlan()
    withNone.accounts = [cash(50_000)]
    const withEmpty = structuredClone(withNone)
    withEmpty.incomeFloor = { ladders: [] }
    expect(JSON.stringify(run(withEmpty).years)).toBe(JSON.stringify(run(withNone).years))
  })
})

describe('TIPS ladder purchase funding', () => {
  it('withdraws the quoted cost from a cash account in the purchase year', () => {
    const build = buildLadder({
      annualRealIncome: 10_000,
      firstPayoutOffset: 1,
      payoutYears: 5,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })
    const plan = basePlan()
    plan.accounts = [cash(100_000)]
    plan.incomeFloor = { ladders: [ladder({ purchase: { year: 2026, fundingAccountId: 'cash1' } })] }
    const result = run(plan)
    const y2026 = result.years.find((y) => y.year === 2026)!
    // Cost left cash at book value; the ladder's remaining principal shows up
    // in net worth (not investable), so the purchase never craters net worth.
    expect(y2026.balances['cash1']).toBeCloseTo(100_000 - build.totalCost, 0)
    expect(y2026.ladderValue).toBeGreaterThan(0)
    expect(y2026.netWorth).toBeCloseTo(y2026.investableTotal + y2026.ladderValue, 6)
    expect(y2026.netWorth).toBeGreaterThan(100_000 - build.totalCost * 0.1)
  })

  it('realizes gains pro-rata when funded from a taxable account', () => {
    const plan = basePlan()
    plan.accounts = [
      { type: 'taxable', id: 'tx1', name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 100_000, costBasis: 50_000, annualContribution: 0 },
    ]
    plan.incomeFloor = { ladders: [ladder({ purchase: { year: 2026, fundingAccountId: 'tx1' } })] }
    const result = run(plan)
    const y2026 = result.years.find((y) => y.year === 2026)!
    const build = buildLadder({ annualRealIncome: 10_000, firstPayoutOffset: 1, payoutYears: 5, curve: EMBEDDED_REAL_YIELD_CURVE })
    // Basis ratio 0.5 → half the liquidated cost is realized gain.
    expect(y2026.realizedGains).toBeCloseTo(build.totalCost * 0.5, 0)
  })

  it('scales the ladder down (with a warning) when the funding account is short', () => {
    const plan = basePlan()
    plan.accounts = [cash(20_000)]
    plan.incomeFloor = { ladders: [ladder({ purchase: { year: 2026, fundingAccountId: 'cash1' } })] }
    const result = run(plan)
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.incomes.tipsLadder).toBeGreaterThan(0)
    expect(y2027.incomes.tipsLadder).toBeLessThan(10_000)
    expect(result.warnings.some((w) => w.includes('TIPS ladder purchase exceeded'))).toBe(true)
  })
})

describe('TIPS taxation in the ledger', () => {
  it('taxes coupons as ordinary income but returns maturing principal tax-free', () => {
    const plan = basePlan()
    plan.accounts = [cash(50_000)]
    plan.incomeFloor = { ladders: [ladder({ startYear: 2027, endYear: 2027 })] }
    const result = run(plan)
    const y2027 = result.years.find((y) => y.year === 2027)!
    // ~$10k of cash arrives, but MAGI sees only the small coupon.
    expect(y2027.incomes.tipsLadder).toBeCloseTo(10_000, 6)
    expect(y2027.magi).toBeGreaterThan(0)
    expect(y2027.magi).toBeLessThan(300)
  })

  it('taxes the annual inflation accretion as phantom income', () => {
    const plan = basePlan()
    plan.assumptions.inflationPct = 3
    plan.accounts = [cash(50_000)]
    plan.incomeFloor = { ladders: [ladder({ startYear: 2028, endYear: 2028 })] }
    const result = run(plan)
    // 2027: no maturity, but the outstanding face accretes 3% — taxable now.
    const y2027 = result.years.find((y) => y.year === 2027)!
    const build = buildLadder({ annualRealIncome: 10_000, firstPayoutOffset: 3, payoutYears: 1, curve: EMBEDDED_REAL_YIELD_CURVE })
    const face = build.rungs[0]!.face
    const expectedAccretion = face * (Math.pow(1.03, 2027 - 2026) - Math.pow(1.03, 2026 - 2026))
    const expectedCoupon = face * (build.rungs[0]!.couponRatePct / 100) * Math.pow(1.03, 1)
    expect(y2027.magi).toBeCloseTo(expectedAccretion + expectedCoupon, 0)
  })

  it('raises taxable Social Security through provisional income like any other ordinary income', () => {
    // Age-66 claimant with $24k of SS: alone, none is taxable. A large ladder's
    // coupon interest pushes provisional income over the thresholds, so MAGI
    // rises by MORE than the interest itself — the phase-in the ledger models.
    const base = basePlan()
    base.household.people[0]!.dob = '1960-01-01'
    base.household.people[0]!.retirementAge = 62
    base.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_000, earnings: null, claimAge: { years: 62, months: 0 } },
    ]
    base.accounts = [cash(50_000)]
    const withLadder = structuredClone(base)
    withLadder.incomeFloor = {
      ladders: [ladder({ startYear: 2027, endYear: 2056, annualRealAmount: 40_000 })],
    }
    const baseRun = run(base)
    const ladderRun = run(withLadder)
    const y = (r: typeof baseRun) => r.years.find((yy) => yy.year === 2027)!
    const ladderInterest = y(ladderRun).magi - y(baseRun).magi
    const couponsAlone =
      y(ladderRun).incomes.tipsLadder - 40_000 <= 0 ? y(ladderRun).incomes.tipsLadder : Number.NaN
    // The MAGI delta exceeds any plausible coupon income (≈2.7% of face):
    // taxable SS phased in on top of the interest itself.
    expect(y(baseRun).magi).toBe(0)
    expect(ladderInterest).toBeGreaterThan(20_000)
    expect(Number.isNaN(couponsAlone)).toBe(false)
  })

  it('exempts ladder interest from state tax while equivalent ordinary income is taxed', () => {
    const stateTax = createStateTaxCalculator({ overridePct: 5 })
    const withLadder = basePlan()
    withLadder.accounts = [cash(50_000)]
    withLadder.incomeFloor = { ladders: [ladder({ startYear: 2027, endYear: 2036, annualRealAmount: 20_000 })] }
    const ladderRun = run(withLadder, stateTax)
    const y2027 = ladderRun.years.find((y) => y.year === 2027)!
    // All of the year's ordinary income is U.S.-government interest → $0 state tax.
    expect(y2027.magi).toBeGreaterThan(1_000)
    expect(y2027.tax).toBe(0)

    // Same dollars as recurring ordinary income → taxed at the flat 5%.
    const withRecurring = basePlan()
    withRecurring.accounts = [cash(50_000)]
    withRecurring.incomes = [
      { type: 'recurring', id: 'r1', label: 'Rent', annualAmount: 20_000, startYear: 2027, endYear: 2036, inflationAdjusted: false, taxTreatment: 'ordinary' },
    ]
    const recurringRun = run(withRecurring, stateTax)
    expect(recurringRun.years.find((y) => y.year === 2027)!.tax).toBeCloseTo(1_000, 0)
  })
})
