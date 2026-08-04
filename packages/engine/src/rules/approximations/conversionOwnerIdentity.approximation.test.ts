import { expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../model/plan.js'
import { createFlatTaxCalculator } from '../../projection/flatTax.js'
import { simulatePlan } from '../../projection/simulate.js'
import { describeRule } from '../describeRule.js'

/**
 * The aggregate conversion path moves dollars between two different taxpayers.
 *
 * `simulate.ts` picks the destination once, as the first Roth account in Plan
 * array order with no owner predicate, then draws from every convertible
 * traditional account with no owner filter. Nothing reconciles the two. The
 * runtime journal already records `ownerPersonId` per source while crediting a
 * single destination, so the evidence structure knows the sources can span
 * owners even though the ledger does not act on it.
 */

let counter = 0
const testIds = (): string => `conv-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

const GIFT_YEAR = 2026
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
    conversions: [{ year: GIFT_YEAR, amount: REQUESTED_CONVERSION }],
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
    startYear: GIFT_YEAR,
    taxCalculator: noTax,
  })
  const year = result.years.find((row) => row.year === GIFT_YEAR)!
  return { converted: year.rothConversion, magi: year.magi }
}

describeRule('irc-408-d-3-A-i-conversion-benefits-the-distributee', {
  readings: {
    // The only Roth belongs to A and the only convertible balance to B, so
    // there is no pair of accounts a conversion could legally run between.
    // 408A(d)(3)(B) requires the receiving Roth to be maintained for the
    // benefit of the same individual the distribution came out of, and no
    // such Roth exists here. The statutory answer is not "convert less" but
    // "convert nothing", which is why the readings differ by the whole amount.
    statutePermitsNoConversionAtAll: 0,
    engineConvertsAcrossTheOwnerBoundary: REQUESTED_CONVERSION,
  },
  accepted: 'statutePermitsNoConversionAtAll',
  produced: 'engineConvertsAcrossTheOwnerBoundary',
}, ({ accepted, produced }) => {
  it('converts one spouse’s IRA into the other spouse’s Roth', () => {
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothA', 'p1'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const { converted, magi } = convertedIn(plan)

    expect(converted).toBeCloseTo(produced, 6)
    expect(converted).not.toBeCloseTo(accepted, 6)
    // The income is recognised too, so this is not a bookkeeping-only slip:
    // the household is taxed on a conversion the statute does not permit.
    expect(magi).toBeCloseTo(REQUESTED_CONVERSION, 6)
  })

  it('is silent about it', () => {
    // No warning is the part that makes this survivable. The same code path
    // announces its other refusals -- a plan with no Roth at all warns, and a
    // conversion larger than the available traditional balance warns -- so a
    // reader has every reason to read silence as assent.
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
      startYear: GIFT_YEAR,
      taxCalculator: noTax,
    })

    expect(result.warnings).toEqual([])
  })

  it('does warn when the destination is missing entirely, so silence is a choice', () => {
    // The discriminating half of the previous test. Remove the Roth and the
    // same block warns, which establishes that the empty warning list above is
    // this path declining to speak rather than a path that never speaks.
    const plan = marriedHousehold()
    plan.accounts = [cash(500_000), traditionalIra('tradB', 'p2', 400_000)]

    const result = simulatePlan(validate(plan), {
      startYear: GIFT_YEAR,
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
    // the identical number for it. So the first assertion is pinning the
    // owner mismatch and not merely "a conversion happened".
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
