import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The named-QCD donor ledgers, across a rolled-back annual pass.
 *
 * `namedQcdOffsetConsumedByDonor` and `namedQcdOffsetHistoryUnprovable` are
 * declared outside the year loop -- the post-70½ deductible-contribution offset
 * is cumulative over the donor's lifetime under Notice 2020-68, and a donor
 * whose history stopped being provable never becomes provable again -- but both
 * are *written* inside `runPostContributionAnnualPass`. Until the checkpoint
 * named them, an attempt that mutated either and then rolled back left the
 * mutation standing for whatever ran next: the driver's own retry, or the
 * legacy fallback pass the simulator drops to after a rolled-back settlement.
 *
 * What the leak is worth today is bounded by a gate elsewhere and is stated
 * here rather than assumed: a QCD batch commits only when every gift's
 * `charitableDeductionRequirement` is `notApplicableZeroEligibleAmount`
 * (`annualQcdExecution.ts`), and `settledReasons` in the same module refuses a
 * settled record whose `deductibleContributionOffsetApplied` is nonzero. So
 * every committed gift on this build consumes exactly zero offset, and what a
 * rolled-back pass leaves behind is the donor's ledger entry rather than a
 * wrong number. That gate is the one the section 170 chain exists to remove,
 * and a counterfactual pre-pass would consume real offset in a run that is
 * discarded by design -- which is why the restoration is pinned on the state
 * itself and not on a figure that happens to be zero.
 */

interface DonorLedgerObservation {
  readonly taxYear: number
  readonly consumedBeforeAttempt: readonly (readonly [string, number])[]
  readonly consumedAfterAttempt: readonly (readonly [string, number])[]
  readonly consumedAfterRollback: readonly (readonly [string, number])[]
  readonly unprovableBeforeAttempt: readonly string[]
  readonly unprovableAfterAttempt: readonly string[]
  readonly unprovableAfterRollback: readonly string[]
}

const controller = vi.hoisted(() => ({
  /** Tax years to force a rollback in; every other year delegates. */
  rollbackYears: [] as readonly number[],
  observations: [] as DonorLedgerObservation[],
}))

vi.mock('../internal/ownedNonRothIraAnnualAttemptSettlement.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../internal/ownedNonRothIraAnnualAttemptSettlement.js')
  >()
  const { beginSimulatorAnnualPassTransaction } = await import(
    './annualPassTransaction.js'
  )
  const { asPlanId } = await import('../actions/identity.js')
  return {
    ...original,
    runOwnedNonRothIraAnnualSettlementAttempts: (
      input: Parameters<
        typeof original.runOwnedNonRothIraAnnualSettlementAttempts
      >[0],
    ) => {
      if (!controller.rollbackYears.includes(input.projectionStartTaxYear)) {
        return original.runOwnedNonRothIraAnnualSettlementAttempts(input)
      }
      const consumed = () => [...input.state.namedQcdOffsetConsumedByDonor]
      const unprovable = () => [...input.state.namedQcdOffsetHistoryUnprovable]
      const consumedBeforeAttempt = consumed()
      const unprovableBeforeAttempt = unprovable()
      const transaction = beginSimulatorAnnualPassTransaction(input.state)
      input.runAttempt({
        attemptNumber: 1,
        stable: {
          planId: asPlanId(input.plan.id),
          projectionStartTaxYear: input.projectionStartTaxYear,
        },
        assumedEffects: [],
      })
      const consumedAfterAttempt = consumed()
      const unprovableAfterAttempt = unprovable()
      transaction.rollback()
      controller.observations.push({
        taxYear: input.projectionStartTaxYear,
        consumedBeforeAttempt,
        consumedAfterAttempt,
        consumedAfterRollback: consumed(),
        unprovableBeforeAttempt,
        unprovableAfterAttempt,
        unprovableAfterRollback: unprovable(),
      })
      return Object.freeze({
        status: 'rolledBack' as const,
        reason: 'assumptionCycle' as const,
        attemptCount: 1,
        pendingSettlement: null,
        committedCarryforwards: null,
        issue: null,
      })
    },
  }
})

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from '../actions/identity.js'
import { asPositiveUsdCents, asUsdCents } from '../actions/money.js'
import type { QualifiedCharitableDistributionRequest } from '../actions/contract.js'
import type { Account, Plan } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'

const TAX_YEAR = 2026
/** Born 1950-03-01: age 76 in 2026 and 70½ since 2020-09-01. */
const DOB = '1950-03-01'
const THRESHOLD_YEAR = 2020
const GIFT_DOLLARS = 20_000
const IRA_DOLLARS = 500_000
const IRA_BASIS_DOLLARS = 10_000

/** Nondeductible basis is what makes the owned-IRA settlement run at all. */
function ira(): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount('ira', IRA_DOLLARS, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    nondeductibleBasis: IRA_BASIS_DOLLARS,
  }
}

function namedQcd(): QualifiedCharitableDistributionRequest {
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
  }
}

function donorPlan(options: {
  readonly id: string
  readonly requests?: readonly QualifiedCharitableDistributionRequest[]
  readonly qcdAnnual?: number
}): Plan {
  const plan = singlePersonPlan({ dob: DOB, planningAge: 95 })
  plan.id = options.id
  plan.accounts = [ira(), cashAccount('cash', 200_000)]
  plan.strategies.qcdAnnual = options.qcdAnnual ?? 0
  plan.strategies.retirementActions = [...(options.requests ?? [])]
  const years: number[] = []
  for (let taxYear = THRESHOLD_YEAR; taxYear <= TAX_YEAR; taxYear += 1) {
    years.push(taxYear)
  }
  plan.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: 'ira',
      subtype: 'traditional',
      evidenceId: 'classification-ira',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: years.map((taxYear) => ({
      donorPersonId: 'p1',
      taxYear,
      amountCents: asUsdCents(0),
      evidenceId: `contribution-${taxYear}`,
      provenance: { source: 'manual', sourceId: `ledger-${taxYear}` },
    })),
  }
  return plan
}

function project(plan: Plan) {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
}

describe('the named-QCD donor ledgers across a rolled-back annual pass', () => {
  beforeEach(() => {
    controller.rollbackYears = []
    controller.observations.length = 0
  })

  it('leaves no consumed-offset entry behind for the fallback pass to read', () => {
    controller.rollbackYears = [TAX_YEAR]
    const rolledBack = project(donorPlan({
      id: 'qcd-offset-checkpoint-rollback',
      requests: [namedQcd()],
    }))
    const observation = controller.observations[0]

    // The control: the attempt really did write the ledger, so the restoration
    // below is not vacuously true of a pass that never touched it.
    expect(observation?.consumedBeforeAttempt).toEqual([])
    expect(observation?.consumedAfterAttempt).toEqual([['p1', 0]])
    expect(observation?.consumedAfterRollback).toEqual([])
    // And the year still lands on the gift the fallback pass at the end of the
    // year loop executed, from a ledger that opened where the rolled-back
    // attempt found it rather than where it left it.
    expect(rolledBack.years[0]?.qcd).toBeCloseTo(GIFT_DOLLARS, 6)
    expect(rolledBack.years[0]?.qcdActionExecution?.committed).toBe(true)
  })

  it('leaves no unprovable-donor verdict behind either', () => {
    // The recurring QCD amount is the other writer: a scalar gift has no donor,
    // so it is charged to every eligible one and makes their offset history
    // unstateable from that year on. A rolled-back attempt must not be able to
    // impose that verdict on donors whose gift never settled.
    controller.rollbackYears = [TAX_YEAR]
    const rolledBack = project(donorPlan({
      id: 'qcd-offset-checkpoint-unprovable',
      qcdAnnual: 5_000,
    }))
    const observation = controller.observations[0]

    expect(observation?.unprovableBeforeAttempt).toEqual([])
    expect(observation?.unprovableAfterAttempt).toEqual(['p1'])
    expect(observation?.unprovableAfterRollback).toEqual([])
    expect(rolledBack.years[0]?.qcd).toBeCloseTo(5_000, 6)
  })

  it('reaches the same year the settlement path reaches without a rollback', () => {
    // The fallback at the end of the year loop re-runs the whole pass. With the
    // ledgers restored it opens on the same donor state the committed path
    // opened on, so the year's charitable economics are the settlement path's.
    //
    // Scoped to the gift on purpose. A rolled-back settlement also withholds
    // the exact-cent basis replay, which legitimately moves the *other*
    // distributions' pro-rata split and so moves MAGI -- that is the rollback's
    // own published consequence, not the donor ledgers'.
    controller.rollbackYears = [TAX_YEAR]
    const rolledBack = project(donorPlan({
      id: 'qcd-offset-checkpoint-fallback',
      requests: [namedQcd()],
    }))
    controller.rollbackYears = []
    const settled = project(donorPlan({
      id: 'qcd-offset-checkpoint-settled',
      requests: [namedQcd()],
    }))

    expect(controller.observations).toHaveLength(1)
    expect(rolledBack.years[0]?.qcd).toBeCloseTo(settled.years[0]?.qcd ?? -1, 6)
    expect(rolledBack.years[0]?.balances.ira)
      .toBeCloseTo(settled.years[0]?.balances.ira ?? -1, 6)
    expect(rolledBack.years[0]?.qcdActionExecution?.committed).toBe(true)
    expect(settled.years[0]?.qcdActionExecution?.committed).toBe(true)
    expect(rolledBack.years[0]?.qcdActionExecution?.totalExcludableAmount)
      .toBe(settled.years[0]?.qcdActionExecution?.totalExcludableAmount)
  })

  it('pins the executor’s RMD-satisfied figure at zero, the offset’s sole input', () => {
    // The offset used to be capped at the requirement's taxable share — the
    // pre-408(d)(8)(D) ceiling — behind a value that is structurally zero
    // today: the annual pass distributes the whole required amount in cash
    // before any named gift is sized, so the executor publishes
    // totalRmdSatisfiedAmount of zero on every current shape
    // (treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd). The wrong cap is
    // gone; this pin holds the offset equal to the published figure, so the
    // day the RMD-reserve slice makes it positive, this fails and forces the
    // statutory aggregate-includible cap decision rather than letting a
    // removed formula's absence pass silently.
    const result = project(donorPlan({
      id: 'qcd-offset-checkpoint-dormant-cap',
      requests: [namedQcd()],
    }))
    const execution = result.years[0]?.qcdActionExecution
    expect(execution?.committed).toBe(true)
    expect(execution?.totalRmdSatisfiedAmount).toBe(0)
  })
})
