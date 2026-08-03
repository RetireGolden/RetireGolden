import type {
  EvaluateBeneficiarySpousalElectionResult,
} from './beneficiarySpousalElectionStatus.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  classifyBeneficiaryTraditionalIraWithdrawal,
  type AcceptedBeneficiaryTraditionalIraWithdrawalClassification,
  type BeneficiaryTraditionalIraWithdrawalTaxCharacter,
  type ClassifyBeneficiaryTraditionalIraWithdrawalInput,
} from './beneficiaryTraditionalIraWithdrawalCharacter.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import type { PositiveUsdCents, UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { deriveActionStructuralId } from './structuralId.js'

export interface BeneficiaryTraditionalIraDeathBeneficiaryEvidence {
  predicate: 'beneficiaryTraditionalIraDeathBeneficiary'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  deathDate: string
  inheritanceEvidenceId: string
}

export interface EvaluateBeneficiaryTraditionalIraDeathPenaltyInput {
  characterizationInput:
    Readonly<ClassifyBeneficiaryTraditionalIraWithdrawalInput>
  deathBeneficiaryEvidence:
    Readonly<BeneficiaryTraditionalIraDeathBeneficiaryEvidence> | null
  /**
   * Treas. Reg. 1.408-8(c) status. The zero rate below rests on IRC
   * 72(t)(2)(A)(ii), which reaches a distribution "made to a beneficiary". Once
   * a surviving spouse becomes the owner under 1.408-8(c)(3) they are the owner
   * "for all purposes under the Internal Revenue Code (including section
   * 72(t))", so the zero rate no longer applies and this module must not answer.
   */
  spousalElection: Readonly<EvaluateBeneficiarySpousalElectionResult>
}

export interface BeneficiaryTraditionalIraPenaltyCharacterBinding {
  characterIndex: number
  kind: BeneficiaryTraditionalIraWithdrawalTaxCharacter['kind']
  amount: PositiveUsdCents
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  basisEvidenceId: string
  allocationEvidenceId: string
  characterEvidenceId: string
}

export interface BeneficiaryTraditionalIraDeathPenaltyEvidence {
  predicate: 'withdrawalPenaltyEvidence'
  treatment: 'deathBeneficiary'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  sourceClass: 'beneficiaryTraditionalIra'
  executedAmount: UsdCents
  basisReturnExcludedAmount: UsdCents
  taxableAmountExposed: UsdCents
  penaltyRate: 0
  finalPenaltyAmount: 0
  acceptedEvidence: Readonly<{
    evaluationDate: string
    deathDate: string
    sourceAccountId: AccountId
    beneficiaryPersonId: PersonId
    decedentPersonId: PersonId
    inheritanceEvidenceId: string
  }>
  characterBindings:
    readonly Readonly<BeneficiaryTraditionalIraPenaltyCharacterBinding>[]
  sourceCharacterEvidenceId: string
  penaltyEvidenceId: string
}

export interface AcceptedBeneficiaryTraditionalIraDeathPenaltyResult {
  status: 'accepted'
  reasons: readonly []
  characterization:
    Readonly<AcceptedBeneficiaryTraditionalIraWithdrawalClassification>
  penaltyEvidence: Readonly<BeneficiaryTraditionalIraDeathPenaltyEvidence>
}

export interface UnsupportedBeneficiaryTraditionalIraDeathPenaltyResult {
  status: 'unsupported'
  reasons: readonly [Readonly<ActionReason>]
  characterization: null
  penaltyEvidence: null
}

export type EvaluateBeneficiaryTraditionalIraDeathPenaltyResult =
  | AcceptedBeneficiaryTraditionalIraDeathPenaltyResult
  | UnsupportedBeneficiaryTraditionalIraDeathPenaltyResult

const DEATH_EVIDENCE_KEYS = [
  'predicate',
  'actionId',
  'allocationId',
  'sourceAccountId',
  'beneficiaryPersonId',
  'decedentPersonId',
  'evaluationDate',
  'deathDate',
  'inheritanceEvidenceId',
] as const

function spousalOwnerTreatmentBegun(): Readonly<
  UnsupportedBeneficiaryTraditionalIraDeathPenaltyResult
> {
  return deepFreeze({
    status: 'unsupported',
    reasons: [
      createActionReason('withdrawal-spousal-owner-treatment-begun'),
    ] as [ActionReason],
    characterization: null,
    penaltyEvidence: null,
  })
}

function unsupported(): Readonly<
  UnsupportedBeneficiaryTraditionalIraDeathPenaltyResult
> {
  return deepFreeze({
    status: 'unsupported',
    reasons: [
      createActionReason('withdrawal-inherited-facts-missing'),
    ] as [ActionReason],
    characterization: null,
    penaltyEvidence: null,
  })
}

function canonicalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = parseCivilIsoDate(value)
  return parsed === null ? null : formatCivilDate(parsed)
}

function evidenceId(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const INVALID_SNAPSHOT = Symbol('invalidSnapshot')

function plainDataSnapshot(
  value: unknown,
  ancestors = new Set<object>(),
): unknown | typeof INVALID_SNAPSHOT {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) return value
  if (typeof value !== 'object' || ancestors.has(value)) {
    return INVALID_SNAPSHOT
  }
  try {
    const isArray = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (
      (isArray && prototype !== Array.prototype) ||
      (!isArray && prototype !== Object.prototype && prototype !== null)
    ) return INVALID_SNAPSHOT
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID_SNAPSHOT
    const output: unknown[] | Record<string, unknown> = isArray
      ? []
      : Object.create(null) as Record<string, unknown>
    ancestors.add(value)
    for (const key of keys) {
      if (isArray && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) return INVALID_SNAPSHOT
      const child = plainDataSnapshot(descriptor.value, ancestors)
      if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
      Object.defineProperty(output, key, {
        enumerable: true,
        configurable: true,
        writable: true,
        value: child,
      })
    }
    return output
  } catch {
    return INVALID_SNAPSHOT
  } finally {
    ancestors.delete(value)
  }
}

function exactKeys(
  value: unknown,
  keys: readonly string[],
): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
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

function characterBinding(
  character: Readonly<BeneficiaryTraditionalIraWithdrawalTaxCharacter>,
  characterIndex: number,
  identity: Readonly<{
    actionId: ActionId
    allocationId: AllocationId
    sourceAccountId: AccountId
    basisEvidenceId: string
    allocationEvidenceId: string
  }>,
): BeneficiaryTraditionalIraPenaltyCharacterBinding | null {
  if (
    character.actionId !== identity.actionId ||
    character.allocationId !== identity.allocationId ||
    character.sourceAccountId !== identity.sourceAccountId ||
    character.sourceClass !== 'beneficiaryTraditionalIra' ||
    character.characterEvidence.rule !== 'beneficiaryAnnualIraBasisAllocation' ||
    character.characterEvidence.allocationId !== identity.allocationId ||
    character.characterEvidence.basisEvidenceId !== identity.basisEvidenceId ||
    character.characterEvidence.allocationEvidenceId !==
      identity.allocationEvidenceId ||
    character.characterEvidence.segmentAmount !== character.amount
  ) {
    return null
  }
  const characterEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-penalty-character',
    [characterIndex, character],
  )
  return {
    characterIndex,
    kind: character.kind,
    amount: character.amount,
    actionId: identity.actionId,
    allocationId: identity.allocationId,
    sourceAccountId: identity.sourceAccountId,
    basisEvidenceId: identity.basisEvidenceId,
    allocationEvidenceId: identity.allocationEvidenceId,
    characterEvidenceId,
  }
}

/**
 * Pure death-exception evidence boundary for a beneficiary traditional IRA.
 * It rebuilds character from the complete annual inputs and moves no money.
 */
export function evaluateBeneficiaryTraditionalIraDeathPenalty(
  input: Readonly<EvaluateBeneficiaryTraditionalIraDeathPenaltyInput>,
): Readonly<EvaluateBeneficiaryTraditionalIraDeathPenaltyResult> {
  try {
    const rawSnapshot = plainDataSnapshot(input)
    if (
      rawSnapshot === INVALID_SNAPSHOT ||
      !exactKeys(rawSnapshot, [
        'characterizationInput',
        'deathBeneficiaryEvidence',
        'spousalElection',
      ])
    ) return unsupported()
    const snapshot = rawSnapshot as unknown as
      EvaluateBeneficiaryTraditionalIraDeathPenaltyInput
    // Read from the snapshot, never from `input`. A caller can hand over a
    // proxy or accessor for spousalElection, and reading the live object would
    // both invoke that code and let two reads disagree -- the exact boundary
    // plainDataSnapshot exists to hold.
    const electionStatus = snapshot.spousalElection.status
    if (electionStatus === 'spousalOwnerTreatmentBegun') {
      return spousalOwnerTreatmentBegun()
    }
    if (
      electionStatus !== 'spousalElectionNotApplicable' &&
      electionStatus !== 'spousalOwnerTreatmentNotBegun'
    ) return unsupported()
    const characterization = classifyBeneficiaryTraditionalIraWithdrawal(
      snapshot.characterizationInput,
    )
    if (characterization.status !== 'accepted') return unsupported()

    const death = snapshot.deathBeneficiaryEvidence
    if (!exactKeys(death, DEATH_EVIDENCE_KEYS)) return unsupported()

    const actionId = actionIdSchema.safeParse(death.actionId)
    const allocationId = allocationIdSchema.safeParse(death.allocationId)
    const sourceAccountId = accountIdSchema.safeParse(death.sourceAccountId)
    const beneficiaryPersonId = personIdSchema.safeParse(
      death.beneficiaryPersonId,
    )
    const decedentPersonId = personIdSchema.safeParse(death.decedentPersonId)
    const evaluationDate = canonicalDate(death.evaluationDate)
    const deathDate = canonicalDate(death.deathDate)
    const inheritanceEvidenceId = evidenceId(death.inheritanceEvidenceId)
    const source = characterization.acceptedSourceEligibility
    if (
      death.predicate !== 'beneficiaryTraditionalIraDeathBeneficiary' ||
      !actionId.success ||
      !allocationId.success ||
      !sourceAccountId.success ||
      !beneficiaryPersonId.success ||
      !decedentPersonId.success ||
      beneficiaryPersonId.data === decedentPersonId.data ||
      evaluationDate === null ||
      evaluationDate !== death.evaluationDate ||
      deathDate === null ||
      deathDate !== death.deathDate ||
      deathDate > evaluationDate ||
      inheritanceEvidenceId === null ||
      actionId.data !== snapshot.characterizationInput.actionId ||
      allocationId.data !== source.allocationId ||
      sourceAccountId.data !== source.sourceAccountId ||
      beneficiaryPersonId.data !== source.beneficiaryPersonId ||
      decedentPersonId.data !== source.decedentPersonId ||
      evaluationDate !== source.evaluationDate ||
      inheritanceEvidenceId !== source.inheritanceEvidenceId ||
      deathDate !== snapshot.characterizationInput.inheritanceEvidence?.deathDate
    ) {
      return unsupported()
    }

    const basisEvidence = source.basisEvidence
    const allocationEvidenceId =
      basisEvidence.annualDistributionBasisAllocation.allocationEvidenceId
    const bindings: BeneficiaryTraditionalIraPenaltyCharacterBinding[] = []
    let basisReturnExcludedAmount = 0
    let taxableAmountExposed = 0
    const kinds = new Set<string>()
    for (const [index, character] of characterization.taxCharacter.entries()) {
      const binding = characterBinding(character, index, {
        actionId: actionId.data,
        allocationId: allocationId.data,
        sourceAccountId: sourceAccountId.data,
        basisEvidenceId: basisEvidence.evidenceId,
        allocationEvidenceId,
      })
      if (binding === null || kinds.has(binding.kind)) return unsupported()
      kinds.add(binding.kind)
      bindings.push(binding)
      if (binding.kind === 'basisReturn') {
        basisReturnExcludedAmount += binding.amount
      } else {
        taxableAmountExposed += binding.amount
      }
    }
    if (
      !Number.isSafeInteger(basisReturnExcludedAmount) ||
      !Number.isSafeInteger(taxableAmountExposed) ||
      basisReturnExcludedAmount !== basisEvidence.basisRecoveredAmount ||
      taxableAmountExposed !== basisEvidence.ordinaryIncomeAmount ||
      basisReturnExcludedAmount + taxableAmountExposed !==
        snapshot.characterizationInput.executedAmount
    ) {
      return unsupported()
    }

    const sourceCharacterEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-penalty-character-coverage',
      [
        actionId.data,
        allocationId.data,
        sourceAccountId.data,
        beneficiaryPersonId.data,
        decedentPersonId.data,
        evaluationDate,
        inheritanceEvidenceId,
        basisEvidence.evidenceId,
        source.rmdEvidence.evidenceId,
        bindings,
        basisReturnExcludedAmount,
        taxableAmountExposed,
      ],
    )
    const acceptedEvidence = {
      evaluationDate,
      deathDate,
      sourceAccountId: sourceAccountId.data,
      beneficiaryPersonId: beneficiaryPersonId.data,
      decedentPersonId: decedentPersonId.data,
      inheritanceEvidenceId,
    }
    const penaltyEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-death-penalty',
      [
        actionId.data,
        allocationId.data,
        acceptedEvidence,
        sourceCharacterEvidenceId,
        taxableAmountExposed,
        0,
        0,
      ],
    )
    const ids = [
      inheritanceEvidenceId,
      snapshot.characterizationInput.basisPoolEvidence?.evidenceId,
      snapshot.characterizationInput.rmdPoolEvidence?.evidenceId,
      basisEvidence.evidenceId,
      allocationEvidenceId,
      ...bindings.map((binding) => binding.characterEvidenceId),
      sourceCharacterEvidenceId,
      penaltyEvidenceId,
    ]
    if (
      ids.some((id) => evidenceId(id) === null) ||
      new Set(ids).size !== ids.length
    ) {
      return unsupported()
    }

    return deepFreeze({
      status: 'accepted',
      reasons: [],
      characterization,
      penaltyEvidence: {
        predicate: 'withdrawalPenaltyEvidence',
        treatment: 'deathBeneficiary',
        actionId: actionId.data,
        allocationId: allocationId.data,
        sourceAccountId: sourceAccountId.data,
        beneficiaryPersonId: beneficiaryPersonId.data,
        decedentPersonId: decedentPersonId.data,
        evaluationDate,
        sourceClass: 'beneficiaryTraditionalIra',
        executedAmount: snapshot.characterizationInput.executedAmount,
        basisReturnExcludedAmount: basisReturnExcludedAmount as UsdCents,
        taxableAmountExposed: taxableAmountExposed as UsdCents,
        penaltyRate: 0,
        finalPenaltyAmount: 0,
        acceptedEvidence,
        characterBindings: bindings,
        sourceCharacterEvidenceId,
        penaltyEvidenceId,
      },
    })
  } catch {
    return unsupported()
  }
}
