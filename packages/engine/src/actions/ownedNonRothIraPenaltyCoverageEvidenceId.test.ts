import { describe, expect, it } from 'vitest'

import {
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
} from './identity.js'
import { asUsdCents } from './money.js'
import { classifyOwnedNonRothIraAnnualWithdrawals } from './ownedNonRothIraWithdrawalCharacter.js'
import { evaluateOwnedNonRothIraPenaltyPrerequisites } from './ownedNonRothIraPenaltyPrerequisite.js'
import {
  OWNED_IRA_PENALTY_COVERAGE_ID_PREFIX,
  coverageEvidenceIdParts,
  mintCoverageEvidenceId,
  type OwnedNonRothIraPenaltyCoverageEvidenceIdFields,
} from './ownedNonRothIraPenaltyCoverageEvidenceId.js'

/**
 * Characterization pin, not an oracle. The expected value below is what
 * `deriveActionStructuralId` produces for these inputs through the shared part
 * builder. Its authority is the frozen wire format of already-minted evidence
 * IDs, not a statute: producer and both SEPP consumers compare minted IDs, so
 * any reordering, added field, or change of minter would silently flip every
 * consumer's conformance check, and this test exists to make that a red test
 * instead. It replaced the raw-`JSON.stringify` pin captured before the three
 * sides were collapsed onto one part builder.
 */
const PINNED_COVERAGE_EVIDENCE_ID =
  'owned-ira-penalty-character-coverage:b448b74151a530fee7a01614a0d370cc' +
  '1abd5a84b0a725a65ba2af2b14bc6f8d'

function pinnedFields(): OwnedNonRothIraPenaltyCoverageEvidenceIdFields {
  return {
    actionId: asActionId('action-1'),
    allocationId: asAllocationId('allocation-1'),
    sourceAccountId: asAccountId('ira-account-1'),
    ownerPersonId: asPersonId('owner-1'),
    subtype: 'traditional',
    evaluationDate: '2030-06-01',
    executedAmount: asUsdCents(100000),
    basisReturnExcludedAmount: asUsdCents(40000),
    ordinaryIncomeExposureAmount: asUsdCents(60000),
    basisEvidenceId: 'basis-evidence-1',
    line7AllocationEvidenceId: 'line7-allocation-evidence-1',
    characterEvidenceIds: [
      'character-segment-evidence-1',
      'character-segment-evidence-2',
    ],
    sourceEvidenceIds: {
      distributionDateEvidenceId: 'distribution-date-evidence-1',
      accountOwnershipEvidenceId: 'ownership-evidence-1',
      iraClassificationEvidenceId: 'classification-evidence-1',
    },
    ageThresholdEvidenceId: 'age-threshold-evidence-1',
  }
}

/** Minimal single-withdrawal penalty evaluation: one $1.00 fully taxable IRA distribution. */
function evaluatedCoverage() {
  const taxYear = 2030
  const evaluationDate = '2030-06-01'
  const characterization = classifyOwnedNonRothIraAnnualWithdrawals({
    ownerPersonId: asPersonId('owner'),
    ownerWideNonRothIraPoolId: 'owner-pool',
    completePoolEvidence: {
      predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
      ownerPersonId: asPersonId('owner'),
      ownerWideNonRothIraPoolId: 'owner-pool',
      taxYear,
      accountIds: [asAccountId('ira-account')],
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      evidenceId: 'complete-pool',
    },
    annualBasisRecordEvidenceId: 'annual-basis-record',
    taxYear,
    poolMembers: [{
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      accountType: 'traditional',
      accountKind: 'ira',
      inheritanceStatus: 'owned',
      subtype: 'traditional',
      yearEndApplicableBalanceAmount: asUsdCents(0),
      iraClassificationEvidenceId: 'classification',
      accountOwnershipEvidenceId: 'ownership',
    }],
    annualFacts: {
      openingBasisAmount: asUsdCents(0),
      taxYearNondeductibleContributionAmount: asUsdCents(0),
      postYearNondeductibleContributionExcludedAmount: asUsdCents(0),
      yearEndApplicablePoolBalanceAmount: asUsdCents(0),
      outstandingRolloverAmount: asUsdCents(0),
      rolloverRepaymentAdjustmentAmount: asUsdCents(0),
      form8606Line7DistributionAmount: asUsdCents(100),
      form8606Line8NetConversionAmount: asUsdCents(0),
    },
    line7Distributions: [{
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      scheduledDate: evaluationDate,
      scheduledSequence: 1,
      grossAmount: asUsdCents(100),
    }],
    line8Conversions: [],
  })
  const result = evaluateOwnedNonRothIraPenaltyPrerequisites({
    characterization,
    ownerEvidence: {
      predicate: 'ownerBirthDateForIraPenaltyAgeThreshold',
      ownerPersonId: asPersonId('owner'),
      birthDate: '1980-01-01',
      evidenceId: 'birth-date',
    },
    sourceEvidence: [{
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: asActionId('action'),
      allocationId: asAllocationId('allocation'),
      sourceAccountId: asAccountId('ira-account'),
      ownerPersonId: asPersonId('owner'),
      subtype: 'traditional',
      evaluationDate,
      distributionDateEvidenceId: 'distribution-date',
      accountOwnershipEvidenceId: 'ownership',
      iraClassificationEvidenceId: 'classification',
    }],
    qualifiedDisabilityEvidence: [],
    simpleParticipationEvidence: [],
  })
  const coverage = result.coverage[0]
  if (coverage === undefined) {
    throw new Error('fixture lost its character coverage')
  }
  return coverage
}

describe('owned IRA penalty character-coverage evidence ID', () => {
  it('mints the pinned ID byte for byte', () => {
    expect(mintCoverageEvidenceId(coverageEvidenceIdParts(pinnedFields())))
      .toBe(PINNED_COVERAGE_EVIDENCE_ID)
    expect(mintCoverageEvidenceId(coverageEvidenceIdParts(pinnedFields())))
      .toMatch(/^owned-ira-penalty-character-coverage:[0-9a-f]{64}$/)
  })

  it('commits to exactly fourteen ordered parts', () => {
    const parts = coverageEvidenceIdParts(pinnedFields())
    expect(parts.length).toBe(14)
    // Part thirteen is the canonical penalty source-evidence record. It is
    // rebuilt here rather than passed through so the producer's validated
    // object and a consumer's reconstruction serialize identically.
    expect(parts[12]).toEqual({
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal',
      actionId: 'action-1',
      allocationId: 'allocation-1',
      sourceAccountId: 'ira-account-1',
      ownerPersonId: 'owner-1',
      subtype: 'traditional',
      evaluationDate: '2030-06-01',
      distributionDateEvidenceId: 'distribution-date-evidence-1',
      accountOwnershipEvidenceId: 'ownership-evidence-1',
      iraClassificationEvidenceId: 'classification-evidence-1',
    })
    expect(mintCoverageEvidenceId(parts).startsWith(
      `${OWNED_IRA_PENALTY_COVERAGE_ID_PREFIX}:`,
    )).toBe(true)
  })

  it('lets a consumer re-derive the producer ID from the coverage record alone', () => {
    const coverage = evaluatedCoverage()
    // This is exactly what canonicalCoverage (SEPP annual reconciliation) and
    // validateOwnedNonRothIraSeppCurrentPaymentCandidate do to decide
    // producerConforming / canonicalBindingMismatch.
    expect(mintCoverageEvidenceId(coverageEvidenceIdParts(coverage)))
      .toBe(coverage.evidenceId)
  })

  it('discriminates every committed field', () => {
    const base = pinnedFields()
    const baseId = mintCoverageEvidenceId(coverageEvidenceIdParts(base))
    const mutations: readonly OwnedNonRothIraPenaltyCoverageEvidenceIdFields[] = [
      { ...base, actionId: asActionId('action-2') },
      { ...base, allocationId: asAllocationId('allocation-2') },
      { ...base, sourceAccountId: asAccountId('ira-account-2') },
      { ...base, ownerPersonId: asPersonId('owner-2') },
      { ...base, subtype: 'sep' },
      { ...base, evaluationDate: '2030-06-02' },
      { ...base, executedAmount: asUsdCents(100001) },
      { ...base, basisReturnExcludedAmount: asUsdCents(40001) },
      { ...base, ordinaryIncomeExposureAmount: asUsdCents(60001) },
      { ...base, basisEvidenceId: 'basis-evidence-2' },
      { ...base, line7AllocationEvidenceId: 'line7-allocation-evidence-2' },
      { ...base, characterEvidenceIds: ['character-segment-evidence-1'] },
      {
        ...base,
        sourceEvidenceIds: {
          ...base.sourceEvidenceIds,
          distributionDateEvidenceId: 'distribution-date-evidence-2',
        },
      },
      {
        ...base,
        sourceEvidenceIds: {
          ...base.sourceEvidenceIds,
          accountOwnershipEvidenceId: 'ownership-evidence-2',
        },
      },
      {
        ...base,
        sourceEvidenceIds: {
          ...base.sourceEvidenceIds,
          iraClassificationEvidenceId: 'classification-evidence-2',
        },
      },
      { ...base, ageThresholdEvidenceId: 'age-threshold-evidence-2' },
    ]
    const ids = mutations.map((fields) =>
      mintCoverageEvidenceId(coverageEvidenceIdParts(fields)))
    expect(ids.filter((id) => id === baseId)).toEqual([])
    expect(new Set(ids).size).toBe(ids.length)
  })
})
