/**
 * The two one-sided bookings the LP-committed-terms slice enumerated as still
 * open, and the one its channel sweep turned up beside them.
 *
 * Every fixture here was written as a REPRO first and verified failing against
 * the parent commit by stashing the fix, so a regression reads as the defect
 * returning. The defect figure is written down next to the corrected one for
 * the same reason.
 *
 * NONE OF THESE PLANS RECORDS A RETIREMENT ACTION, so none of them was ever
 * behind the Optimize page's `optimizerUnsupportedRetirementActions` refusal —
 * an aggregate `strategies.qcdAnnual` gift, a pension lump-sum election and a
 * TIPS-ladder purchase are all plan configuration, not
 * `plan.strategies.retirementActions`. Every one of these reached a live
 * recommendation.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { buildOptimizerModel, optimizeSchedule, type OptimizerInput } from '../strategies/optimizer.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import type { OptimizerYearProbe } from './types.js'
import { buildOptimizerInput, optimizerUnsupportedRetirementActions } from './optimizePlan.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `sides-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const opts = { startYear: 2026, taxCalculator: createFederalTaxCalculator() }

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function probesFor(plan: Plan): OptimizerYearProbe[] {
  const probes: OptimizerYearProbe[] = []
  simulatePlan(plan, { ...opts, captureOptimizerInputs: (p) => probes.push(p) })
  return probes
}

/**
 * The LP the engine built BEFORE the cash-side term existed, on the identical
 * plan: the shipped input with the new term zeroed. Comparing against this
 * rather than against a second hand-built plan keeps every other coefficient
 * byte-identical, so a difference can only be the term under test.
 */
function withoutCashDiversion(input: OptimizerInput): OptimizerInput {
  return {
    ...input,
    years: input.years.map((year) => ({
      ...year,
      forcedDistributionCashDiversion: 0,
    })),
  }
}

/** The LP before the strategy channel carried the producer under test. */
function withoutStrategyMovement(input: OptimizerInput): OptimizerInput {
  return {
    ...input,
    years: input.years.map((year) => {
      const rest = { ...year }
      delete rest.exogenousStrategyMovement
      return rest
    }),
  }
}

function zeroedHealthcare() {
  return {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
}

// ---------------------------------------------------------------------------
// GAP A — the QCD cash side.
// ---------------------------------------------------------------------------

/**
 * A retiree at 76 whose income IS the RMD, giving part of it away.
 *
 * `baseCashInflows` books `+ rmdTotal − qcdFromRmd − namedQcdRmdSatisfied`: the
 * forced distribution arrives and the gifted share leaves again, because a
 * distribution paid to a charity was never the household's to spend. The LP
 * re-decides that same distribution as its own `wt` and the cash constraint
 * credits `wt` at 1.0, so before `forcedDistributionCashDiversion` the solve
 * funded spending out of dollars the household had given away.
 *
 * `planningAge` is set high enough that the gift runs for many years: the error
 * is not one year's cash, it is a cash credit the solve never had to raise,
 * which then compounds as a bucket it never had to draw down.
 */
function giftPlan(options: {
  qcdAnnual: number
  spending: number
  cash: number
  planningAge?: number
}): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1950-01-01', // 76 in 2026 — the RMD age is long past.
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: options.planningAge ?? 77, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = options.spending
  plan.expenses.healthcare = zeroedHealthcare()
  plan.strategies.qcdAnnual = options.qcdAnnual
  plan.accounts = [
    { type: 'traditional', id: 'g-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 1_000_000, annualContribution: 0 },
    { type: 'roth', id: 'g-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: 'g-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: options.cash, annualContribution: 0 },
  ]
  return validate(plan)
}

describe('GAP A (closed): a gift year books tax, cash and balances together', () => {
  it('reconciles all three sides of one gift year against the ledger', () => {
    // A gift LARGER than the RMD, so both arms of the aggregate QCD run in the
    // same year and the three terms have to divide the same gift between them
    // without overlapping: the routed part leaves through the RMD (cash side
    // here, income side on the exclusion) and the rest debits the IRA directly
    // (balance side on the strategy channel).
    const plan = giftPlan({ qcdAnnual: 60_000, spending: 40_000, cash: 200_000 })
    const ledger = simulatePlan(plan, opts).years[0]!
    const modeled = buildOptimizerInput(plan, opts).years[0]!

    // The ledger's own year, so every bar below is a fact and not a target.
    expect(ledger.rmd).toBeCloseTo(42_194.09, 2)
    expect(ledger.qcd).toBeCloseTo(60_000, 2)
    const routed = Math.min(ledger.qcd, ledger.rmd)
    const beyond = ledger.qcd - routed
    expect(routed).toBeCloseTo(42_194.09, 2)
    expect(beyond).toBeCloseTo(17_805.91, 2)

    // SIDE 1, TAX. The LP's exogenous ordinary income evaluated at the ledger's
    // own draw is the ledger's MAGI. The whole RMD is excluded here, so the
    // year's ordinary income is nothing at all.
    const lpOrdinaryAtLedgerDraw =
      modeled.ordinaryIncomeBase +
      (modeled.committedOrdinaryIncome ?? 0) -
      (modeled.forcedDistributionOrdinaryIncomeExclusion ?? 0) +
      ledger.rmd * (modeled.traditionalWithdrawalTaxableFraction ?? 1)
    expect(lpOrdinaryAtLedgerDraw - ledger.magi).toBeCloseTo(0, 6)

    // SIDE 2, CASH. The gift's routed part is exactly what the ledger nets out
    // of its own inflows, so the LP's cash credit for `wt` nets to the same.
    // DEFECT: this was absent, and the LP believed all $42,194.09 of the forced
    // draw was spendable when $12,194.09 of it reached the household — a
    // $42,194.09 overstatement, since the entire RMD was gifted.
    expect(modeled.forcedDistributionCashDiversion).toBeCloseTo(routed, 6)
    const lpSpendableFromForcedDraw =
      ledger.rmd - (modeled.forcedDistributionCashDiversion ?? 0)
    expect(lpSpendableFromForcedDraw).toBeCloseTo(ledger.rmd - routed, 6)
    expect(lpSpendableFromForcedDraw).toBeCloseTo(0, 6)

    // NO DOUBLE ADJUSTMENT with the income side. Both come off the same gift,
    // and they are different figures for different reasons: this IRA carries no
    // nondeductible basis, so gross and includible coincide, and the two terms
    // are equal here — but they are subtracted from different constants on
    // different sides of the model, so neither can absorb the other's dollars.
    expect(modeled.forcedDistributionOrdinaryIncomeExclusion).toBeCloseTo(routed, 6)

    // SIDE 3, BALANCES. The beyond-RMD dollars are on the movement channel and
    // NOT in either of the terms above, because they never entered the ledger's
    // cash or income at all — booking them anywhere else would charge the gift
    // twice.
    // To the cent: the channel converts once, in cents, off the arm's own
    // published takes, so it lands on a whole cent where the ledger's dollar
    // subtraction above leaves a sub-cent residue.
    expect(modeled.exogenousStrategyMovement?.trad).toBeCloseTo(-beyond, 2)
    expect(modeled.exogenousStrategyMovement?.proceeds).toBe(0)
    // Growth is zero, so the LP's traditional recursion evaluated at the
    // ledger's own draw is the ledger's closing IRA balance to the cent.
    const probe = probesFor(plan)[0]!
    const lpEndTrad =
      1_000_000 -
      probe.incumbentTraditionalDistribution +
      (modeled.exogenousStrategyMovement?.trad ?? 0)
    expect(lpEndTrad).toBeCloseTo(ledger.balances['g-ira']!, 2)
    expect(ledger.balances['g-ira']).toBeCloseTo(940_000, 2)

    // It always reached a user: the page gate reads recorded actions, and this
    // plan records none.
    expect(optimizerUnsupportedRetirementActions(plan)).toEqual([])
  })

  it('takes the gift back on the cash constraint and nowhere else', () => {
    const plan = giftPlan({ qcdAnnual: 30_000, spending: 40_000, cash: 200_000 })
    const shipped = buildOptimizerInput(plan, opts)
    const shippedLp = buildOptimizerModel(shipped).lp
    const regressedLp = buildOptimizerModel(withoutCashDiversion(shipped)).lp

    // Exactly the cash rows move, and each by exactly the gift. The bracket,
    // MAGI, RMD-floor and balance rows are character-identical, which is what
    // proves the term did not leak into the tax side that the exclusion owns.
    const cashRow = (lp: string, t: number) =>
      lp.split('\n').find((line) => line.trim().startsWith(`cash${t}:`))!
    const nonCashRows = (lp: string) =>
      lp.split('\n').filter((line) => !/^\s*cash\d+:/.test(line)).join('\n')
    expect(nonCashRows(shippedLp)).toBe(nonCashRows(regressedLp))
    for (let t = 0; t < shipped.years.length; t++) {
      const shippedConstant = Number(cashRow(shippedLp, t).split('=')[1]!)
      const regressedConstant = Number(cashRow(regressedLp, t).split('=')[1]!)
      // The right-hand side is `spendingNeed − cash the household already has`,
      // so ADDING the diversion raises it: the solver must now raise those
      // dollars somewhere real instead of spending a gift.
      expect(shippedConstant - regressedConstant).toBeCloseTo(30_000, 2)
    }
  })

  it('is byte-identical on a plan with no gift', () => {
    const plan = giftPlan({ qcdAnnual: 0, spending: 40_000, cash: 200_000 })
    const shipped = buildOptimizerInput(plan, opts)
    expect(shipped.years.every((year) => year.forcedDistributionCashDiversion === 0)).toBe(true)
    expect(buildOptimizerModel(shipped).lp)
      .toBe(buildOptimizerModel(withoutCashDiversion(shipped)).lp)
  })

  it('makes the solver fund spending from somewhere real', async () => {
    // THE DISCRIMINATOR. Cash is small and spending is large, so the year's
    // money has to come from the IRA. Before the fix the solve could count the
    // gifted dollars as spendable and simply not withdraw them.
    const plan = giftPlan({ qcdAnnual: 30_000, spending: 40_000, cash: 10_000 })
    const shippedInput = buildOptimizerInput(plan, opts)
    const shipped = await optimizeSchedule(shippedInput)
    const regressed = await optimizeSchedule(withoutCashDiversion(shippedInput))
    expect(shipped.status).toBe('optimal')
    expect(regressed.status).toBe('optimal')

    const shipped0 = shipped.schedule[0]!
    const regressed0 = regressed.schedule[0]!
    // The corrected solve raises the gift from real sources — a larger draw, a
    // smaller surplus, or both — and the total it moves out of its buckets is
    // higher by the whole gift.
    const drawn = (row: typeof shipped0) =>
      row.withdrawTraditional + row.withdrawInheritedTraditional + row.withdrawOther + row.withdrawTaxable
    const endWealth = (row: typeof shipped0) =>
      row.endTrad + row.endInheritedTrad + row.endOther + row.endTaxable
    expect(drawn(shipped0)).toBeGreaterThan(drawn(regressed0))
    // DEFECT: the regressed solve ends the first year $30,000 richer than the
    // household does, on money it gave to a charity.
    expect(endWealth(regressed0) - endWealth(shipped0)).toBeCloseTo(30_000, 2)
  })

  it('does not let the error compound across a multi-year gift', async () => {
    // The deep-horizon probe. A gift that runs for a decade is not a decade of
    // independent one-year errors: every gifted dollar the old solve spent is a
    // dollar it never withdrew, so the buckets it carried forward were too big
    // and the next year's error started from there.
    const plan = giftPlan({ qcdAnnual: 30_000, spending: 40_000, cash: 10_000, planningAge: 86 })
    const shippedInput = buildOptimizerInput(plan, opts)
    expect(shippedInput.years.length).toBeGreaterThanOrEqual(10)
    const shipped = await optimizeSchedule(shippedInput)
    const regressed = await optimizeSchedule(withoutCashDiversion(shippedInput))
    expect(shipped.status).toBe('optimal')
    expect(regressed.status).toBe('optimal')

    const endWealth = (rows: typeof shipped.schedule) =>
      rows.map((row) => row.endTrad + row.endInheritedTrad + row.endOther + row.endTaxable)
    const shippedTrajectory = endWealth(shipped.schedule)
    const regressedTrajectory = endWealth(regressed.schedule)
    const gapByYear = regressedTrajectory.map((value, index) => value - shippedTrajectory[index]!)

    // The gap is the running sum of the gifts the old solve kept, so it MUST
    // grow every year and never plateau — a plateau would mean the term stopped
    // applying, and a shrink would mean it double-counted somewhere.
    expect(gapByYear[0]!).toBeCloseTo(30_000, 0)
    for (let t = 1; t < gapByYear.length; t++) {
      expect(gapByYear[t]!).toBeGreaterThan(gapByYear[t - 1]!)
    }
    // It is EXACTLY one gift a year while the two solves are otherwise the same
    // plan, and drifts below that once the regressed solve — sitting on money
    // the household gave away — starts taking a different tax path with it. The
    // drift is downward, so the bar below is the conservative one: after ten
    // gift years the old solve was carrying most of a decade of gifts.
    expect(gapByYear[6]!).toBeCloseTo(30_000 * 7, 0)
    expect(gapByYear[gapByYear.length - 1]!).toBeGreaterThan(30_000 * 9)
    // And the ledger agrees the gift ran every one of those years.
    const gifts = simulatePlan(plan, opts).years.map((year) => year.qcd)
    expect(gifts.every((gift) => Math.abs(gift - 30_000) < 0.01)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// GAP B — the pension lump-sum rollover credit.
// ---------------------------------------------------------------------------

/**
 * An elected pension lump sum: the offer commutes the stream into a tax-free
 * direct rollover, the traditional account is credited, and the pension never
 * pays again.
 *
 * The LP already saw HALF of that: the stream vanishes out of `exogenousCash`
 * from the election year on. Booking only that half made the solve poorer than
 * the household by the whole offer, for the rest of the horizon — the one
 * direction of one-sided booking that costs the user money by UNDER-stating
 * what they have.
 */
function lumpSumPlan(options: { elect: boolean }): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1959-01-01', // 67 in 2026 — the pension is already paying.
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 72, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  plan.expenses.baseAnnual = 30_000
  plan.expenses.healthcare = zeroedHealthcare()
  plan.accounts = [
    { type: 'traditional', id: 'l-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 300_000, annualContribution: 0 },
    { type: 'roth', id: 'l-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: 'l-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 50_000, annualContribution: 0 },
    {
      type: 'pension',
      id: 'l-pension',
      name: 'Pension',
      ownerPersonId: 'p1',
      annualReturnPct: 0,
      startAge: 65,
      monthlyAmount: 2_000,
      colaPct: 0,
      survivorPct: 0,
      lumpSumOffer: { amount: 400_000, electionYear: 2027 },
      ...(options.elect ? { lumpSumElection: { rolloverAccountId: 'l-ira' } } : {}),
    },
  ]
  return validate(plan)
}

describe('GAP B (closed): an elected pension lump sum credits the LP', () => {
  it('tracks the ledger’s credit in the traditional recursion, with no proceeds', () => {
    const plan = lumpSumPlan({ elect: true })
    const ledgerYears = simulatePlan(plan, opts).years
    const probes = probesFor(plan)
    const electionIndex = probes.findIndex((probe) => probe.year === 2027)
    expect(electionIndex).toBeGreaterThanOrEqual(0)
    const modeled = buildOptimizerInput(plan, opts).years[electionIndex]!

    // The credit reaches the channel at the offer's own figure, on the account
    // the election named.
    const movement = probes[electionIndex]!.exogenousStrategyAccountMovement
    expect(movement).toEqual([{ accountId: 'l-ira', amount: 400_000 }])
    expect(modeled.exogenousStrategyMovement?.trad).toBeCloseTo(400_000, 6)
    // NO PROCEEDS, and this is the claim worth pinning rather than assuming: a
    // direct rollover is plan-to-IRA money that never passes through the
    // household's hands, so it is not spendable cash. The ledger agrees — the
    // election year's pension income is zero, and the offer appears nowhere in
    // the year's inflows.
    expect(modeled.exogenousStrategyMovement?.proceeds).toBe(0)
    const electionYear = ledgerYears.find((year) => year.year === 2027)!
    expect(electionYear.incomes.pension).toBeCloseTo(0, 6)
    // Nor is it income: a tax-free direct rollover puts nothing on the return,
    // so the year's ordinary base carries no part of it.
    const priorYear = ledgerYears.find((year) => year.year === 2026)!
    expect(priorYear.incomes.pension).toBeCloseTo(24_000, 6)
    expect(modeled.ordinaryIncomeBase).toBeLessThan(priorYear.incomes.pension)

    // And the recursion lands on the ledger's own closing balance. Growth is
    // zero, so this is exact.
    const openingTrad = ledgerYears.find((year) => year.year === 2026)!.balances['l-ira']!
    const drawn = probes[electionIndex]!.incumbentTraditionalDistribution
    const lpEndTrad = openingTrad - drawn + (modeled.exogenousStrategyMovement?.trad ?? 0)
    expect(lpEndTrad).toBeCloseTo(electionYear.balances['l-ira']!, 2)
    // DEFECT: without the credit the LP carried $400,000 less than the ledger
    // in that bucket, from the election year to the end of the horizon.
    expect(electionYear.balances['l-ira']! - (openingTrad - drawn)).toBeCloseTo(400_000, 2)
  })

  it('is byte-identical when the offer is not elected', () => {
    const plan = lumpSumPlan({ elect: false })
    const input = buildOptimizerInput(plan, opts)
    expect(input.years.every((year) => year.exogenousStrategyMovement === undefined)).toBe(true)
    expect(buildOptimizerModel(input).lp)
      .toBe(buildOptimizerModel(withoutStrategyMovement(input)).lp)
    expect(optimizerUnsupportedRetirementActions(plan)).toEqual([])
  })

  it('lets the solve spend the money the household actually has', async () => {
    const plan = lumpSumPlan({ elect: true })
    const shippedInput = buildOptimizerInput(plan, opts)
    const shipped = await optimizeSchedule(shippedInput)
    const regressed = await optimizeSchedule(withoutStrategyMovement(shippedInput))
    expect(shipped.status).toBe('optimal')
    expect(regressed.status).toBe('optimal')

    const endWealth = (rows: typeof shipped.schedule) =>
      rows.map((row) => row.endTrad + row.endInheritedTrad + row.endOther + row.endTaxable)
    const shippedTrajectory = endWealth(shipped.schedule)
    const regressedTrajectory = endWealth(regressed.schedule)
    const electionIndex = shippedInput.years.findIndex((year) => year.year === 2027)
    expect(electionIndex).toBeGreaterThan(0)
    // DEFECT, in the direction that under-states the household: from the
    // election year on, the corrected solve carries essentially the whole
    // $400,000 offer the regressed one never saw, and carries it for every
    // remaining year. It is a level shift rather than a compounding one —
    // growth is zero and the credit happens once — and it falls a little short
    // of the offer because the regressed solve, left poorer, takes a cheaper
    // tax path with the money it does have.
    for (let t = electionIndex; t < shippedTrajectory.length; t++) {
      const gap = shippedTrajectory[t]! - regressedTrajectory[t]!
      expect(gap).toBeGreaterThan(380_000)
      expect(gap).toBeLessThanOrEqual(400_000)
    }
    // The solver looks forward, so the year BEFORE the election is not
    // untouched: knowing the rollover is coming changes what it does with the
    // bracket room it has now. Asserting sameness there would be asserting that
    // the LP is myopic, which it is not.
    expect(shippedTrajectory[0]).not.toBe(regressedTrajectory[0])
  })
})

// ---------------------------------------------------------------------------
// THE SWEEP'S FINDING — a TIPS-ladder purchase.
// ---------------------------------------------------------------------------

/**
 * The channel sweep asked what else mutates an LP bucket or the cash flow
 * without either channel or an LP variable carrying it, and the TIPS-ladder
 * purchase came back: `simulate.ts` debits the funding account for the quoted
 * cost under a comment that says, in its own words, that these are the same
 * transfer semantics as an annuity premium — which the channel already carries.
 * The premium was booked and the ladder was not.
 *
 * The rungs pay back through `incomes.tipsLadder`, which is already inside
 * `exogenousCash`, so the purchase is a debit with no proceeds, exactly as the
 * premium is.
 */
function ladderPlan(options: { ladder: 'purchased' | 'owned' | 'none' }): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1959-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 74, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.assumptions.heirTaxRatePct = 25
  // Spending is zero so the purchase is the ONLY thing that moves the funding
  // account in the purchase year, which lets the ledger's own balance delta
  // stand in for the ladder's price without this fixture reimplementing the
  // yield curve that sized it.
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = zeroedHealthcare()
  plan.accounts = [
    { type: 'traditional', id: 't-ira', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 400_000, annualContribution: 0 },
    { type: 'roth', id: 't-roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: 0, kind: 'ira', balance: 0, annualContribution: 0 },
    { type: 'cash', id: 't-cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 300_000, annualContribution: 0 },
  ]
  if (options.ladder !== 'none') {
    plan.incomeFloor = {
      ladders: [{
        id: 't-ladder',
        name: 'Floor',
        purpose: 'floor',
        startYear: 2029,
        endYear: 2033,
        annualRealAmount: 12_000,
        ...(options.ladder === 'purchased'
          ? { purchase: { year: 2027, fundingAccountId: 't-cash' } }
          : {}),
      }],
    }
  }
  return validate(plan)
}

describe('SWEEP (closed): a TIPS-ladder purchase debits the LP’s bucket', () => {
  it('books the purchase price the ledger actually spent, with no proceeds', () => {
    const plan = ladderPlan({ ladder: 'purchased' })
    const ledgerYears = simulatePlan(plan, opts).years
    const probes = probesFor(plan)
    const purchaseIndex = probes.findIndex((probe) => probe.year === 2027)
    expect(purchaseIndex).toBeGreaterThanOrEqual(0)

    // What the purchase actually took, measured against the same plan with no
    // ladder at all rather than recomputed from the embedded real-yield curve
    // that sized it. The two plans are identical through 2027 — the rungs pay
    // nothing before 2029 — so their cash accounts differ by the price and by
    // nothing else.
    const withPurchase = ledgerYears.find((year) => year.year === 2027)!.balances['t-cash']!
    const withoutLadder = simulatePlan(ladderPlan({ ladder: 'none' }), opts)
      .years.find((year) => year.year === 2027)!.balances['t-cash']!
    const purchaseCost = withoutLadder - withPurchase
    expect(purchaseCost).toBeGreaterThan(0)

    const movement = probes[purchaseIndex]!.exogenousStrategyAccountMovement
    expect(movement.length).toBe(1)
    expect(movement[0]!.accountId).toBe('t-cash')
    // DEFECT: this entry did not exist, so the LP kept spending a cash bucket
    // the ledger had already emptied by the ladder's price — and kept it for
    // every remaining year.
    expect(-movement[0]!.amount).toBeCloseTo(purchaseCost, 2)
    expect(probes[purchaseIndex]!.exogenousStrategyProceeds).toBe(0)

    // The cash account is the tax-free bucket, so the debit lands in `other`.
    const modeled = buildOptimizerInput(plan, opts).years[purchaseIndex]!
    expect(modeled.exogenousStrategyMovement?.other).toBeCloseTo(-purchaseCost, 2)
    expect(modeled.exogenousStrategyMovement?.trad).toBe(0)
    expect(modeled.exogenousStrategyMovement?.proceeds).toBe(0)

    // No proceeds is the right booking because the rungs pay back later through
    // income the LP already carries: the payout years show ladder income the
    // purchase year does not.
    const payoutYear = ledgerYears.find((year) => year.year === 2029)!
    expect(payoutYear.incomes.tipsLadder).toBeGreaterThan(0)
    expect(ledgerYears.find((year) => year.year === 2027)!.incomes.tipsLadder).toBe(0)

    expect(optimizerUnsupportedRetirementActions(plan)).toEqual([])
  })

  it('is byte-identical for an already-owned ladder with no purchase', () => {
    const plan = ladderPlan({ ladder: 'owned' })
    const input = buildOptimizerInput(plan, opts)
    expect(input.years.every((year) => year.exogenousStrategyMovement === undefined)).toBe(true)
    expect(buildOptimizerModel(input).lp)
      .toBe(buildOptimizerModel(withoutStrategyMovement(input)).lp)
  })
})
