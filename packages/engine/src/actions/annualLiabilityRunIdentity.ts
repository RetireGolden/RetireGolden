import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

/**
 * What it means to name one annual tax-liability run, and how a run's name is
 * derived from the inputs that produced it.
 *
 * Three modules already declare the run binding below, character for character
 * — the section 68 overall limitation, the section 170 itemized QCD ledger, and
 * the section 170(p) standard-deduction QCD ledger — and a fourth notion was
 * about to be born divergent as two bare strings on the conversion tax-funding
 * record. One union is declared here and the three re-export it under the names
 * they already publish, so the copies cannot drift apart and a caller cannot
 * bind a `candidateT1` identity into a `baselineT0` slot merely because both
 * spell it `string`.
 *
 * The minter below is the part nothing has ever had. Every consumer of
 * `annualTaxLiabilityEvidenceId` and `taxInputSnapshotId` in this package takes
 * both as caller-supplied strings, and no non-test producer of either exists
 * anywhere in `packages/engine/src`: stages 5 through 8 of the QCD chain sit
 * unreachable waiting for one, and the conversion tax-funding record needs a
 * matched pair for a baseline and a candidate run that must be provably
 * different runs over provably different inputs.
 *
 * Two consumers are coming, and this is deliberately built for both rather than
 * for whichever arrives first:
 *
 * - the `T0` counterfactual slice, which runs the filing unit's annual pass a
 *   second time with the conversions removed and needs a `baselineT0` identity
 *   that a `committedAnnual` identity cannot be mistaken for; and
 * - the QCD section 170 slice, whose itemized and standard ledgers and their
 *   liability reconciliation all require a run identity before any of them can
 *   be wired to the simulator.
 *
 * Until one of them lands, this module is not exported from `actions/index.ts`
 * and is not a package subpath — the same discipline the conversion tax-funding
 * evidence module took for the same reason: a contract with no consumer is not
 * yet a published surface, and the slice that writes the first consumer
 * publishes it. The binding is the one thing that already reaches consumers, and
 * it does so under the three names the barrel already exports, so unifying the
 * copies adds nothing to the published surface and removes nothing from it.
 *
 * Both identities are structural, in the idiom the rest of the actions layer
 * already uses: a canonical JSON serialisation hashed with SHA-256, via
 * `deriveActionStructuralId`. The consequence worth stating is the one the
 * consumers rely on. `taxInputSnapshotId` names the *inputs* and nothing else,
 * so two runs that were handed the same inputs mint the same snapshot ID — a
 * counterfactual that failed to remove anything is therefore detectable by
 * comparing two snapshot IDs rather than by trusting the caller's account of
 * what it removed. `annualTaxLiabilityEvidenceId` names the whole run, snapshot
 * ID and run kind included, so a baseline and a candidate over identical inputs
 * still hold distinct evidence IDs.
 */

/**
 * Which of a filing unit's annual liability runs an evidence record answers
 * for.
 *
 * `committedAnnual` is the ordinary published run. `baselineT0` is the
 * counterfactual with the candidate actions removed. `candidateT1` is the run
 * with them present, and it alone carries the funding vector it was run
 * against, because a candidate that does not name its vector cannot be
 * subtracted from a baseline honestly.
 */
export type AnnualLiabilityRunBinding =
  | {
      readonly liabilityRunKind: 'committedAnnual' | 'baselineT0'
      readonly candidateFundingVectorEvidenceId: null
    }
  | {
      readonly liabilityRunKind: 'candidateT1'
      readonly candidateFundingVectorEvidenceId: string
    }

export type AnnualLiabilityRunKind = AnnualLiabilityRunBinding['liabilityRunKind']

/**
 * One named figure a liability run was computed from.
 *
 * Amounts are exact cents and may be signed, because a tax input can be a loss
 * as readily as an income. Everything that is not an amount — a filing status,
 * a state identifier, a parameter-year selection — is a declared term rather
 * than a number, so a snapshot cannot silently encode a policy choice as an
 * integer that compares equal to an unrelated one.
 */
export type AnnualLiabilityRunTaxInputValue =
  | { readonly representation: 'exactCents'; readonly amountCents: number }
  | { readonly representation: 'declaredTerm'; readonly term: string }

export interface AnnualLiabilityRunTaxInput {
  readonly inputId: string
  readonly value: Readonly<AnnualLiabilityRunTaxInputValue>
}

export interface MintAnnualLiabilityRunIdentityInput {
  readonly planId: string
  readonly taxUnitId: string
  readonly taxYear: number
  readonly liabilityRun: Readonly<AnnualLiabilityRunBinding>
  readonly taxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[]
}

/**
 * The minted pair, beside the natural key and the exact input set it was
 * derived from.
 *
 * `orderedTaxInputs` is carried rather than discarded so a later reader can
 * re-derive both IDs without the caller's cooperation, which is what makes a
 * collision between two identities checkable rather than merely assertable.
 */
export interface AnnualLiabilityRunIdentity {
  readonly planId: string
  readonly taxUnitId: string
  readonly taxYear: number
  readonly liabilityRun: Readonly<AnnualLiabilityRunBinding>
  readonly orderedTaxInputs: readonly Readonly<AnnualLiabilityRunTaxInput>[]
  readonly taxInputSnapshotId: string
  readonly annualTaxLiabilityEvidenceId: string
  readonly identityDerivation: 'canonicalJsonSha256'
}

export interface AnnualLiabilityRunIdentityIssue {
  readonly kind:
    | 'hostileInput'
    | 'naturalKeyInvalid'
    | 'runBindingInvalid'
    | 'taxInputSnapshotInvalid'
    | 'identityCollision'
  readonly detail: string
}

export interface AnnualLiabilityRunIdentityMinted {
  readonly status: 'annualLiabilityRunIdentityMinted'
  readonly identity: Readonly<AnnualLiabilityRunIdentity>
  readonly issues: readonly []
}

export interface AnnualLiabilityRunIdentityBlocked {
  readonly status: 'annualLiabilityRunIdentityBlocked'
  readonly identity: null
  readonly issues: readonly [Readonly<AnnualLiabilityRunIdentityIssue>]
}

export type MintAnnualLiabilityRunIdentityResult =
  | AnnualLiabilityRunIdentityMinted
  | AnnualLiabilityRunIdentityBlocked

export interface AnnualLiabilityRunIdentitySetDistinct {
  readonly status: 'annualLiabilityRunIdentitySetDistinct'
  readonly issues: readonly []
}

export interface AnnualLiabilityRunIdentitySetBlocked {
  readonly status: 'annualLiabilityRunIdentitySetBlocked'
  readonly issues: readonly [Readonly<AnnualLiabilityRunIdentityIssue>]
}

export type CheckAnnualLiabilityRunIdentitySetResult =
  | AnnualLiabilityRunIdentitySetDistinct
  | AnnualLiabilityRunIdentitySetBlocked

const TAX_INPUT_SNAPSHOT_PREFIX = 'annual-tax-input-snapshot'
const LIABILITY_RUN_EVIDENCE_PREFIX = 'annual-tax-liability-evidence'

class LiabilityRunIdentityError extends Error {
  readonly kind: AnnualLiabilityRunIdentityIssue['kind']
  constructor(kind: AnnualLiabilityRunIdentityIssue['kind'], detail: string) {
    super(detail)
    this.kind = kind
    this.name = 'LiabilityRunIdentityError'
  }
}

function fail(
  kind: AnnualLiabilityRunIdentityIssue['kind'],
  detail: string,
): never {
  throw new LiabilityRunIdentityError(kind, detail)
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

function nonBlank(
  value: unknown,
  label: string,
  kind: AnnualLiabilityRunIdentityIssue['kind'],
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(kind, `${label} must be a nonblank string.`)
  }
  return value
}

function runBinding(
  value: Readonly<AnnualLiabilityRunBinding>,
): AnnualLiabilityRunBinding {
  if (value === null || typeof value !== 'object') {
    fail('runBindingInvalid', 'A liability run binding is required.')
  }
  const keys = Object.keys(value).sort(compareUtf16CodeUnits)
  if (keys.length !== 2 || keys[0] !== 'candidateFundingVectorEvidenceId' ||
      keys[1] !== 'liabilityRunKind') {
    fail('runBindingInvalid', 'A liability run binding carries exactly its kind and its funding vector.')
  }
  if (value.liabilityRunKind === 'candidateT1') {
    // The candidate is the only run whose liability depends on a chosen funding
    // vector, and it is the only one allowed -- and required -- to name it.
    return {
      liabilityRunKind: 'candidateT1',
      candidateFundingVectorEvidenceId: nonBlank(
        value.candidateFundingVectorEvidenceId,
        'A candidate run\'s funding vector evidence ID',
        'runBindingInvalid',
      ),
    }
  }
  if (value.liabilityRunKind !== 'committedAnnual' &&
      value.liabilityRunKind !== 'baselineT0') {
    fail('runBindingInvalid', 'Unknown liability run kind.')
  }
  if (value.candidateFundingVectorEvidenceId !== null) {
    fail('runBindingInvalid', 'Only a candidate run may name a funding vector.')
  }
  return {
    liabilityRunKind: value.liabilityRunKind,
    candidateFundingVectorEvidenceId: null,
  }
}

function taxInputValue(
  value: Readonly<AnnualLiabilityRunTaxInputValue>,
  inputId: string,
): AnnualLiabilityRunTaxInputValue {
  if (value === null || typeof value !== 'object') {
    fail('taxInputSnapshotInvalid', `Tax input "${inputId}" carries no value.`)
  }
  if (value.representation === 'exactCents') {
    if (Object.keys(value).length !== 2 ||
        !Number.isSafeInteger(value.amountCents) ||
        Object.is(value.amountCents, -0)) {
      fail('taxInputSnapshotInvalid', `Tax input "${inputId}" must be an exact whole number of cents.`)
    }
    return { representation: 'exactCents', amountCents: value.amountCents }
  }
  if (value.representation !== 'declaredTerm' || Object.keys(value).length !== 2) {
    fail('taxInputSnapshotInvalid', `Tax input "${inputId}" has an unknown representation.`)
  }
  return {
    representation: 'declaredTerm',
    term: nonBlank(value.term, `Tax input "${inputId}"`, 'taxInputSnapshotInvalid'),
  }
}

function orderedTaxInputs(
  inputs: readonly Readonly<AnnualLiabilityRunTaxInput>[],
): AnnualLiabilityRunTaxInput[] {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    fail('taxInputSnapshotInvalid', 'A liability run states the inputs it was computed from.')
  }
  const ordered = inputs.map((input) => {
    if (input === null || typeof input !== 'object' ||
        Object.keys(input).length !== 2) {
      fail('taxInputSnapshotInvalid', 'Every tax input carries exactly an ID and a value.')
    }
    const inputId = nonBlank(input.inputId, 'A tax input ID', 'taxInputSnapshotInvalid')
    return { inputId, value: taxInputValue(input.value, inputId) }
  }).sort((left, right) => compareUtf16CodeUnits(left.inputId, right.inputId))
  // Sorted rather than trusted, so that the same snapshot handed over in a
  // different order is the same snapshot; and unique, because two figures under
  // one name are two different snapshots claiming one identity.
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index]!.inputId === ordered[index - 1]!.inputId) {
      fail('taxInputSnapshotInvalid', `Tax input "${ordered[index]!.inputId}" appears more than once.`)
    }
  }
  return ordered
}

function mint(
  input: MintAnnualLiabilityRunIdentityInput,
): AnnualLiabilityRunIdentityMinted {
  if (input === null || typeof input !== 'object') {
    fail('naturalKeyInvalid', 'A liability run identity requires its natural key.')
  }
  const planId = nonBlank(input.planId, 'Plan ID', 'naturalKeyInvalid')
  const taxUnitId = nonBlank(input.taxUnitId, 'Tax-unit ID', 'naturalKeyInvalid')
  if (!Number.isInteger(input.taxYear) || input.taxYear < 1 ||
      input.taxYear > 9999) {
    fail('naturalKeyInvalid', 'Tax year must be a four-digit calendar year.')
  }
  const taxYear = input.taxYear
  const liabilityRun = runBinding(input.liabilityRun)
  const inputs = orderedTaxInputs(input.taxInputs)

  // The snapshot names the inputs and only the inputs. Two runs handed the same
  // figures therefore share this ID, which is what lets a caller prove that a
  // counterfactual actually changed something rather than assert it.
  const taxInputSnapshotId = deriveActionStructuralId(TAX_INPUT_SNAPSHOT_PREFIX, [
    planId,
    taxUnitId,
    taxYear,
    inputs,
  ])
  // The evidence ID names the whole run: the same inputs under a different run
  // kind, or under a different funding vector, are a different run.
  const annualTaxLiabilityEvidenceId = deriveActionStructuralId(
    LIABILITY_RUN_EVIDENCE_PREFIX,
    [
      planId,
      taxUnitId,
      taxYear,
      liabilityRun.liabilityRunKind,
      liabilityRun.candidateFundingVectorEvidenceId,
      taxInputSnapshotId,
    ],
  )
  return deepFreeze({
    status: 'annualLiabilityRunIdentityMinted' as const,
    identity: {
      planId,
      taxUnitId,
      taxYear,
      liabilityRun,
      orderedTaxInputs: inputs,
      taxInputSnapshotId,
      annualTaxLiabilityEvidenceId,
      identityDerivation: 'canonicalJsonSha256' as const,
    },
    issues: [] as const,
  })
}

function blocked(error: unknown): AnnualLiabilityRunIdentityBlocked {
  const issue = error instanceof LiabilityRunIdentityError
    ? { kind: error.kind, detail: error.message }
    : {
        kind: 'hostileInput' as const,
        detail: 'Liability run identity inputs must be detached canonical data.',
      }
  return deepFreeze({
    status: 'annualLiabilityRunIdentityBlocked' as const,
    identity: null,
    issues: [issue] as [AnnualLiabilityRunIdentityIssue],
  })
}

/**
 * Mint the `annualTaxLiabilityEvidenceId` / `taxInputSnapshotId` pair bound to
 * one annual liability run.
 *
 * Pure and total: the input is detached before anything reads it, and every
 * refusal is a typed issue rather than a throw, because the callers this is
 * built for are inside an annual pass that must fail closed rather than abort a
 * projection.
 */
export function mintAnnualLiabilityRunIdentity(
  input: Readonly<MintAnnualLiabilityRunIdentityInput>,
): Readonly<MintAnnualLiabilityRunIdentityResult> {
  try {
    return mint(structuredClone(input) as MintAnnualLiabilityRunIdentityInput)
  } catch (error) {
    return blocked(error)
  }
}

/** Whether two run bindings name the same run of the same filing unit's year. */
export function sameAnnualLiabilityRun(
  left: Readonly<AnnualLiabilityRunBinding>,
  right: Readonly<AnnualLiabilityRunBinding>,
): boolean {
  return left.liabilityRunKind === right.liabilityRunKind &&
    left.candidateFundingVectorEvidenceId ===
      right.candidateFundingVectorEvidenceId
}

function identityFingerprint(
  identity: Readonly<AnnualLiabilityRunIdentity>,
): string {
  return JSON.stringify([
    identity.planId,
    identity.taxUnitId,
    identity.taxYear,
    identity.liabilityRun.liabilityRunKind,
    identity.liabilityRun.candidateFundingVectorEvidenceId,
    identity.orderedTaxInputs,
  ])
}

function snapshotFingerprint(
  identity: Readonly<AnnualLiabilityRunIdentity>,
): string {
  return JSON.stringify([
    identity.planId,
    identity.taxUnitId,
    identity.taxYear,
    identity.orderedTaxInputs,
  ])
}

/**
 * Prove that a set of minted identities disagrees about nothing.
 *
 * A structural ID is only worth what its collision behaviour is worth, and the
 * failure mode that matters is not a SHA-256 collision — it is two runs that
 * were minted from different inputs and then handed to a consumer under one
 * evidence ID because a caller rebuilt one of them by hand. So this checks both
 * directions: one ID must never cover two different runs, and one run must
 * never be published under two IDs.
 */
export function checkAnnualLiabilityRunIdentitySet(
  identities: readonly Readonly<AnnualLiabilityRunIdentity>[],
): Readonly<CheckAnnualLiabilityRunIdentitySetResult> {
  const byEvidenceId = new Map<string, string>()
  const bySnapshotId = new Map<string, string>()
  const byRun = new Map<string, string>()
  const collision = (
    detail: string,
  ): AnnualLiabilityRunIdentitySetBlocked => deepFreeze({
    status: 'annualLiabilityRunIdentitySetBlocked' as const,
    issues: [{ kind: 'identityCollision' as const, detail }] as
      [AnnualLiabilityRunIdentityIssue],
  })
  for (const identity of identities) {
    const run = identityFingerprint(identity)
    const snapshot = snapshotFingerprint(identity)
    const knownRun = byEvidenceId.get(identity.annualTaxLiabilityEvidenceId)
    if (knownRun !== undefined && knownRun !== run) {
      return collision(`Liability evidence ID "${identity.annualTaxLiabilityEvidenceId}" covers two different runs.`)
    }
    const knownSnapshot = bySnapshotId.get(identity.taxInputSnapshotId)
    if (knownSnapshot !== undefined && knownSnapshot !== snapshot) {
      return collision(`Tax-input snapshot ID "${identity.taxInputSnapshotId}" covers two different input sets.`)
    }
    const knownEvidenceId = byRun.get(run)
    if (knownEvidenceId !== undefined &&
        knownEvidenceId !== identity.annualTaxLiabilityEvidenceId) {
      return collision('One liability run is published under two evidence IDs.')
    }
    byEvidenceId.set(identity.annualTaxLiabilityEvidenceId, run)
    bySnapshotId.set(identity.taxInputSnapshotId, snapshot)
    byRun.set(run, identity.annualTaxLiabilityEvidenceId)
  }
  return deepFreeze({
    status: 'annualLiabilityRunIdentitySetDistinct' as const,
    issues: [] as const,
  })
}
