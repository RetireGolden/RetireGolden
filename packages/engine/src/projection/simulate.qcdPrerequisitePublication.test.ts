import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Account, Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

/**
 * A named QCD publishes its identity/legal prerequisite through the qcdExecutor
 * and moves nothing. The qcdExecutor is the QCD's sole publisher, so the
 * ordinary-withdrawal executor no longer sees the request at all.
 */

const TAX_YEAR = 2026
const GIFT_DOLLARS = 5_000

function ira(id: string, balance: number): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function namedQcd(
  overrides: Partial<QualifiedCharitableDistributionRequest> = {},
): QualifiedCharitableDistributionRequest {
  const amount = asPositiveUsdCents(GIFT_DOLLARS * 100)
  return {
    actionId: asActionId('qcd-action'),
    kind: 'qcd',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-08-01`,
    executionSequence: 1,
    requestedAmount: amount,
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('qcd-allocation'),
      sourceAccountId: asAccountId('ira'),
      requestedAmount: amount,
    },
    charity: {
      designationId: 'charity-1',
      name: 'Public charity',
      designationKind: 'eligiblePublicCharity',
      directFromCustodianAttested: true,
      eligibleOrganizationAttested: true,
      notDonorAdvisedFundOrSupportingOrganizationAttested: true,
      notSplitInterestEntityAttested: true,
      entireDistributionOtherwiseDeductibleAttested: true,
    },
    ...overrides,
  }
}

/** Born 1950, so age 76 in 2026: past the applicable age, with an RMD due. */
function donorPlan(options: { named: boolean, scalar?: boolean, dob?: string } = {
  named: true,
}): Plan {
  const plan = singlePersonPlan({ dob: options.dob ?? '1950-03-01', planningAge: 95 })
  plan.id = `qcd-prerequisite-${options.named ? 'named' : 'no-named'}-${options.dob ?? 'default'}`
  plan.accounts = [ira('ira', 500_000)]
  plan.strategies.qcdAnnual = options.scalar === true ? GIFT_DOLLARS : 0
  if (options.named) plan.strategies.retirementActions = [namedQcd()]
  return plan
}

function run(plan: Plan): YearResult {
  const year = simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  }).years.find((row) => row.year === TAX_YEAR)
  if (year === undefined) throw new Error('missing tax year')
  return year
}

describe('a named QCD publishes its prerequisite without moving a dollar', () => {
  it('publishes one zero-movement qcdExecutor record for the request', () => {
    const year = run(donorPlan())
    const publication = year.retirementActionPublication

    expect(publication?.executorSources).toEqual(['qcdExecutor'])
    expect(publication?.records).toEqual([expect.objectContaining({
      actionId: 'qcd-action',
      executorSource: 'qcdExecutor',
      kind: 'qcd',
      personId: 'p1',
      requestedAmount: GIFT_DOLLARS * 100,
      executedAmount: 0,
      unexecutedAmount: GIFT_DOLLARS * 100,
      readiness: 'nonActionable',
      outcome: 'unsupported',
      executedDate: null,
      executedSequence: null,
    })])
    expect(year.qcdActionPrerequisites?.map(
      (evidence) => evidence.missingAnnualStages,
    )).toEqual([{
      physicalSettlement: 'notEstablished',
      personalIndexedLimit: 'notEstablished',
      deductibleContributionOffset: 'notEstablished',
      otherwiseTaxablePoolAndBasis: 'notEstablished',
      rmdCoordination: 'notEstablished',
      charitableDeductionTreatment: 'notEstablished',
      exclusionAndTaxCharacter: 'notEstablished',
    }])
  })

  it('leaves the published gift, the source balance, and the runtime occurrences alone', () => {
    // Compared against the same household without the request, so the
    // assertion isolates the QCD from Medicare-driven withdrawals.
    const withNamed = run(donorPlan({ named: true }))
    const withoutNamed = run(donorPlan({ named: false }))

    expect(withNamed.qcd).toBe(0)
    expect(withNamed.qcd).toBe(withoutNamed.qcd)
    expect(withNamed.balances.ira).toBe(withoutNamed.balances.ira)
    expect(
      withNamed.retirementRuntimeSource?.runtimeOccurrences.filter(
        (occurrence) => occurrence.kind === 'legacyQcd',
      ),
    ).toEqual([])
  })

  it('keeps the request out of the ordinary-withdrawal executor entirely', () => {
    const year = run(donorPlan())

    expect(year.retirementActionPublication?.executorSources).not.toContain(
      'ordinaryWithdrawalExecutor',
    )
    expect(year).not.toHaveProperty('retirementActionExecution')
  })

  it('carries the donor, source, and charity binding through publication unchanged', () => {
    const request = namedQcd()
    const year = run(donorPlan())
    const record = year.retirementActionPublication?.records[0]

    expect(record?.request).toEqual(request)
    expect(record?.allocations).toEqual([{
      allocationId: 'qcd-allocation',
      sourceAccountId: 'ira',
      resolution: 'resolved',
      requestedAmount: GIFT_DOLLARS * 100,
      executedAmount: 0,
      unexecutedAmount: GIFT_DOLLARS * 100,
    }])
    expect(record?.scheduledDate).toBe(`${TAX_YEAR}-08-01`)
    expect(record?.scheduledSequence).toBe(1)
    expect(year.qcdActionPrerequisites?.[0]?.eligibility.charity)
      .toEqual(request.charity)
    expect(year.qcdActionPrerequisites?.[0]?.eligibility.source).toMatchObject({
      allocationId: 'qcd-allocation',
      sourceAccountId: 'ira',
      resolution: 'resolved',
      ownerPersonId: 'p1',
      accountType: 'traditional',
      retirementAccountKind: 'ira',
      inheritance: 'owned',
    })
  })

  it('reads age 70½ exactly, where the aggregate arm reads the birth month', () => {
    // The discriminating fixture. A donor born 1956-06-01 attains 70 in 2026
    // and reaches 70½ on 2026-12-01, and the gift is dated 2026-08-01.
    //
    // Two readings, two answers:
    //   - the aggregate arm's month proxy (simulate.ts, `ageAttained === 70 &&
    //     birthMonth <= 6`) makes the donor eligible for the whole of 2026, so
    //     the scalar gift is excluded from income;
    //   - the named path's exact 846-month threshold
    //     (annualQcdExecutionPrerequisite.ts, `addCalendarMonths(dob, 846)`)
    //     puts 2026-08-01 four months before the half-birthday, so the request
    //     is refused as pre-70½.
    //
    // The aggregate arm's approximation stays registered and untouched; this
    // pins only that the named path does not inherit it.
    const CROSSING_DOB = '1956-06-01'
    const named = run(donorPlan({ named: true, dob: CROSSING_DOB }))
    const aggregate = run(donorPlan({ named: false, scalar: true, dob: CROSSING_DOB }))

    expect(named.qcdActionPrerequisites?.[0]?.eligibility.donor).toMatchObject({
      birthDate: CROSSING_DOB,
      age70HalfThresholdDate: `${TAX_YEAR}-12-01`,
    })
    expect(named.qcdActionPrerequisites?.[0]?.eligibility.schedule).toMatchObject({
      scheduledDate: `${TAX_YEAR}-08-01`,
      reachedAge70HalfOnScheduledDate: false,
    })
    expect(
      named.retirementActionPublication?.records[0]?.reasons.map(
        (reason) => reason.code,
      ),
    ).toContain('qcd-before-age-70-half')

    // The other reading, on the same household and the same year.
    expect(aggregate.qcd).toBeCloseTo(GIFT_DOLLARS, 6)
  })
})
