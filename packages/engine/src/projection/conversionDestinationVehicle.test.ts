import { expect, it } from 'vitest'

import {
  executeRothConversions,
  type ExecuteRothConversionsInput,
} from '../actions/rothConversionExecution.js'
import { rothConversionRequestSchema } from '../actions/contract.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asUsdCents } from '../actions/money.js'
import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { describeRule } from '../rules/describeRule.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type {
  SimulatorRetirementRuntimeAggregateRothDestinationCredit,
  YearResult,
} from './types.js'

/**
 * Which KIND of Roth account an aggregate conversion may land in.
 *
 * The owner half of the conversion-identity question is settled elsewhere
 * (`conversionOwnerIdentity.test.ts`): the household target is sliced by owner
 * and each slice is drained and credited inside one person's own accounts. This
 * file covers the vehicle half. The destination search reads `kind` as well as
 * `type`, so an owner's first Roth IRA anywhere in Plan order receives the
 * dollars and an employer designated Roth account never does -- IRC
 * 408A(d)(3)(B) applies the conversion paragraph only to an amount contributed
 * to a Roth IRA, and the only route into a designated Roth account,
 * 402A(c)(4)(B), reaches a distribution from the plan that maintains the
 * account and so can never reach one out of an IRA.
 *
 * One registered vector covers destination selection when both kinds exist,
 * refusal when only the wrong kind exists, and an explicitly named employer
 * destination. Each coordinate exercises the same destination-kind boundary.
 */

let counter = 0
const testIds = (): string => `conv-${++counter}`
const fixedNow = (): Date => new Date('2026-06-11T00:00:00.000Z')

const CONVERSION_YEAR = 2026
const REQUESTED_CONVERSION = 50_000

/**
 * Each builder is typed at the exact account it returns, down to `kind`. That
 * matters more here than anywhere else in the suite: `kind: 'employer'` against
 * `kind: 'ira'` IS the difference this record is about, so two builders sharing
 * one type would leave the fixture's whole subject unstated by the code.
 *
 * The `& { kind: ... }` intersection is load-bearing, not stylistic, and the
 * reason is a trap worth recording. `Account` discriminates on `type` alone:
 * the roth and traditional members each carry `kind` as an `'ira' | 'employer'`
 * union INSIDE a single member. So `Extract<Account, { type: 'roth' }>` admits
 * both kinds and gives `rothIra` and `designatedRothAccount` the identical
 * type -- which is what these annotations said before, under a comment
 * claiming they encoded the discriminant. They did not.
 *
 * The obvious repair is worse than useless: `Extract<Account, { type: 'roth',
 * kind: 'ira' }>` resolves to `never`, because the member's `kind` union is not
 * assignable to the single literal, so nothing is extracted at all.
 * Intersecting is what actually pins it. The check that these annotations mean
 * anything is that swapping the two builders' bodies fails to compile.
 */
function cash(balance: number): Extract<Account, { type: 'cash' }> {
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

function rothIra(
  id: string,
  owner: string,
): Extract<Account, { type: 'roth' }> & { kind: 'ira' } {
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

function designatedRothAccount(
  id: string,
  owner: string,
): Extract<Account, { type: 'roth' }> & { kind: 'employer' } {
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

function traditionalIra(
  id: string,
  owner: string,
  balance: number,
): Extract<Account, { type: 'traditional' }> & { kind: 'ira' } {
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

function runOf(plan: Plan): { year: Readonly<YearResult>, warnings: readonly string[] } {
  const result = simulatePlan(validate(plan), {
    startYear: CONVERSION_YEAR,
    taxCalculator: noTax,
  })
  return {
    year: result.years.find((row) => row.year === CONVERSION_YEAR)!,
    warnings: result.warnings,
  }
}

/**
 * Every per-owner destination credit the aggregate conversion recorded, so the
 * account the dollars landed in can be asserted alongside the amount: this
 * record is named for the KIND of account they reach, and a fixture that only
 * counted them would pass on a build that credited some entirely different
 * Roth.
 *
 * The filter is a type guard, so `map` narrows without a second
 * `applicationKind` check. An earlier draft re-tested the kind inside `map` and
 * fell back to `null`, widening the return type with a branch the filter had
 * already made unreachable -- on a fixture whose subject is assertions that
 * cannot fail, a case a reader could never make execute is the same defect one
 * layer down.
 *
 * Throws rather than returning empty when the source is absent: a missing
 * source would otherwise turn every assertion below into a vacuous statement
 * about an empty array.
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

/**
 * B holds both kinds, with the designated Roth account earlier in Plan order.
 * Four candidate destination policies share one registered vector; each
 * coordinate is a complete observed slice for one fact pattern:
 *
 *   statute                     pass over the designated Roth account and
 *                               credit B's first Roth IRA in Plan order
 *   creditFirstRothInPlanOrder  credit the first account of type roth, which
 *                               here is the designated Roth account
 *   trimDesignatedRothOnly      refuse any owner whose first Roth is a
 *                               designated Roth account
 *   anyRothAccountAccepted      treat any Roth account, including a named
 *                               employer destination, as lawful
 */
type ConversionDestinationReading = {
  bothKindsInPlanOrder: {
    converted: number
    rothIra: number
    designatedRoth: number
  }
  designatedOnlyHousehold: number
  mixedHouseholdConverted: number
  namedEmployerDestination: {
    committed: boolean
    executedAmount: number
    destinationCreditAmount: number
  }
}

function expectConversionCoordinate<
  K extends keyof ConversionDestinationReading,
>(
  coordinate: K,
  observed: ConversionDestinationReading[K],
  accepted: ConversionDestinationReading,
  readings: Record<string, ConversionDestinationReading>,
) {
  const acceptedSlice = accepted[coordinate]
  if (typeof observed === 'number' && typeof acceptedSlice === 'number') {
    expect(observed).toBeCloseTo(acceptedSlice, 6)
    for (const reading of Object.values(readings)) {
      const rejectedSlice = reading[coordinate]
      if (typeof rejectedSlice !== 'number' || rejectedSlice === acceptedSlice) continue
      expect(observed).not.toBeCloseTo(rejectedSlice, 6)
    }
    return
  }
  if (
    coordinate === 'bothKindsInPlanOrder'
    && typeof observed === 'object'
    && observed !== null
  ) {
    const slice = observed as ConversionDestinationReading['bothKindsInPlanOrder']
    const acceptedBothKinds = acceptedSlice as ConversionDestinationReading['bothKindsInPlanOrder']
    expect(slice.converted).toBeCloseTo(acceptedBothKinds.converted, 6)
    expect(slice.rothIra).toBeCloseTo(acceptedBothKinds.rothIra, 6)
    expect(slice.designatedRoth).toBeCloseTo(acceptedBothKinds.designatedRoth, 6)
    for (const reading of Object.values(readings)) {
      const rejected = reading.bothKindsInPlanOrder
      if (JSON.stringify(rejected) === JSON.stringify(acceptedBothKinds)) continue
      const matches = (
        Math.abs(slice.converted - rejected.converted) < 1e-6
        && Math.abs(slice.rothIra - rejected.rothIra) < 1e-6
        && Math.abs(slice.designatedRoth - rejected.designatedRoth) < 1e-6
      )
      expect(matches).toBe(false)
    }
    return
  }
  expect(observed).toEqual(acceptedSlice)
  for (const reading of Object.values(readings)) {
    if (JSON.stringify(reading[coordinate]) === JSON.stringify(acceptedSlice)) continue
    expect(observed).not.toEqual(reading[coordinate])
  }
}

describeRule('irc-408A-d-3-B-conversion-destination-must-be-a-roth-ira', {
  readings: {
    statute: {
      bothKindsInPlanOrder: {
        converted: REQUESTED_CONVERSION,
        rothIra: REQUESTED_CONVERSION,
        designatedRoth: 0,
      },
      designatedOnlyHousehold: 0,
      mixedHouseholdConverted: REQUESTED_CONVERSION / 2,
      namedEmployerDestination: {
        committed: false,
        executedAmount: 0,
        destinationCreditAmount: 0,
      },
    },
    creditFirstRothInPlanOrder: {
      bothKindsInPlanOrder: {
        converted: REQUESTED_CONVERSION,
        rothIra: 0,
        designatedRoth: REQUESTED_CONVERSION,
      },
      designatedOnlyHousehold: 0,
      mixedHouseholdConverted: REQUESTED_CONVERSION / 2,
      namedEmployerDestination: {
        committed: false,
        executedAmount: 0,
        destinationCreditAmount: 0,
      },
    },
    trimDesignatedRothOnly: {
      bothKindsInPlanOrder: {
        converted: 0,
        rothIra: 0,
        designatedRoth: 0,
      },
      designatedOnlyHousehold: 0,
      mixedHouseholdConverted: 0,
      namedEmployerDestination: {
        committed: false,
        executedAmount: 0,
        destinationCreditAmount: 0,
      },
    },
    anyRothAccountAccepted: {
      bothKindsInPlanOrder: {
        converted: REQUESTED_CONVERSION,
        rothIra: REQUESTED_CONVERSION,
        designatedRoth: 0,
      },
      designatedOnlyHousehold: REQUESTED_CONVERSION,
      mixedHouseholdConverted: REQUESTED_CONVERSION,
      namedEmployerDestination: {
        committed: true,
        executedAmount: REQUESTED_CONVERSION,
        destinationCreditAmount: REQUESTED_CONVERSION,
      },
    },
  },
  accepted: 'statute',
}, ({ accepted, readings }) => {
  function bothKindsPlan(): Plan {
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      designatedRothAccount('rothB401k', 'p2'),
      rothIra('rothBIra', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]
    return plan
  }

  it('converts into the Roth IRA and leaves the designated Roth account alone', () => {
    const { year } = runOf(bothKindsPlan())
    expectConversionCoordinate('bothKindsInPlanOrder', {
      converted: year.rothConversion,
      rothIra: year.balances['rothBIra']!,
      designatedRoth: year.balances['rothB401k']!,
    }, accepted, readings)
    expect(year.balances['tradB']).toBeCloseTo(400_000 - accepted.bothKindsInPlanOrder.converted, 6)
  })

  it('names the Roth IRA on the destination credit, not the earlier Roth account', () => {
    // The credit is the record an advisor reads back, and it is also what puts
    // the conversion layer in a basis pool: `rothPoolKey` aggregates an owner's
    // Roth IRAs under one key and gives each employer Roth account its own, so
    // crediting the wrong account would file the layer and its five-year clock
    // in a pool later withdrawals do not read.
    const { year } = runOf(bothKindsPlan())
    const credits = destinationCredits(year)

    expect(credits).toHaveLength(1)
    expect(credits[0]!.destinationRothAccountId).toBe('rothBIra')
    expect(credits[0]!.destinationCreditedAmountPlanDollars)
      .toBeCloseTo(accepted.bothKindsInPlanOrder.converted, 6)
  })

  it('recognises the income and says nothing, because nothing was refused', () => {
    // Silence is the point of preferring this reading over trimming: B has a
    // lawful destination, so there is no refusal to explain. Pinned to the
    // movement it accompanies, because an absence of warnings is the weakest
    // shape an assertion can take -- a build that converted nothing would also
    // be silent here.
    const { year, warnings } = runOf(bothKindsPlan())

    expectConversionCoordinate('bothKindsInPlanOrder', {
      converted: year.rothConversion,
      rothIra: year.balances['rothBIra']!,
      designatedRoth: year.balances['rothB401k']!,
    }, accepted, readings)
    expect(year.magi).toBeCloseTo(accepted.bothKindsInPlanOrder.converted, 6)
    expect(warnings).toEqual([])
  })

  it('converts nothing, and says the employer account is what stands in the way', () => {
    // No Roth IRA anywhere in the plan, so the refusal is stated once at the
    // household level -- the same arm that used to say "the plan has no Roth
    // account", which a household holding a Roth 401(k) would read as flatly
    // false.
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      designatedRothAccount('rothB401k', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const { year, warnings } = runOf(plan)

    expectConversionCoordinate('designatedOnlyHousehold', year.rothConversion, accepted, readings)
    expect(year.balances['rothB401k']).toBeCloseTo(0, 6)
    expect(year.balances['tradB']).toBeCloseTo(400_000, 6)
    expect(destinationCredits(year)).toEqual([])
    // No conversion means no inclusion. The engine used to recognise the income
    // as well as move the dollars, so the household was taxed on a transaction
    // the statute does not permit.
    expect(year.magi).toBeCloseTo(0, 6)
    expect(warnings).toEqual([
      'Roth conversions were requested but every Roth account in the plan sits inside an ' +
      'employer plan, and a Roth conversion here can land only in a Roth IRA; ' +
      'conversions skipped.',
    ])
  })

  it('trims only the designated-Roth owner’s slice, and names them', () => {
    // A holds a Roth IRA and B holds only a designated Roth account, so the
    // household target splits in two and one half has nowhere to go. Both
    // owners carry the same convertible balance, so the slice arithmetic is not
    // what decides the answer here -- the destination search is.
    const plan = marriedHousehold()
    plan.accounts = [
      cash(500_000),
      rothIra('rothAIra', 'p1'),
      traditionalIra('tradA', 'p1', 400_000),
      designatedRothAccount('rothB401k', 'p2'),
      traditionalIra('tradB', 'p2', 400_000),
    ]

    const { year, warnings } = runOf(plan)

    expectConversionCoordinate('mixedHouseholdConverted', year.rothConversion, accepted, readings)
    expect(year.balances['rothAIra']).toBeCloseTo(accepted.mixedHouseholdConverted, 6)
    expect(year.balances['rothB401k']).toBeCloseTo(0, 6)
    expect(year.balances['tradB']).toBeCloseTo(400_000 - accepted.designatedOnlyHousehold, 6)
    const credits = destinationCredits(year)
    expect(credits).toHaveLength(1)
    expect(credits[0]!.destinationRothAccountId).toBe('rothAIra')
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('B’s only Roth account is inside an employer plan')
    expect(warnings[0]).toContain('Opening a Roth IRA for B would let that share convert.')
    expect(warnings[0]).not.toContain('has no Roth account')
  })

  it('keeps the destination-less copy for a household holding no Roth at all', () => {
    // The control on the copy split. Same request, same balances, one account
    // removed -- and the message reverts, because there the plain sentence is
    // the true one.
    const plan = marriedHousehold()
    plan.accounts = [cash(500_000), traditionalIra('tradB', 'p2', 400_000)]

    const { year, warnings } = runOf(plan)

    expect(year.rothConversion).toBeCloseTo(accepted.designatedOnlyHousehold, 6)
    expect(warnings).toEqual([
      'Roth conversions were requested but the plan has no Roth account; conversions skipped.',
    ])
  })

  it('refuses a named employer Roth destination on the action executor without moving money', () => {
    const namedEmployerDestinationInput = (): ExecuteRothConversionsInput => {
      // Cloned from the fully-valid executor fixture in
      // actions/rothConversionExecution.test.ts (withBasis(0) + person p1),
      // then the destination account alone is switched to kind: 'employer'.
      const personId = asPersonId('p1')
      const sourceAccountId = asAccountId('traditional-a')
      const destinationAccountId = asAccountId('roth-employer')
      const value = createEmptyPlan({ newId: testIds, now: fixedNow })
      value.household.filingStatus = 'single'
      value.household.people = [{
        id: personId,
        name: 'Pat',
        dob: '1960-01-01',
        sex: 'average',
        retirementAge: null,
        longevity: { planningAge: 100, source: 'manual' },
      }]
      value.assumptions.inflationPct = 0
      value.assumptions.defaultReturnPct = 0
      value.accounts = [
        {
          type: 'traditional',
          kind: 'ira',
          id: sourceAccountId,
          name: 'IRA',
          ownerPersonId: personId,
          annualReturnPct: 0,
          balance: 100_000,
          annualContribution: 0,
        },
        {
          type: 'roth',
          kind: 'employer',
          id: destinationAccountId,
          name: 'Roth 401(k)',
          ownerPersonId: personId,
          annualReturnPct: 0,
          balance: 0,
          annualContribution: 0,
        },
      ]
      value.retirementActionEligibilityFacts = {
        iraClassifications: [{
          sourceAccountId,
          subtype: 'traditional',
          evidenceId: 'classification-traditional-a',
          provenance: { source: 'manual' },
        }],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      }
      const conversionRequest = rothConversionRequestSchema.parse({
        actionId: asActionId('conversion-a'),
        kind: 'rothConversion',
        personId,
        year: CONVERSION_YEAR,
        executionDate: '2026-12-15',
        executionSequence: 1,
        requestedAmount: REQUESTED_CONVERSION,
        allocations: [{
          allocationId: asAllocationId('allocation-a'),
          sourceAccountId,
          requestedAmount: REQUESTED_CONVERSION,
        }],
        destinationRothAccountId: destinationAccountId,
        taxFunding: { kind: 'noneExpected' },
        provenance: { source: 'manual' },
      })
      return {
        year: CONVERSION_YEAR,
        plan: value,
        requests: [conversionRequest],
        openingBalances: [
          { accountId: sourceAccountId, openingBalance: asUsdCents(100_000) },
          { accountId: destinationAccountId, openingBalance: asUsdCents(0) },
        ],
        runtimeEvidence: {
          personAliveEvidence: [{
            evidenceId: 'alive-conversion-a',
            actionId: conversionRequest.actionId,
            personId: conversionRequest.personId,
            actionYear: CONVERSION_YEAR,
            actionDate: '2026-12-15',
            alive: true,
          }],
          // DOB 1960-01-01 and year 2026: owner is 66, before the SECURE 2.0
          // RMD start age of 73, so the aggregated IRA RMD sum for the year is
          // zero and Treas. Reg. 1.408A-4 A-6(b) withholds nothing.
          ownerIraRmdSatisfactionEvidence: [{
            evidenceId: 'rmd-conversion-a',
            actionId: conversionRequest.actionId,
            personId: conversionRequest.personId,
            actionYear: CONVERSION_YEAR,
            actionDate: '2026-12-15',
            requiredAmount: asUsdCents(0),
            distributedAmount: asUsdCents(0),
          }],
          // IRC 408(d)(2) numerator proven at zero: basis admission is
          // satisfied and the whole gross would be taxable if the movement ran.
          ownerAggregatedIraBasisEvidence: [{
            evidenceId: 'basis-conversion-a',
            actionId: conversionRequest.actionId,
            personId: conversionRequest.personId,
            actionYear: CONVERSION_YEAR,
            actionDate: '2026-12-15',
            basisAmount: asUsdCents(0),
          }],
        },
      }
    }

    const result = executeRothConversions(namedEmployerDestinationInput())
    const evidence = result.evidence[0]!
    const reasonCodes = evidence.reasons.map((reason) => reason.code)

    expect(reasonCodes).toEqual(['conversion-employer-destination-unsupported'])
    expectConversionCoordinate('namedEmployerDestination', {
      committed: result.committed,
      executedAmount: evidence.executedAmount,
      destinationCreditAmount: evidence.destinationCreditAmount,
    }, accepted, readings)
    expect(result.balances).toEqual([
      {
        accountId: asAccountId('roth-employer'),
        openingBalance: asUsdCents(0),
        closingBalance: asUsdCents(0),
      },
      {
        accountId: asAccountId('traditional-a'),
        openingBalance: asUsdCents(100_000),
        closingBalance: asUsdCents(100_000),
      },
    ])
  })
})
