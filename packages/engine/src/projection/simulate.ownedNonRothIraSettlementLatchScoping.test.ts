/**
 * The exact-cent settlement, on real Plans, across the shapes that used to
 * interrupt it.
 *
 * The unit-level dispositions live in
 * `simulate.ownedNonRothIraAnnualSettlementRollback.test.ts`, which drives the
 * settlement module through a controller so it can raise any rollback reason on
 * demand. These are the shapes a user can actually build: a charitable-gift
 * projection with one annuity-purchase year in the middle of it, the same thing
 * in a two-owner household, and a Plan carrying an exact IRA withdrawal the
 * executor refuses.
 *
 * WHAT THEY PINNED, AND WHAT THEY PIN NOW. Each of these three years used to be
 * refused by the source series, and what these fixtures asserted was the
 * HORIZON of that refusal -- that a year the replay could not characterize cost
 * the projection that year and not the rest of it. Two of the three refusals
 * are gone: the declared withdrawal the executor refuses moves no dollars and
 * settled from #252, and the annuity premium now stages into the contract-value
 * channel that Form 8606 line 6 adds. The `[true, false, true]` shape below is
 * therefore `[true, true, true]`, and what is left worth pinning is stronger
 * than the horizon was -- the basis chain running unbroken THROUGH the
 * purchase, and the one figure the purchase does move, which is the growth the
 * engine's contract-value convention does not credit.
 */
import { describe, expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
/** Born 1950, so 76 in 2026: past 70½ for QCDs and taking requirements. */
const DONOR_DOB = '1950-01-01'

function ira(
  id: string,
  balance: number,
  basis: number,
  ownerPersonId = 'p1',
  annualReturnPct = 0,
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct, nondeductibleBasis: basis }
}

function qualifiedAnnuity(
  purchaseYear: number,
  premium: number,
  fundingAccountId: string,
  ownerPersonId = 'p1',
): Account {
  return {
    type: 'annuity',
    id: `annuity-${fundingAccountId}`,
    name: 'Qualified annuity',
    ownerPersonId,
    annualReturnPct: null,
    // Immediate: a qualified purchase that is not a QLAC may not defer past the
    // owner's required beginning date, and this donor's has gone by, so the
    // contract must commence in its purchase year. It pays nothing regardless,
    // since `monthlyAmount` is 0 — only the premium leaving the pool matters
    // here.
    startAge: purchaseYear - Number(DONOR_DOB.slice(0, 4)),
    monthlyAmount: 0,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: purchaseYear,
      premium,
      fundingAccountId,
      taxQualification: 'qualified',
      // Declared a QLAC, and the declaration changes no figure below: the
      // engine reaches the same required-distribution base either way, which is
      // what `treas-reg-1-401-a-9-5-b-4-qlac-excluded-from-the-rmd-account-
      // balance` records from one side and
      // `treas-reg-1-401-a-9-6-a-3-i-annuity-payments-commence-by-the-required-
      // beginning-date` from the other. What it buys is that the fixture is a
      // contract the regulations permit: payments starting at 90 are nine years
      // past this owner's required beginning date, and 1.401(a)(9)-6(q)(1)(iii)
      // is the only exemption from the commence-by-the-RBD rule there is.
      qlac: true,
    },
  }
}

function run(plan: Plan, endYear: number): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
}

/** Every year's published settlement, as `taxYear -> owner -> opening cents`. */
function openingBasisCents(
  years: readonly YearResult[],
  ownerPersonId: string,
): (number | null)[] {
  return years.map((year) => {
    const owner = year.ownedNonRothIraAnnualReplay?.annualReplay.ownerReplays
      .find((entry) => entry.ownerPersonId === ownerPersonId)
    return owner === undefined ? null : owner.openingBasisAmount
  })
}

function nextOpeningBasisCents(
  years: readonly YearResult[],
  index: number,
  ownerPersonId: string,
): number {
  const owner = years[index]!.ownedNonRothIraAnnualReplay?.annualReplay
    .ownerReplays.find((entry) => entry.ownerPersonId === ownerPersonId)
  if (owner === undefined) {
    throw new Error(`year index ${index} published nothing for ${ownerPersonId}`)
  }
  return owner.nextYearOpeningBasisAmount
}

describe('owned-IRA settlement latch scoping', () => {
  it('settles every year of a gift chain an annuity purchase runs through', () => {
    // The adversarial shape, interleaved: gift, gift, annuity year, gift. It
    // has been three fixtures in one place. Under the original sticky latch the
    // 2028 purchase set a household flag and 2029 -- a plain gift year with
    // nothing wrong with it -- settled false forever. Under #252's year-scoped
    // horizon only 2028 was withheld. Now none is: the premium is not a
    // distribution under IRC 408(d)(1), the contract it bought is inside the
    // same 408(d)(2)(A) aggregate the account is, and the replay carries both.
    const giftPlan = (withAnnuity: boolean): Plan => {
      const plan = singlePersonPlan({ dob: DONOR_DOB, planningAge: 90 })
      plan.id = `latch-scoping-gift-annuity-gift-${String(withAnnuity)}`
      plan.accounts = [
        ira('ira', 100_000, 20_000),
        ...(withAnnuity ? [qualifiedAnnuity(TAX_YEAR + 2, 5_000, 'ira')] : []),
      ]
      plan.strategies.qcdAnnual = 1_000
      return plan
    }

    const years = run(giftPlan(true), TAX_YEAR + 3)
    const control = run(giftPlan(false), TAX_YEAR + 3)

    expect(years.map((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay')))
      .toEqual([true, true, true, true])
    expect(control.map((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay')))
      .toEqual([true, true, true, true])

    // THE PURCHASE IS INVISIBLE TO THE FORM, and at a flat return that is
    // literal: every year's opening basis is cent-for-cent the figure the
    // identical household that bought no contract carries. Section 408(d)(2)(A)
    // has no term that distinguishes them -- the premium moved value from one
    // line-6 asset to another and destroyed none of it -- and neither does the
    // engine now.
    const published = openingBasisCents(years, 'p1')
    expect(published).toEqual([2_000_000, 1_934_961, 1_869_989, 1_804_692])
    expect(published).toEqual(openingBasisCents(control, 'p1'))

    // THE SEAM, TO THE CENT, and it is a settled seam now rather than a
    // fallback one. Each annual replay is one year long and opens on the figure
    // the projection is carrying, so `planSeed` is what every one of them
    // reports; what says the chain held is that 2029's seed IS 2028's committed
    // carryforward, and that 2028 is a year the exact-cent replay produced
    // rather than one it discarded.
    expect(nextOpeningBasisCents(years, 2, 'p1')).toBe(published[3]!)
    expect(years[2]!.ownedNonRothIraAnnualReplay).toMatchObject({
      status: 'committedOwnedNonRothIraAnnualReplay',
      taxYear: TAX_YEAR + 2,
    })
    // The economics are unchanged: the 5,000 premium still leaves the IRA. What
    // changed is that the value is no longer lost to the form on its way out.
    expect(control[2]!.balances.ira! - years[2]!.balances.ira!)
      .toBeCloseTo(5_000, 9)
  })

  /**
   * The co-owner case, at three return assumptions.
   *
   * IT USED TO BE A DISQUALIFICATION FIXTURE. The application-chain arm refused
   * p1's year for the premium, and because `publishableOwners` is
   * all-or-nothing the joined artifact was withheld for the year p1 appeared
   * in; what this asserted was that p2's ECONOMICS survived it and that
   * publication resumed. Both owners settle in all three years now, so p2's
   * BASIS survives too -- cent for cent, at every return -- which the fallback
   * year's measurement instant used to make impossible.
   *
   * WHAT DOES MOVE IS P1'S, and only away from a flat return. The engine's
   * contract-value convention credits the contract no growth, because the Plan
   * carries no contract growth rate and `annualReturnPct` on an annuity account
   * describes a balance the account does not have. So the premium's dollars
   * stop compounding inside line 6 the moment they buy the contract, while the
   * same dollars left in the IRA would have kept compounding. In a GAIN year
   * that makes the annuity household's line-6 denominator smaller than the
   * control's, the basis fraction larger, and more basis recovered -- so less
   * is carried forward. In a LOSS year the contract holds flat while the
   * control's dollars shrink, the denominator is larger, and less basis is
   * recovered. That is the convention's error running in both directions, and
   * these are the figures, registered as
   * `engine-convention-ira-annuity-contract-value-premium-less-payments`.
   */
  const coupleReturns: readonly (readonly [number, number])[] = [
    // [return pct, p1's TAX_YEAR + 2 opening basis delta from control, cents]
    [0, 0],
    [5, -190],
    [-5, 252],
  ]
  it.each(coupleReturns)(
    'settles both owners through an annuity year at %i percent',
    (returnPct, p1Delta) => {
      const couple = (withAnnuity: boolean): Plan => {
        const plan = couplePlan({
          p1Dob: DONOR_DOB,
          p2Dob: DONOR_DOB,
          p1PlanningAge: 90,
          p2PlanningAge: 90,
        })
        plan.id =
          `latch-scoping-couple-annuity-${String(withAnnuity)}-${returnPct}`
        plan.assumptions.defaultReturnPct = returnPct
        plan.accounts = [
          ira('ira-p1', 100_000, 20_000, 'p1', returnPct),
          ira('ira-p2', 100_000, 20_000, 'p2', returnPct),
          ...(withAnnuity
            ? [qualifiedAnnuity(TAX_YEAR + 1, 5_000, 'ira-p1', 'p1')]
            : []),
        ]
        return plan
      }

      const years = run(couple(true), TAX_YEAR + 2)
      const control = run(couple(false), TAX_YEAR + 2)

      expect(years.map((year) =>
        Object.hasOwn(year, 'ownedNonRothIraAnnualReplay')))
        .toEqual([true, true, true])
      expect(control.map((year) =>
        Object.hasOwn(year, 'ownedNonRothIraAnnualReplay')))
        .toEqual([true, true, true])

      // THE ECONOMICS SURVIVE, at every return: p2's balance coming out of the
      // purchase year is cent-for-cent the balance the same household produces
      // with no annuity in it at all. Nothing p2 owns moved because of p1's
      // purchase.
      expect(years[2]!.balances['ira-p2'])
        .toBe(control[2]!.balances['ira-p2'])
      // AND SO DOES P2'S BASIS FIGURE, which it did not while p1's year fell
      // back: the fallback priced p2's pool at the before-the-first-
      // distribution instant, so the co-owner's basis moved with the return
      // because of a purchase in the other spouse's account.
      expect(openingBasisCents(years, 'p2')[2])
        .toBe(openingBasisCents(control, 'p2')[2])
      // p1's own figure moves by the growth the contract-value convention does
      // not credit, and by nothing else: zero in the flat year, and signed
      // against the return.
      expect(openingBasisCents(years, 'p1')[2]! -
        openingBasisCents(control, 'p1')[2]!).toBe(p1Delta)
    },
  )

  it('settles a gift year beside a refused exact IRA-withdrawal declaration', () => {
    // The Plan declares an exact ordinary withdrawal from the owned IRA. The
    // executor refuses it -- `withdrawal-source-type-unsupported`, because its
    // source scope is cash, equity compensation and taxable -- so no dollars
    // move. The year settles, and the refusal is still published on the action's
    // own evidence rather than being swallowed by a year-wide refusal.
    const plan = singlePersonPlan({ dob: DONOR_DOB, planningAge: 90 })
    plan.id = 'latch-scoping-refused-declaration'
    plan.accounts = [ira('ira', 100_000, 20_000)]
    plan.strategies.qcdAnnual = 1_000
    plan.strategies.retirementActions = [{
      actionId: 'refused-ira-withdrawal',
      kind: 'ordinaryWithdrawal',
      year: TAX_YEAR,
      executionDate: `${TAX_YEAR}-06-15`,
      executionSequence: 1,
      requestedAmount: 500_000,
      provenance: { source: 'manual' },
      personId: 'p1',
      allocations: [{
        allocationId: 'refused-ira-allocation',
        sourceAccountId: 'ira',
        requestedAmount: 500_000,
      }],
      purpose: { kind: 'spending' },
    }] as Plan['strategies']['retirementActions']

    const withoutDeclaration = singlePersonPlan({
      dob: DONOR_DOB, planningAge: 90,
    })
    withoutDeclaration.id = 'latch-scoping-refused-declaration-control'
    withoutDeclaration.accounts = [ira('ira', 100_000, 20_000)]
    withoutDeclaration.strategies.qcdAnnual = 1_000

    const years = run(plan, TAX_YEAR)
    const control = run(withoutDeclaration, TAX_YEAR)

    // The gift year settles.
    expect(years[0]!.ownedNonRothIraAnnualReplay).toMatchObject({
      status: 'committedOwnedNonRothIraAnnualReplay',
      taxYear: TAX_YEAR,
    })
    // The refusal is published on the action, in its own evidence record.
    const evidence = years[0]!.retirementActionExecution?.evidence
      .find((entry) => String(entry.actionId) === 'refused-ira-withdrawal')
    expect(evidence).toBeDefined()
    expect(evidence!.readiness).toBe('nonActionable')
    expect(evidence!.disposition.reasons.map((reason) => reason.code))
      .toContain('withdrawal-source-type-unsupported')
    expect(evidence!.allocations[0]).toMatchObject({
      sourceAccountId: 'ira',
      executedAmount: 0,
    })
    // Balances untouched: a declaration whose execution refused leaves the year
    // exactly as the same year without the declaration.
    expect(years[0]!.balances.ira).toBe(control[0]!.balances.ira)
    expect(
      years[0]!.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays[0]!
        .nextYearOpeningBasisAmount,
    ).toBe(
      control[0]!.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays[0]!
        .nextYearOpeningBasisAmount,
    )
  })
})
