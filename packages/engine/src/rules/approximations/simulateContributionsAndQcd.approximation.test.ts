import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

let counter = 0
const testIds = (): string => `approx-sim-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

const noTax = createFlatTaxCalculator(0)
const pack2026 = packForYear(2026).pack

/** One person, flat dollars: every figure below is the statutory one, unindexed. */
function soloPlan(dob: string, retirementAge: number | null): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge,
    longevity: { planningAge: 95, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  return plan
}

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    annualContribution: 0,
  }
}

function traditionalIra(balance: number, contribution = 0, owner = 'p1'): Account {
  return {
    type: 'traditional',
    id: testIds(),
    name: 'IRA',
    ownerPersonId: owner,
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: contribution,
  }
}

function rothIra(balance: number, contribution = 0, owner = 'p1'): Account {
  return {
    type: 'roth',
    id: testIds(),
    name: 'Roth IRA',
    ownerPersonId: owner,
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: contribution,
  }
}

function wages(annualGross: number, personId = 'p1'): IncomeStream {
  return { type: 'wages', id: testIds(), personId, annualGross, endAge: null, realGrowthPct: 0 }
}

/**
 * Net earnings from a trade or business, the only shape a plan has for
 * self-employment: an ordinary recurring stream with no person attached.
 */
function selfEmploymentEarnings(annualAmount: number): IncomeStream {
  return {
    type: 'recurring',
    id: testIds(),
    label: 'Consulting net earnings from self-employment',
    annualAmount,
    startYear: null,
    endYear: null,
    inflationAdjusted: false,
    taxTreatment: 'ordinary',
  }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function year2026(plan: Plan) {
  const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
  return result.years.find((y) => y.year === 2026)!
}

// Deliberately below the 219(b)(1) dollar limit, so nothing in either fixture
// below turns on the limit itself: the whole requested amount is allowable on
// the accepted reading, and the readings differ only over the gap being pinned.
const REQUESTED_IRA_CONTRIBUTION = 5_000

// --------------------------------------------------------------------------
// Roth contribution AGI phase-out
// --------------------------------------------------------------------------

describeRule('irc-408A-c-3-roth-contribution-agi-phase-out', {
  readings: {
    // 408A(c)(3)(A): the (2)(A) amount reduced ratably once AGI passes the
    // applicable dollar amount, over a 15,000 dollar band for a single filer.
    // 400,000 dollars of wages clears the top of that band several times over
    // under any published applicable dollar amount, so the limit is zero and
    // no part of the requested contribution is permitted.
    statutePhasesTheLimitToZero: 0,
    engineAllowsTheContributionAtAnyIncome: REQUESTED_IRA_CONTRIBUTION,
  },
  accepted: 'statutePhasesTheLimitToZero',
  produced: 'engineAllowsTheContributionAtAnyIncome',
}, ({ accepted, produced }) => {
  it('funds a Roth IRA for a single filer far above the phase-out range', () => {
    const plan = soloPlan('1966-06-15', 67) // 60 in 2026, still earning
    plan.accounts = [cash(0), rothIra(0, REQUESTED_IRA_CONTRIBUTION)]
    plan.incomes = [wages(400_000)]

    const year = year2026(plan)

    expect(year.contributions).toBeCloseTo(produced, 6)
    expect(year.contributions).not.toBeCloseTo(accepted, 6)
  })

  it('charges the same contribution at an income the phase-out does not reach', () => {
    // The control. Without it the fixture above could be read as pinning the
    // dollar limit or the compensation prong rather than the missing
    // reduction: this run differs only in the wage figure and lands on the
    // same number, which is exactly the ratable reduction failing to appear.
    const plan = soloPlan('1966-06-15', 67)
    plan.accounts = [cash(0), rothIra(0, REQUESTED_IRA_CONTRIBUTION)]
    plan.incomes = [wages(40_000)]

    expect(year2026(plan).contributions).toBeCloseTo(REQUESTED_IRA_CONTRIBUTION, 6)
  })
})

// --------------------------------------------------------------------------
// Self-employment earned income as compensation
// --------------------------------------------------------------------------

describeRule('irc-401-c-2-earned-income-not-modeled', {
  readings: {
    // 219(f)(1) reads compensation to include 401(c)(2) earned income, so
    // 80,000 dollars of net earnings from a consulting business supports the
    // whole requested contribution under 219(b)(1)(B).
    statuteEarnedIncomeIsCompensation: REQUESTED_IRA_CONTRIBUTION,
    engineModelsWagesOnly: 0,
  },
  accepted: 'statuteEarnedIncomeIsCompensation',
  produced: 'engineModelsWagesOnly',
}, ({ accepted, produced }) => {
  it('denies IRA contribution room to a household whose only earnings are self-employment', () => {
    const plan = soloPlan('1966-06-15', 67)
    plan.accounts = [cash(50_000), traditionalIra(0, REQUESTED_IRA_CONTRIBUTION)]
    plan.incomes = [selfEmploymentEarnings(80_000)]

    const year = year2026(plan)

    expect(year.contributions).toBeCloseTo(produced, 6)
    expect(year.contributions).not.toBeCloseTo(accepted, 6)
  })

  it('allows the identical amount when the same dollars arrive as wages', () => {
    // The control, and what makes the zero above mean something. Same person,
    // same account, same requested amount, same dollar total of ordinary
    // income — only the stream type changes, and the contribution appears.
    const plan = soloPlan('1966-06-15', 67)
    plan.accounts = [cash(50_000), traditionalIra(0, REQUESTED_IRA_CONTRIBUTION)]
    plan.incomes = [wages(80_000)]

    expect(year2026(plan).contributions).toBeCloseTo(accepted, 6)
  })
})

// --------------------------------------------------------------------------
// Household substitution for the individual donor
// --------------------------------------------------------------------------

/** One indexed annual QCD limit, the figure the ledger applies once per household. */
const QCD_LIMIT = pack2026.rmd.qcdAnnualLimit

describeRule('irc-408-d-8-A-projection-household-qcd-aggregation', {
  readings: {
    // 408(d)(8)(A) limits the exclusion "with respect to a taxpayer". Two
    // spouses filing jointly are two taxpayers, each with their own IRA large
    // enough to fund a whole limit, so the joint return excludes two of them.
    statuteOneLimitPerTaxpayer: QCD_LIMIT * 2,
    engineOneLimitPerHousehold: QCD_LIMIT,
  },
  accepted: 'statuteOneLimitPerTaxpayer',
  produced: 'engineOneLimitPerHousehold',
  note: 'one annual dollar limit for two donors',
}, ({ accepted, produced }) => {
  it('caps two spouses giving from their own IRAs at a single annual limit', () => {
    const plan = soloPlan('1946-06-15', null) // 80 in 2026, past the applicable age
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1946-06-15',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    plan.accounts = [
      cash(0),
      traditionalIra(3_000_000, 0, 'p1'),
      traditionalIra(3_000_000, 0, 'p2'),
    ]
    plan.strategies.qcdAnnual = QCD_LIMIT * 2

    const year = year2026(plan)

    // Each spouse's own required distribution alone exceeds a whole limit, so
    // the accepted reading is fundable twice over from separate IRAs and the
    // shortfall below cannot be blamed on either IRA running dry.
    expect(year.rmd).toBeGreaterThan(QCD_LIMIT * 2)
    expect(year.qcd).toBeCloseTo(produced, 6)
    expect(year.qcd).not.toBeCloseTo(accepted, 6)
  })
})

// --------------------------------------------------------------------------
// QCD ordered after pro-rata basis recovery
// --------------------------------------------------------------------------

// A 265,000 dollar IRA at age 73 distributes 265,000 / 26.5 = 10,000, of which
// 20 percent is basis under the Form 8606 fraction below.
const IRA_BALANCE = 265_000
const IRA_BASIS = 53_000
const REQUIRED_DISTRIBUTION = IRA_BALANCE / 26.5
const GIFT = 5_000

describeRule('irc-408-d-8-D-projection-qcd-after-pro-rata', {
  readings: {
    // 408(d)(8)(D): the gift is deemed to consist of includible dollars, so it
    // leaves section 72 entirely and the whole 20 percent basis fraction lands
    // on the other 5,000 dollars. 5,000 - 1,000 = 4,000 of ordinary income.
    statuteQcdComesOutOfPreTaxFirst: 4_000,
    // The ledger pro-rates all 10,000 first (2,000 of basis returned) and then
    // subtracts the whole gift: 10,000 - 2,000 - 5,000 = 3,000.
    engineProRatesTheWholeDistributionFirst: 3_000,
  },
  accepted: 'statuteQcdComesOutOfPreTaxFirst',
  produced: 'engineProRatesTheWholeDistributionFirst',
}, ({ accepted, produced }) => {
  it('spends basis on the charitable half of the required distribution', () => {
    const plan = soloPlan('1953-06-15', null) // 73 in 2026, first RMD year
    plan.accounts = [
      cash(0),
      { ...(traditionalIra(IRA_BALANCE) as Extract<Account, { type: 'traditional' }>), nondeductibleBasis: IRA_BASIS },
    ]
    plan.strategies.qcdAnnual = GIFT

    const year = year2026(plan)

    // Both readings depend on this exact distribution and this exact gift; if
    // either moved, the two figures below would stop being 4,000 and 3,000.
    expect(year.rmd).toBeCloseTo(REQUIRED_DISTRIBUTION, 6)
    expect(year.qcd).toBeCloseTo(GIFT, 6)
    expect(year.magi).toBeCloseTo(produced, 6)
    expect(year.magi).not.toBeCloseTo(accepted, 6)
  })
})
