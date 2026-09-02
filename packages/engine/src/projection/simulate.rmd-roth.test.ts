import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import {
  type Account,
  type Plan,
} from '../model/plan.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import {
  basePlan,
  cash,
  currentYearAca,
  noTax,
  testIds,
  traditional,
  traditionalIra,
  validate,
} from './simulate.test-support.js'

describe('RMDs', () => {
  /** Born 1953 -> RMD start age 73 -> first RMD in 2026 in these tests. */
  function rmdPlan(): Plan {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1953-06-15'
    plan.household.people[0]!.retirementAge = null
    plan.accounts = [cash(0), traditional(265_000)]
    return plan
  }

  it('forces distributions from the prior-year balance and reinvests the excess', () => {
    const plan = rmdPlan()
    const cashId = plan.accounts[0]!.id
    const traditionalId = plan.accounts[1]!.id
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    const y2026 = result.years.find((y) => y.year === 2026)! // age 73
    expect(y2026.rmd).toBeCloseTo(265_000 / 26.5, 6) // 10,000
    expect(y2026.withdrawals.traditional).toBeCloseTo(10_000, 6)
    expect(y2026.balances[traditionalId]).toBeCloseTo(255_000, 6)
    // 65+: standard Part B is charged automatically; the rest of the RMD lands in cash.
    expect(y2026.expenses.healthcare).toBeCloseTo(202.9 * 12, 6)
    expect(y2026.surplusInvested).toBeCloseTo(10_000 - 202.9 * 12, 6)
    expect(y2026.balances[cashId]).toBeCloseTo(10_000 - 202.9 * 12, 6)

    const y2027 = result.years.find((y) => y.year === 2027)! // age 74, divisor 25.5
    expect(y2027.rmd).toBeCloseTo(255_000 / 25.5, 6) // exactly 10,000 again
  })

  // IRC 402(a): the 2026 amount is not actually distributed until the April
  // 1, 2027 deadline. The 2027 RMD is separately due by December 31, so the
  // receipt-year ordinary-income worksheet is 265,000 / 26.5 + 265,000 / 25.5.
  describeRule('irc-402-a-employer-plan-distribution-receipt-year-taxability', {
    readings: {
      receiptYearIncludesTheDeferredAndCurrentRmd: {
        magi2026: 0,
        magi2027: 265_000 / 26.5 + 265_000 / 25.5,
      },
      rejectedDistributionCalendarYearIncludesTheFirstRmd: {
        magi2026: 265_000 / 26.5,
        magi2027: 265_000 / 25.5,
      },
    },
    accepted: 'receiptYearIncludesTheDeferredAndCurrentRmd',
    note: 'April 1 first-RMD deferral receipt-year income',
  }, ({ accepted, readings }) => {
    it('books the deferred employer-plan RMD as ordinary income in the following receipt year', () => {
      const plan = rmdPlan()
      const cashAccount = plan.accounts[0]!
      const employerPlan = plan.accounts[1]!
      if (cashAccount.type !== 'cash' ||
          employerPlan.type !== 'traditional' ||
          employerPlan.kind !== 'employer') {
        throw new Error('expected cash and employer-plan RMD fixture accounts')
      }
      // Keep Medicare spending from producing an unrelated traditional draw.
      cashAccount.balance = 1_000_000
      const result = simulatePlan(validate(plan), {
        startYear: 2026,
        horizonEndYear: 2027,
        taxCalculator: noTax,
        rmdFirstYearDeferrals: [{
          distributionCalendarYear: 2026,
          applicablePlan: { kind: 'employerPlan', accountId: employerPlan.id },
        }],
      })
      const y2026 = result.years.find((year) => year.year === 2026)!
      const y2027 = result.years.find((year) => year.year === 2027)!

      expect(y2026.rmd).toBe(0)
      expect(y2026.magi).toBeCloseTo(accepted.magi2026, 8)
      expect(y2026.magi).not.toBeCloseTo(
        readings.rejectedDistributionCalendarYearIncludesTheFirstRmd.magi2026,
        8,
      )
      expect(y2027.rmd).toBeCloseTo(accepted.magi2027, 8)
      expect(y2027.magi).toBeCloseTo(accepted.magi2027, 8)
      expect(y2027.magi).not.toBeCloseTo(
        readings.rejectedDistributionCalendarYearIncludesTheFirstRmd.magi2027,
        8,
      )
    })
  })

  // Treas. Reg. 1.408-8(e)(1)(i) calculates the RMD separately for each IRA
  // but requires "the sum of those separately calculated required minimum
  // distributions" to be distributed from one or more of the owner's IRAs.
  // Flooring each account at its own balance drops the difference: the annuity
  // premium, the rebalance and the TIPS-ladder passes all run before the RMD
  // block and can empty an account whose RMD base was the prior Dec 31
  // balance, so the shortfall is reachable and understates forced ordinary
  // income. It compounds through the Roth conversion pass immediately after,
  // which 1.408A-4 A-6(b) bars from converting while an RMD is unsatisfied.
  //
  // Aggregation is IRA-only. Under (e)(2)(i) only IRAs held as owner
  // aggregate, and (e)(3) keeps IRAs apart from other arrangements, so an
  // employer plan must still distribute its own amount and can neither absorb
  // nor supply someone else's shortfall.
  //
  // Born 1953 -> age 73 in 2026 -> divisor 26.5. IRA A 265,000 (RMD 10,000) is
  // emptied by a qualified annuity premium; IRA B 530,000 (RMD 20,000); a
  // 401(k) of 265,000 (RMD 10,000):
  //   sum distributed from the owner's IRAs: B pays 30,000, plan pays 10,000
  //   shortfall dropped at the account floor: B pays 20,000, plan pays 10,000
  //   shortfall swept into the 401(k) too:    B pays 20,000, plan pays 20,000
  describeRule('treas-reg-1-408-8-e-1-i-aggregate-ira-rmd-sum', {
    readings: {
      sumFromTheOwnersIras: { ira: 500_000, employerPlan: 255_000, rmd: 40_000 },
      shortfallDroppedAtTheAccountFloor: { ira: 510_000, employerPlan: 255_000, rmd: 30_000 },
      shortfallSweptIntoTheEmployerPlan: { ira: 510_000, employerPlan: 245_000, rmd: 40_000 },
    },
    accepted: 'sumFromTheOwnersIras',
  }, ({ accepted, readings }) => {
    it('takes an emptied IRA share from the owner other IRAs, not from the employer plan', () => {
      const plan = basePlan()
      plan.household.people[0]!.dob = '1953-06-15'
      plan.household.people[0]!.retirementAge = null
      plan.accounts = [
        cash(0),
        {
          type: 'traditional', kind: 'ira', id: 'ira-a', name: 'IRA A',
          ownerPersonId: 'p1', annualReturnPct: 0, balance: 265_000, annualContribution: 0,
        },
        {
          type: 'traditional', kind: 'ira', id: 'ira-b', name: 'IRA B',
          ownerPersonId: 'p1', annualReturnPct: 0, balance: 530_000, annualContribution: 0,
        },
        {
          type: 'traditional', kind: 'employer', id: 'plan-e', name: '401k',
          ownerPersonId: 'p1', annualReturnPct: 0, balance: 265_000, annualContribution: 0,
        },
        {
          type: 'annuity', id: 'ann1', name: 'Qualified annuity',
          ownerPersonId: 'p1', annualReturnPct: null,
          // The owner turns 73 in 2026, so nothing is paid in the year under
          // test. 74 is the latest a qualified purchase that is not a QLAC may
          // carry for a 1953 birth: it may not defer past the required
          // beginning date.
          startAge: 74, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          // Empties IRA A after its RMD base was fixed at the prior Dec 31
          // balance, which is exactly the reachable shortfall.
          purchase: {
            year: 2026, premium: 265_000,
            fundingAccountId: 'ira-a', taxQualification: 'qualified',
          },
        },
      ]

      const year = simulatePlan(validate(plan), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      expect(year.balances['ira-a']).toBeCloseTo(0, 6)
      expect(year.balances['ira-b']).toBeCloseTo(accepted.ira, 6)
      expect(year.balances['plan-e']).toBeCloseTo(accepted.employerPlan, 6)
      expect(year.rmd).toBeCloseTo(accepted.rmd, 6)
      expect(year.balances['ira-b'])
        .not.toBeCloseTo(readings.shortfallDroppedAtTheAccountFloor.ira, 6)
      expect(year.balances['plan-e'])
        .not.toBeCloseTo(readings.shortfallSweptIntoTheEmployerPlan.employerPlan, 6)
    })

    it('never reaches into the other spouse IRAs to cover a shortfall', () => {
      // 1.408-8(e)(2)(i) aggregates only the IRAs an individual holds as
      // owner. There is no household aggregation, so an unmet amount stops at
      // the owner's own IRAs even when the spouse holds an untouched one.
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people[0]!.dob = '1953-06-15'
      plan.household.people[0]!.retirementAge = null
      plan.household.people.push({
        id: 'p2', name: 'Sam', dob: '1953-06-15', sex: 'average',
        retirementAge: null, longevity: { planningAge: 90, source: 'manual' },
      })
      plan.accounts = [
        cash(0),
        {
          type: 'traditional', kind: 'ira', id: 'ira-a', name: 'IRA A',
          ownerPersonId: 'p1', annualReturnPct: 0, balance: 265_000, annualContribution: 0,
        },
        {
          type: 'traditional', kind: 'ira', id: 'ira-d', name: 'IRA D',
          ownerPersonId: 'p2', annualReturnPct: 0, balance: 530_000, annualContribution: 0,
        },
        {
          type: 'annuity', id: 'ann1', name: 'Qualified annuity',
          ownerPersonId: 'p1', annualReturnPct: null,
          // As above: the latest start a qualified non-QLAC purchase may carry
          // for this owner, which still leaves the year under test unpaid.
          startAge: 74, monthlyAmount: 1_000, colaPct: 0, taxablePct: 100,
          purchase: {
            year: 2026, premium: 265_000,
            fundingAccountId: 'ira-a', taxQualification: 'qualified',
          },
        },
      ]

      const year = simulatePlan(validate(plan), {
        startYear: 2026, horizonEndYear: 2026, taxCalculator: noTax,
      }).years[0]!

      // Only Sam's own 20,000 comes out; Pat's unmet 10,000 has nowhere to go.
      expect(year.balances['ira-d']).toBeCloseTo(510_000, 6)
      expect(year.rmd).toBeCloseTo(20_000, 6)
    })
  })

  it('does not force distributions before the start age (born 1960 -> 75)', () => {
    const plan = rmdPlan()
    plan.household.people[0]!.dob = '1960-06-15'
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years.find((y) => y.year === 2034)!.rmd).toBe(0) // age 74
    expect(result.years.find((y) => y.year === 2035)!.rmd).toBeGreaterThan(0) // age 75
  })

  it('uses the joint-life divisor only when the spouse is flagged sole beneficiary', () => {
    const make = (soleBeneficiary: boolean): Plan => {
      const plan = basePlan()
      plan.household.filingStatus = 'marriedFilingJointly'
      plan.household.people = [
        { id: 'p1', name: 'A', dob: '1953-06-15', sex: 'male', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } },
        { id: 'p2', name: 'B', dob: '1970-06-15', sex: 'female', retirementAge: null, longevity: { planningAge: 95, source: 'manual' } }, // 17 yrs younger
      ]
      plan.accounts = [cash(0), { ...(traditional(265_000, 0, 'p1') as Extract<Account, { type: 'traditional' }>), spouseSoleBeneficiary: soleBeneficiary }]
      return validate(plan)
    }
    const flagged = simulatePlan(make(true), { startYear: 2026, taxCalculator: noTax }).years.find((y) => y.year === 2026)!.rmd
    const unflagged = simulatePlan(make(false), { startYear: 2026, taxCalculator: noTax }).years.find((y) => y.year === 2026)!.rmd
    expect(unflagged).toBeCloseTo(265_000 / 26.5, 6) // Uniform Lifetime Table
    expect(flagged).toBeGreaterThan(0)
    expect(flagged).toBeLessThan(unflagged) // joint-life divisor is larger → smaller RMD
  })

  it('skips one-time goals once everyone has died on an extended horizon', () => {
    const plan = basePlan() // single person p1, born 1966
    plan.expenses.baseAnnual = 0
    plan.expenses.oneTimeGoals = [{ id: 'g', label: 'Post-death goal', year: 2056, amount: 100_000 }] // age 90
    plan.accounts = [cash(500_000)]
    const result = simulatePlan(validate(plan), {
      startYear: 2026,
      taxCalculator: noTax,
      deathAgeByPersonId: { p1: 80 }, // dies at 80 (2046)
      horizonEndYear: 2066, // run to age 100
    })
    expect(result.years.find((y) => y.year === 2056)!.expenses.oneTimeGoals).toBe(0) // post-death: not charged
  })

  it('treats RMD income as taxable ordinary income', () => {
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(rmdPlan()), { startYear: 2026, taxCalculator: flat10 })

    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.tax).toBeCloseTo(1_000, 6) // 10% of the 10,000 RMD
    expect(y2026.surplusInvested).toBeCloseTo(9_000 - y2026.expenses.healthcare, 6)
  })

  // The source has to be an IRA: IRC 408(d)(8)(B) reaches only "any distribution
  // from an individual retirement plan", so the 401(k) that rmdPlan() otherwise
  // holds could never carry a gift out of income. Same balance and same divisor,
  // so the RMD is still 10,000 -- only its eligibility changes.
  it('routes QCD dollars out of the IRA RMD, untaxed', () => {
    const plan = rmdPlan()
    plan.accounts = [cash(0), traditionalIra(265_000)]
    plan.strategies.qcdAnnual = 4_000
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat10 })

    const y2026 = result.years.find((y) => y.year === 2026)! // age 73 ≥ 71: eligible
    expect(y2026.rmd).toBeCloseTo(10_000, 6)
    expect(y2026.qcd).toBeCloseTo(4_000, 6)
    expect(y2026.tax).toBeCloseTo(600, 6) // 10% of the remaining 6,000
    expect(y2026.magi).toBeCloseTo(6_000, 6)
  })

  // The negative half of the same rule, on the fixture that used to assert the
  // wrong thing: an employer-plan RMD is ineligible however large it is.
  it('refuses to route QCD dollars out of an employer-plan RMD', () => {
    const plan = rmdPlan() // cash + a 401(k), no IRA anywhere
    plan.strategies.qcdAnnual = 4_000
    const flat10 = createFlatTaxCalculator(10)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat10 })

    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.rmd).toBeCloseTo(10_000, 6)
    expect(y2026.qcd).toBe(0)
    expect(y2026.magi).toBeCloseTo(10_000, 6) // the whole RMD stays in income
  })
})

describe('Roth conversions', () => {
  function roth(balance: number): Account {
    return { type: 'roth', id: testIds(), name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance, annualContribution: 0 }
  }

  function retireePlan(): Plan {
    const plan = basePlan()
    plan.household.people[0]! = {
      ...plan.household.people[0]!,
      dob: '1960-06-15', // 66 in 2026; RMDs not until 75
      retirementAge: null,
    }
    return plan
  }

  it('executes manual conversions: balances move, income is taxed, no penalty', () => {
    const plan = retireePlan()
    plan.accounts = [cash(200_000), traditional(500_000), roth(0)]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2027, amount: 50_000 }] }
    const flat20 = createFlatTaxCalculator(20)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: flat20 })

    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.rothConversion).toBe(50_000)
    expect(y2027.balances[plan.accounts[1]!.id]).toBeCloseTo(450_000, 6)
    expect(y2027.balances[plan.accounts[2]!.id]).toBeCloseTo(50_000, 6)
    expect(y2027.tax).toBeCloseTo(10_000, 6)
    expect(y2027.penalties).toBe(0)
    expect(y2027.magi).toBeCloseTo(50_000, 6)
    // Conversion tax + Medicare premiums came out of cash, not the conversion.
    expect(y2027.withdrawals.traditional).toBe(0)
  })

  it('skips conversions with a warning when no Roth account exists', () => {
    const plan = retireePlan()
    plan.accounts = [cash(200_000), traditional(500_000)]
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 50_000 }] }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

    expect(result.years[0]!.rothConversion).toBe(0)
    expect(result.warnings.join(' ')).toContain('no Roth account')
  })

  it('fills to the top of the 12% bracket under the federal engine', () => {
    const plan = retireePlan()
    plan.accounts = [cash(300_000), traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: 2026,
      endYear: 2026,
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    const y1 = result.years[0]!
    // Deductions at 66: 16,100 + 2,050 + 6,000 senior = 24,150; top of 12% = 50,400.
    expect(y1.rothConversion).toBeCloseTo(74_550, 0)
    expect(y1.magi).toBeCloseTo(74_550, 0)
    // Outside the window: nothing converts.
    expect(result.years.find((y) => y.year === 2027)!.rothConversion).toBe(0)
  })

  it('fills to the ACA cliff for a pre-65 retiree', () => {
    const plan = basePlan() // born 1966 -> 60 in 2026
    currentYearAca(plan)
    plan.accounts = [cash(300_000), traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'acaCliff',
      targetValue: null,
      startYear: 2026,
      endYear: 2026,
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    expect(result.years[0]!.rothConversion).toBeCloseTo(15_650 * 4, 0)
  })

  it('warns when spending withdrawals push income past the conversion target', () => {
    const plan = retireePlan()
    plan.expenses.baseAnnual = 100_000
    plan.accounts = [traditional(1_000_000), roth(0)]
    plan.strategies.rothConversion = {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: 2026,
      endYear: 2030,
    }
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: createFederalTaxCalculator() })

    expect(result.years[0]!.rothConversion).toBeGreaterThan(0)
    expect(result.years[0]!.withdrawals.traditional).toBeGreaterThan(0)
    expect(result.warnings.join(' ')).toContain('above the Roth-conversion target')
  })
})

/**
 * Registered rules covering the two things the annual ledger fixes about a
 * required distribution: the balance it is computed on, and its position
 * relative to a Roth conversion.
 */
describe('registered rules: RMD base and RMD-before-conversion ordering', () => {
  /** Born 1953 -> applicable age 73 -> first distribution calendar year 2026. */
  function rmdBasePlan(): Plan {
    const plan = basePlan()
    plan.household.people[0]!.dob = '1953-06-15'
    plan.household.people[0]!.retirementAge = null
    return plan
  }

  // Treas. Reg. 1.408-8(b)(2) fixes the numerator at the prior 31 December
  // balance and forbids any adjustment for contributions or distributions
  // after that date, so money that leaves the account in January does not
  // shrink the amount required for that same year. Recomputing on the balance
  // standing when the distribution is taken is the natural misreading, and it
  // is what an engine that reaches for the live balance would do.
  //
  // Prior year-end balance 265,000, denominator 26.5 at age 73. A qualified
  // annuity premium of 132,500 leaves the same IRA earlier in 2026:
  //   prior 31 December balance:  265,000 / 26.5 = 10,000
  //   balance at the distribution: 132,500 / 26.5 =  5,000
  describeRule('treas-reg-1-408-8-b-2-prior-december-31-balance', {
    readings: { priorDecemberThirtyFirstBalance: 10_000, balanceWhenTheDistributionIsTaken: 5_000 },
    accepted: 'priorDecemberThirtyFirstBalance',
  }, ({ accepted, readings }) => {
    it('computes the RMD on the untouched prior year-end balance', () => {
      const plan = rmdBasePlan()
      plan.accounts = [
        cash(0),
        // kind 'ira' is load-bearing, not decoration: 1.408-8 is a section 408
        // regulation, and the local `traditional` helper builds a 401(k). An
        // employer account would pin 1.401(a)(9)-5 and leave the cited rule
        // uncovered if the two paths ever part.
        {
          ...(traditional(265_000) as Extract<Account, { type: 'traditional' }>),
          id: 'trad-rmd-base', name: 'Traditional IRA', kind: 'ira',
        },
        {
          type: 'annuity',
          id: 'ann-rmd-base',
          name: 'Qualified SPIA',
          ownerPersonId: 'p1',
          annualReturnPct: null,
          // The owner is 73 in 2026, so no payment lands in the year under test
          // and only the premium leaves the IRA. 74 is the latest start a
          // qualified purchase that is not a QLAC may carry for this owner.
          startAge: 74,
          monthlyAmount: 1_000,
          colaPct: 0,
          taxablePct: 0,
          purchase: {
            year: 2026,
            premium: 132_500,
            fundingAccountId: 'trad-rmd-base',
            taxQualification: 'qualified',
          },
        },
      ]
      const y2026 = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
        .years.find((y) => y.year === 2026)!

      expect(y2026.rmd).toBeCloseTo(accepted, 6)
      expect(y2026.rmd).not.toBeCloseTo(readings.balanceWhenTheDistributionIsTaken, 6)
      // Premium out, then the full RMD out of what is left.
      expect(y2026.balances['trad-rmd-base']).toBeCloseTo(265_000 - 132_500 - 10_000, 6)
    })
  })

  // Treas. Reg. 1.408A-4, A-6 makes the first dollars distributed in a year for
  // which an RMD is required the RMD itself, and section 408(d)(3) bars rolling
  // an RMD over, so nothing may be converted until the whole required amount
  // has come out. Treating the two flows as independent is the natural
  // misreading and it produces an excess Roth contribution the size of the RMD.
  //
  // Prior year-end balance 265,000, RMD 10,000, and a manual conversion request
  // for the entire 265,000:
  //   RMD first:            265,000 - 10,000 = 255,000 convertible
  //   flows independent:    the whole 265,000 converts
  describeRule('treas-reg-1-408A-4-a-6-rmd-precedes-conversion', {
    readings: { rmdIsTheFirstDollarsOut: 255_000, everyDollarConvertible: 265_000 },
    accepted: 'rmdIsTheFirstDollarsOut',
  }, ({ accepted, readings }) => {
    it('satisfies the whole RMD before any dollar becomes a conversion', () => {
      const plan = rmdBasePlan()
      plan.accounts = [
        cash(0),
        // 1.408A-4 governs a conversion out of a traditional IRA, so the source
        // has to be one. The local `traditional` helper builds a 401(k), whose
        // route into a Roth is a rollover under a different authority.
        {
          ...(traditional(265_000) as Extract<Account, { type: 'traditional' }>),
          id: 'trad-order', name: 'Traditional IRA', kind: 'ira',
        },
        {
          type: 'roth',
          id: 'roth-order',
          name: 'Roth',
          ownerPersonId: 'p1',
          annualReturnPct: null,
          kind: 'ira',
          balance: 0,
          annualContribution: 0,
        },
      ]
      plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 265_000 }] }
      const y2026 = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
        .years.find((y) => y.year === 2026)!

      expect(y2026.rmd).toBeCloseTo(10_000, 6)
      expect(y2026.rothConversion).toBeCloseTo(accepted, 6)
      expect(y2026.rothConversion).not.toBeCloseTo(readings.everyDollarConvertible, 6)
      expect(y2026.balances['trad-order']).toBeCloseTo(0, 6)
    })
  })
})
