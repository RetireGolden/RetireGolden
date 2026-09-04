import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import type { UsdCents } from './money.js'
import type { OwnedNonRothIraSubtype } from './ownedNonRothIraWithdrawalCharacter.js'
import { deriveActionStructuralId } from './structuralId.js'

/**
 * The one prefix the owned-IRA penalty character-coverage evidence ID carries.
 * Producer and consumers must never spell it separately.
 */
export const OWNED_IRA_PENALTY_COVERAGE_ID_PREFIX =
  'owned-ira-penalty-character-coverage'

/**
 * The exact facts the character-coverage evidence ID commits to. The producer
 * (`evaluateOwnedNonRothIraPenaltyPrerequisites`) mints the ID from a freshly
 * characterized withdrawal; the SEPP consumers re-derive it from the coverage
 * evidence they were handed and refuse the route when the two disagree. Both
 * sides read the same field list here, so dropping or renaming a field is a
 * compile error at every call site that names it. `coverageEvidenceIdParts`
 * still turns this into a positional `unknown[]`, so reordering its array
 * entries is not itself a compile error -- see the note there.
 */
export interface OwnedNonRothIraPenaltyCoverageEvidenceIdFields {
  readonly actionId: ActionId
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly ownerPersonId: PersonId
  readonly subtype: OwnedNonRothIraSubtype
  readonly evaluationDate: string
  readonly executedAmount: UsdCents
  readonly basisReturnExcludedAmount: UsdCents
  readonly ordinaryIncomeExposureAmount: UsdCents
  readonly basisEvidenceId: string
  readonly line7AllocationEvidenceId: string
  readonly characterEvidenceIds: readonly string[]
  readonly sourceEvidenceIds: Readonly<{
    distributionDateEvidenceId: string
    accountOwnershipEvidenceId: string
    iraClassificationEvidenceId: string
  }>
  readonly ageThresholdEvidenceId: string
}

/**
 * The ordered fourteen-element ID part list, in exactly the order the minted
 * ID has always serialized. Element thirteen is the canonical penalty
 * source-evidence record, rebuilt here in its declared key order so that the
 * producer's validated evidence object and a consumer's reconstruction
 * serialize byte-identically.
 *
 * Changing this order changes every previously minted ID. Do not reorder.
 * The return type is a positional `readonly unknown[]`, so a reorder here
 * compiles cleanly; it is `ownedNonRothIraPenaltyCoverageEvidenceId.test.ts`'s
 * pinned byte-for-byte ID and its fourteen-part shape assertion that catch a
 * reorder, at runtime, not the type checker.
 *
 * @internal
 */
export function coverageEvidenceIdParts(
  fields: Readonly<OwnedNonRothIraPenaltyCoverageEvidenceIdFields>,
): readonly unknown[] {
  return [
    fields.actionId,
    fields.allocationId,
    fields.sourceAccountId,
    fields.ownerPersonId,
    fields.subtype,
    fields.evaluationDate,
    fields.executedAmount,
    fields.basisReturnExcludedAmount,
    fields.ordinaryIncomeExposureAmount,
    fields.basisEvidenceId,
    fields.line7AllocationEvidenceId,
    fields.characterEvidenceIds,
    {
      predicate: 'ownedNonRothIraPenaltySourceForWithdrawal' as const,
      actionId: fields.actionId,
      allocationId: fields.allocationId,
      sourceAccountId: fields.sourceAccountId,
      ownerPersonId: fields.ownerPersonId,
      subtype: fields.subtype,
      evaluationDate: fields.evaluationDate,
      distributionDateEvidenceId:
        fields.sourceEvidenceIds.distributionDateEvidenceId,
      accountOwnershipEvidenceId:
        fields.sourceEvidenceIds.accountOwnershipEvidenceId,
      iraClassificationEvidenceId:
        fields.sourceEvidenceIds.iraClassificationEvidenceId,
    },
    fields.ageThresholdEvidenceId,
  ]
}

/**
 * Mints the character-coverage evidence ID from its part list, through the
 * hardened structural minter: no `NaN`/`Infinity`/`-0`, no cycles or
 * non-plain prototypes, and a fixed 64-hex digest instead of the whole
 * payload inline. The historical `${prefix}:${JSON.stringify(parts)}` form
 * it replaced could not say any of that.
 *
 * The minter does not sort object keys; it walks `Reflect.ownKeys` in
 * insertion order, same as `JSON.stringify`. What keeps producer and
 * consumer aligned on the part-13 source-evidence object is that
 * {@link coverageEvidenceIdParts} rebuilds that object in the same declared
 * key order on every call — a consumer that reconstructs it with a
 * different key insertion order will mint a different digest for the same
 * fields.
 *
 * The output is still a frozen wire format: producer and both SEPP consumers
 * compare minted IDs, so changing this function, or the part order it is fed,
 * must remain one coordinated change across every call site. They all reach it
 * through this one export, which is what makes that possible.
 *
 * @internal
 */
export function mintCoverageEvidenceId(parts: readonly unknown[]): string {
  return deriveActionStructuralId(OWNED_IRA_PENALTY_COVERAGE_ID_PREFIX, parts)
}
