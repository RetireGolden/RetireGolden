import { describe, expect, it } from 'vitest'

import type { QualifiedCharitableDistributionRequest } from '../../actions/contract.js'
import { asAccountId, asActionId, asAllocationId, asPersonId } from '../../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../../actions/money.js'
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
// SCOPE, WHICH THIS SHAPE IS CHOSEN TO REACH. The fallback governs only a year
// the owned-non-Roth-IRA annual settlement produced no usable characters for,
// and the aggregate gift below is what puts this household there: a gift routed
// out of a required distribution mints a nonmoving overlay carrying no owner and
// no source account, so `ownedNonRothIraRuntimeSourceSeries` refuses the year
// with `qcdStageRequired` and the pass keeps the figures the fallback committed.
// Drop the gift and the same household settles, at the December 31 measure —
// which is the boundary the second suite below pins, and without that suite this
// one reads as a claim about the whole engine rather than about one arm of it.
//
// The shape holds everything but the return fixed and gives line 8 far more
// weight than line 7, which is where the departure is material: a 76-year-old
// with a 1,000,000 dollar IRA that is 20 percent basis, taking the 42,194.09
// requirement, routing 40,000 of it to charity, and converting 100,000.
const INSTANT_IRA_BALANCE = 1_000_000
const INSTANT_IRA_BASIS = 200_000
const INSTANT_REQUIRED_DISTRIBUTION = INSTANT_IRA_BALANCE / 23.7
const INSTANT_GIFT = 40_000
const INSTANT_CONVERSION = 100_000
const INSTANT_RETURN_PCT = 5
/** Form 8606 lines 7 + 8: the requirement the household kept, plus the conversion. */
const INSTANT_ANNUAL_GROSS =
  INSTANT_REQUIRED_DISTRIBUTION - INSTANT_GIFT + INSTANT_CONVERSION
/** Line 6 at a 5 percent return: what the account retained, grown. */
const INSTANT_LINE_6 =
  (INSTANT_IRA_BALANCE - INSTANT_REQUIRED_DISTRIBUTION - INSTANT_CONVERSION) *
  (1 + INSTANT_RETURN_PCT / 100)
/** Line 9, and the fraction it produces against the unreduced basis. */
const INSTANT_LINE_9 = INSTANT_LINE_6 + INSTANT_ANNUAL_GROSS
/** The fallback's denominator: pre-distribution pool less the qualified gift. */
const INSTANT_FALLBACK_DENOMINATOR = INSTANT_IRA_BALANCE - INSTANT_GIFT

/**
 * The shared shape. `gift` is the only thing that decides which arm of the
 * engine prices the year, which is why the settled-path suite below builds its
 * household from this same function rather than a lookalike: a difference the
 * two suites did not intend would otherwise read as the boundary they exist to
 * draw.
 */
function measurementInstantPlan(returnPct: number, gift = INSTANT_GIFT): Plan {
  const plan = soloPlan('1950-01-01', null) // 76 in 2026
  plan.assumptions.defaultReturnPct = returnPct
  // Spending is funded from cash so nothing but the requirement, the gift and
  // the conversion moves through the IRA, and the return is the only variable.
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
  ]
  if (gift > 0) plan.strategies.qcdAnnual = gift
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: 2026, amount: INSTANT_CONVERSION }],
  }
  return plan
}

describeRule('irc-408-d-2-C-projection-pro-rata-measurement-instant', {
  readings: {
    // 408(d)(2)(C) with Form 8606 line 6: the denominator is the December 31
    // value grown at 5 percent, plus lines 7 and 8. 1,002,890.30, a fraction of
    // 0.1994236, and 81,814.18 of ordinary income.
    statuteMeasuresTheContractAtTheCloseOfTheYear:
      INSTANT_ANNUAL_GROSS * (1 - INSTANT_IRA_BASIS / INSTANT_LINE_9),
    // The fallback: the pre-distribution pool less the qualified gift, which
    // never saw the year's return. 960,000, a fraction of 0.2083333, and
    // 80,903.66 — the same figure at any return at all.
    fallbackMeasuresBeforeTheFirstDistribution:
      INSTANT_ANNUAL_GROSS * (1 - INSTANT_IRA_BASIS / INSTANT_FALLBACK_DENOMINATOR),
  },
  accepted: 'statuteMeasuresTheContractAtTheCloseOfTheYear',
  produced: 'fallbackMeasuresBeforeTheFirstDistribution',
  note: 'the fallback ledger',
}, ({ accepted, produced }) => {
  it('prices a gain year off a denominator that never saw the gain', () => {
    const year = year2026(measurementInstantPlan(INSTANT_RETURN_PCT))

    // Both readings rest on this exact requirement, gift and conversion.
    expect(year.rmd).toBeCloseTo(INSTANT_REQUIRED_DISTRIBUTION, 6)
    expect(year.qcd).toBeCloseTo(INSTANT_GIFT, 6)
    expect(year.rothConversion).toBeCloseTo(INSTANT_CONVERSION, 6)

    expect(year.magi).toBeCloseTo(produced, 6)
    expect(year.magi).toBeCloseTo(80_903.66, 2)
    expect(year.magi).not.toBeCloseTo(accepted, 6)
    expect(accepted).toBeCloseTo(81_814.18, 2)
    // The gap the measurement instant costs this household, in one year.
    expect(accepted - produced).toBeCloseTo(910.52, 2)
    // And the two intermediate figures the accepted reading is built from, so a
    // future reader can check the derivation rather than the conclusion.
    expect(INSTANT_LINE_6).toBeCloseTo(900_696.20, 2)
    expect(INSTANT_LINE_9).toBeCloseTo(1_002_890.30, 2)
  })

  it('returns the same income at a 0 percent and a negative return', () => {
    // The control, and the whole shape of the defect: a denominator that is
    // measured before the year's growth cannot move when the growth does. If
    // this test ever fails, the measurement instant moved and the record above
    // is what has to be reclassified.
    const gain = year2026(measurementInstantPlan(INSTANT_RETURN_PCT))
    const flat = year2026(measurementInstantPlan(0))
    const loss = year2026(measurementInstantPlan(-INSTANT_RETURN_PCT))

    expect(flat.magi).toBeCloseTo(produced, 6)
    expect(gain.magi).toBeCloseTo(flat.magi, 6)
    expect(loss.magi).toBeCloseTo(flat.magi, 6)
    // The statute does not agree with itself across the three, which is what
    // makes the invariance above a departure rather than a coincidence.
    expect(accepted).not.toBeCloseTo(produced, 6)
    // And WHY this household is on the fallback at all, pinned rather than
    // asserted in prose: the settlement published nothing for the year. If the
    // aggregate gift arm ever becomes source-allocatable this shape settles,
    // and then it is this suite — not only the record — that has to be revisited.
    expect(gain.ownedNonRothIraAnnualReplay).toBeUndefined()
  })
})

// --------------------------------------------------------------------------
// The same instant, on the settled path
// --------------------------------------------------------------------------

// The boundary of the record above, pinned from the other side, because the
// record was first written as a claim about the whole engine and its one
// fixture sat on the single shape where that claim survives.
//
// Drop the charitable gift and nothing else changes: same 76-year-old, same
// 1,000,000 dollar IRA at 20 percent basis, same 42,194.09 requirement, same
// 100,000 dollar conversion. With no gift there is no nonmoving overlay, the
// source series does not refuse the year, and the owned-non-Roth-IRA annual
// settlement prices it — off the December 31 pool balance, which is the instant
// 408(d)(2)(C) names.
//
// THE FIGURES BELOW ARE DERIVED, NOT OBSERVED. With no gift the whole of the
// year's distributions is added back, so line 7 + line 8 is just the requirement
// plus the conversion:
//
//   distributions        = 42,194.09 + 100,000     = 142,194.09
//   retained             = 1,000,000 − 142,194.09  =   857,805.91
//   line 6 at 5 percent  =   857,805.91 × 1.05     =   900,696.20
//   line 9 at 5 percent  =   900,696.20 + 142,194.09 = 1,042,890.30
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
// in whole cents against an exact-cent line 9, so it agrees with the closed form
// above to the cent and not beyond; a tighter tolerance would be pinning the
// quantization rather than the measurement instant.
//
// NOT REGISTERED THROUGH `describeRule`, deliberately. That helper's contract
// for an approximated rule is that the fixture names the reading the engine
// produces and asserts it does NOT produce the accepted one. Here the engine
// produces the accepted reading, so passing it through `describeRule` would mean
// declaring a `produced` reading the suite immediately contradicts. The rule's
// coverage obligation is already met by the fallback suite above; this suite
// exists to bound it.

/** Lines 7 + 8 with no gift to exclude: the requirement plus the conversion. */
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
    const gain = year2026(measurementInstantPlan(INSTANT_RETURN_PCT, 0))
    const flat = year2026(measurementInstantPlan(0, 0))

    // The settlement priced both years. Without this the suite could pass on a
    // household that fell through to the fallback and happened to agree.
    expect(gain.ownedNonRothIraAnnualReplay).toBeDefined()
    expect(flat.ownedNonRothIraAnnualReplay).toBeDefined()
    // Both figures rest on this exact requirement and conversion, and on there
    // being no gift to take the year off the settled path.
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
})
