import { expect, it } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { couplePlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type {
  SimulatorRetirementRuntimeAggregateRothDestinationCredit,
  YearResult,
} from './types.js'

/**
 * The distributee half of the conversion-identity rule, which is settled.
 *
 * The aggregate conversion path used to choose its destination once, as the
 * first Roth account in Plan array order with no owner predicate, and then draw
 * from every convertible traditional account with no owner filter. A married
 * household whose only Roth belonged to Pat and whose only convertible balance
 * belonged to Robin therefore converted Robin's dollars into Pat's Roth and said
 * nothing. It now snapshots each owner's gross convertible balance after the RMD
 * block, splits the sized household amount pro rata in exact cents, drains only
 * that owner's accounts, credits only a Roth that owner owns, and trims and
 * names the slice of an owner who holds no Roth at all.
 *
 * WHERE THE EVIDENCE COMES FROM, and why not from the total. An assertion on
 * `year.rothConversion` alone cannot see this rule: the pre-slice engine
 * converted the same household total, into the wrong person's account. So the
 * split cases below assert the per-owner destination credit two ways —
 * `year.balances` for the amount that reached each account, and the runtime
 * application source for the owner PAIRING, since
 * `aggregateRothDestinationCredit` carries `destinationOwnerPersonId` alongside
 * the `sourceOwnerPersonIds` whose debits produced it. The pairing is the only
 * evidence that states the rule directly rather than implying it from balances.
 *
 * Builders come from `testing/planFixtures.js`, the same route
 * `simulate.crossOwnerRothConversion.test.ts` takes, so the two files cannot
 * drift on what a household looks like.
 */

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function ira(
  id: string,
  balance: number,
  ownerPersonId: string,
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId, 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function roth(id: string, ownerPersonId: string): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    kind: 'ira',
    balance: 0,
    annualReturnPct: 0,
    annualContribution: 0,
  }
}

function household(): Plan {
  const plan = couplePlan({ p1PlanningAge: 60, p2PlanningAge: 60 })
  plan.id = 'conversion-owner-identity'
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  return plan
}

function run(plan: Plan): {
  warnings: readonly string[]
  year: Readonly<YearResult>
} {
  const result = simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: noTax,
  })
  return { warnings: result.warnings, year: result.years[0]! }
}

/**
 * Every per-owner destination credit the aggregate conversion recorded, in the
 * order the slices were allocated. Throws rather than returning empty when the
 * source is absent: a missing source would otherwise turn every assertion below
 * into a vacuous statement about an empty array.
 */
function destinationCredits(
  year: Readonly<YearResult>,
): readonly Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit>[] {
  const source = year.retirementRuntimeApplicationSource
  if (source === undefined) throw new Error('expected a runtime application source')
  return source.applications.filter(
    (application): application is
      Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit> =>
      application.applicationKind === 'aggregateRothDestinationCredit',
  )
}

const SKIPPED_WARNING =
  'Robin has no Roth account, so Robin’s share of the Roth conversion was skipped — ' +
  'a conversion has to land in the same person’s own Roth. ' +
  'Opening a Roth IRA for Robin would let that share convert.'
const NO_ROTH_WARNING =
  'Roth conversions were requested but the plan has no Roth account; conversions skipped.'

describeRule('irc-408-d-3-A-i-conversion-benefits-the-distributee', {
  readings: {
    // Only Pat holds a Roth and only Robin holds a convertible balance, so
    // there is no pair of accounts a conversion could legally run between and
    // the statutory answer is to convert nothing. The rejected reading is the
    // engine's own former behaviour, which crossed the owner boundary and
    // recognised the whole request.
    statuteRequiresOneIndividualOnBothSides: 0,
    crossOwnerConversionIntoTheOtherSpousesRoth: 20_000,
  },
  accepted: 'statuteRequiresOneIndividualOnBothSides',
}, ({ accepted, readings }) => {
  it('does not convert one spouse’s IRA into the other spouse’s Roth', () => {
    const plan = household()
    plan.accounts = [roth('pat-roth', 'p1'), ira('robin-ira', 100_000, 'p2')]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 20_000 }],
    }

    const { year } = run(plan)

    expect(year.rothConversion).toBeCloseTo(accepted, 6)
    expect(year.rothConversion)
      .not.toBeCloseTo(readings.crossOwnerConversionIntoTheOtherSpousesRoth, 6)
    // Both accounts stand still. Asserted per account, because a total of zero
    // is also what a path that moved 20,000 out and 20,000 back would report.
    expect(year.balances['robin-ira']).toBeCloseTo(100_000, 6)
    expect(year.balances['pat-roth']).toBeCloseTo(0, 6)
    // No conversion means no inclusion. A path that moved nothing while still
    // recognising the income would satisfy the balance assertions alone and be
    // a worse defect than the one it replaced.
    expect(year.magi).toBeCloseTo(0, 6)
  })

  it('says whose share was skipped and what would let it convert', () => {
    // Silence was the part that made the old behaviour survivable: the same
    // code path announced its other refusals, so a reader had every reason to
    // read silence as assent. The refusal now names the person and the one
    // thing that would change the answer.
    //
    // Asserted against the run-level `warnings`, which is the only warning
    // channel there is. An earlier draft of this test read `year.warnings`,
    // which does not exist on `YearResult`: it compared `undefined ?? []` to
    // `[]` and passed while proving nothing. That is the defect this whole
    // registry exists to make impossible, reproduced by hand, and only `tsc`
    // caught it.
    const plan = household()
    plan.accounts = [roth('pat-roth', 'p1'), ira('robin-ira', 100_000, 'p2')]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 20_000 }],
    }

    const { warnings } = run(plan)

    expect(warnings).toContain(SKIPPED_WARNING)
    expect(warnings).not.toContain(NO_ROTH_WARNING)
  })

  it('does warn when the destination is missing entirely, so the household case is distinct', () => {
    // A plan with no Roth at all is a household-wide refusal, not an owner's,
    // and keeps its own wording.
    const plan = household()
    plan.accounts = [ira('robin-ira', 100_000, 'p2')]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 20_000 }],
    }

    const { warnings } = run(plan)

    expect(warnings).toContain(NO_ROTH_WARNING)
    expect(warnings).not.toContain(SKIPPED_WARNING)
  })

  it('converts the same amount when the owners do match, so the fixture is about identity', () => {
    // The control. Same request, same balance, same household -- only the owner
    // of the convertible account changes. A conversion from Pat's IRA to Pat's
    // Roth is exactly what the statute permits, and the engine produces that
    // number for it, into that account.
    const plan = household()
    plan.accounts = [roth('pat-roth', 'p1'), ira('pat-ira', 100_000, 'p1')]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 20_000 }],
    }

    const { year } = run(plan)

    expect(year.rothConversion).toBeCloseTo(20_000, 6)
    expect(year.balances['pat-roth']).toBeCloseTo(20_000, 6)
    expect(year.balances['pat-ira']).toBeCloseTo(80_000, 6)
  })

  it('credits each owner’s own Roth with that owner’s own pro-rata slice', () => {
    // Both people can convert, so nothing is trimmed and the whole 40,000
    // moves. What the rule decides is WHERE it moves. Pat holds three times
    // Robin's convertible balance, so the split is 3:1 -- 30,000 and 10,000 --
    // and each slice must leave that person's own IRA and land in that person's
    // own Roth.
    //
    // The pre-slice engine converted this same 40,000 total into `pat-roth`
    // alone, drawing 30,000 of it out of Robin's IRA. Every assertion here is
    // chosen to separate that from the correct answer; an assertion on
    // `year.rothConversion` would not, which is the whole point.
    const plan = household()
    plan.accounts = [
      ira('robin-ira', 30_000, 'p2'),
      ira('pat-ira', 90_000, 'p1'),
      roth('pat-roth', 'p1'),
      roth('robin-roth', 'p2'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 40_000 }],
    }

    const { warnings, year } = run(plan)

    // Each owner's own IRA falls by exactly that owner's own slice...
    expect(year.balances['pat-ira']).toBeCloseTo(60_000, 6)
    expect(year.balances['robin-ira']).toBeCloseTo(20_000, 6)
    // ...and that same slice arrives in that owner's own Roth.
    expect(year.balances['pat-roth']).toBeCloseTo(30_000, 6)
    expect(year.balances['robin-roth']).toBeCloseTo(10_000, 6)
    // The parts are the whole: no dollar was created, lost, or double counted
    // between the per-owner credits and the figure the year publishes.
    const credited = year.balances['pat-roth']! + year.balances['robin-roth']!
    expect(credited).toBeCloseTo(year.rothConversion, 10)
    expect(year.rothConversion).toBeCloseTo(40_000, 6)
    expect(warnings).not.toContain(SKIPPED_WARNING)
    expect(warnings).not.toContain(NO_ROTH_WARNING)
  })

  it('never credits one owner’s Roth out of another owner’s dollars', () => {
    // The rule stated directly, rather than inferred from balances. Each
    // destination credit carries the owner of the account it landed in and the
    // owners of the debits that produced it; the rule is that those are the
    // same person, on every credit, with no exception.
    //
    // A regression that put the whole household target into the first Roth in
    // Plan order fails here on two counts at once: one credit where there
    // should be two, and `sourceOwnerPersonIds` naming an owner the
    // destination does not belong to.
    const plan = household()
    plan.accounts = [
      ira('robin-ira', 30_000, 'p2'),
      ira('pat-ira', 90_000, 'p1'),
      roth('pat-roth', 'p1'),
      roth('robin-roth', 'p2'),
    ]
    plan.strategies.rothConversion = {
      mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 40_000 }],
    }

    const { year } = run(plan)
    const credits = destinationCredits(year)

    // One credit per converting owner, and both owners converted.
    expect(credits).toHaveLength(2)
    expect(credits.map((credit) => credit.destinationOwnerPersonId).sort())
      .toEqual(['p1', 'p2'])

    for (const credit of credits) {
      // The identity requirement itself: every dollar in this credit came out
      // of an account belonging to the person whose Roth received it.
      //
      // The destination owner is pinned non-null FIRST, and that is not
      // ceremony. Both sides of the comparison below are `string | null` --
      // `destinationOwnerPersonId` comes from the destination account's
      // `ownerPersonId` and each `sourceOwnerPersonIds` entry from a source
      // account's, and either is null for an account with no owner set. So
      // `null === null` would satisfy the identity check while proving nothing
      // about identity, which is precisely the shape of assertion this branch
      // exists to eliminate. Excluding null makes the comparison bite.
      expect(credit.destinationOwnerPersonId).not.toBeNull()
      expect(credit.sourceOwnerPersonIds.length).toBeGreaterThan(0)
      for (const sourceOwner of credit.sourceOwnerPersonIds) {
        expect(sourceOwner).toBe(credit.destinationOwnerPersonId)
      }
    }

    const byOwner = new Map(
      credits.map((credit) => [credit.destinationOwnerPersonId, credit]),
    )
    const pat = byOwner.get('p1')!
    const robin = byOwner.get('p2')!
    expect(pat.destinationRothAccountId).toBe('pat-roth')
    expect(robin.destinationRothAccountId).toBe('robin-roth')
    expect(pat.destinationCreditedAmountPlanDollars).toBeCloseTo(30_000, 6)
    expect(robin.destinationCreditedAmountPlanDollars).toBeCloseTo(10_000, 6)
    // The credits reconcile to the published figure, so this evidence and the
    // balances above cannot disagree about what happened.
    const total = credits.reduce(
      (sum, credit) => sum + credit.destinationCreditedAmountPlanDollars, 0,
    )
    expect(total).toBeCloseTo(year.rothConversion, 10)
  })
})
