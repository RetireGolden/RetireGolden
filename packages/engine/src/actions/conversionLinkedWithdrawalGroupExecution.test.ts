import { describe, expect, it } from 'vitest'

import {
  mintAnnualLiabilityRunIdentity,
  type AnnualLiabilityRunBinding,
  type AnnualLiabilityRunIdentity,
} from './annualLiabilityRunIdentity.js'
import { parseRetirementActionRequest } from './contract.js'
import type { RetirementActionRequest } from './contract.js'
import { assessConversionLinkedWithdrawalGroups } from './conversionLinkedWithdrawalGroup.js'
import {
  authorizeConversionLinkedWithdrawalGroups,
  executeConversionLinkedWithdrawalGroups,
  type ConversionLinkedWithdrawalGroupLiabilityRun,
  type ConversionLinkedWithdrawalGroupMemberInput,
} from './conversionLinkedWithdrawalGroupExecution.js'
import {
  reducedConversionTaxFundingExactCentAmount,
  type ConversionTaxFundingTaxUnitEvidence,
} from './conversionTaxFundingEvidence.js'
import { asActionId, asPersonId } from './identity.js'
import { asUsdCents } from './money.js'

/**
 * The linked-funding group executor: what it computes, and what it still will
 * not do.
 *
 * The simulator's own end-to-end fixture proves the two liability runs are real
 * runs of a real annual pass. This file proves the rest, with the liabilities
 * supplied — which is the only way to reach the arithmetic that matters. Every
 * group refuses today, a refused conversion has no taxable principal, and a
 * refused withdrawal funds nothing, so a real simulator group is always a
 * required amount of zero split across zero weight. That degenerate case is
 * pinned end to end; the allocation, the mismatch arms and the identity
 * checking are pinned here, over the liabilities the slice that opens the gate
 * will hand it.
 */

const YEAR = 2030
const TAX_UNIT_ID = 'group-execution-tax-unit'

const taxUnit: Readonly<ConversionTaxFundingTaxUnitEvidence> = {
  taxUnitId: TAX_UNIT_ID,
  taxYear: YEAR,
  federalFilingStatus: 'single',
  stateFilingStatusId: 'group-execution-state-filing',
  taxUnitEvidenceId: 'group-execution-tax-unit-evidence',
  taxUnitMemberPersonIds: [asPersonId('p1')],
}

function cents(whole: number): ReturnType<
  typeof reducedConversionTaxFundingExactCentAmount
> {
  return reducedConversionTaxFundingExactCentAmount(BigInt(whole), 1n)
}

function exactCents(whole: number) {
  const amount = cents(whole)
  if (amount === null) throw new Error('unrepresentable liability')
  return amount
}

function identity(
  binding: Readonly<AnnualLiabilityRunBinding>,
  omitted: readonly string[],
): Readonly<AnnualLiabilityRunIdentity> {
  const minted = mintAnnualLiabilityRunIdentity({
    planId: 'group-execution-plan',
    taxUnitId: TAX_UNIT_ID,
    taxYear: YEAR,
    liabilityRun: binding,
    taxInputs: [
      {
        inputId: 'taxUnitEvidenceId',
        value: {
          representation: 'declaredTerm',
          term: taxUnit.taxUnitEvidenceId,
        },
      },
      {
        inputId: 'counterfactualOmittedRetirementActionIds',
        value: { representation: 'declaredTerm', term: JSON.stringify(omitted) },
      },
    ],
  })
  if (minted.status !== 'annualLiabilityRunIdentityMinted') {
    throw new Error(minted.issues[0].detail)
  }
  return minted.identity
}

function baselineRun(
  liabilityCents: number,
  omitted: readonly string[] = ['conversion-a', 'withdrawal-a'],
): Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> {
  return {
    liability: exactCents(liabilityCents),
    identity: identity(
      { liabilityRunKind: 'baselineT0', candidateFundingVectorEvidenceId: null },
      omitted,
    ),
  }
}

function candidateRun(
  liabilityCents: number,
): Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> {
  return {
    liability: exactCents(liabilityCents),
    identity: identity(
      {
        liabilityRunKind: 'candidateT1',
        candidateFundingVectorEvidenceId: 'group-execution-funding-vector',
      },
      [],
    ),
  }
}

function conversion(
  actionId: string,
  withdrawalActionId: string,
  executionSequence: number,
  executionDate: string,
): RetirementActionRequest {
  const parsed = parseRetirementActionRequest({
    actionId,
    kind: 'rothConversion',
    personId: 'p1',
    year: YEAR,
    executionDate,
    executionSequence,
    requestedAmount: 50_000_00,
    allocations: [{
      allocationId: `${actionId}-allocation`,
      sourceAccountId: 'ira-a',
      requestedAmount: 50_000_00,
    }],
    destinationRothAccountId: 'roth-a',
    taxFunding: { kind: 'linkedWithdrawal', withdrawalActionId },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function withdrawal(
  actionId: string,
  referenceId: string,
  executionSequence: number,
  executionDate: string | null,
): RetirementActionRequest {
  const parsed = parseRetirementActionRequest({
    actionId,
    kind: 'ordinaryWithdrawal',
    personId: 'p1',
    year: YEAR,
    ...(executionDate === null ? {} : { executionDate }),
    executionSequence,
    requestedAmount: 10_000_00,
    allocations: [{
      allocationId: `${actionId}-allocation`,
      sourceAccountId: 'cash-a',
      requestedAmount: 10_000_00,
    }],
    purpose: { kind: 'taxPayment', referenceId },
    provenance: { source: 'manual' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}

function member(
  actionId: string,
  allocationWeight: number | null,
  fundedAmount: number,
): Readonly<ConversionLinkedWithdrawalGroupMemberInput> {
  return {
    conversionActionId: asActionId(actionId),
    conversionPersonId: asPersonId('p1'),
    allocationWeight: allocationWeight === null
      ? null
      : asUsdCents(allocationWeight),
    fundedAmount: asUsdCents(fundedAmount),
  }
}

/** One conversion, one dedicated withdrawal, both well scheduled. */
function dedicatedPair(): readonly RetirementActionRequest[] {
  return [
    withdrawal('withdrawal-a', 'conversion-a', 1, `${YEAR}-06-14`),
    conversion('conversion-a', 'withdrawal-a', 2, `${YEAR}-06-15`),
  ]
}

function run(input: {
  requests: readonly RetirementActionRequest[]
  members: readonly Readonly<ConversionLinkedWithdrawalGroupMemberInput>[]
  baseline?: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  candidate?: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  taxUnitOverride?: Readonly<ConversionTaxFundingTaxUnitEvidence> | null
}) {
  return executeConversionLinkedWithdrawalGroups({
    taxYear: YEAR,
    requests: input.requests,
    assessment: assessConversionLinkedWithdrawalGroups(input.requests, {
      annualLiabilityBaseline: (input.baseline ?? null) === null
        ? 'unavailable'
        : 'read',
    }),
    taxUnit: input.taxUnitOverride === undefined
      ? taxUnit
      : input.taxUnitOverride,
    baseline: input.baseline ?? null,
    candidate: input.candidate ?? null,
    members: input.members,
  })
}

describe('executeConversionLinkedWithdrawalGroups', () => {
  describe('what it refuses to do', () => {
    it('refuses a group that was handed no movement, however good its figures', () => {
      // This used to read `status` and `movement` as literal types, which was
      // the gate while the executor had no executable arm at all. It has one
      // now, so the pin moves from the type to the *predicate*: perfect
      // liabilities, a real merged ordering and a satisfied evaluation are
      // still not permission, because nothing moved. A caller that omits the
      // movement is a caller reporting a year in which the legs stayed still,
      // and the answer to that is refusal whatever else it supplies.
      const result = run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 50_000_00, 2_500_00)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_250_000),
      })

      expect(result.status).toBe('refused')
      expect(result.movement).toBe('none')
      expect(result.groups.map((group) => group.movement)).toEqual(['none'])
      expect(result.groups.map((group) => group.disposition))
        .toEqual(['refusedPendingGroupExecution'])
      expect(Object.isFrozen(result)).toBe(true)
    })
  })

  describe('the merged ordering both legs would occupy', () => {
    it('orders the two legs through one schedule, not two', () => {
      const result = run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 50_000_00, 2_500_00)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_250_000),
      })

      expect(result.ordering?.orderingSource)
        .toBe('mergedRetirementActionSchedule')
      // The withdrawal is dated a day earlier, so the merged schedule puts it
      // first. Neither executor could have said that: each sees one kind.
      expect(result.ordering?.positions.map((position) => ({
        actionId: position.actionId,
        order: position.order,
        effectiveDate: position.effectiveDate,
      }))).toEqual([
        {
          actionId: 'withdrawal-a',
          order: 1,
          effectiveDate: `${YEAR}-06-14`,
        },
        {
          actionId: 'conversion-a',
          order: 2,
          effectiveDate: `${YEAR}-06-15`,
        },
      ])
      const group = result.groups[0]!
      expect(group.conversionPosition?.order).toBe(2)
      expect(group.withdrawalPosition?.order).toBe(1)
      expect(group.orderingComplete).toBe(true)
    })

    it('reports an incomplete ordering when the two legs disagree about dates', () => {
      // An undated ordinary withdrawal is lawful and lands on the year's last
      // day; an undated conversion has no effective date at all. The pair can
      // therefore be half-scheduled, and a group that must move as one
      // transaction cannot.
      const requests = [
        withdrawal('withdrawal-a', 'conversion-a', 1, null),
        conversion('conversion-a', 'withdrawal-a', 2, `${YEAR}-06-15`),
      ]
      const withdrawalUndated = run({
        requests,
        members: [member('conversion-a', 0, 0)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_000_000),
      })

      expect(withdrawalUndated.ordering?.positions.map((position) => ({
        actionId: position.actionId,
        scheduledDate: position.scheduledDate,
        effectiveDate: position.effectiveDate,
        scheduleValid: position.scheduleValid,
      }))).toEqual([
        {
          actionId: 'conversion-a',
          scheduledDate: `${YEAR}-06-15`,
          effectiveDate: `${YEAR}-06-15`,
          scheduleValid: true,
        },
        {
          actionId: 'withdrawal-a',
          scheduledDate: null,
          effectiveDate: `${YEAR}-12-31`,
          scheduleValid: true,
        },
      ])
      // Both legs are well scheduled here, and the ordering says the funding
      // would arrive six months after the conversion it funds. That is an
      // ordering fact, not a refusal: the refusal is the disposition's.
      expect(withdrawalUndated.groups[0]!.orderingComplete).toBe(true)

      // A withdrawal the request set does not contain has no position at all.
      const orphaned = run({
        requests: [conversion('conversion-a', 'withdrawal-a', 2, `${YEAR}-06-15`)],
        members: [member('conversion-a', 0, 0)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_000_000),
      })

      expect(orphaned.groups[0]!.withdrawalPosition).toBeNull()
      expect(orphaned.groups[0]!.orderingComplete).toBe(false)
    })
  })

  describe('the annual funding evaluation', () => {
    it('builds the whole chain from two distinct liability runs', () => {
      const result = run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 50_000_00, 2_500_00)],
        // 12,500.00 against 10,000.00: the group costs 2,500.00, funded to the
        // cent by the withdrawal.
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_250_000),
      })

      if (result.funding.status !== 'annualGroupEvaluated') {
        throw new Error(result.funding.issues.join('; '))
      }
      expect(result.funding.members).toHaveLength(1)
      const evidence = result.funding.members[0]!
      expect(evidence).toMatchObject({
        evaluation: 'satisfied',
        fundingEquality: 'exactCentQuantized',
        annualGroupRequiredFundingAmount: 250_000,
        annualGroupFundedAmount: 250_000,
        requiredFundingAmount: 250_000,
        fundedAmount: 250_000,
        allocationOrder: 1,
        allocationWeight: 50_000_00,
        currencyMinorUnit: 0.01,
        liabilityQuantization: 'nearestCentHalfUp',
      })
      expect(evidence.baselineAnnualTaxLiability.numeratorMinorUnits).toBe(1_000_000)
      expect(evidence.candidateAnnualTaxLiability.numeratorMinorUnits).toBe(1_250_000)
      // The record names its two runs, and they are the runs it was handed.
      expect(evidence.baselineAnnualTaxLiabilityEvidenceId)
        .toBe(result.funding.baselineRun.annualTaxLiabilityEvidenceId)
      expect(evidence.candidateAnnualTaxLiabilityEvidenceId)
        .toBe(result.funding.candidateRun.annualTaxLiabilityEvidenceId)
      // Different runs over different input sets, because one removed the group
      // and the other did not.
      expect(result.funding.taxInputSnapshotsShared).toBe(false)
      // And the member record reaches the group's own verdict record.
      expect(result.groups[0]!.fundingEvidence).toBe(evidence)
    })

    it('splits the group requirement by largest remainder in scheduled order', () => {
      // Three conversions, weights 1/1/1, requirement 100 cents: 33 each with a
      // residual cent. Equal remainders make the tie-break by position the
      // deciding rule, and position is the merged schedule's, not the caller's.
      const requests = [
        withdrawal('withdrawal-c', 'conversion-c', 1, `${YEAR}-03-01`),
        conversion('conversion-c', 'withdrawal-c', 2, `${YEAR}-03-02`),
        withdrawal('withdrawal-b', 'conversion-b', 3, `${YEAR}-05-01`),
        conversion('conversion-b', 'withdrawal-b', 4, `${YEAR}-05-02`),
        withdrawal('withdrawal-a', 'conversion-a', 5, `${YEAR}-09-01`),
        conversion('conversion-a', 'withdrawal-a', 6, `${YEAR}-09-02`),
      ]
      const result = run({
        requests,
        // Supplied in action-id order, which is the reverse of scheduled order.
        members: [
          member('conversion-a', 1, 0),
          member('conversion-b', 1, 0),
          member('conversion-c', 1, 0),
        ],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_000_100),
      })

      if (result.funding.status !== 'annualGroupEvaluated') {
        throw new Error(result.funding.issues.join('; '))
      }
      expect(result.funding.members.map((evidence) => ({
        conversionActionId: evidence.conversionActionId,
        allocationOrder: evidence.allocationOrder,
        requiredFundingAmount: evidence.requiredFundingAmount,
      }))).toEqual([
        { conversionActionId: 'conversion-c', allocationOrder: 1, requiredFundingAmount: 34 },
        { conversionActionId: 'conversion-b', allocationOrder: 2, requiredFundingAmount: 33 },
        { conversionActionId: 'conversion-a', allocationOrder: 3, requiredFundingAmount: 33 },
      ])
      expect(
        result.funding.members.reduce(
          (sum, evidence) => sum + evidence.requiredFundingAmount,
          0,
        ),
      ).toBe(100)
    })

    it('reports the mismatch arm and its signed cents when funding falls short', () => {
      const result = run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 50_000_00, 240_000)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_250_000),
      })

      if (result.funding.status !== 'annualGroupEvaluated') {
        throw new Error(result.funding.issues.join('; '))
      }
      expect(result.funding.members[0]).toMatchObject({
        evaluation: 'mismatch',
        fundingEquality: 'notEqual',
        mismatchKind: 'memberAndAnnualGroup',
        fundedAmountDifference: -10_000,
        annualGroupFundedAmountDifference: -10_000,
      })
    })

    it('floors the requirement at zero when the group lowered the liability', () => {
      // A candidate below its baseline is not a negative requirement. It is a
      // group that cost the filing unit nothing, and the funding question has
      // the answer zero.
      const result = run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 0, 0)],
        baseline: baselineRun(1_250_000),
        candidate: candidateRun(1_000_000),
      })

      if (result.funding.status !== 'annualGroupEvaluated') {
        throw new Error(result.funding.issues.join('; '))
      }
      expect(result.funding.members[0]).toMatchObject({
        evaluation: 'satisfied',
        annualGroupRequiredFundingAmount: 0,
        requiredFundingAmount: 0,
        fundedAmount: 0,
      })
      expect(
        result.funding.members[0]!
          .unquantizedAnnualGroupRequiredFundingAmount.numeratorMinorUnits,
      ).toBe(0)
    })
  })

  describe('what it refuses to evaluate', () => {
    it('refuses without a baseline, without a unit, and without both', () => {
      const requests = dedicatedPair()
      const members = [member('conversion-a', 0, 0)]

      expect(run({ requests, members, candidate: candidateRun(1_000_000) }).funding)
        .toMatchObject({
          status: 'annualGroupNotEvaluated',
          reason: 'annualLiabilityUnavailable',
        })
      expect(run({
        requests,
        members,
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_000_000),
        taxUnitOverride: null,
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'taxUnitUnavailable',
      })
      // A year with no linked group at all: the ordering is absent too, because
      // there are no legs to order.
      const none = run({ requests: [], members: [] })
      expect(none.funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'noAnnualGroup',
      })
      expect(none.ordering).toBeNull()
      expect(none.groups).toEqual([])
    })

    it('refuses a member whose taxable principal nobody can state', () => {
      // Null is not zero. A conversion that moved while leaving its Form 8606
      // character to the annual settlement has a weight this run cannot state,
      // and zero would say it owes none of the unit's tax.
      expect(run({
        requests: dedicatedPair(),
        members: [member('conversion-a', null, 0)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_250_000),
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'allocationWeightUnavailable',
      })
    })

    it('refuses two identities that disagree about what they name', () => {
      // The failure the collision check exists for is not a hash collision. It
      // is a caller rebuilding an identity by hand, so that one ID ends up
      // covering two different runs — here, a candidate wearing the baseline's
      // input-snapshot ID while carrying its own inputs. The snapshot names the
      // inputs and only the inputs, so one ID over two input sets is a lie
      // about what was computed, and it survives every kind and unit check
      // because both of those are still correct.
      const baseline = baselineRun(1_000_000)
      const candidate = candidateRun(1_250_000)

      expect(run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 0, 0)],
        baseline,
        candidate: {
          liability: candidate.liability,
          identity: {
            ...candidate.identity,
            taxInputSnapshotId: baseline.identity.taxInputSnapshotId,
          },
        },
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'liabilityRunIdentityCollided',
      })
    })

    it('takes exactly the run kind each slot is defined by', () => {
      // Each slot is named rather than merely fenced off from the other. The
      // baseline is `baselineT0` because `T0` is defined by what was removed
      // from it. The candidate is `candidateT1` because that is the only
      // binding carrying a funding vector, and the evidence contract's
      // candidate is the liability "funded as stated" -- a candidate that does
      // not name its vector cannot be subtracted from a baseline, since a
      // different vector is a different candidate.
      //
      // `committedAnnual` is the arm this pins hardest. In this slice the
      // committed pass and `T1` are the same physical run, which makes it easy
      // to reach for the committed identity here — but `liabilityRunKind` names
      // the role and inputs an identity answers for, not which execution
      // produced it, and `committedAnnual` structurally cannot carry a funding
      // vector: its field is `null` by the union. So the run is minted a second
      // time as `candidateT1` over the year's actual vector, and only that is
      // admitted.
      const requests = dedicatedPair()
      const members = [member('conversion-a', 0, 0)]
      const committed: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> = {
        liability: exactCents(1_250_000),
        identity: identity(
          {
            liabilityRunKind: 'committedAnnual',
            candidateFundingVectorEvidenceId: null,
          },
          [],
        ),
      }

      const committedAsCandidate = run({
        requests,
        members,
        baseline: baselineRun(1_000_000),
        candidate: committed,
      }).funding
      expect(committedAsCandidate).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'liabilityRunKindInvalid',
      })
      if (committedAsCandidate.status !== 'annualGroupNotEvaluated') {
        throw new Error('expected a refusal')
      }
      expect(committedAsCandidate.issues[0])
        .toMatch(/candidate slot takes a "candidateT1" run, not "committedAnnual"/)

      // The mirror: a candidate identity in the baseline's slot. Two distinct
      // identities that still do not name a baseline and a candidate, and it is
      // a kind defect rather than a collision.
      expect(run({
        requests,
        members,
        baseline: {
          liability: exactCents(1_000_000),
          identity: candidateRun(1_000_000).identity,
        },
        candidate: candidateRun(1_250_000),
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'liabilityRunKindInvalid',
      })

      // And a committed identity in the baseline's slot, which the old
      // "anything but the other one" reading would also have let through on the
      // candidate side.
      expect(run({
        requests,
        members,
        baseline: committed,
        candidate: candidateRun(1_250_000),
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'liabilityRunKindInvalid',
      })
    })

    it('refuses runs that answer for another filing unit or year', () => {
      // Not a collision and not a kind defect: two well-formed runs of the
      // right kinds that simply do not belong to the unit whose conversions are
      // being allocated. Allocating one unit's tax bill across another unit's
      // conversions can still balance to the cent, which is why the identity is
      // checked rather than inferred from the arithmetic coming out even.
      expect(run({
        requests: dedicatedPair(),
        members: [member('conversion-a', 0, 0)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_250_000),
        taxUnitOverride: { ...taxUnit, taxUnitId: 'a-different-filing-unit' },
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'liabilityRunUnitMismatched',
      })
    })

    it('refuses members that are not the conversions the assessment named', () => {
      const requests = dedicatedPair()

      expect(run({
        requests,
        members: [member('conversion-a', 0, 0), member('conversion-z', 0, 0)],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_000_000),
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'annualGroupMembershipInvalid',
      })
      expect(run({
        requests,
        members: [],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_000_000),
      }).funding).toMatchObject({
        status: 'annualGroupNotEvaluated',
        reason: 'annualGroupMembershipInvalid',
      })
    })
  })

  describe('the tie-break: two conversions naming one withdrawal', () => {
    const contested = (): readonly RetirementActionRequest[] => [
      withdrawal('withdrawal-shared', 'conversion-a', 1, `${YEAR}-06-14`),
      conversion('conversion-a', 'withdrawal-shared', 2, `${YEAR}-06-15`),
      conversion('conversion-b', 'withdrawal-shared', 3, `${YEAR}-06-16`),
    ]

    it('refuses both pairs, on the merits, with evidence for each', () => {
      const result = run({
        requests: contested(),
        members: [
          member('conversion-a', 30_000_00, 0),
          member('conversion-b', 10_000_00, 0),
        ],
        baseline: baselineRun(1_000_000),
        candidate: candidateRun(1_100_000),
      })

      // Both pairs refuse, for the shared-withdrawal reason, and each names the
      // whole contest rather than only itself.
      expect(result.groups.map((group) => ({
        conversionActionId: group.conversionActionId,
        withdrawalActionId: group.withdrawalActionId,
        disposition: group.disposition,
        refusalKind: group.refusalKind,
        reasonCode: group.reasonCode,
        movement: group.movement,
        contested: group.fundingEvidence?.conversionActionId,
      }))).toEqual([
        {
          conversionActionId: 'conversion-a',
          withdrawalActionId: 'withdrawal-shared',
          disposition: 'refusedPendingGroupExecution',
          refusalKind: 'sharedFundingWithdrawal',
          reasonCode: 'conversion-tax-funding-unallocated',
          movement: 'none',
          contested: 'conversion-a',
        },
        {
          conversionActionId: 'conversion-b',
          withdrawalActionId: 'withdrawal-shared',
          disposition: 'refusedPendingGroupExecution',
          refusalKind: 'sharedFundingWithdrawal',
          reasonCode: 'conversion-tax-funding-unallocated',
          movement: 'none',
          contested: 'conversion-b',
        },
      ])

      // The evaluation is still built for the contested set: the filing unit
      // owed the tax whether or not its funding was well formed, and both
      // members carry the group's own figures identically.
      if (result.funding.status !== 'annualGroupEvaluated') {
        throw new Error(result.funding.issues.join('; '))
      }
      expect(result.funding.members.map((evidence) => ({
        conversionActionId: evidence.conversionActionId,
        allocationOrder: evidence.allocationOrder,
        requiredFundingAmount: evidence.requiredFundingAmount,
        fundedAmount: evidence.fundedAmount,
        evaluation: evidence.evaluation,
        annualGroupRequiredFundingAmount: evidence.annualGroupRequiredFundingAmount,
      }))).toEqual([
        {
          conversionActionId: 'conversion-a',
          allocationOrder: 1,
          requiredFundingAmount: 75_000,
          fundedAmount: 0,
          evaluation: 'mismatch',
          annualGroupRequiredFundingAmount: 100_000,
        },
        {
          conversionActionId: 'conversion-b',
          allocationOrder: 2,
          requiredFundingAmount: 25_000,
          fundedAmount: 0,
          evaluation: 'mismatch',
          annualGroupRequiredFundingAmount: 100_000,
        },
      ])
    })

    it('answers the shared withdrawal the same way whichever pair is asked', () => {
      // The lookup by withdrawal returns the first candidate in sorted order.
      // That is answer-invariant only because the contest makes every candidate
      // identical in everything a withdrawal reads: the disposition, the
      // refusal kind, and the reason code.
      const assessment = assessConversionLinkedWithdrawalGroups(contested())

      expect(assessment.groups).toHaveLength(2)
      expect(new Set(assessment.groups.map((group) => JSON.stringify([
        group.disposition,
        group.refusalKind,
        group.reasonCode,
        group.contestingConversionActionIds,
      ])))).toHaveLength(1)
      expect(assessment.groups[0]!.contestingConversionActionIds)
        .toEqual(['conversion-a', 'conversion-b'])
    })
  })
})

/**
 * The gate itself: what releases a pair, and what refuses to.
 *
 * Every case below is built from a *satisfied* evaluation over two real
 * liabilities, so satisfaction is held constant and only the thing under test
 * varies. That is deliberate: the degenerate evaluation of a refused group is
 * also satisfied, so a gate that read satisfaction alone would release
 * everything that refused.
 */
describe('the release gate', () => {
  const CONVERSION_CENTS = 50_000_00
  /** The withdrawal `dedicatedPair` authors, to the cent. */
  const WITHDRAWAL_CENTS = 10_000_00
  /** `T1 - T0`, chosen so that the authored withdrawal funds it exactly. */
  const REQUIRED_CENTS = WITHDRAWAL_CENTS
  const BASELINE_CENTS = 1_000_000
  const CANDIDATE_CENTS = BASELINE_CENTS + REQUIRED_CENTS

  function authorization(
    conversionActionId: string,
    withdrawalActionId: string,
  ) {
    return {
      conversionActionId: asActionId(conversionActionId),
      withdrawalActionId: asActionId(withdrawalActionId),
      funding: {
        requiredFundingAmount: asUsdCents(REQUIRED_CENTS),
        fundedAmount: asUsdCents(REQUIRED_CENTS),
      },
    }
  }

  /** One conversion, one withdrawal, and whatever the run made of them. */
  function stagedRun(input: {
    authorized: boolean
    conversionExecuted: number
    withdrawalExecuted: number
    fundedAmount: number
    candidateCents?: number
  }) {
    const requests = dedicatedPair()
    return executeConversionLinkedWithdrawalGroups({
      taxYear: YEAR,
      requests,
      assessment: assessConversionLinkedWithdrawalGroups(requests, {
        annualLiabilityBaseline: 'read',
        authorizedGroups: input.authorized
          ? [authorization('conversion-a', 'withdrawal-a')]
          : [],
      }),
      taxUnit,
      baseline: baselineRun(BASELINE_CENTS),
      candidate: candidateRun(input.candidateCents ?? CANDIDATE_CENTS),
      members: [member('conversion-a', CONVERSION_CENTS, input.fundedAmount)],
      movements: [{
        conversionActionId: asActionId('conversion-a'),
        withdrawalActionId: asActionId('withdrawal-a'),
        conversion: {
          authoredAmount: asUsdCents(CONVERSION_CENTS),
          executedAmount: asUsdCents(input.conversionExecuted),
        },
        withdrawal: {
          authoredAmount: asUsdCents(WITHDRAWAL_CENTS),
          executedAmount: asUsdCents(input.withdrawalExecuted),
        },
      }],
    })
  }

  it('reports executed when release, movement and fixed point agree', () => {
    const result = stagedRun({
      authorized: true,
      conversionExecuted: CONVERSION_CENTS,
      withdrawalExecuted: WITHDRAWAL_CENTS,
      fundedAmount: WITHDRAWAL_CENTS,
    })

    expect(result.status).toBe('executed')
    expect(result.movement).toBe('bothLegs')
    expect(result.groups[0]).toMatchObject({
      disposition: 'executedAsAtomicGroup',
      refusalKind: null,
      reasonCode: null,
      movement: 'bothLegs',
      movementCoherent: true,
    })
    // And the authorization it mints for the run that commits repeats the
    // proved figures rather than the authored ones.
    expect(authorizeConversionLinkedWithdrawalGroups(result)).toEqual({
      status: 'conversionLinkedWithdrawalGroupsAuthorized',
      taxYear: YEAR,
      authorizations: [{
        conversionActionId: 'conversion-a',
        withdrawalActionId: 'withdrawal-a',
        funding: {
          requiredFundingAmount: REQUIRED_CENTS,
          fundedAmount: REQUIRED_CENTS,
        },
      }],
    })
  })

  it.each([
    ['only the conversion moved', CONVERSION_CENTS, 0],
    ['only the withdrawal moved', 0, WITHDRAWAL_CENTS],
    ['the withdrawal moved a part of itself', CONVERSION_CENTS, WITHDRAWAL_CENTS - 1],
  ] as const)('refuses, and calls the movement incoherent, when %s', (
    _label, conversionExecuted, withdrawalExecuted,
  ) => {
    // The third row is the partial case: a cent short of the amount the
    // household authored, which is not the withdrawal they asked for however
    // close it came. Whole or nothing, per leg.
    const result = stagedRun({
      authorized: true,
      conversionExecuted,
      withdrawalExecuted,
      fundedAmount: withdrawalExecuted,
    })

    expect(result.status).toBe('refused')
    expect(result.movement).toBe('none')
    expect(result.groups[0]?.movement).toBe('none')
    expect(result.groups[0]?.movementCoherent).toBe(false)
    expect(authorizeConversionLinkedWithdrawalGroups(result).status)
      .toBe('conversionLinkedWithdrawalGroupsWithheld')
  })

  it('refuses a funded amount its own withdrawal did not move', () => {
    // Conservation across the two legs. The evaluation would balance on the
    // figure supplied, while the withdrawal that was supposed to raise those
    // dollars moved a different number of them.
    const result = stagedRun({
      authorized: true,
      conversionExecuted: CONVERSION_CENTS,
      withdrawalExecuted: WITHDRAWAL_CENTS,
      fundedAmount: WITHDRAWAL_CENTS + 1,
    })

    expect(result.groups[0]?.movementCoherent).toBe(false)
    expect(result.status).toBe('refused')
  })

  it('withholds authorization from a group whose evaluation is a mismatch', () => {
    // Both legs moved whole. What does not balance is the plan: the year cost
    // a cent more than the withdrawal the household authored could raise.
    const result = stagedRun({
      authorized: true,
      conversionExecuted: CONVERSION_CENTS,
      withdrawalExecuted: WITHDRAWAL_CENTS,
      fundedAmount: WITHDRAWAL_CENTS,
      candidateCents: CANDIDATE_CENTS + 1,
    })

    expect(result.groups[0]?.movementCoherent).toBe(true)

    expect(result.groups[0]?.fundingEvidence?.evaluation).toBe('mismatch')
    expect(authorizeConversionLinkedWithdrawalGroups(result))
      .toMatchObject({ reason: 'fundingMismatched' })
  })

  it('withholds authorization from a staging run that moved nothing', () => {
    const result = stagedRun({
      authorized: false,
      conversionExecuted: 0,
      withdrawalExecuted: 0,
      fundedAmount: 0,
    })

    expect(result.status).toBe('refused')
    expect(authorizeConversionLinkedWithdrawalGroups(result))
      .toMatchObject({ reason: 'stagingRefused' })
  })

  it('never releases a contested pair, however it was authorized', () => {
    // Two conversions naming one withdrawal. An authorization for each of them
    // is still not permission, and the contest is checked before the
    // authorization is read at all.
    const contested = [
      withdrawal('withdrawal-a', 'conversion-a', 1, `${YEAR}-06-14`),
      conversion('conversion-a', 'withdrawal-a', 2, `${YEAR}-06-15`),
      conversion('conversion-b', 'withdrawal-a', 3, `${YEAR}-06-16`),
    ]
    const assessed = assessConversionLinkedWithdrawalGroups(contested, {
      annualLiabilityBaseline: 'read',
      authorizedGroups: [
        authorization('conversion-a', 'withdrawal-a'),
        authorization('conversion-b', 'withdrawal-a'),
      ],
    })

    expect(assessed.groups.map((group) => group.disposition))
      .toEqual(['refusedPendingGroupExecution', 'refusedPendingGroupExecution'])
    expect(assessed.groups.map((group) => group.refusalKind))
      .toEqual(['sharedFundingWithdrawal', 'sharedFundingWithdrawal'])
    expect(assessed.groups.every((group) => group.fundingAuthority === null))
      .toBe(true)
  })

  it('releases nothing when the authorization does not cover every group', () => {
    // Two independent pairs, one authorized. The required amount is the filing
    // unit's whole annual figure, so a run that released one of them would
    // hold a different funding vector from the one the proof was taken over.
    const twoPairs = [
      ...dedicatedPair(),
      withdrawal('withdrawal-b', 'conversion-b', 3, `${YEAR}-06-16`),
      conversion('conversion-b', 'withdrawal-b', 4, `${YEAR}-06-17`),
    ]
    const assessed = assessConversionLinkedWithdrawalGroups(twoPairs, {
      annualLiabilityBaseline: 'read',
      authorizedGroups: [authorization('conversion-a', 'withdrawal-a')],
    })

    expect(assessed.groups.map((group) => group.disposition))
      .toEqual(['refusedPendingGroupExecution', 'refusedPendingGroupExecution'])
  })

  it('releases nothing when the authorization names the wrong withdrawal', () => {
    const assessed = assessConversionLinkedWithdrawalGroups(dedicatedPair(), {
      annualLiabilityBaseline: 'read',
      authorizedGroups: [
        authorization('conversion-a', 'withdrawal-elsewhere'),
      ],
    })

    expect(assessed.groups[0]?.disposition)
      .toBe('refusedPendingGroupExecution')
  })
})
