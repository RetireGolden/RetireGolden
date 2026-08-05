import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import type { YearResult } from '../../projection/types.js'
import { describeRule } from '../describeRule.js'

/**
 * What is left of the conversion-identity defect after the owner slice landed.
 *
 * The aggregate conversion path used to pick its destination once, as the first
 * Roth account in Plan array order with no owner predicate, and then draw from
 * every convertible traditional account with no owner filter. It now slices the
 * household target by owner, drains each owner's own accounts, credits an
 * account that owner owns, and warns by name when an owner has no Roth at all.
 * That half is settled and its fixture lives in
 * `projection/conversionOwnerIdentity.test.ts`.
 *
 * The vehicle half is not settled. The destination search still accepts any
 * account of type `roth` — including a designated Roth account inside an
 * employer plan. A traditional IRA cannot be rolled into one: IRC 408A(d)(3)(B)
 * applies the conversion paragraph only to an amount contributed to a Roth IRA,
 * (C) treats a conversion as such a distribution, 408A(b) defines a Roth IRA as
 * an individual retirement plan designated as one, and the in-plan route of
 * 402A(c)(4)(B) reaches only a distribution from the same plan that maintains
 * the designated Roth account. So an individual whose only Roth is a 401(k)
 * designated Roth account still receives converted IRA dollars there, and the
 * statute permits no conversion for that person at all.
 */

let counter = 0
const testIds = (): string => `conv-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

const CONVERSION_YEAR = 2026
const REQUESTED_CONVERSION = 50_000

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

function rothIra(id: string, owner: string): Account {
  return {
    type: 'roth',
    id,
    name: `Roth ${owner}`,
    ownerPersonId: owner,
    annualReturnPct: null,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }
}

function designatedRothAccount(id: string, owner: string): Account {
  return {
    type: 'roth',
    id,
    name: `Roth 401(k) ${owner}`,
    ownerPersonId: owner,
    annualReturnPct: null,
    kind: 'employer',
    balance: 0,
    annualContribution: 0,
  }
}

function traditionalIra(id: string, owner: string, balance: number): Account {
  return {
    type: 'traditional',
    id,
    name: `IRA ${owner}`,
    ownerPersonId: owner,
    annualReturnPct: null,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

/** Married, both alive, both past 59.5 so no early-distribution arm is in play. */
function marriedHousehold(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people = [
    {
      id: 'p1',
      name: 'A',
      dob: '1958-03-15',
      sex: 'average',
      retirementAge: 62,
      longevity: { planningAge: 90, source: 'manual' },
    },
    {
      id: 'p2',
      name: 'B',
      dob: '1958-05-20',
      sex: 'average',
      retirementAge: 62,
      longevity: { planningAge: 90, source: 'manual' },
    },
  ]
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: CONVERSION_YEAR, amount: REQUESTED_CONVERSION }],
  }
  return plan
}

function validate(plan: Plan): Plan {
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const noTax = createFlatTaxCalculator(0)

function yearOf(plan: Plan): Readonly<YearResult> {
  const result = simulatePlan(validate(plan), {
    startYear: CONVERSION_YEAR,
    taxCalculator: noTax,
  })
  return result.years.find((row) => row.year === CONVERSION_YEAR)!
}

/**
 * The account each destination credit actually landed in. Asserted alongside
 * the amount throughout, because this record is named for the KIND of account
 * the dollars reach: a fixture that only counted them would pass on a build
 * that credited some entirely different Roth.
 */
function destinationAccountIds(year: Readonly<YearResult>): readonly (string | null)[] {
  const source = year.retirementRuntimeApplicationSource
  if (source === undefined) throw new Error('expected a runtime application source')
  return source.applications
    .filter((application) =>
      application.applicationKind === 'aggregateRothDestinationCredit')
    .map((application) =>
      application.applicationKind === 'aggregateRothDestinationCredit'
        ? application.destinationRothAccountId
        : null)
}

describeRule('irc-408A-d-3-B-conversion-destination-must-be-a-roth-ira', {
  readings: {
    // B's only Roth is a designated Roth account inside an employer plan, and
    // the conversion paragraph reaches only an amount contributed to a Roth
    // IRA. There is no account a rollover out of B's traditional IRA could
    // legally land in, so the statutory answer is "convert nothing" rather
    // than "convert less".
    statuteRequiresARothIra: 0,
    engineAcceptsAnyRothAccount: REQUESTED_CONVERSION,
  },
  accepted: 'statuteRequiresARothIra',
  produced: 'engineAcceptsAnyRothAccount',
}, ({ accepted, produced }) => {
  it('converts a traditional IRA into the same individual’s designated Roth account', () => {
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      designatedRothAccount('rothB401k', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const year = yearOf(plan)

    expect(year.rothConversion).toBeCloseTo(produced, 6)
    expect(year.rothConversion).not.toBeCloseTo(accepted, 6)
    // Where the dollars went, not merely how many moved. The record's whole
    // claim is about the KIND of account they reached, so the destination is
    // named on both the balance and the runtime credit.
    expect(year.balances['rothB401k']).toBeCloseTo(REQUESTED_CONVERSION, 6)
    expect(year.balances['tradB']).toBeCloseTo(350_000, 6)
    expect(destinationAccountIds(year)).toEqual(['rothB401k'])
    // The income is recognised too, so this is not a bookkeeping-only slip:
    // the household is taxed on a conversion the statute does not permit.
    expect(year.magi).toBeCloseTo(REQUESTED_CONVERSION, 6)
  })

  it('converts the same amount into a Roth IRA, so the fixture is about the vehicle', () => {
    // The control. Same request, same balances, same household, same owner --
    // only the KIND of the destination account changes, from an employer
    // designated Roth account to a Roth IRA. The engine produces the identical
    // number AND the same shape of credit for both, which is exactly the
    // defect: it cannot tell them apart. Without this, the assertion above
    // would only be pinning "a conversion happened".
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothBIra', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const year = yearOf(plan)

    expect(year.rothConversion).toBeCloseTo(REQUESTED_CONVERSION, 6)
    expect(year.balances['rothBIra']).toBeCloseTo(REQUESTED_CONVERSION, 6)
    expect(destinationAccountIds(year)).toEqual(['rothBIra'])
  })

  it('raises no warning about the destination it chose', () => {
    // Silence is what makes this survivable-looking. The same code path
    // announces its other refusals by name -- no Roth in the plan at all, an
    // owner with no Roth of their own -- so a reader has every reason to read
    // silence as assent. Asserted against the run-level `warnings`, which is
    // the only warning channel there is; an earlier draft of the sibling
    // fixture read `year.warnings`, which does not exist on `YearResult`, and
    // passed while proving nothing.
    //
    // The conversion is asserted alongside the silence on purpose. An absence
    // of warnings is the weakest shape an assertion can take -- a build that
    // refused the conversion outright would also be silent here -- so the
    // silence is only meaningful pinned to the movement it failed to mention.
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      designatedRothAccount('rothB401k', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const result = simulatePlan(validate(plan), {
      startYear: CONVERSION_YEAR,
      taxCalculator: noTax,
    })
    const year = result.years.find((row) => row.year === CONVERSION_YEAR)!

    expect(year.balances['rothB401k']).toBeCloseTo(REQUESTED_CONVERSION, 6)
    expect(result.warnings).toEqual([])
  })
})
