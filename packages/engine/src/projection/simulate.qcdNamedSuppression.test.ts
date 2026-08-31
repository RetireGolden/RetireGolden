import { describe, expect, it } from 'vitest'

import { asAccountId, asActionId, asAllocationId, asPersonId } from '../actions/identity.js'
import { asPositiveUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Account, Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

/**
 * The aggregate QCD arm must stand down when the year carries a named QCD
 * request, the same way the aggregate conversion arm stands down for a named
 * conversion.
 *
 * Nothing moves twice today, because the QCD executor publishes a named
 * request's identity/legal prerequisite and nothing else, so a named QCD is
 * inert. That is exactly why this test exists now rather than later: the slice
 * that makes a named QCD move dollars would otherwise have the household give
 * twice — once from `strategies.qcdAnnual` and once from the action — and no
 * other fixture in the suite combines the two arms, so nothing would fail.
 */

const TAX_YEAR = 2026
const GIFT = 5_000

function ira(id: string, balance: number): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return { ...account, annualReturnPct: 0 }
}

function namedQcd(amount: number): QualifiedCharitableDistributionRequest {
  return {
    actionId: asActionId('qcd-action'),
    kind: 'qcd',
    year: TAX_YEAR,
    executionDate: `${TAX_YEAR}-11-14`,
    executionSequence: 1,
    requestedAmount: asPositiveUsdCents(amount * 100),
    provenance: { source: 'manual' },
    donorPersonId: asPersonId('p1'),
    allocation: {
      allocationId: asAllocationId('qcd-allocation'),
      sourceAccountId: asAccountId('ira'),
      requestedAmount: asPositiveUsdCents(amount * 100),
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
  }
}

/** Born 1950, so age 76 in 2026: past the applicable age, with an RMD due. */
function donorPlan(options: { named: boolean, scalar: boolean }): Plan {
  const plan = singlePersonPlan({ dob: '1950-03-01', planningAge: 95 })
  plan.id = `qcd-named-suppression-${options.named ? 'named' : 'no-named'}-${options.scalar ? 'scalar' : 'no-scalar'}`
  plan.accounts = [ira('ira', 500_000)]
  plan.strategies.qcdAnnual = options.scalar ? GIFT : 0
  if (options.named) plan.strategies.retirementActions = [namedQcd(GIFT)]
  return plan
}

function run(plan: Plan): YearResult {
  const years = simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  }).years
  const year = years.find((row) => row.year === TAX_YEAR)
  if (year === undefined) throw new Error('missing tax year')
  return year
}

describe('a named QCD request suppresses the aggregate arm', () => {
  it('gives the scalar amount when no named request exists', () => {
    // The control. Without it this file would pass on a build that had simply
    // stopped doing QCDs at all.
    const year = run(donorPlan({ named: false, scalar: GIFT > 0 }))

    expect(year.qcd).toBeCloseTo(GIFT, 6)
  })

  it('adds nothing when the scalar sits beside a named request', () => {
    // The invariant, asserted as a comparison rather than a number: with a
    // named request present, setting the scalar must not change the year.
    //
    // Written this way deliberately. Asserting a literal zero would pin today's
    // behaviour, where a named QCD moves nothing because the executor refuses
    // it — and would then fail on the very slice this guard exists to protect,
    // the one that makes named QCDs move dollars. The suppression is still
    // correct at that point; only the total changes. Comparing the two runs
    // survives that, because it asks what the SCALAR contributed rather than
    // what the year totalled.
    const withScalar = run(donorPlan({ named: true, scalar: true }))
    const withoutScalar = run(donorPlan({ named: true, scalar: false }))

    expect(withScalar.qcd).toBe(withoutScalar.qcd)
  })

  it('leaves a later year alone', () => {
    // The suppression is per year, matching the conversion gate. A named
    // request in 2026 must not silence the scalar in 2027.
    const plan = donorPlan({ named: true, scalar: true })
    const years = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
    }).years
    const next = years.find((row) => row.year === TAX_YEAR + 1)

    expect(next?.qcd).toBeCloseTo(GIFT, 6)
  })
})
