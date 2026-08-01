import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { singlePersonPlan, traditionalAccount } from '../testing/planFixtures.js'
import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
} from './identity.js'
import { asPositiveUsdCents, asUsdCents } from './money.js'
import {
  preparePlanOwnedNonRothIraAnnualCandidateTransaction,
  type PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput,
} from './ownedNonRothIraAnnualCandidateTransaction.js'
import {
  buildCompletePlanOwnedNonRothIraAnnualPassEvidence,
  probePlanOwnedNonRothIraAnnualPass,
  type ProbePlanOwnedNonRothIraAnnualPassInput,
} from './ownedNonRothIraAnnualPassProbe.js'

const owner = asPersonId('p1')
const planId = asPlanId('annual-pass-probe-plan')
const ira = asAccountId('ira')
const siblingIra = asAccountId('sibling-ira')
const actionId = asActionId('withdrawal')
const allocationId = asAllocationId('allocation')
const secondActionId = asActionId('withdrawal-second')
const secondAllocationId = asAllocationId('allocation-second')

function plan(): Plan {
  const value = singlePersonPlan({ dob: '1950-01-01', planningAge: 100 })
  value.id = planId
  value.accounts = [
    traditionalAccount(ira, 100, owner),
    traditionalAccount(siblingIra, 100, owner),
  ]
  value.retirementActionEligibilityFacts = {
    iraClassifications: [{
      sourceAccountId: ira,
      subtype: 'traditional',
      evidenceId: 'classification',
      provenance: { source: 'manual' },
    }, {
      sourceAccountId: siblingIra,
      subtype: 'sep',
      evidenceId: 'classification-sibling',
      provenance: { source: 'manual' },
    }],
    sepSimpleActivities: [],
    deductibleIraContributions: [],
  }
  value.strategies.retirementActions = [{
    actionId,
    kind: 'ordinaryWithdrawal',
    year: 2030,
    executionDate: '2030-06-15',
    executionSequence: 10,
    requestedAmount: asPositiveUsdCents(10_000),
    provenance: { source: 'manual' },
    personId: owner,
    allocations: [{
      allocationId,
      sourceAccountId: ira,
      requestedAmount: asPositiveUsdCents(10_000),
    }],
    purpose: { kind: 'spending' },
  }]
  return value
}

function completedCandidateInput(
  opening: number,
): PreparePlanOwnedNonRothIraAnnualCandidateTransactionInput {
  return {
    plan: plan(),
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    openingBalances: [{
      accountId: ira,
      openingBalance: asUsdCents(opening),
    }],
    runtimeRecords: [],
    runtimeInventoryAttestation: {
      predicate: 'completeAnnualRetirementPhysicalEventInventory',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      resolvedEventIds: [],
      unresolvedActivityIds: [],
      evidenceId: 'runtime-inventory',
      upstreamEvidenceId: 'runtime-inventory-upstream',
    },
  }
}

function fixture(
  opening = 10_000,
  openingBasis = opening === 0 ? 0 : 4_000,
  yearEnd = 0,
  multiple = false,
): ProbePlanOwnedNonRothIraAnnualPassInput {
  const completedInput = completedCandidateInput(opening)
  if (multiple) {
    const valuePlan = completedInput.plan as Plan
    const first = valuePlan.strategies.retirementActions[0]!
    if (first.kind !== 'ordinaryWithdrawal') throw new Error('fixture drift')
    valuePlan.strategies.retirementActions.push({
      ...first,
      actionId: secondActionId,
      executionDate: '2030-09-01',
      executionSequence: 20,
      requestedAmount: asPositiveUsdCents(3_000),
      allocations: [{
        allocationId: secondAllocationId,
        sourceAccountId: siblingIra,
        requestedAmount: asPositiveUsdCents(3_000),
      }],
    })
    completedInput.openingBalances = [
      ...completedInput.openingBalances,
      { accountId: siblingIra, openingBalance: asUsdCents(3_000) },
    ]
  }
  const prepared =
    preparePlanOwnedNonRothIraAnnualCandidateTransaction(completedInput)
  if (prepared.status !== 'candidateTransactionPrepared') {
    throw new Error(`fixture failed: ${prepared.status} ${JSON.stringify(prepared.issues)}`)
  }
  const executed = Math.min(opening, 10_000)
  const basis = executed === 0 ? 0 : openingBasis
  const yearEndApplicableBalances = [{
    predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
    planId,
    ownerPersonId: owner,
    sourceAccountId: ira,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    ledgerPhase:
      'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' as const,
    asOfDate: '2030-12-31',
    yearEndApplicableBalanceAmount: asUsdCents(yearEnd),
    evidenceId: 'year-end',
    upstreamEvidenceId: 'year-end-upstream',
  }, {
    predicate: 'ownedNonRothIraForm8606ApplicableTaxYearEndBalance' as const,
    planId,
    ownerPersonId: owner,
    sourceAccountId: siblingIra,
    taxYear: 2030,
    ledgerRunId: 'ledger-2030',
    ledgerPhase:
      'form8606ApplicableTaxYearEndAfterCanonicalMovementCandidate' as const,
    asOfDate: '2030-12-31',
    yearEndApplicableBalanceAmount: asUsdCents(0),
    evidenceId: 'year-end-sibling',
    upstreamEvidenceId: 'year-end-sibling-upstream',
  }]
  const assumedEffects = multiple
    ? prepared.movementCandidate.actions.flatMap((action) =>
      action.allocations.map((allocation) => ({
        actionId: action.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        executedAmount: allocation.executedAmount,
        basisReturnAmount: asUsdCents(0),
        ordinaryIncomeAmount: allocation.executedAmount,
        allocatedPenaltyAmount: asUsdCents(0),
      })))
    : [{
        actionId,
        allocationId,
        sourceAccountId: ira,
        executedAmount: asUsdCents(executed),
        basisReturnAmount: asUsdCents(basis),
        ordinaryIncomeAmount: asUsdCents(executed - basis),
        allocatedPenaltyAmount: asUsdCents(0),
      }]
  const annualPassEvidence = structuredClone(
    buildCompletePlanOwnedNonRothIraAnnualPassEvidence({
      predicate: 'completePlanOwnedNonRothIraAnnualPassEvidence',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      movementCandidateId: prepared.movementCandidate.movementCandidateId,
      inventoryEvidenceId: prepared.inventory.inventoryEvidenceId,
      transactionEvidenceId: prepared.transactionEvidenceId,
      assumedEffects,
      yearEndApplicableBalances,
      passStatus: 'completeAfterAllAnnualTransactionsAndGrowth',
      upstreamEvidenceId: 'annual-pass-upstream',
    }),
  )
  return {
    provisionalMovementInput: structuredClone(prepared.movementInput),
    provisionalMovementCandidate: structuredClone(prepared.movementCandidate),
    completedCandidateInput: completedInput,
    annualPassEvidence,
    annualBasisRecord: {
      predicate: 'completePlanOwnedNonRothIraAnnualBasisRecord',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      recordStatus: 'openingBasisAndExplicitZeroRolloverFactsComplete',
      openingBasisAmount: asUsdCents(openingBasis),
      outstandingRolloverAmount: 0,
      rolloverRepaymentAdjustmentAmount: 0,
      evidenceId: 'annual-basis',
      upstreamEvidenceId: 'annual-basis-upstream',
    },
    postYearContributionWindow: {
      predicate:
        'completePlanOwnedNonRothIraPostYearNondeductibleContributionWindow',
      planId,
      ownerPersonId: owner,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      inventoryStatus: 'completeIncludingExplicitEmpty',
      deadlineEvidence: {
        predicate: 'federalIraContributionDeadlineForTaxYear',
        designatedTaxYear: 2030,
        deadlineStatus: 'authoritativeFederalDeadlineEstablished',
        deadlineKind:
          'ordinaryFederalFilingDeadlineExcludingDisasterRelief',
        calendarAdjustmentStatus:
          'weekendAndDistrictOfColumbiaHolidayAdjustmentApplied',
        deadlineDate: '2031-04-15',
        evidenceId: 'contribution-deadline',
        upstreamEvidenceId: 'contribution-deadline-upstream',
      },
      contributions: [],
      evidenceId: 'contribution-window',
      upstreamEvidenceId: 'contribution-window-upstream',
    },
    penaltyFacts: {
      ownerEvidence: {
        predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
        ownerPersonId: owner,
        birthDate: '1950-01-01',
        evidenceId: 'owner-birth',
      },
      simpleParticipationEvidence: [],
    },
  }
}

function rebindPass(input: ProbePlanOwnedNonRothIraAnnualPassInput): void {
  const { evidenceId, ...body } = input.annualPassEvidence
  void evidenceId
  input.annualPassEvidence = structuredClone(
    buildCompletePlanOwnedNonRothIraAnnualPassEvidence(body),
  )
}

describe('Plan-owned non-Roth IRA annual-pass probe', () => {
  it.each([
    ['full', 10_000, 'postCandidateAnnualWithdrawalCommitted'],
    ['partial', 5_000, 'postCandidateAnnualWithdrawalCommitted'],
    ['zero', 0, 'postCandidateMovementRefused'],
  ] as const)('settles an exact %s assumption', (_label, opening, nested) => {
    const input = fixture(opening)
    const result = probePlanOwnedNonRothIraAnnualPass(input)
    expect(result.status).toBe('commit')
    if (result.status !== 'commit') return
    expect(result.execution.status).toBe(nested)
    expect(result.decision).toBe(
      opening === 0 ? 'settledNoMovement' : 'commitReady',
    )
    expect(result.movement).toBe(opening === 0 ? 'noMovement' : 'notCommitted')
    expect(result.controlBinding).toMatchObject({
      annualPassEvidenceId: input.annualPassEvidence.evidenceId,
      probeEvidenceId: result.probeEvidenceId,
    })
  })

  it.each([
    'executedAmount',
    'basisReturnAmount',
    'ordinaryIncomeAmount',
    'allocatedPenaltyAmount',
  ] as const)(
    'returns reprobe when valid %s assumptions changed',
    (field) => {
      const input = fixture()
      ;(input.annualPassEvidence.assumedEffects[0] as unknown as
        Record<string, number>)[field] += 1
      rebindPass(input)
      const result = probePlanOwnedNonRothIraAnnualPass(input)
      expect(result).toMatchObject({
        status: 'reprobe',
        movement: 'notCommitted',
        execution: null,
      })
      expect(result.observedEffects[0]).toMatchObject({
        basisReturnAmount: 4_000,
        ordinaryIncomeAmount: 6_000,
        allocatedPenaltyAmount: 0,
      })
    },
  )

  it('returns reprobe when the truthful December 31 pool changes character', () => {
    const input = fixture()
    ;(input.annualPassEvidence.yearEndApplicableBalances[0] as {
      yearEndApplicableBalanceAmount: number
    }).yearEndApplicableBalanceAmount = 1_000
    rebindPass(input)
    const result = probePlanOwnedNonRothIraAnnualPass(input)
    expect(result.status).toBe('reprobe')
    expect(result.observedEffects[0]?.basisReturnAmount).not.toBe(4_000)
  })

  it('canonicalizes equivalent year-end evidence permutations', () => {
    const baseline = fixture()
    const permuted = fixture()
    ;(permuted.annualPassEvidence as unknown as {
      yearEndApplicableBalances: unknown[]
    }).yearEndApplicableBalances.reverse()
    rebindPass(permuted)
    expect(probePlanOwnedNonRothIraAnnualPass(permuted))
      .toEqual(probePlanOwnedNonRothIraAnnualPass(baseline))
  })

  it('canonicalizes provisional request, opening, and source permutations', () => {
    const baseline = fixture(10_000, 0, 0, true)
    const permuted = fixture(10_000, 0, 0, true)
    ;(permuted.provisionalMovementInput as unknown as {
      requests: unknown[]
      openingBalances: unknown[]
      sourceEvidence: unknown[]
    }).requests.reverse()
    ;(permuted.provisionalMovementInput as unknown as {
      openingBalances: unknown[]
    }).openingBalances.reverse()
    ;(permuted.provisionalMovementInput as unknown as {
      sourceEvidence: unknown[]
    }).sourceEvidence.reverse()
    expect(probePlanOwnedNonRothIraAnnualPass(permuted))
      .toEqual(probePlanOwnedNonRothIraAnnualPass(baseline))
  })

  it('requires a newly rebound pass after an assumption changes', () => {
    const input = fixture()
    ;(input.annualPassEvidence.assumedEffects[0] as {
      basisReturnAmount: number
    }).basisReturnAmount += 1
    expect(probePlanOwnedNonRothIraAnnualPass(input).status).toBe('rollback')
  })

  it('ignores hostile shadow keys outside the penalty-facts API', () => {
    const baseline = fixture()
    const hostile = fixture()
    Object.assign(hostile.penaltyFacts as object, {
      movementInput: { ownerPersonId: 'attacker' },
      annualInput: { taxYear: 1900 },
      postCandidateInput: { inventoryInput: null },
      postCandidateEvidence: { status: 'attacker' },
      annualFinalization: { finalizationEvidenceId: 'attacker' },
    })
    expect(probePlanOwnedNonRothIraAnnualPass(hostile))
      .toEqual(probePlanOwnedNonRothIraAnnualPass(baseline))
  })

  it('rolls back completed runtime activity requiring the unified ledger', () => {
    const input = fixture()
    ;(input.completedCandidateInput as unknown as {
      runtimeRecords: unknown[]
    }).runtimeRecords = [{
      recordStatus: 'resolved',
      planId,
      taxYear: 2030,
      ledgerRunId: 'ledger-2030',
      eventId: 'runtime-rmd',
      movementAuthorityId: 'runtime-rmd-authority',
      kind: 'ownedIraRmd',
      origin: 'rmdEngine',
      ownerPersonId: owner,
      sourceAccountId: ira,
      grossAmount: asPositiveUsdCents(1_000),
      executionDate: '2030-03-01',
      executionSequence: 1,
      upstreamEvidenceId: 'runtime-rmd-upstream',
    }]
    ;(input.completedCandidateInput as {
      runtimeInventoryAttestation:
        ProbePlanOwnedNonRothIraAnnualPassInput['completedCandidateInput']['runtimeInventoryAttestation']
    }).runtimeInventoryAttestation = {
      ...input.completedCandidateInput.runtimeInventoryAttestation,
      resolvedEventIds: ['runtime-rmd'],
    }
    expect(probePlanOwnedNonRothIraAnnualPass(input)).toMatchObject({
      status: 'rollback',
      movement: 'notCommitted',
      issues: [{
        kind: 'completedCandidateBlocked',
        upstreamStatus: 'requiresUnifiedAnnualLedger',
      }],
    })
  })

  it.each(['candidate', 'yearEnd', 'basis', 'window', 'pass'] as const)(
    'fails closed for tampered %s evidence',
    (target) => {
      const input = fixture()
      if (target === 'candidate') {
        ;(input.provisionalMovementCandidate as {
          movementCandidateId: string
        }).movementCandidateId = 'tampered-candidate'
      } else if (target === 'yearEnd') {
        ;(input.annualPassEvidence.yearEndApplicableBalances[0] as {
          evidenceId: string
        })
          .evidenceId = 'annual-basis'
      } else if (target === 'basis') {
        ;(input.annualBasisRecord as { recordStatus: string })
          .recordStatus = 'incomplete'
      } else if (target === 'window') {
        ;(input.postYearContributionWindow as { evidenceId: string })
          .evidenceId = 'year-end'
      } else {
        ;(input.annualPassEvidence as { ledgerRunId: string })
          .ledgerRunId = 'stale-ledger'
      }
      expect(probePlanOwnedNonRothIraAnnualPass(input).status)
        .toBe('rollback')
    },
  )

  it('rolls back malformed, duplicate, or incomplete assumption vectors', () => {
    const malformed = fixture()
    ;(malformed.annualPassEvidence.assumedEffects[0] as {
      executedAmount: number
    })
      .executedAmount = -1
    expect(probePlanOwnedNonRothIraAnnualPass(malformed)).toMatchObject({
      status: 'rollback',
      issues: [{ kind: 'effectAssumptionInvalid' }],
    })

    const duplicate = fixture()
    ;(duplicate.annualPassEvidence as unknown as {
      assumedEffects: unknown[]
    }).assumedEffects = [
      duplicate.annualPassEvidence.assumedEffects[0]!,
      duplicate.annualPassEvidence.assumedEffects[0]!,
    ]
    expect(probePlanOwnedNonRothIraAnnualPass(duplicate)).toMatchObject({
      status: 'rollback',
      issues: [{ kind: 'effectAssumptionInvalid' }],
    })
  })

  it('is deterministic, input-pure, deeply frozen, and collision guarded', () => {
    const input = fixture()
    const before = structuredClone(input)
    const first = probePlanOwnedNonRothIraAnnualPass(input)
    const second = probePlanOwnedNonRothIraAnnualPass(input)
    expect(first).toEqual(second)
    expect(input).toEqual(before)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first.observedEffects)).toBe(true)
    expect(Object.isFrozen(first.observedEffects[0])).toBe(true)
    expect(Object.isFrozen(input.annualPassEvidence)).toBe(false)
    expect(Object.isFrozen(
      input.annualPassEvidence.yearEndApplicableBalances,
    )).toBe(false)
    expect(Object.isFrozen(
      input.annualPassEvidence.yearEndApplicableBalances[0],
    )).toBe(false)

    const collision = fixture()
    ;(collision.annualPassEvidence as { evidenceId: string }).evidenceId =
      'classification'
    expect(probePlanOwnedNonRothIraAnnualPass(collision)).toMatchObject({
      status: 'rollback',
      issues: [{ kind: 'annualPassIdentifierCollision' }],
    })
  })

  it('reserves the completed transaction identity across caller facts', () => {
    const input = fixture()
    ;(input.annualBasisRecord as { evidenceId: string }).evidenceId =
      input.annualPassEvidence.transactionEvidenceId
    expect(probePlanOwnedNonRothIraAnnualPass(input)).toMatchObject({
      status: 'rollback',
      issues: [{ kind: 'annualPassIdentifierCollision' }],
    })
  })

  it('turns malformed producer exceptions into a nonmoving rollback', () => {
    const input = fixture()
    ;(input.penaltyFacts as unknown as { ownerEvidence: unknown })
      .ownerEvidence = null
    expect(probePlanOwnedNonRothIraAnnualPass(input)).toMatchObject({
      status: 'rollback',
      movement: 'notCommitted',
      issues: [{ kind: 'orchestrationException' }],
    })
  })
})
