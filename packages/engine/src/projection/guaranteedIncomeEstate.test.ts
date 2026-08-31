/**
 * Integration coverage for the guaranteed-income and estate-depth plan through
 * the exact ledger: annuity purchase funding, non-qualified exclusion-ratio
 * taxation (IRS Pub 939), qualified/QLAC treatment with RMD-base reduction and
 * the statutory cap, and the after-tax estate breakdown (beneficiary
 * destinations, heir tax by account class, charity carve-outs). Fixtures use
 * sub-65 ages where possible so Medicare premiums don't perturb balances; each
 * behavior carries a feature-off assertion proving pre-existing plans unchanged.
 */
import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { summarizeProjection } from './compare.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `gie-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

/** Single person, born 1966 → age 60 in 2026 (pre-65, pre-RMD); flat dollars. */
function basePlan(planningAge = 95, dob = '1966-01-01'): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge: 60,
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

function traditional(balance: number, id = 'trad1'): Account {
  return {
    type: 'traditional',
    id,
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

const run = (plan: Plan) => simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

describe('annuity purchase — non-qualified exclusion ratio (Pub 939)', () => {
  it('realizes a signed loss when a taxable loss position funds the purchase', () => {
    const plan = basePlan()
    plan.accounts = [
      {
        type: 'taxable',
        id: 'taxable1',
        name: 'Brokerage',
        ownerPersonId: null,
        annualReturnPct: null,
        balance: 100_000,
        costBasis: 200_000,
        annualContribution: 0,
      },
      {
        type: 'annuity',
        id: 'ann1',
        name: 'SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 10_000 / 12,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: 2026,
          premium: 100_000,
          fundingAccountId: 'taxable1',
          taxQualification: 'nonQualified',
        },
      },
    ]

    const year = run(plan).years[0]!

    expect(year.realizedGains).toBe(-100_000)
    expect(year.capitalLossUsedAgainstOrdinary).toBe(3_000)
    expect(year.capitalLossCarryforwardRemaining).toBe(97_000)
  })

  it('taxes only the non-excluded share of each payment, then fully after the investment is recovered', () => {
    // Premium $121,000, $10,000/yr immediate life annuity at age 60. Table V
    // multiple at 60 = 24.2 → expected return $242,000 → exclusion ratio
    // 121,000/242,000 = 0.5 → excludable $5,000/yr, taxable $5,000/yr, for 24.2
    // years (until $121,000 is recovered), then fully taxable ($10,000/yr).
    const plan = basePlan()
    plan.accounts = [
      cash(200_000),
      {
        type: 'annuity',
        id: 'ann1',
        name: 'SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 10_000 / 12,
        colaPct: 0,
        taxablePct: 100, // ignored for a purchased non-qualified annuity
        purchase: { year: 2026, premium: 121_000, fundingAccountId: 'cash1', taxQualification: 'nonQualified' },
      },
    ]
    const result = run(plan)
    const y0 = result.years[0]!
    // Premium left the cash account; gross annuity is the full $10,000.
    expect(y0.incomes.annuity).toBeCloseTo(10_000, 0)
    expect(y0.balances['cash1']).toBeCloseTo(200_000 - 121_000 + 10_000, 0) // remainder + reinvested payment
    // Only the taxable ($5,000) part reaches MAGI.
    expect(y0.magi).toBeCloseTo(5_000, 0)
    // Once the whole $121,000 investment is recovered, payouts are fully taxable.
    const late = result.years.find((y) => y.year === 2055)!
    expect(late.magi).toBeCloseTo(10_000, 0)
  })

  it('a qualified purchase makes every payout fully ordinary income', () => {
    const plan = basePlan()
    plan.accounts = [
      traditional(150_000),
      {
        type: 'annuity',
        id: 'ann1',
        name: 'Qualified SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 10_000 / 12,
        colaPct: 0,
        taxablePct: 0,
        purchase: { year: 2026, premium: 100_000, fundingAccountId: 'trad1', taxQualification: 'qualified' },
      },
    ]
    const y0 = run(plan).years[0]!
    // Fully taxable: the whole $10,000 payment is ordinary income.
    expect(y0.magi).toBeCloseTo(10_000, 0)
    // Premium left the traditional account.
    expect(y0.balances['trad1']).toBeCloseTo(50_000, 0)
  })

  it('does not pay (or cache a zero-investment exclusion state) before the purchase year', () => {
    // startAge 60 → payments would begin in 2026, but the premium is not funded
    // until 2028. Payments must wait for funding; once funded, the exclusion
    // ratio must use the real premium (not a cached investment=0 that would make
    // every payout fully taxable).
    const plan = basePlan()
    plan.accounts = [
      cash(200_000),
      {
        type: 'annuity',
        id: 'ann1',
        name: 'Deferred-funded SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 60,
        monthlyAmount: 10_000 / 12,
        colaPct: 0,
        taxablePct: 100,
        purchase: { year: 2028, premium: 121_000, fundingAccountId: 'cash1', taxQualification: 'nonQualified' },
      },
    ]
    const result = run(plan)
    // No income and no tax before the premium is paid.
    expect(result.years.find((y) => y.year === 2026)!.incomes.annuity).toBeCloseTo(0, 0)
    expect(result.years.find((y) => y.year === 2027)!.incomes.annuity).toBeCloseTo(0, 0)
    const y2028 = result.years.find((y) => y.year === 2028)!
    // Premium leaves cash in 2028; the $10,000 payment is reinvested.
    expect(y2028.balances['cash1']).toBeCloseTo(200_000 - 121_000 + 10_000, 0)
    // Exclusion ratio 121,000/242,000 = 0.5 → only $5,000 is taxable, proving the
    // investment-in-contract was set (not stuck at 0 → fully taxable $10,000).
    expect(y2028.incomes.annuity).toBeCloseTo(10_000, 0)
    expect(y2028.magi).toBeCloseTo(5_000, 0)
  })
})

describe('QLAC — RMD-base reduction and statutory cap', () => {
  it('shrinks a later-year RMD relative to the same plan without the QLAC', () => {
    // Person is 73 in 2026 (RMD age). Buying a QLAC out of the traditional
    // account this year lowers next year's start balance, so 2027's RMD shrinks.
    const plan = basePlan(95, '1953-01-01') // age 73 in 2026
    plan.accounts = [
      traditional(400_000),
      {
        type: 'annuity',
        id: 'qlac1',
        name: 'QLAC',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 83,
        monthlyAmount: 3_000,
        colaPct: 0,
        taxablePct: 100,
        purchase: { year: 2026, premium: 200_000, fundingAccountId: 'trad1', taxQualification: 'qualified', qlac: true },
      },
    ]
    const withQlac = run(plan)
    const noQlacPlan = basePlan(95, '1953-01-01')
    noQlacPlan.accounts = [traditional(400_000)]
    const noQlac = run(noQlacPlan)
    const rmd2027With = withQlac.years.find((y) => y.year === 2027)!.rmd
    const rmd2027Without = noQlac.years.find((y) => y.year === 2027)!.rmd
    expect(rmd2027With).toBeGreaterThan(0)
    expect(rmd2027With).toBeLessThan(rmd2027Without)
  })

  it('caps the premium at the QLAC limit and warns', () => {
    // Sub-RMD age (60) so no RMD perturbs the funding-account balance.
    const plan = basePlan()
    plan.accounts = [
      traditional(400_000),
      {
        type: 'annuity',
        id: 'qlac1',
        name: 'QLAC',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 83,
        monthlyAmount: 3_000,
        colaPct: 0,
        taxablePct: 100,
        purchase: { year: 2026, premium: 300_000, fundingAccountId: 'trad1', taxQualification: 'qualified', qlac: true },
      },
    ]
    const result = run(plan)
    // Only the $210,000 cap left the traditional account, not the full $300,000.
    expect(result.years[0]!.balances['trad1']).toBeCloseTo(400_000 - 210_000, 0)
    expect(result.warnings.some((w) => w.includes('QLAC premium above'))).toBe(true)
  })
})

describe('after-tax estate depth', () => {
  /** One-year plan: person dies after 2026 so ending balances equal start (0 growth, no Medicare). */
  function estatePlan(accounts: Account[], heirTaxRatePct = 25): Plan {
    const plan = basePlan(60) // planningAge 60 = age 60 in 2026 → endYear 2026
    plan.assumptions.heirTaxRatePct = heirTaxRatePct
    plan.accounts = accounts
    return plan
  }

  it('feature-off: a traditional balance is taxed at the flat heir rate, others pass free', () => {
    const plan = estatePlan([traditional(100_000), cash(50_000)])
    const summary = summarizeProjection(validate(plan), run(plan))
    expect(summary.endingEstateHeirTax).toBeCloseTo(25_000, 0)
    expect(summary.endingEstateToCharity).toBe(0)
    expect(summary.endingAfterTaxEstate).toBeCloseTo(150_000 - 25_000, 0)
  })

  it('charity carve-out passes untaxed and leaves the heirs’ estate', () => {
    const trad = {
      ...(traditional(100_000) as Extract<Account, { type: 'traditional' }>),
      estateBeneficiary: { destination: 'charity' as const, charityPct: 100 },
    }
    const plan = estatePlan([trad])
    const summary = summarizeProjection(validate(plan), run(plan))
    // No heir tax (100% to charity); the $100k leaves the heirs' estate.
    expect(summary.endingEstateHeirTax).toBeCloseTo(0, 0)
    expect(summary.endingEstateToCharity).toBeCloseTo(100_000, 0)
    expect(summary.endingAfterTaxEstate).toBeCloseTo(0, 0)
    const row = summary.estateBreakdown.find((b) => b.category === 'traditional')!
    expect(row.destination).toBe('charity')
  })

  it('heir tax by account class overrides the flat rate for that class', () => {
    const plan = estatePlan([traditional(100_000)])
    plan.assumptions.heirTaxByClass = { traditional: 10 }
    const summary = summarizeProjection(validate(plan), run(plan))
    expect(summary.endingEstateHeirTax).toBeCloseTo(10_000, 0)
  })

  it('a spouse-destination traditional account passes untaxed', () => {
    const trad = {
      ...(traditional(100_000) as Extract<Account, { type: 'traditional' }>),
      estateBeneficiary: { destination: 'spouse' as const },
    }
    const plan = estatePlan([trad])
    const summary = summarizeProjection(validate(plan), run(plan))
    expect(summary.endingEstateHeirTax).toBeCloseTo(0, 0)
  })
})

/**
 * Registered rule: the section 72(b) exclusion ratio, and the 72(b)(2) ceiling
 * that stops it once the investment in the contract has been returned.
 */
describe('registered rule: non-qualified annuity exclusion ratio', () => {
  /** 100,000 premium buying 12,000 a year for life from age 66 (Table V = 19.2). */
  function exclusionRatioPlan(): Plan {
    const plan = basePlan(95, '1960-01-01') // age 66 in 2026
    plan.accounts = [
      cash(100_000),
      {
        type: 'annuity',
        id: 'ann1',
        name: 'Non-qualified SPIA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        startAge: 66,
        monthlyAmount: 1_000,
        colaPct: 0,
        taxablePct: 100, // ignored for a purchased non-qualified annuity
        purchase: {
          year: 2026,
          premium: 100_000,
          fundingAccountId: 'cash1',
          taxQualification: 'nonQualified',
        },
      },
    ]
    return plan
  }

  // IRC 72(b)(1) excludes the share of each payment that the investment in the
  // contract bears to the expected return, both measured once at the annuity
  // starting date. Treas. Reg. 1.72-9 sends any contract holding post-June-1986
  // money to Table V, and the difference from the older Table I is a third of
  // the expected return: 1.72-5(a)(1) works the same age-66 life through both.
  //
  //   Table V, age 66 = 19.2 -> expected return 230,400, ratio 0.43403,
  //     excluded 5,208.33, taxable 6,791.67
  //   Table I, male age 66 = 14.4 -> expected return 172,800, taxable 5,055.56
  //   return of premium first -> nothing taxable at all
  describeRule('irc-72-b-annuity-exclusion-ratio', {
    readings: {
      tableVExclusionRatio: 6_791.67,
      preJulyNineteenEightySixTableI: 5_055.56,
      returnOfPremiumFirst: 0,
    },
    accepted: 'tableVExclusionRatio',
  }, ({ accepted, readings }) => {
    it('taxes each payment net of the ratio fixed at the annuity starting date', () => {
      const y2026 = run(exclusionRatioPlan()).years.find((y) => y.year === 2026)!

      expect(y2026.magi).toBeCloseTo(accepted, 2)
      expect(y2026.magi).not.toBeCloseTo(readings.preJulyNineteenEightySixTableI, 2)
      expect(y2026.magi).not.toBeCloseTo(readings.returnOfPremiumFirst, 2)
    })
  })

  // IRC 72(b)(2) caps the cumulative exclusion at the unrecovered investment,
  // so the shelter stops rather than running for as long as the annuitant does.
  // An uncapped ratio is the natural misreading and it never stops sheltering.
  //
  // 100,000 of investment is returned after 19.2 years at 5,208.33 a year, so
  // by the 25th payment year nothing is excludable and the whole 12,000 is
  // taxable.
  describeRule('irc-72-b-annuity-exclusion-ratio', {
    readings: { cappedAtUnrecoveredInvestment: 12_000, uncappedRatioForever: 6_791.67 },
    accepted: 'cappedAtUnrecoveredInvestment',
  }, ({ accepted, readings }) => {
    it('taxes the whole payment once the investment in the contract is recovered', () => {
      const years = run(exclusionRatioPlan()).years
      const y2050 = years.find((y) => y.year === 2050)! // 25th payment year

      expect(y2050.magi).toBeCloseTo(accepted, 2)
      expect(y2050.magi).not.toBeCloseTo(readings.uncappedRatioForever, 2)
      // The crossing year is partial: the last 1,041.67 of investment is used up.
      expect(years.find((y) => y.year === 2045)!.magi).toBeCloseTo(12_000 - 1_041.67, 2)
    })
  })
})
