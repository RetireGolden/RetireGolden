import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'

/**
 * The distributee half of the conversion-identity rule, which is settled.
 *
 * The aggregate conversion path used to choose its destination once, as the
 * first Roth account in Plan array order with no owner predicate, and then draw
 * from every convertible traditional account with no owner filter. A married
 * household whose only Roth belonged to A and whose only convertible balance
 * belonged to B therefore converted B's dollars into A's Roth and said nothing.
 * It now snapshots each owner's gross convertible balance after the RMD block,
 * splits the sized household amount pro rata in exact cents, drains only that
 * owner's accounts, credits only a Roth that owner owns, and trims and names the
 * slice of an owner who holds no Roth at all.
 *
 * The builders here are deliberately a local copy of the ones in
 * `rules/approximations/conversionDestinationVehicle.approximation.test.ts`
 * rather than a shared import: importing one test module from another registers
 * its suites twice, and a non-test helper module carrying plan builders would be
 * shipped engine source that only tests use.
 */

let counter = 0
const testIds = (): string => `owner-${++counter}`
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
    // Only A holds a Roth and only B holds a convertible balance, so there is
    // no pair of accounts a conversion could legally run between and the
    // statutory answer is to convert nothing. The rejected reading is the
    // engine's own former behaviour, which crossed the owner boundary and
    // recognised the whole request.
    statuteRequiresOneIndividualOnBothSides: 0,
    crossOwnerConversionIntoTheOtherSpousesRoth: REQUESTED_CONVERSION,
  },
  accepted: 'statuteRequiresOneIndividualOnBothSides',
}, ({ accepted, readings }) => {
  it('does not convert one spouse’s IRA into the other spouse’s Roth', () => {
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const { converted, magi } = convertedIn(plan)

    expect(converted).toBeCloseTo(accepted, 6)
    expect(converted).not.toBeCloseTo(readings.crossOwnerConversionIntoTheOtherSpousesRoth, 6)
    // No conversion means no inclusion. Asserted separately because a path that
    // moved nothing while still recognising the income would satisfy the
    // balance assertion alone and be a worse defect than the one it replaced.
    expect(magi).toBeCloseTo(0, 6)
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
    // that number for it. So the assertions above are pinning the owner
    // question and not merely "a conversion happened".
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      traditionalIra('tradA', 'p1', 400_000),
    ]

    const { converted } = convertedIn(plan)

    expect(converted).toBeCloseTo(REQUESTED_CONVERSION, 6)
  })

  it('splits a household target between two owners who both hold convertible balances', () => {
    // The other half of the owner boundary, and the one the trimming cases
    // cannot show: where both people can convert, each person's own dollars
    // move into that person's own Roth, pro rata on gross convertible balance.
    // B holds three times A's balance, so B carries three quarters of the
    // 50,000 request. The whole request converts, which is what distinguishes
    // this from the refusal cases above.
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      rothIra('rothB', 'p2'),
      traditionalIra('tradA', 'p1', 100_000),
      traditionalIra('tradB', 'p2', 300_000),
    ]

    const result = simulatePlan(validate(plan), {
      startYear: CONVERSION_YEAR,
      taxCalculator: noTax,
    })
    const year = result.years.find((row) => row.year === CONVERSION_YEAR)!

    expect(year.rothConversion).toBeCloseTo(REQUESTED_CONVERSION, 6)
    expect(result.warnings).toEqual([])
  })
})
