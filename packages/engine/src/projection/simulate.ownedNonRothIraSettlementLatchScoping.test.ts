/**
 * The exact-cent settlement's disqualification latch, on real Plans.
 *
 * The unit-level dispositions live in
 * `simulate.ownedNonRothIraAnnualSettlementRollback.test.ts`, which drives the
 * settlement module through a controller so it can raise any rollback reason on
 * demand. These are the shapes a user can actually build: a charitable-gift
 * projection with one annuity-purchase year in the middle of it, the same thing
 * in a two-owner household, and a Plan carrying an exact IRA withdrawal the
 * executor refuses. What they pin is the HORIZON -- that a year the source
 * series cannot characterize costs the projection that year and not the rest of
 * it -- and the basis chain across the seam, to the cent.
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
    startAge: 90,
    monthlyAmount: 0,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: purchaseYear,
      premium,
      fundingAccountId,
      taxQualification: 'qualified',
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
  it('settles again after one annuity-purchase year interrupts a gift chain', () => {
    // The adversarial shape, interleaved: gift, gift, annuity year, gift. Under
    // the former sticky latch the 2028 purchase set the household flag and 2029
    // -- a plain gift year with nothing wrong with it -- settled false forever.
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
      .toEqual([true, true, false, true])
    expect(control.map((year) =>
      Object.hasOwn(year, 'ownedNonRothIraAnnualReplay')))
      .toEqual([true, true, true, true])
    // The withheld window is exactly one year wide. 2029 is a plain gift year
    // with nothing wrong with it, and it settles.
    const published = openingBasisCents(years, 'p1')
    expect(published).toEqual([2_000_000, 1_934_961, null, 1_800_878])

    // THE SEAM, TO THE CENT. 2028's fallback pass committed p1's basis through
    // the same `iraBasisByOwner` the settled path writes, and 2029's replay
    // opens on exactly that figure -- as a plan seed, which is what every
    // annual replay's opening basis is. The 69,111 cents between them are the
    // basis the fallback year's own requirement and gift consumed; nothing is
    // carried over from the exact-cent replay that year discarded.
    expect(nextOpeningBasisCents(years, 1, 'p1')).toBe(1_869_989)
    expect(1_869_989 - published[3]!).toBe(69_111)
    expect(years[3]!.ownedNonRothIraAnnualReplay!.annualReplay.ownerReplays[0])
      .toMatchObject({ ownerPersonId: 'p1', openingBasisSource: 'planSeed' })
    // Nothing about the blocked year's own economics changed: the 5,000 premium
    // still left the IRA and the year still priced on the legacy ledger.
    expect(control[2]!.balances.ira! - years[2]!.balances.ira!)
      .toBeCloseTo(5_000, 9)
  })

  /**
   * The co-owner case, at three return assumptions.
   *
   * The refusal that fires is the application-chain arm, which carries the
   * owner on its context, so it is p1's year that is disqualified and not the
   * household's. `publishableOwners` is still all-or-nothing -- the joined
   * artifact is withheld for that year because p1 appears in it -- so what this
   * asserts is that p2's ECONOMICS survive and that publication resumes the
   * next year for both.
   *
   * What it does NOT assert is that p2's basis figure survives unchanged,
   * because it does not. The blocked year prices p2's pool on the legacy
   * fallback ledger, whose pro-rata denominator is measured before the year's
   * first distribution rather than at its close -- the departure registered as
   * `irc-408-d-2-C-projection-pro-rata-measurement-instant`. The two instants
   * differ by exactly the growth on the retained balance, so they coincide only
   * in a flat year and diverge with the sign of the return: in a gain year the
   * fallback recovers MORE basis and leaves p2 opening the next year lower, in
   * a loss year less and higher. A fixture that only ever ran at 0 percent
   * would have read that coincidence as an invariant.
   */
  const coupleReturns: readonly (readonly [number, number, number])[] = [
    // [return pct, p2's TAX_YEAR + 2 opening basis cents, its delta from control]
    [0, 1_831_961, 0],
    [5, 1_835_648, -3_825],
    [-5, 1_827_901, 4_191],
  ]
  it.each(coupleReturns)(
    'leaves a co-owner’s economics whole through the other’s annuity year at %i percent',
    (returnPct, p2Opening, p2Delta) => {
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
        .toEqual([true, false, true])
      expect(control.map((year) =>
        Object.hasOwn(year, 'ownedNonRothIraAnnualReplay')))
        .toEqual([true, true, true])

      // THE ECONOMICS SURVIVE, at every return: p2's balance coming out of the
      // blocked year is cent-for-cent the balance the same household produces
      // with no annuity in it at all. Nothing p2 owns moved because of p1's
      // purchase.
      expect(years[2]!.balances['ira-p2'])
        .toBe(control[2]!.balances['ira-p2'])
      // THE BASIS FIGURE DIVERGES, by the measurement instant and by nothing
      // else -- zero in the flat year, and signed with the return otherwise.
      expect(openingBasisCents(years, 'p2')[2]).toBe(p2Opening)
      expect(openingBasisCents(years, 'p2')[2]! -
        openingBasisCents(control, 'p2')[2]!).toBe(p2Delta)
      // p1 is settling again -- the year-scoped disposition did not quietly
      // become a per-owner permanent one.
      expect(openingBasisCents(years, 'p1')[2]).not.toBeNull()
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
