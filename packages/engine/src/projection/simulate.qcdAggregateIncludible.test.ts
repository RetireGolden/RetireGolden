/**
 * IRC 408(d)(8)(D) in the aggregate `qcdAnnual` arm of the annual ledger.
 *
 * These fixtures were `produced` pins on an approximated record until
 * 2026-08-07 — they asserted the engine's wrong answer and were required to
 * fail when the defect closed. It closed, and they are settled pins now: each
 * asserts the statutory figure and names the readings it beats.
 *
 * THE ARITHMETIC EVERY FIXTURE BELOW TURNS ON, once, so no docblock has to
 * restate it. For one owner, in one year:
 *
 *   D  = aggregated owned-IRA balance measured before any distribution
 *   B  = the owner's nondeductible basis
 *   I  = max(0, D − B)          the (D) aggregate includible amount
 *   G  = the year's charitable gift charged to this owner
 *   Q  = min(G, I)              the qualified charitable distribution
 *
 * The gift returns no basis and is excluded from income at its GROSS. Every
 * other distribution of the year pro-rates at B / (D − Q) — the Form 8606 line-9
 * denominator with line 6 already net of the gift and line 7 never gaining it —
 * against the whole of B, which the gift did not touch.
 *
 * The rival the fixtures discriminate against is not only the pre-fix engine.
 * It is also `giftCarvedOutButLeftInTheDenominator`: carve the gift out of the
 * line-7 gross, which is half the statute, but keep pro-rating the remainder at
 * B / D. That reading is the one the record itself carried while it was
 * approximated, and it is wrong for a reason the Form 8606 instructions state
 * outright — a QCD is not a line-7 distribution, so it is not in line 9 either.
 */
import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { describeRule } from '../rules/describeRule.js'
import { buildOptimizerInput } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './types.js'

let counter = 0
const testIds = (): string => `qcd-d-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

/** One person, flat dollars, no growth: every figure below is exact. */
function soloPlan(dob: string): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob,
    sex: 'average',
    retirementAge: null,
    longevity: { planningAge: 95, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  // Spending is funded entirely from cash so the IRA distributes the
  // requirement and nothing else. A discretionary draw on top would add
  // ordinary income of its own and no fixture here would be about the gift.
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  return plan
}

function cash(balance: number): Account {
  return {
    type: 'cash',
    id: testIds(),
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function ira(balance: number, nondeductibleBasis?: number): Account {
  return {
    type: 'traditional',
    id: testIds(),
    name: 'IRA',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
    ...(nondeductibleBasis === undefined ? {} : { nondeductibleBasis }),
  }
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

interface Observed {
  readonly rmd: number
  readonly qcd: number
  readonly magi: number
  /** Basis returned by the year's forced distribution, from the LP probe. */
  readonly basisConsumed: number
  readonly probe: OptimizerYearProbe
}

function observe(plan: Plan): Observed {
  const probes: OptimizerYearProbe[] = []
  const result = simulatePlan(validate(plan), {
    startYear: 2026,
    taxCalculator: noTax,
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  const year = result.years.find((entry) => entry.year === 2026)!
  const probe = probes.find((entry) => entry.year === 2026)!
  return {
    rmd: year.rmd,
    qcd: year.qcd,
    magi: year.magi,
    basisConsumed: year.rmd - (probe.rmdTaxable ?? year.rmd),
    probe,
  }
}

// --------------------------------------------------------------------------
// The ordering: the gift leaves section 72 before the requirement pro-rates
// --------------------------------------------------------------------------

// D = 265,000 at age 73, so the requirement is 265,000 / 26.5 = 10,000.
// B = 53,000, G = 5,000, I = 212,000 — the ceiling is nowhere near binding, so
// this fixture isolates the ORDERING and nothing else.
const ORDER_D = 265_000
const ORDER_B = 53_000
const ORDER_RMD = ORDER_D / 26.5
const ORDER_GIFT = 5_000
/** B / (D − Q) = 53,000 / 260,000. */
const ORDER_FRACTION = ORDER_B / (ORDER_D - ORDER_GIFT)
const ORDER_RESIDUAL = ORDER_RMD - ORDER_GIFT

describeRule('irc-408-d-8-D-projection-qcd-after-pro-rata', {
  note: 'the ordering, with the aggregate ceiling not yet binding',
  readings: {
    // The statute. Q = 5,000 is deemed includible and returns no basis; the
    // 5,000 that reaches the household pro-rates at 53,000/260,000 = 0.203846,
    // returning 1,019.23 of basis. 5,000 − 1,019.23 = 3,980.77.
    statuteGiftLeavesBothNumeratorAndDenominator: ORDER_RESIDUAL * (1 - ORDER_FRACTION),
    // The rival: carve the gift off line 7 but keep pro-rating at 53,000/265,000
    // = 0.20, returning 1,000 of basis. 5,000 − 1,000 = 4,000. Half the statute,
    // and refused by the Form 8606 line-7 instructions, which keep a QCD out of
    // line 7 and therefore out of the line-9 denominator too.
    giftCarvedOutButLeftInTheDenominator: ORDER_RESIDUAL * (1 - ORDER_B / ORDER_D),
    // The engine before 2026-08-07: pro-rate the whole 10,000 first (2,000 of
    // basis) and then subtract the gift. 10,000 − 2,000 − 5,000 = 3,000.
    engineProRatedTheWholeRequirementFirst:
      ORDER_RMD - ORDER_RMD * (ORDER_B / ORDER_D) - ORDER_GIFT,
  },
  accepted: 'statuteGiftLeavesBothNumeratorAndDenominator',
}, ({ accepted, readings }) => {
  it('taxes only the requirement the household kept, at the reduced denominator', () => {
    const plan = soloPlan('1953-06-15') // 73 in 2026, first RMD year
    plan.accounts = [cash(0), ira(ORDER_D, ORDER_B)]
    plan.strategies.qcdAnnual = ORDER_GIFT

    const observed = observe(plan)

    // Every reading rests on this requirement and this gift.
    expect(observed.rmd).toBeCloseTo(ORDER_RMD, 6)
    expect(observed.qcd).toBeCloseTo(ORDER_GIFT, 6)

    expect(observed.magi).toBeCloseTo(accepted, 6)
    expect(observed.magi).toBeCloseTo(3_980.77, 2)
    expect(observed.magi).not.toBeCloseTo(readings.giftCarvedOutButLeftInTheDenominator, 6)
    expect(observed.magi).not.toBeCloseTo(readings.engineProRatedTheWholeRequirementFirst, 6)

    // The basis half, which is the half that outlives the year: 5,000 × 0.203846.
    expect(observed.basisConsumed).toBeCloseTo(ORDER_RESIDUAL * ORDER_FRACTION, 6)
    expect(observed.basisConsumed).toBeCloseTo(1_019.23, 2)
  })
})

// --------------------------------------------------------------------------
// The ceiling: the aggregate includible amount, not the requirement's share
// --------------------------------------------------------------------------

// D = 1,000,000 at age 76, so the requirement is 1,000,000 / 23.7 = 42,194.09.
// B = 200,000 and G = 40,000. The gift is LARGER than the taxable part of the
// requirement (33,755.27 under the old pro-rata), which is exactly what the
// fixture above avoids: the pre-fix ceiling bound here and clamped away
// 6,244.73 of gift. The statutory ceiling is I = 800,000 and does not bind.
const CEIL_D = 1_000_000
const CEIL_B = 200_000
const CEIL_RMD = CEIL_D / 23.7
const CEIL_GIFT = 40_000
const CEIL_FRACTION = CEIL_B / (CEIL_D - CEIL_GIFT)
const CEIL_RESIDUAL = CEIL_RMD - CEIL_GIFT

describeRule('irc-408-d-8-D-projection-qcd-after-pro-rata', {
  note: 'the ceiling the exclusion is measured against',
  readings: {
    // The statute: I = 800,000, so the whole gift qualifies, is excluded at its
    // gross, and returns no basis. Only the 2,194.09 that reached the household
    // pro-rates, at 200,000/960,000 = 0.208333.
    statuteMeasuresAgainstAllIrasAsOneContract: CEIL_RESIDUAL * (1 - CEIL_FRACTION),
    // The same rival as above, at 200,000/1,000,000 = 0.20: 1,755.27.
    giftCarvedOutButLeftInTheDenominator: CEIL_RESIDUAL * 0.8,
    // The engine before 2026-08-07: pro-rate all 42,194.09 into 8,438.82 of
    // basis and 33,755.27 of taxable dollars, then cap the offset at that same
    // 33,755.27. Nothing is left and the year reports no ordinary income at all.
    engineCappedTheExclusionAtTheRequirementsTaxableShare: 0,
  },
  accepted: 'statuteMeasuresAgainstAllIrasAsOneContract',
}, ({ accepted, readings }) => {
  it('excludes the whole gift and taxes the residual at the reduced denominator', () => {
    const plan = soloPlan('1950-01-01') // 76 in 2026
    plan.accounts = [cash(200_000), ira(CEIL_D, CEIL_B)]
    plan.strategies.qcdAnnual = CEIL_GIFT

    const observed = observe(plan)

    expect(observed.rmd).toBeCloseTo(CEIL_RMD, 2)
    expect(observed.qcd).toBeCloseTo(CEIL_GIFT, 6)
    // The shape that separates this fixture from the one above.
    expect(CEIL_GIFT).toBeGreaterThan(CEIL_RMD * 0.8)

    expect(observed.magi).toBeCloseTo(accepted, 6)
    expect(observed.magi).toBeCloseTo(1_736.99, 2)
    expect(observed.magi).not.toBeCloseTo(readings.giftCarvedOutButLeftInTheDenominator, 6)
    expect(observed.magi)
      .not.toBeCloseTo(readings.engineCappedTheExclusionAtTheRequirementsTaxableShare, 6)

    // 2,194.09 × 0.208333 = 457.10, against the 8,438.82 the ledger used to burn.
    expect(observed.basisConsumed).toBeCloseTo(CEIL_RESIDUAL * CEIL_FRACTION, 6)
    expect(observed.basisConsumed).toBeCloseTo(457.10, 2)
    expect(observed.basisConsumed).not.toBeCloseTo(8_438.82, 2)

    // THE EXCLUSION IS THE GROSS. `forcedDistributionOrdinaryIncomeExclusion`
    // (#236) carried 33,755.27 before the fix, because the exclusion was capped
    // at the requirement's taxable share; under (D) the routed gift is deemed
    // includible in full, so the term is the whole 40,000 and now coincides
    // with the cash-diversion gross (#238), which never moved.
    expect(observed.probe.forcedDistributionOrdinaryIncomeExclusion).toBeCloseTo(40_000, 6)
    expect(observed.probe.forcedDistributionCashDiversion).toBeCloseTo(40_000, 6)
  })
})

// --------------------------------------------------------------------------
// A gift larger than the whole aggregate includible amount
// --------------------------------------------------------------------------

// The half of (D) that is a LIMIT rather than a licence. D = 100,000 with
// B = 60,000 leaves I = 40,000, and the requested gift is 50,000. Only 40,000
// can be a QCD; under (B)'s closing sentence the other 10,000 is not a
// charitable distribution at all, and it stays in the section 72 computation.
//
// The consequence is arithmetic and worth stating: once the gift has taken the
// whole pre-tax pool, D − Q = B, the year's fraction is exactly 1, and every
// dollar the IRA distributes afterwards is a return of basis. So the excess is
// untaxed here not because it was excluded but because there is nothing left in
// the account that could be income.
const EXCESS_D = 100_000
const EXCESS_B = 60_000
const EXCESS_RMD = EXCESS_D / 23.7
const EXCESS_GIFT = 50_000

describeRule('irc-408-d-8-D-projection-qcd-after-pro-rata', {
  note: 'a gift that runs past the aggregate includible amount',
  readings: {
    // Statute: Q = 40,000, the residual denominator is 100,000 − 40,000 =
    // 60,000 = B, the fraction is 1, and the requirement that reached the
    // household is pure basis. No ordinary income at all.
    statuteCapsQualificationAtTheAggregateIncludibleAmount: 0,
    // The rival that ignores the cap and excludes the whole 50,000 against an
    // unreduced 60% taxable fraction: the requirement's 4,219.41 would be
    // 40% basis, leaving 2,531.65 of income the exclusion then over-erases.
    // Stated as a positive number so the readings cannot collide.
    giftQualifiesInFullWithNoAggregateCeiling: EXCESS_RMD * 0.6,
  },
  accepted: 'statuteCapsQualificationAtTheAggregateIncludibleAmount',
}, ({ accepted, readings }) => {
  it('qualifies only the pre-tax pool and turns the rest of the year into basis', () => {
    const plan = soloPlan('1950-01-01') // 76 in 2026
    plan.accounts = [cash(50_000), ira(EXCESS_D, EXCESS_B)]
    plan.strategies.qcdAnnual = EXCESS_GIFT

    const observed = observe(plan)

    expect(observed.rmd).toBeCloseTo(EXCESS_RMD, 6)
    expect(observed.qcd).toBeCloseTo(EXCESS_GIFT, 6)
    // The shape: the gift exceeds the owner's entire aggregate includible
    // amount, which is what no other fixture on this record reaches.
    expect(EXCESS_GIFT).toBeGreaterThan(EXCESS_D - EXCESS_B)

    expect(observed.magi).toBeCloseTo(accepted, 6)
    expect(observed.magi).not.toBeCloseTo(readings.giftQualifiesInFullWithNoAggregateCeiling, 6)
    // The requirement returned itself in basis, at a fraction of exactly 1.
    expect(observed.basisConsumed).toBeCloseTo(EXCESS_RMD, 6)
  })
})

// --------------------------------------------------------------------------
// No basis: the fix must be invisible
// --------------------------------------------------------------------------

// Nothing above can be true of an IRA with no nondeductible basis, and the fix
// must not touch one. With B = 0 the year opens no pro-rata state at all, so
// the deferred forced-distribution commit splits nothing, and I = D makes the
// new ceiling non-binding for any gift the account can fund — so the exclusion
// is the routed gross, which is exactly what
// `min(qcdFromRmd, ownedIraRmdTotal − 0)` gave before the fix.
const FLAT_D = 265_000
const FLAT_RMD = FLAT_D / 26.5
const FLAT_GIFT = 5_000

it('leaves a no-basis household on the same figures the pre-fix ledger produced', () => {
  const plan = soloPlan('1953-06-15')
  plan.accounts = [cash(0), ira(FLAT_D)]
  plan.strategies.qcdAnnual = FLAT_GIFT

  const observed = observe(plan)

  expect(observed.rmd).toBeCloseTo(FLAT_RMD, 6)
  expect(observed.qcd).toBeCloseTo(FLAT_GIFT, 6)
  // rmdTotal − 0 − qcdFromRmd, the identical expression on both sides of the fix.
  expect(observed.magi).toBeCloseTo(FLAT_RMD - FLAT_GIFT, 6)
  expect(observed.basisConsumed).toBeCloseTo(0, 6)
  expect(observed.probe.forcedDistributionOrdinaryIncomeExclusion).toBeCloseTo(FLAT_GIFT, 6)
  expect(observed.probe.forcedDistributionCashDiversion).toBeCloseTo(FLAT_GIFT, 6)
})

// A gift the account cannot fund at all is the other invisibility case: with no
// gift there is no qualified amount, so the denominator is the whole
// pre-distribution pool and the deferred commit reproduces the immediate one.
it('leaves a basis-holding household with no gift exactly where it was', () => {
  const plan = soloPlan('1953-06-15')
  plan.accounts = [cash(0), ira(ORDER_D, ORDER_B)]

  const observed = observe(plan)

  expect(observed.qcd).toBe(0)
  expect(observed.basisConsumed).toBeCloseTo(ORDER_RMD * (ORDER_B / ORDER_D), 6)
  expect(observed.magi).toBeCloseTo(ORDER_RMD * (1 - ORDER_B / ORDER_D), 6)
})

// --------------------------------------------------------------------------
// The LP's two terms still reconcile against the moved ledger
// --------------------------------------------------------------------------

// #236's `forcedDistributionOrdinaryIncomeExclusion` and #238's
// `forcedDistributionCashDiversion` were both built while the exclusion was the
// clamped taxable share. The exclusion GREW with this fix and the diversion did
// not move, so the identity that ties the LP's reconstructed ordinary income to
// the exact ledger has to be re-proved on a gift-plus-basis shape rather than
// assumed to have survived.
it('reconciles the LP ordinary-income reconstruction to the exact ledger', () => {
  const plan = soloPlan('1950-01-01')
  plan.accounts = [cash(200_000), ira(CEIL_D, CEIL_B)]
  plan.strategies.qcdAnnual = CEIL_GIFT
  const validated = validate(plan)

  const observed = observe(plan)
  const modeled = buildOptimizerInput(validated, {
    startYear: 2026,
    taxCalculator: noTax,
  }).years[0]!

  // The LP re-decides the whole forced distribution as its own withdrawal, so
  // it adds the gross back at the modelled taxable fraction and subtracts the
  // exclusion. That has to land on the ledger's own MAGI exactly.
  const lpOrdinaryAtLedgerDraw =
    modeled.ordinaryIncomeBase +
    (modeled.committedOrdinaryIncome ?? 0) -
    (modeled.forcedDistributionOrdinaryIncomeExclusion ?? 0) +
    observed.rmd * (modeled.traditionalWithdrawalTaxableFraction ?? 1)
  expect(lpOrdinaryAtLedgerDraw - observed.magi).toBeCloseTo(0, 4)

  // The cash term is the gross and is what the household never had in hand, so
  // what is left of the requirement is what it could actually spend.
  expect(observed.rmd - (modeled.forcedDistributionCashDiversion ?? 0))
    .toBeCloseTo(CEIL_RESIDUAL, 2)

  // The exclusion can never exceed the taxable forced income it excludes —
  // the invariant the LP's term promises, now guaranteed by the carve rather
  // than by the old ceiling.
  expect(modeled.forcedDistributionOrdinaryIncomeExclusion ?? 0)
    .toBeLessThanOrEqual(observed.rmd - observed.basisConsumed + 1e-9)
})
