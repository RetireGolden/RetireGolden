import { describe, expect, it } from 'vitest'

import type { QualifiedCharitableDistributionRequest } from '../../actions/contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from '../../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../../actions/money.js'
import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

let counter = 0
const testIds = (): string => `approx-sim-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

const noTax = createFlatTaxCalculator(0)
const fullFlatTax = createFlatTaxCalculator(100)
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

function employerTraditional(balance: number, contribution = 0): Account {
  return {
    type: 'traditional',
    id: testIds(),
    name: 'Employer plan',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    kind: 'employer',
    employerPlanType: '401k',
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

function year2026(plan: Plan, taxCalculator = noTax) {
  const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator })
  return result.years.find((y) => y.year === 2026)!
}

// IRC 401(a)(17) / Notice 2025-67: 2026 compensation taken into account is
// capped at 360,000. A 100%-of-deferral match capped at 6% of pay on 500,000
// of wages with a 24,500 elective yields match of 24,500 on uncapped wages
// (min(24,500, 0.06 × 500,000)), but only 21,600 once wages are capped at
// 360,000 (0.06 × 360,000). Section 415(c) does not repair it: 24,500 + 24,500
// stays under the 72,000 annual-additions limit.
// Observed produced pin (fixture run 2026-08-26): employerMatch stays at the
// uncapped 24,500 figure.
const producedUncapped401a17Match = 24_500

describeRule('irc-401-a-17-plan-compensation-cap', {
  readings: {
    matchOnCappedCompensation: 21_600,
    matchOnUncappedWages: producedUncapped401a17Match,
  },
  accepted: 'matchOnCappedCompensation',
  produced: 'matchOnUncappedWages',
  note: 'uncapped wages inflate the 6%-of-pay match',
}, ({ accepted, produced }) => {
  it('computes employer match from uncapped wages above the 401(a)(17) cap', () => {
    const plan = soloPlan('1990-06-15', 70)
    plan.incomes = [wages(500_000)]
    const employer = employerTraditional(0, 24_500)
    if (employer.type !== 'traditional') throw new Error('expected traditional')
    plan.accounts = [
      cash(0),
      { ...employer, employerMatch: { matchPct: 100, capPctOfPay: 6 } },
    ]

    const year = year2026(plan)
    expect(year.employerMatch).toBeCloseTo(produced, 6)
    expect(year.employerMatch).not.toBeCloseTo(accepted, 6)
    // 415(c) does not repair the overstatement: combined additions stay under
    // the pack's 72,000 dollar annual-additions limit.
    expect(year.contributions + year.employerMatch).toBeLessThan(
      pack2026.contributionLimits.section415cLimit,
    )
  })
})

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
// Excess IRA/Roth excise and traditional-IRA deduction phase-out
// --------------------------------------------------------------------------

const EXCESS_ROTH_CONTRIBUTION = 100
const STATUTORY_ROTH_EXCISE = EXCESS_ROTH_CONTRIBUTION * 0.06
// Observed produced pin (fixture run 2026-08-26): the projection imposes no
// section 4973 IRA/Roth excise; penalties stay 0.
const producedIraRothExciseNone = 0

describeRule('irc-4973-a-b-f-ira-and-roth-excess-contribution-excise', {
  readings: {
    // 4973(a) and Form 5329 Part IV line 25: a $100 excess, with a year-end
    // Roth value of at least $100, has a $6 excise: min($100, $100) × 0.06.
    statuteSixPercentExcise: STATUTORY_ROTH_EXCISE,
    engineOmitsTheExcise:
      producedIraRothExciseNone,
  },
  accepted: 'statuteSixPercentExcise',
  produced: 'engineOmitsTheExcise',
  note: 'Roth excess-contribution excise',
}, ({ accepted, produced }) => {
  it('does not price the excise on a Roth contribution above a zero phase-out limit', () => {
    const plan = soloPlan('1966-06-15', 67) // 60 in 2026
    // The operative fact is the Roth phase-out: $400,000 of wages zeroes the
    // 408A(c)(3) contribution limit (the companion irc-408A-c-3 fixture pins
    // that), so the whole $100 deposit is a 4973(f) excess. The contribution
    // is $100 solely to isolate the 6% excise.
    plan.accounts = [cash(0), rothIra(0, EXCESS_ROTH_CONTRIBUTION)]
    plan.incomes = [wages(400_000)]

    const year = year2026(plan)

    expect(year.contributions).toBeCloseTo(EXCESS_ROTH_CONTRIBUTION, 6)
    expect(year.penalties).toBeCloseTo(produced, 6)
    expect(year.penalties).not.toBeCloseTo(accepted, 6)
  })
})

const TRADITIONAL_IRA_CONTRIBUTION = 100
const EMPLOYER_DEFERRAL_PROVING_ACTIVE_PARTICIPATION = 1
const STATUTORY_TAX_AFTER_EMPLOYER_DEFERRAL =
  100_000 - EMPLOYER_DEFERRAL_PROVING_ACTIVE_PARTICIPATION
// Observed produced pin (fixture run 2026-08-26): the engine deducts the $100
// traditional-IRA deposit despite the phaseout: 100,000 - 1 - 100 = 99,899.
const producedTaxWithIraDeposit = 99_899

describeRule('irc-219-g-traditional-ira-deduction-phaseout', {
  readings: {
    // A $100,000 single taxpayer is above Notice 2025-67's $81,000–$91,000
    // active-participant band. The $1 employer deferral is allowed, but the
    // $100 traditional-IRA deposit is nondeductible: $100,000 − $1 = $99,999.
    statuteAllowsOnlyTheEmployerDeferral: STATUTORY_TAX_AFTER_EMPLOYER_DEFERRAL,
    engineDeductsTheTraditionalIraDeposit:
      producedTaxWithIraDeposit,
  },
  accepted: 'statuteAllowsOnlyTheEmployerDeferral',
  produced: 'engineDeductsTheTraditionalIraDeposit',
  note: 'active-participant deduction phase-out',
}, ({ accepted, produced }) => {
  it('deducts a traditional-IRA contribution after the active-participant phase-out ends', () => {
    const plan = soloPlan('1966-06-15', 67) // 60 in 2026
    plan.accounts = [
      cash(0),
      employerTraditional(0, EMPLOYER_DEFERRAL_PROVING_ACTIVE_PARTICIPATION),
      traditionalIra(0, TRADITIONAL_IRA_CONTRIBUTION),
    ]
    plan.incomes = [wages(100_000)]

    const year = year2026(plan, fullFlatTax)

    expect(year.tax).toBeCloseTo(produced, 6)
    expect(year.tax).not.toBeCloseTo(accepted, 6)
  })
})

describeRule('pl-116-94-div-o-title-I-sec-107-traditional-ira-age-cap-repeal', {
  readings: {
    // P.L. 116-94 §107 repealed 219(d)(1). The requested $100 is below both
    // wages and the annual ceiling, so an 80-year-old's contribution remains
    // $100; the superseded age ceiling would have produced zero.
    repealAllowsTheContribution: 100,
    repealedAgeCeilingBlocksIt: 0,
  },
  accepted: 'repealAllowsTheContribution',
  note: 'age 80 still has compensation',
}, ({ accepted, readings }) => {
  it('allows an otherwise eligible traditional-IRA contribution after age 70.5', () => {
    const plan = soloPlan('1946-06-15', null) // 80 in 2026
    plan.accounts = [cash(0), traditionalIra(0, accepted)]
    plan.incomes = [wages(100)]

    const year = year2026(plan)

    expect(year.contributions).toBeCloseTo(accepted, 6)
    expect(year.contributions).not.toBeCloseTo(readings.repealedAgeCeilingBlocksIt, 6)
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
// One donor, one limit
// --------------------------------------------------------------------------

/** One taxpayer's indexed annual QCD limit for 2026. */
const QCD_LIMIT = pack2026.rmd.qcdAnnualLimit

/** A married couple, both past the applicable age, each with their own IRA. */
function donorCouplePlan(iraBalance: number): Plan {
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
    traditionalIra(iraBalance, 0, 'p1'),
    traditionalIra(iraBalance, 0, 'p2'),
  ]
  return plan
}

describeRule('irc-408-d-8-A-projection-household-qcd-aggregation', {
  readings: {
    // 408(d)(8)(A) limits the exclusion "with respect to a taxpayer", and (G)
    // indexes that per-taxpayer amount. Two spouses filing jointly are two
    // taxpayers, each with their own IRA large enough to fund a whole limit, so
    // a joint return can exclude up to two of them and a gift of one and a half
    // is inside what the two of them may exclude.
    statuteOneLimitPerTaxpayer: QCD_LIMIT * 1.5,
    // The aggregate arm until 2026-08-07: one indexed figure applied once to the
    // pooled household ask, which stopped a couple at a single taxpayer's limit.
    oneLimitPerHousehold: QCD_LIMIT,
  },
  accepted: 'statuteOneLimitPerTaxpayer',
  note: 'a couple giving more than one limit and less than two',
}, ({ accepted, readings }) => {
  it('excludes a couple’s gift above one limit against their two limits', () => {
    // Above one limit and below two, which is the band that discriminates: a
    // gift of exactly two limits would also be excluded in full by a reading
    // that simply doubled the household figure without charging either donor.
    const plan = donorCouplePlan(3_000_000)
    plan.strategies.qcdAnnual = QCD_LIMIT * 1.5

    const year = year2026(plan)

    // Each spouse's own required distribution alone exceeds a whole limit, so
    // the gift is fundable from either side and nothing below can be blamed on
    // an IRA running dry.
    expect(year.rmd).toBeGreaterThan(QCD_LIMIT * 2)
    expect(year.qcd).toBeCloseTo(accepted, 6)
    expect(year.qcd).not.toBeCloseTo(readings.oneLimitPerHousehold, 6)
  })
})

describeRule('irc-408-d-8-A-projection-household-qcd-aggregation', {
  readings: {
    // The other half of "per taxpayer": one donor has one limit, and the
    // household cannot borrow a second from a spouse who is not there.
    statuteCapsOneDonorAtOneLimit: QCD_LIMIT,
    // The reading a naive per-donor fix invites: cap only after attribution and
    // let the household ask through when there is nobody to reallocate it to.
    householdAskGivenInFull: QCD_LIMIT * 1.5,
  },
  accepted: 'statuteCapsOneDonorAtOneLimit',
  note: 'a single donor asking for more than their own limit',
}, ({ accepted, readings }) => {
  it('still clamps one donor at one limit', () => {
    const DONOR_IRA_BALANCE = 3_000_000
    const plan = soloPlan('1946-06-15', null) // 80 in 2026
    plan.accounts = [cash(0), traditionalIra(DONOR_IRA_BALANCE, 0, 'p1')]
    plan.strategies.qcdAnnual = QCD_LIMIT * 1.5

    const year = year2026(plan)

    // The requirement alone carries more than a whole limit, and the IRA behind
    // it could fund the rest beyond the requirement, so nothing here clamps the
    // gift except the donor's own 408(d)(8)(A) figure.
    expect(year.rmd).toBeGreaterThan(QCD_LIMIT)
    expect(DONOR_IRA_BALANCE).toBeGreaterThan(QCD_LIMIT * 1.5)
    expect(year.qcd).toBeCloseTo(accepted, 6)
    expect(year.qcd).not.toBeCloseTo(readings.householdAskGivenInFull, 6)
  })
})

// The eligibility half of the same record, which #242's per-owner attribution
// closed and this fixture pins. Registered rather than left as a bare `it`,
// because the record's coverage obligation runs to every departure it once
// described and this is one of the three.
describeRule('irc-408-d-8-A-projection-household-qcd-aggregation', {
  readings: {
    // 408(d)(8)(B)(ii) admits only a distribution made on or after the date
    // "the individual for whose benefit the plan is maintained has attained age
    // 70 1/2", so a spouse years short of it contributes neither a required
    // distribution the gift can be routed out of nor an account it can be
    // drained from. The household is held to the eligible donor's own limit.
    statuteFundsOnlyFromTheEligibleDonor: QCD_LIMIT,
    // The reading the arm carried while it gated on the household: pass the
    // eligibility test on the elder, then fund the gift from whatever IRAs the
    // household happens to hold.
    householdReachesTheIneligibleSpousesIra: QCD_LIMIT * 1.5,
  },
  accepted: 'statuteFundsOnlyFromTheEligibleDonor',
  note: 'an eligible donor beside an ineligible spouse',
}, ({ accepted, readings }) => {
  it('funds a household gift only from the eligible donor', () => {
    const plan = soloPlan('1946-06-15', null) // 80 in 2026, eligible
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1968-06-15', // 58 in 2026, years short of 70 1/2
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 95, source: 'manual' },
    })
    plan.accounts = [
      cash(0),
      traditionalIra(3_000_000, 0, 'p1'),
      traditionalIra(3_000_000, 0, 'p2'),
    ]
    plan.strategies.qcdAnnual = QCD_LIMIT * 1.5

    const year = year2026(plan)

    expect(year.qcd).toBeCloseTo(accepted, 6)
    expect(year.qcd).not.toBeCloseTo(
      readings.householdReachesTheIneligibleSpousesIra, 6,
    )
  })
})

// --------------------------------------------------------------------------
// The one-cent bound the carve leaves on the published denominator
// --------------------------------------------------------------------------

// THE HONEST HALF OF THE ATTRIBUTION CONVENTION, pinned rather than asserted in
// prose, because the `irc-408-d-8-A-projection-household-qcd-aggregation`
// record makes a claim about order-independence that is true of one step and
// not of the next.
//
// WHICH DONOR gives is decided in sorted owner id order and does not move with
// the plan's account listing. WHERE THE FRACTIONAL CENT LANDS does. Once an
// owner's routed share is fixed it is carved out of their own required
// distributions greedily in mutation order, every entry the carve consumes
// whole lands on a line-7 gross of zero, exactly one entry is left partly
// consumed, and each entry's gross is rounded to cents on its own -- so the SUM
// can differ by a cent depending on which entry carries the remainder.
//
// NOT REMOVABLE WITHOUT COST, which is why this is a bound rather than a bug.
// The annual ledger carves in plan dollars at its commit site, and the
// settlement matches an assumed character only when its gross agrees to the
// cent. Rounding the carve earlier in the replay would make the two arms
// disagree and stop the year settling at all, which is a far larger error than
// the one cent it would remove.
const PERMUTATIONS = [
  ['a', 'b', 'c'], ['a', 'c', 'b'], ['b', 'a', 'c'],
  ['b', 'c', 'a'], ['c', 'a', 'b'], ['c', 'b', 'a'],
] as const
const PERMUTATION_BALANCES: Readonly<Record<string, number>> =
  { a: 333_333, b: 222_222, c: 111_111 }

/** The published Form 8606 line-9 denominator, in cents, for one listing. */
function denominatorAcrossListing(order: readonly string[], gift: number): number {
  const plan = soloPlan('1945-01-01', null) // 81 in 2026, well past the applicable age
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.accounts = [
    cash(50_000),
    // The basis sits on whichever IRA is listed first, so the pool carries one
    // basis figure however the accounts are permuted.
    ...order.map((id, index) => {
      const account = traditionalIra(PERMUTATION_BALANCES[id]!, 0, 'p1') as
        Extract<Account, { type: 'traditional' }>
      return {
        ...account,
        id,
        annualReturnPct: 0,
        ...(index === 0 ? { nondeductibleBasis: 100_000 } : {}),
      }
    }),
  ]
  if (gift > 0) plan.strategies.qcdAnnual = gift

  const year = year2026(plan)
  return year.ownedNonRothIraAnnualReplay!.annualReplay
    .ownerReplays[0]!.annualBasisRatio.denominatorMinorUnits
}

describe('the routed carve leaves a one-cent bound on the published denominator', () => {
  it('publishes the same denominator to the cent when nothing is gifted', () => {
    const denominators = PERMUTATIONS
      .map((order) => denominatorAcrossListing(order, 0))

    // The control. Without a carve there is no fractional remainder to place,
    // so account order changes nothing at all.
    expect(new Set(denominators).size).toBe(1)
    expect(denominators[0]).toBe(66_666_600)
  })

  it('varies by at most one cent when a gift is routed out of the requirement', () => {
    const denominators = PERMUTATIONS
      .map((order) => denominatorAcrossListing(order, 40_000))

    // Two values, one cent apart, and no wider. If this ever spreads further
    // the carve stopped being a single-entry remainder and the record's claim
    // about the bound has to be re-measured.
    expect(new Set(denominators).size).toBe(2)
    expect(Math.max(...denominators) - Math.min(...denominators)).toBe(1)
    expect(Math.min(...denominators)).toBe(62_666_600)
  })
})

// --------------------------------------------------------------------------
// Named QCD modelled as beyond the required distribution
// --------------------------------------------------------------------------

// A 237,000 dollar IRA at age 76 distributes 237,000 / 23.7 = 10,000, and the
// scheduled gift is well inside it, so the whole of the gift is an amount the
// requirement could have absorbed.
const NAMED_IRA_BALANCE = 237_000
const NAMED_REQUIRED_DISTRIBUTION = 10_000
const NAMED_GIFT = 6_000
/** The donor's exact 70.5 threshold, 846 calendar months from 1950-06-15. */
const NAMED_DONOR_THRESHOLD_YEAR = 2020

/** One named gift, fully attested, dated after the donor's exact threshold. */
function attestedNamedGiftPlan(): { readonly plan: Plan; readonly iraAccountId: string } {
  const plan = soloPlan('1950-06-15', null) // 76 in 2026, past the applicable age
  const ira = traditionalIra(NAMED_IRA_BALANCE) as Extract<Account, { type: 'traditional' }>
  plan.accounts = [cash(50_000), { ...ira, annualReturnPct: 0 }]
  const amount = asPositiveUsdCents(NAMED_GIFT * 100)
  plan.strategies.retirementActions = [{
    actionId: asActionId('named-gift'),
    kind: 'qcd',
    year: 2026,
    executionDate: '2026-08-01',
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('named-gift-allocation'),
      sourceAccountId: asAccountId(ira.id),
      requestedAmount: amount,
    },
    charity: {
      designationId: 'charity-1',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
  } satisfies QualifiedCharitableDistributionRequest]
  const contributionYears: number[] = []
  for (let taxYear = NAMED_DONOR_THRESHOLD_YEAR; taxYear <= 2026; taxYear += 1) {
    contributionYears.push(taxYear)
  }
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: ira.id,
      subtype: 'traditional',
      evidenceId: 'classification-named-ira',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: contributionYears.map((taxYear) => ({
      donorPersonId: 'p1',
      taxYear,
      amountCents: asUsdCents(0),
      evidenceId: `contribution-${taxYear}`,
      provenance: { source: 'manual', sourceId: `ledger-${taxYear}` },
    })),
  }
  return { plan, iraAccountId: ira.id }
}

describeRule('treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd', {
  readings: {
    // 1.408-8(g)(1) takes the gift into account against section 401(a)(9), so
    // 6,000 of the 10,000 requirement is met by the gift and only the 4,000
    // balance has to come out as taxable cash.
    regulationGiftSatisfiesTheRequirement: NAMED_REQUIRED_DISTRIBUTION - NAMED_GIFT,
    // The projection distributes the whole requirement in cash at phase rank 3
    // and debits the gift separately at rank 6, so all 10,000 stays in income.
    engineDistributesTheWholeRequirementFirst: NAMED_REQUIRED_DISTRIBUTION,
  },
  accepted: 'regulationGiftSatisfiesTheRequirement',
  produced: 'engineDistributesTheWholeRequirementFirst',
  note: 'a scheduled gift cannot displace cash already distributed',
}, ({ accepted, produced }) => {
  it('taxes the whole required distribution beside an excluded gift', () => {
    const { plan, iraAccountId } = attestedNamedGiftPlan()
    const year = year2026(plan)
    const execution = year.qcdActionExecution

    // Both readings rest on this exact requirement and this exact gift, and on
    // the gift having actually moved: a refused gift would put MAGI on the
    // produced figure for the wrong reason.
    expect(year.rmd).toBeCloseTo(NAMED_REQUIRED_DISTRIBUTION, 6)
    expect(year.qcd).toBeCloseTo(NAMED_GIFT, 6)
    expect(execution?.committed).toBe(true)

    expect(year.magi).toBeCloseTo(produced, 6)
    expect(year.magi).not.toBeCloseTo(accepted, 6)

    // The balance-sheet half of the same error: the IRA gives up the whole
    // requirement and the gift, where the coordinated transaction would have
    // taken the requirement alone.
    expect(NAMED_IRA_BALANCE - (year.balances[iraAccountId] ?? 0))
      .toBeCloseTo(NAMED_REQUIRED_DISTRIBUTION + NAMED_GIFT, 6)

    // And the record says so rather than leaving the zero to be interpreted.
    if (execution?.committed !== true) return
    expect(execution.totalRmdSatisfiedAmount).toBe(0)
    expect(execution.evidence[0].rmdCoordination).toMatchObject({
      predicate: 'qcdRmdCoordination',
      rmdRequiredAmount: NAMED_REQUIRED_DISTRIBUTION * 100,
      rmdRemainingBefore: 0,
      rmdSatisfiedAmount: 0,
      rmdRemainingAfter: 0,
      coordination: 'requirementAlreadyDistributedBeforeTheGift',
    })
  })
})

// --------------------------------------------------------------------------
// The instant the Form 8606 pro-rata denominator is measured
// --------------------------------------------------------------------------

// IRC 408(d)(2)(C) computes the section 72 contract value "as of the close of
// the calendar year" and then adds the year's distributions back, which is
// Form 8606 line 6 — the December 31 value, AFTER a year of return on whatever
// the account retained. The LEGACY FALLBACK ledger measures the pre-distribution
// balance instead, which is year-end-BEFORE-growth plus distributions. The two
// differ by exactly the growth on the retained balance, so the fallback's
// denominator is invariant to the return assumption and the statute's is not.
//
// SCOPE, WHICH DECIDES WHICH SHAPE THIS FIXTURE HAS TO BE BUILT ON. The fallback
// governs only a year the owned-non-Roth-IRA annual settlement produced no usable
// characters for, so the fixture has to reach a refusal that a plain valid Plan
// can still reach. Until 2026-08-07 an aggregate charitable gift routed out of a
// required distribution was such a shape — the nonmoving overlay carried no owner,
// and `ownedNonRothIraRuntimeSourceSeries` refused the year with
// `qcdStageRequired`. That refusal is gone: the overlay now carries the
// 408(d)(8)(D) owner attribution the annual ledger settles when it sizes the gift,
// so a gift year settles, and the suite below pins it doing so at the statutory
// figure.
//
// What remains reachable is an owned-IRA-funded annuity purchase, which is what
// this fixture uses. The premium leaves the captured owned-IRA pool for a
// contract the replay does not carry, `annuityStageRequired` refuses the year,
// and the fallback prices it. (A Plan-declared exact ordinary withdrawal sourced
// from an owned IRA used to reach the fallback the same way, through
// `exactActionStageRequired`. It no longer does: the ordinary executor refuses
// an owned-IRA source outright, so the declaration moves nothing, and as of
// 2026-08-07 the source series binds to that evidence instead of refusing the
// year on the declaration alone. `exactActionStageRequired` is still reachable
// where cents actually move.)
//
// The refusal is dated to the year it names. It disqualifies the purchase year,
// which the fallback prices, and the projection settles again the year after --
// so a multi-year run of this shape has exactly one fallback-priced year in it.
//
// THE TWO READINGS DIFFER ONLY IN THE INSTANT, deliberately. Whether the premium
// should have left the section 72 pool at all is a different question with its own
// refusal, and a fixture that varied it would stop being about this record. So
// both readings below are computed over the SAME pool — the engine's, with the
// premium out of it — and disagree only about when that pool is measured.
//
// The shape holds everything but the return fixed and gives line 8 far more
// weight than line 7, which is where the departure is material: a 76-year-old
// with a 1,000,000 dollar IRA that is 20 percent basis, taking the 42,194.09
// requirement, converting 100,000, and paying a 50,000 dollar annuity premium
// out of the same IRA.
const INSTANT_IRA_BALANCE = 1_000_000
const INSTANT_IRA_BASIS = 200_000
const INSTANT_REQUIRED_DISTRIBUTION = INSTANT_IRA_BALANCE / 23.7
const INSTANT_GIFT = 40_000
const INSTANT_CONVERSION = 100_000
const INSTANT_RETURN_PCT = 5
const INSTANT_ANNUITY_PREMIUM = 50_000
/** Form 8606 lines 7 + 8 on the annuity shape: the requirement, plus the conversion. */
const ANNUITY_ANNUAL_GROSS =
  INSTANT_REQUIRED_DISTRIBUTION + INSTANT_CONVERSION
/** What the account keeps: the premium left it, and so did lines 7 and 8. */
const ANNUITY_RETAINED =
  INSTANT_IRA_BALANCE - INSTANT_ANNUITY_PREMIUM - ANNUITY_ANNUAL_GROSS
/** The fallback's denominator: the pool as it stood before the first distribution. */
const ANNUITY_FALLBACK_DENOMINATOR =
  INSTANT_IRA_BALANCE - INSTANT_ANNUITY_PREMIUM

/**
 * The shared shape. `gift` and `annuityPremium` are the only things that decide
 * which arm of the engine prices the year, which is why the settled-path suite
 * below builds its households from this same function rather than a lookalike:
 * a difference the two suites did not intend would otherwise read as the
 * boundary they exist to draw.
 */
function measurementInstantPlan(
  returnPct: number,
  options: { gift?: number; annuityPremium?: number } = {},
): Plan {
  const gift = options.gift ?? 0
  const annuityPremium = options.annuityPremium ?? 0
  const plan = soloPlan('1950-01-01', null) // 76 in 2026
  plan.assumptions.defaultReturnPct = returnPct
  // Spending is funded from cash so nothing but the requirement, the gift, the
  // premium and the conversion moves through the IRA, and the return is the
  // only variable.
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  const ira = traditionalIra(INSTANT_IRA_BALANCE) as Extract<Account, { type: 'traditional' }>
  plan.accounts = [
    { ...(cash(200_000) as Extract<Account, { type: 'cash' }>), annualReturnPct: 0 },
    { ...ira, nondeductibleBasis: INSTANT_IRA_BASIS, annualReturnPct: returnPct },
    rothIra(0),
    ...(annuityPremium > 0
      ? [{
        type: 'annuity' as const,
        id: 'measurement-instant-annuity',
        name: 'Qualified annuity',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        // Immediate. The owner is 76 in 2026 and their required beginning date
        // has gone, so a qualified purchase that is not a QLAC must commence in
        // its purchase year; `monthlyAmount` is 0, so nothing is paid either
        // way and the premium leaving the pool is all this fixture needs.
        startAge: 76,
        monthlyAmount: 0,
        colaPct: 0,
        taxablePct: 100,
        purchase: {
          year: 2026,
          premium: annuityPremium,
          fundingAccountId: ira.id,
          taxQualification: 'qualified' as const,
        },
      }]
      : []),
  ]
  if (gift > 0) plan.strategies.qcdAnnual = gift
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: 2026, amount: INSTANT_CONVERSION }],
  }
  return plan
}

/** The annuity-funded household, which is the one the fallback still prices. */
function annuityPlan(returnPct: number): Plan {
  return measurementInstantPlan(returnPct, {
    annuityPremium: INSTANT_ANNUITY_PREMIUM,
  })
}

// --------------------------------------------------------------------------
// The shape that still reaches the fallback, which is a magnitude and not an
// event.
//
// Every refusal that used to route an ordinary year to the legacy ledger is
// closed. What is left is the exact-cent boundary: cents are safe integers, so
// a Plan-dollar figure above about 90.07 trillion cannot be represented, the
// source series refuses the year with `sourceAmountInvalid`, and the fallback
// prices it. The household below is absurd on purpose — nobody holds this
// balance — because the question the record answers is whether the departure is
// reachable, not whether it is common. One order of magnitude smaller settles.
const OVERFLOW_IRA_BALANCE = 1e14
const OVERFLOW_IRA_BASIS = OVERFLOW_IRA_BALANCE * 0.2
const OVERFLOW_CONVERSION = 1e13
const OVERFLOW_REQUIRED_DISTRIBUTION = OVERFLOW_IRA_BALANCE / 23.7
const OVERFLOW_ANNUAL_GROSS =
  OVERFLOW_REQUIRED_DISTRIBUTION + OVERFLOW_CONVERSION
/** What the account keeps before the year's return is credited to it. */
const OVERFLOW_RETAINED = OVERFLOW_IRA_BALANCE - OVERFLOW_ANNUAL_GROSS

function overflowPlan(returnPct: number, balance = OVERFLOW_IRA_BALANCE): Plan {
  const plan = soloPlan('1950-01-01', null) // 76 in 2026
  plan.assumptions.defaultReturnPct = returnPct
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  const ira = traditionalIra(balance) as Extract<Account, { type: 'traditional' }>
  plan.accounts = [
    { ...(cash(200_000) as Extract<Account, { type: 'cash' }>), annualReturnPct: 0 },
    { ...ira, nondeductibleBasis: balance * 0.2, annualReturnPct: returnPct },
    rothIra(0),
  ]
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: 2026, amount: balance * 0.1 }],
  }
  return plan
}

describeRule('irc-408-d-2-C-projection-pro-rata-measurement-instant', {
  readings: {
    // 408(d)(2)(C) with Form 8606 line 6: the December 31 value grown at 5
    // percent, plus lines 7 and 8.
    statuteMeasuresTheCloseOfTheYear:
      OVERFLOW_ANNUAL_GROSS *
        (1 - OVERFLOW_IRA_BASIS /
          (OVERFLOW_RETAINED * (1 + INSTANT_RETURN_PCT / 100) +
            OVERFLOW_ANNUAL_GROSS)),
    // The fallback: the pool as it stood before the first distribution, which
    // never saw the year's return, so the fraction is the opening 0.2 at any
    // return at all.
    fallbackMeasuresBeforeTheFirstDistribution:
      OVERFLOW_ANNUAL_GROSS *
        (1 - OVERFLOW_IRA_BASIS / OVERFLOW_IRA_BALANCE),
  },
  accepted: 'statuteMeasuresTheCloseOfTheYear',
  produced: 'fallbackMeasuresBeforeTheFirstDistribution',
  note: 'the exact-cent overflow that still reaches the fallback',
}, ({ accepted, produced }) => {
  it('prices a gain year off a denominator that never saw the gain', () => {
    const year = year2026(overflowPlan(INSTANT_RETURN_PCT))

    // The year did not settle, which is WHY the fallback priced it. Pinned
    // rather than asserted in prose: if this ever settles, the record above is
    // what has to be reclassified.
    expect(year).not.toHaveProperty('ownedNonRothIraAnnualReplay')
    expect(year.rmd).toBeCloseTo(OVERFLOW_REQUIRED_DISTRIBUTION, 0)
    expect(year.rothConversion).toBeCloseTo(OVERFLOW_CONVERSION, 0)

    // Relative tolerance, because these figures are eleven digits wide and an
    // absolute cent test at that scale is a test of IEEE-754 rather than of the
    // measurement instant.
    expect(year.magi / produced).toBeCloseTo(1, 12)
    expect(year.magi / accepted).not.toBeCloseTo(1, 6)
    expect(accepted).toBeGreaterThan(produced)
  })

  it('returns the same income at a 0 percent and a negative return', () => {
    // The whole shape of the defect: a denominator measured before the year's
    // growth cannot move when the growth does.
    const gain = year2026(overflowPlan(INSTANT_RETURN_PCT))
    const flat = year2026(overflowPlan(0))
    const loss = year2026(overflowPlan(-INSTANT_RETURN_PCT))

    expect(flat.magi / produced).toBeCloseTo(1, 12)
    expect(gain.magi).toBe(flat.magi)
    expect(loss.magi).toBe(flat.magi)
    // The statute does not agree with itself across the three, which is what
    // makes the invariance above a departure rather than a coincidence.
    expect(accepted / produced).not.toBeCloseTo(1, 6)
  })

  it('settles one order of magnitude below the exact-cent ceiling', () => {
    // THE BOUNDARY IS THE LEDGER'S, not a property of large households, and
    // this is what says so. The same household at a tenth of the balance
    // settles and moves with the return, so what reaches the fallback is the
    // representation limit and nothing about the shape of the plan.
    const gain = year2026(overflowPlan(INSTANT_RETURN_PCT, OVERFLOW_IRA_BALANCE / 10))
    const flat = year2026(overflowPlan(0, OVERFLOW_IRA_BALANCE / 10))

    expect(gain.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(flat.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(gain.magi).not.toBe(flat.magi)
    expect(gain.magi).toBeGreaterThan(flat.magi)
  })
})

// --------------------------------------------------------------------------
// The annuity shape, which used to be this record's produced arm
// --------------------------------------------------------------------------

describe('irc-408-d-2-C — an annuity purchase settles at the close of the year', () => {
  // NOT REGISTERED THROUGH `describeRule`, for the reason the settled-path
  // suite below states: the engine produces the accepted reading here, so
  // passing it through the helper would mean declaring a `produced` reading the
  // suite immediately contradicts. The rule's coverage obligation is met by the
  // overflow suite above; this bounds it on the other side.
  const conventionLine9 = (returnPct: number): number =>
    ANNUITY_RETAINED * (1 + returnPct / 100) + INSTANT_ANNUITY_PREMIUM +
      ANNUITY_ANNUAL_GROSS

  it('measures an annuity year at the close of the year like every other', () => {
    const year = year2026(annuityPlan(INSTANT_RETURN_PCT))

    expect(year.rmd).toBeCloseTo(INSTANT_REQUIRED_DISTRIBUTION, 6)
    expect(year.qcd).toBe(0)
    expect(year.rothConversion).toBeCloseTo(INSTANT_CONVERSION, 6)
    expect(year.ownedNonRothIraAnnualReplay).toBeDefined()

    // To the cent, not to the float: the settlement allocates basis in whole
    // cents and allocates lines 7 and 8 independently.
    expect(year.magi).toBeCloseTo(
      ANNUITY_ANNUAL_GROSS *
        (1 - INSTANT_IRA_BASIS / conventionLine9(INSTANT_RETURN_PCT)), 2)
    expect(year.magi).toBeCloseTo(114_859.33, 2)
    // What it used to report, at every return alike, while the fallback priced
    // it: the pool as it stood before the first distribution.
    expect(year.magi).not.toBeCloseTo(
      ANNUITY_ANNUAL_GROSS *
        (1 - INSTANT_IRA_BASIS / ANNUITY_FALLBACK_DENOMINATOR), 2)
  })

  it('moves the annuity year’s income with the return', () => {
    const gain = year2026(annuityPlan(INSTANT_RETURN_PCT))
    const flat = year2026(annuityPlan(0))
    const loss = year2026(annuityPlan(-INSTANT_RETURN_PCT))

    expect(gain.magi).toBeGreaterThan(flat.magi)
    expect(loss.magi).toBeLessThan(flat.magi)
    expect(gain.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(flat.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(loss.ownedNonRothIraAnnualReplay).toBeDefined()
  })
})

// --------------------------------------------------------------------------
// The value the engine puts on the contract, which is not a valuation
// --------------------------------------------------------------------------

/** Line 9 with the contract carried at the premium, flat, at a given return. */
const conventionLine9 = (returnPct: number): number =>
  ANNUITY_RETAINED * (1 + returnPct / 100) + INSTANT_ANNUITY_PREMIUM +
    ANNUITY_ANNUAL_GROSS
/** Line 9 for the identical household that never bought the contract. */
const counterfactualLine9 = (returnPct: number): number =>
  (INSTANT_IRA_BALANCE - ANNUITY_ANNUAL_GROSS) * (1 + returnPct / 100) +
    ANNUITY_ANNUAL_GROSS

describeRule('irc-408-d-2-C-annuity-contract-close-of-year-value', {
  readings: {
    // The nearest determinable December 31 value the model can name: the one
    // the household that bought no contract carries, which is what 408(d)(2)(A)
    // supports as far as it goes — a movement between two members of one
    // aggregate is not an event section 72 measures, so a valuation that made
    // the purchase visible to line 9 would defeat what the aggregation is for.
    // It assumes the contract earns what the account would have, which is true
    // of no particular contract, and the record says so.
    contractTracksTheDollarsItWasBoughtWith:
      ANNUITY_ANNUAL_GROSS *
        (1 - INSTANT_IRA_BASIS / counterfactualLine9(INSTANT_RETURN_PCT)),
    // The engine: premium in, payments out, floored at zero, no growth.
    engineHoldsTheContractAtPremiumLessPayments:
      ANNUITY_ANNUAL_GROSS *
        (1 - INSTANT_IRA_BASIS / conventionLine9(INSTANT_RETURN_PCT)),
  },
  accepted: 'contractTracksTheDollarsItWasBoughtWith',
  produced: 'engineHoldsTheContractAtPremiumLessPayments',
  note: 'a gain year',
}, ({ accepted, produced }) => {
  it('withholds the growth the premium would have earned in the account', () => {
    const bought = year2026(annuityPlan(INSTANT_RETURN_PCT))
    const kept = year2026(measurementInstantPlan(INSTANT_RETURN_PCT))

    expect(bought.magi).toBeCloseTo(produced, 2)
    expect(bought.magi).toBeCloseTo(114_859.33, 2)
    expect(bought.magi).not.toBeCloseTo(accepted, 2)
    // Derivation rather than conclusion: the accepted figure is read off the
    // household that bought nothing, and it is the same figure the settled-path
    // suite below pins independently.
    expect(kept.magi).toBeCloseTo(accepted, 2)
    expect(kept.magi).toBeCloseTo(114_924.86, 2)
    // The gap is exactly what the convention did not credit, and it is
    // derivable rather than observed: the two line 9s differ by 2,500, which is
    // 5 percent of the 50,000 premium the contract froze.
    expect(counterfactualLine9(INSTANT_RETURN_PCT) -
      conventionLine9(INSTANT_RETURN_PCT))
      .toBeCloseTo(INSTANT_ANNUITY_PREMIUM * INSTANT_RETURN_PCT / 100, 6)
    expect(accepted - produced).toBeCloseTo(65.53, 2)
  })

  it('errs the other way in a loss year, and not at all in a flat one', () => {
    // BOTH DIRECTIONS, WHICH IS WHY THE RECORD CARRIES THAT LABEL. In a gain
    // year the frozen contract shrinks line 9, raises the basis fraction, and
    // understates tax. In a loss year the same freeze holds line 9 up, lowers
    // the fraction, and overstates it. At a flat return there is no growth to
    // withhold and the convention is exact — which is why every fixture in the
    // aggregation suites runs at zero.
    const gainDelta = year2026(annuityPlan(INSTANT_RETURN_PCT)).magi -
      year2026(measurementInstantPlan(INSTANT_RETURN_PCT)).magi
    const lossDelta = year2026(annuityPlan(-INSTANT_RETURN_PCT)).magi -
      year2026(measurementInstantPlan(-INSTANT_RETURN_PCT)).magi
    const flatDelta = year2026(annuityPlan(0)).magi -
      year2026(measurementInstantPlan(0)).magi

    expect(gainDelta).toBeCloseTo(-65.53, 2)
    expect(lossDelta).toBeCloseTo(77.41, 2)
    expect(flatDelta).toBeCloseTo(0, 2)
  })
})

// --------------------------------------------------------------------------
// The same instant, on the settled path
// --------------------------------------------------------------------------

// The boundary of the record above, pinned from the other side, because the
// record was first written as a claim about the whole engine and its one
// fixture sat on the single shape where that claim survived.
//
// Drop the annuity and nothing else changes: same 76-year-old, same 1,000,000
// dollar IRA at 20 percent basis, same 42,194.09 requirement, same 100,000
// dollar conversion. There is nothing to take the year off the settled path, so
// the owned-non-Roth-IRA annual settlement prices it — off the December 31 pool
// balance, which is the instant 408(d)(2)(C) names.
//
// THE FIGURES BELOW ARE DERIVED, NOT OBSERVED. The whole of the year's
// distributions is added back, so line 7 + line 8 is just the requirement plus
// the conversion:
//
//   distributions        = 42,194.09 + 100,000     = 142,194.09
//   retained             = 1,000,000 − 142,194.09  =   857,805.91
//   line 6 at 5 percent  =   857,805.91 × 1.05     =   900,696.2055 (unrounded)
//   line 9 at 5 percent  = 900,696.2055 + 142,194.09 = 1,042,890.2955 ≈ 1,042,890.30
//   fraction             =   200,000 ÷ 1,042,890.30 =    0.1917747
//   ordinary income      =   142,194.09 × (1 − 0.1917747) = 114,924.86
//
// At a 0 percent return line 6 is the retained balance itself, line 9 is the
// opening 1,000,000, the fraction is exactly 0.2, and the income is 113,755.27 —
// which is also what the fallback measure returns, because the two instants
// coincide when nothing grows. The 1,169.59 between the two returns is the whole
// signal: a denominator measured before the growth could not have produced it.
//
// Asserted to the cent rather than to the float. The settlement allocates basis
// in whole cents, and allocates Form 8606 lines 7 and 8 independently, so it
// agrees with the closed form above to within those roundings and not beyond; a
// tighter tolerance would be pinning the quantization rather than the
// measurement instant.
//
// NOT REGISTERED THROUGH `describeRule`, deliberately. That helper's contract
// for an approximated rule is that the fixture names the reading the engine
// produces and asserts it does NOT produce the accepted one. Here the engine
// produces the accepted reading, so passing it through `describeRule` would mean
// declaring a `produced` reading the suite immediately contradicts. The rule's
// coverage obligation is already met by the fallback suite above; this suite
// exists to bound it.

/** Lines 7 + 8 with nothing excluded: the requirement plus the conversion. */
const SETTLED_ANNUAL_GROSS = INSTANT_REQUIRED_DISTRIBUTION + INSTANT_CONVERSION
/** What the account keeps, before the year's return is credited to it. */
const SETTLED_RETAINED = INSTANT_IRA_BALANCE - SETTLED_ANNUAL_GROSS
/** Form 8606 line 9 at a given return: the December 31 value, plus lines 7 + 8. */
const settledLine9 = (returnPct: number): number =>
  SETTLED_RETAINED * (1 + returnPct / 100) + SETTLED_ANNUAL_GROSS
/** The ordinary income the close-of-year denominator produces at that return. */
const settledOrdinaryIncome = (returnPct: number): number =>
  SETTLED_ANNUAL_GROSS * (1 - INSTANT_IRA_BASIS / settledLine9(returnPct))

describe('irc-408-d-2-C — the settled path measures at the close of the year', () => {
  it('moves the pro-rata fraction with the year’s return', () => {
    const gain = year2026(measurementInstantPlan(INSTANT_RETURN_PCT))
    const flat = year2026(measurementInstantPlan(0))

    // The settlement priced both years. Without this the suite could pass on a
    // household that fell through to the fallback and happened to agree.
    expect(gain.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(flat.ownedNonRothIraAnnualReplay).toBeDefined()
    // Both figures rest on this exact requirement and conversion, and on there
    // being nothing to take the year off the settled path.
    expect(gain.rmd).toBeCloseTo(INSTANT_REQUIRED_DISTRIBUTION, 6)
    expect(gain.rothConversion).toBeCloseTo(INSTANT_CONVERSION, 6)
    expect(gain.qcd).toBe(0)

    expect(gain.magi).toBeCloseTo(settledOrdinaryIncome(INSTANT_RETURN_PCT), 2)
    expect(gain.magi).toBeCloseTo(114_924.86, 2)
    expect(flat.magi).toBeCloseTo(settledOrdinaryIncome(0), 2)
    expect(flat.magi).toBeCloseTo(113_755.27, 2)
    // The discriminating half: a pre-distribution denominator never sees the
    // return, so it would report the flat figure in the gain year too.
    expect(gain.magi).not.toBeCloseTo(flat.magi, 2)
    expect(gain.magi - flat.magi).toBeCloseTo(1_169.59, 2)
    // And the intermediate the accepted figure is built from, so a future reader
    // can check the derivation rather than the conclusion.
    expect(settledLine9(INSTANT_RETURN_PCT)).toBeCloseTo(1_042_890.30, 2)
    expect(settledLine9(0)).toBeCloseTo(INSTANT_IRA_BALANCE, 2)
  })

  // THE FLIP, and the reason this suite is where it belongs. The household with
  // a 40,000 dollar aggregate charitable gift routed out of the requirement was
  // the `produced` fixture on this record until 2026-08-07: it reported
  // 80,903.66 at every return, because the nonmoving overlay carried no owner,
  // the source series refused the year, and the fallback's pre-distribution
  // denominator priced it. The overlay now carries the 408(d)(8)(D) attribution,
  // the year settles, and the figures are the statutory ones — including the one
  // the old fixture asserted the engine could not produce.
  //
  //   lines 7 + 8          = (42,194.09 − 40,000) + 100,000 = 102,194.09
  //   retained             = 1,000,000 − 42,194.09 − 100,000 =  857,805.91
  //   line 9 at 5 percent  = 857,805.91 × 1.05 + 102,194.09  =  1,002,890.30
  //   fraction             = 200,000 ÷ 1,002,890.30          =    0.1994236
  //   ordinary income      = 102,194.09 × (1 − 0.1994236)    =   81,814.18
  //
  // The gift is in neither term, which is the whole of (D)'s proper adjustment:
  // its dollars left the account so line 6 is already net of them, and the
  // Form 8606 line-7 instructions keep them off line 7.
  it('settles a gift year at the statutory denominator and moves with the return', () => {
    const gain = year2026(measurementInstantPlan(INSTANT_RETURN_PCT, {
      gift: INSTANT_GIFT,
    }))
    const flat = year2026(measurementInstantPlan(0, { gift: INSTANT_GIFT }))

    expect(gain.qcd).toBeCloseTo(INSTANT_GIFT, 6)
    expect(gain.rmd).toBeCloseTo(INSTANT_REQUIRED_DISTRIBUTION, 6)
    expect(gain.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(flat.ownedNonRothIraAnnualReplay).toBeDefined()

    const giftedAnnualGross =
      INSTANT_REQUIRED_DISTRIBUTION - INSTANT_GIFT + INSTANT_CONVERSION
    const giftedLine9 = (returnPct: number): number =>
      SETTLED_RETAINED * (1 + returnPct / 100) + giftedAnnualGross
    const giftedOrdinaryIncome = (returnPct: number): number =>
      giftedAnnualGross * (1 - INSTANT_IRA_BASIS / giftedLine9(returnPct))

    expect(giftedLine9(INSTANT_RETURN_PCT)).toBeCloseTo(1_002_890.30, 2)
    expect(giftedLine9(0)).toBeCloseTo(INSTANT_IRA_BALANCE - INSTANT_GIFT, 2)
    expect(gain.magi).toBeCloseTo(giftedOrdinaryIncome(INSTANT_RETURN_PCT), 1)
    expect(gain.magi).toBeCloseTo(81_814.18, 2)
    expect(flat.magi).toBeCloseTo(giftedOrdinaryIncome(0), 1)
    expect(flat.magi).toBeCloseTo(80_903.66, 2)
    // The discriminating half, and the exact assertion the old `produced`
    // fixture made in reverse: the gift year is growth-SENSITIVE now.
    expect(gain.magi).not.toBeCloseTo(flat.magi, 2)
    expect(gain.magi - flat.magi).toBeCloseTo(910.52, 2)
  })
})
