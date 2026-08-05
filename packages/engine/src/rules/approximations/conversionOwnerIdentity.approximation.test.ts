import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

/**
 * What is left of the destination defect after the owner slice.
 *
 * The aggregate conversion path used to pick its destination once, as the first
 * Roth account in Plan array order with no owner predicate, and then draw from
 * every convertible traditional account with no owner filter. It now slices the
 * household target by owner, drains each owner's slice, and credits it to that
 * owner's own first Plan Roth; an owner with no Roth of their own converts
 * nothing and the user is told so. The distributee half of the rule is
 * therefore satisfied.
 *
 * The vehicle half is not. This record is titled for the Roth *IRA* of the same
 * individual, and the destination search still accepts any account of type
 * `roth` — including a designated Roth account inside an employer plan. A
 * traditional IRA cannot be rolled into a designated Roth account: IRC
 * 408A(e)(1)(B)(i) admits a rollover from an individual retirement plan only on
 * the 408(d)(3) terms, and 408(d)(3)(A)(i) requires the receiving account to be
 * an individual retirement account or annuity, while the in-plan route of
 * 402A(c)(4) reaches only amounts already distributable from that same plan. So
 * an individual whose only Roth is a 401(k) designated Roth account still
 * receives converted IRA dollars there, and the statute permits no conversion
 * for that person at all.
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

function convertedIn(plan: Plan): { converted: number, magi: number } {
  const result = simulatePlan(validate(plan), {
    startYear: CONVERSION_YEAR,
    taxCalculator: noTax,
  })
  const year = result.years.find((row) => row.year === CONVERSION_YEAR)!
  return { converted: year.rothConversion, magi: year.magi }
}

describeRule('irc-408-d-3-A-i-conversion-benefits-the-distributee', {
  readings: {
    // B's only Roth is a designated Roth account inside an employer plan, and
    // 408(d)(3)(A)(i) requires the receiving account to be an individual
    // retirement account or annuity. There is no account a rollover out of B's
    // traditional IRA could legally land in, so the statutory answer is again
    // "convert nothing" rather than "convert less".
    statuteRequiresARothIraOfTheSameIndividual: 0,
    engineAcceptsAnyRothOfTheSameIndividual: REQUESTED_CONVERSION,
  },
  accepted: 'statuteRequiresARothIraOfTheSameIndividual',
  produced: 'engineAcceptsAnyRothOfTheSameIndividual',
}, ({ accepted, produced }) => {
  it('converts a traditional IRA into the same individual’s designated Roth account', () => {
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      designatedRothAccount('rothB401k', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const { converted, magi } = convertedIn(plan)

    expect(converted).toBeCloseTo(produced, 6)
    expect(converted).not.toBeCloseTo(accepted, 6)
    // The income is recognised too, so this is not a bookkeeping-only slip:
    // the household is taxed on a conversion the statute does not permit.
    expect(magi).toBeCloseTo(REQUESTED_CONVERSION, 6)
  })

  it('no longer converts one spouse’s IRA into the other spouse’s Roth', () => {
    // The half of this record that is closed. The only Roth belongs to A and
    // the only convertible balance to B, so there is no pair of accounts a
    // conversion could run between and the engine now converts nothing.
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const { converted, magi } = convertedIn(plan)

    expect(converted).toBe(0)
    expect(magi).toBe(0)
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
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const result = simulatePlan(validate(plan), {
      startYear: CONVERSION_YEAR,
      taxCalculator: noTax,
    })

    expect(result.warnings).toContain(
      'B has no Roth account, so B’s share of the Roth conversion was skipped — ' +
        'a conversion has to land in the same person’s own Roth. ' +
        'Opening a Roth IRA for B would let that share convert.',
    )
  })

  it('does warn when the destination is missing entirely, so the household case is distinct', () => {
    // A plan with no Roth at all is a household-wide refusal, not an owner's,
    // and keeps its own wording.
    const plan = marriedHousehold()
    plan.accounts = [cash(500_000), traditionalIra('tradB', 'p2', 400_000)]

    const result = simulatePlan(validate(plan), {
      startYear: CONVERSION_YEAR,
      taxCalculator: noTax,
    })

    expect(result.warnings).toContain(
      'Roth conversions were requested but the plan has no Roth account; conversions skipped.',
    )
  })

  it('converts the same amount when the owners do match, so the fixture is about identity', () => {
    // The control. Same request, same balances, same household -- only the
    // owner of the convertible account changes. A conversion from A's IRA to
    // A's Roth is exactly what the statute permits, and the engine produces
    // the identical number for it. So the assertions above are pinning the
    // owner and vehicle questions and not merely "a conversion happened".
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      traditionalIra('tradA', 'p1', 400_000),
    ]

    const { converted } = convertedIn(plan)

    expect(converted).toBeCloseTo(REQUESTED_CONVERSION, 6)
  })
})
