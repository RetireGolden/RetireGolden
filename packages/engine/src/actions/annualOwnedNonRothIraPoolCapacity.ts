import type { AccountId, PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsInput,
  type OwnedNonRothIraAnnualBasisEvidence,
} from './ownedNonRothIraWithdrawalCharacter.js'

export interface AnnualOwnedNonRothIraPoolCapacityEvidence {
  readonly predicate: 'annualOwnedNonRothIraPoolCapacity'
  readonly ownerPersonId: PersonId
  readonly ownerWideNonRothIraPoolId: string
  readonly taxYear: number
  readonly scope: 'donorOwnedNonRothIras'
  readonly inheritedFromPersonId: null
  readonly accountIds: readonly [AccountId, ...AccountId[]]
  readonly form8606BaseDenominatorAmount: UsdCents
  readonly basisNumeratorAmount: UsdCents
  readonly form8606BaseEffectiveBasisAmount: UsdCents
  readonly form8606BaseOtherwiseTaxableAmount: UsdCents
  readonly completePoolEvidenceId: string
  readonly annualBasisRecordEvidenceId: string
  readonly annualBasisEvidenceId: string
  readonly capacityEvidenceId: string
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function requireDistinctEvidenceIds(
  annualBasisEvidence: Readonly<OwnedNonRothIraAnnualBasisEvidence>,
): void {
  const evidenceIds = [
    annualBasisEvidence.completePoolEvidence.evidenceId,
    annualBasisEvidence.annualBasisRecordEvidenceId,
    ...annualBasisEvidence.poolMembers.flatMap((member) => [
      member.iraClassificationEvidenceId,
      member.accountOwnershipEvidenceId,
    ]),
  ]
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new RangeError(
      'Annual IRA pool evidence IDs must be unique across evidence roles',
    )
  }
}

/**
 * Rebuilds the canonical annual owned non-Roth IRA evidence boundary and emits
 * the canonical Form 8606 base facts before separately inventoried physical
 * QCD candidates are joined. It does not expose per-event allocations, derive
 * final tax character, or move balances.
 */
export function buildAnnualOwnedNonRothIraPoolCapacity(
  input: Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>,
): Readonly<AnnualOwnedNonRothIraPoolCapacityEvidence> {
  const rebuilt = classifyOwnedNonRothIraAnnualWithdrawals(input)
  const annualBasisEvidence = rebuilt.annualBasisEvidence
  requireDistinctEvidenceIds(annualBasisEvidence)

  const form8606BaseDenominatorAmount =
    annualBasisEvidence.annualBasisDenominatorAmount
  const basisNumeratorAmount = annualBasisEvidence.basisNumeratorAmount
  const form8606BaseEffectiveBasisAmount = asUsdCents(
    Math.min(basisNumeratorAmount, form8606BaseDenominatorAmount),
  )
  const form8606BaseOtherwiseTaxableAmount = asUsdCents(
    Number(
      BigInt(form8606BaseDenominatorAmount) -
        BigInt(form8606BaseEffectiveBasisAmount),
    ),
  )
  const accountIds = [
    ...annualBasisEvidence.completePoolEvidence.accountIds,
  ] as [AccountId, ...AccountId[]]
  const capacityIdentityParts = [
    annualBasisEvidence.ownerPersonId,
    annualBasisEvidence.ownerWideNonRothIraPoolId,
    annualBasisEvidence.taxYear,
    'donorOwnedNonRothIras',
    null,
    accountIds,
    form8606BaseDenominatorAmount,
    basisNumeratorAmount,
    form8606BaseEffectiveBasisAmount,
    form8606BaseOtherwiseTaxableAmount,
    annualBasisEvidence.completePoolEvidence.evidenceId,
    annualBasisEvidence.annualBasisRecordEvidenceId,
    annualBasisEvidence.basisEvidenceId,
  ] as const
  const capacityEvidenceId = deriveActionStructuralId(
    'annual-owned-non-roth-ira-pool-capacity',
    capacityIdentityParts,
  )

  return deepFreeze({
    predicate: 'annualOwnedNonRothIraPoolCapacity',
    ownerPersonId: annualBasisEvidence.ownerPersonId,
    ownerWideNonRothIraPoolId:
      annualBasisEvidence.ownerWideNonRothIraPoolId,
    taxYear: annualBasisEvidence.taxYear,
    scope: 'donorOwnedNonRothIras',
    inheritedFromPersonId: null,
    accountIds,
    form8606BaseDenominatorAmount,
    basisNumeratorAmount,
    form8606BaseEffectiveBasisAmount,
    form8606BaseOtherwiseTaxableAmount,
    completePoolEvidenceId:
      annualBasisEvidence.completePoolEvidence.evidenceId,
    annualBasisRecordEvidenceId:
      annualBasisEvidence.annualBasisRecordEvidenceId,
    annualBasisEvidenceId: annualBasisEvidence.basisEvidenceId,
    capacityEvidenceId,
  })
}
