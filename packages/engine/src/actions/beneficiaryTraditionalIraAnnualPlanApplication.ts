import { planSchema, type Plan } from '../model/plan.js'
import {
  prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction,
  type BeneficiaryTraditionalIraAnnualPhysicalTransactionPreparedResult,
  type PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import { parseCivilIsoDate } from './civilDate.js'
import {
  accountIdSchema,
  personIdSchema,
  planIdSchema,
  type AccountId,
  type PersonId,
  type PlanId,
} from './identity.js'
import { type UsdCents, usdCentsSchema } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { exactKeys, nonblank, plainDataSnapshot } from './plainData.js'

export interface BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence {
  sourceAccountId: AccountId
  annualOpeningBalanceAmount: UsdCents
}

export interface BeneficiaryTraditionalIraPlanInheritanceBinding {
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  deathDate: string
  inheritanceEvidenceId: string
}

export interface PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput {
  plan: unknown
  planSnapshotEvidenceId: string
  transactionInput:
    Readonly<PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput>
  annualOpeningBalances:
    readonly Readonly<BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence>[]
  inheritanceBindings:
    readonly Readonly<BeneficiaryTraditionalIraPlanInheritanceBinding>[]
}

export interface PlanBeneficiaryTraditionalIraSourceBinding {
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  deathDate: string
  inheritanceEvidenceId: string
  annualOpeningBalanceAmount: UsdCents
}

export interface PlanBeneficiaryTraditionalIraSourcesBoundEvidence {
  predicate:
    'planBeneficiaryTraditionalIraSourcesBoundToDetachedTransaction'
  planId: PlanId
  planSnapshotEvidenceId: string
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  sourceAccountIds: readonly AccountId[]
  sourceBindings:
    readonly Readonly<PlanBeneficiaryTraditionalIraSourceBinding>[]
  transactionEvidenceId: string
  evidenceId: string
}

export interface PlanBeneficiaryTraditionalIraAnnualApplicationPreparedResult {
  status: 'planAnnualApplicationPrepared'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  transactionStatus: 'appliedToDetachedSnapshotOnly'
  reasons: readonly []
  transaction:
    Readonly<BeneficiaryTraditionalIraAnnualPhysicalTransactionPreparedResult>
  planBinding:
    Readonly<PlanBeneficiaryTraditionalIraSourcesBoundEvidence>
}

export interface UnsupportedPlanBeneficiaryTraditionalIraAnnualApplicationResult {
  status: 'unsupported'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  transactionStatus: 'notEstablished'
  reasons: readonly [Readonly<ActionReason>]
  transaction: null
  planBinding: null
}

export type PreparePlanBeneficiaryTraditionalIraAnnualApplicationResult =
  | PlanBeneficiaryTraditionalIraAnnualApplicationPreparedResult
  | UnsupportedPlanBeneficiaryTraditionalIraAnnualApplicationResult

const INPUT_KEYS = [
  'plan',
  'planSnapshotEvidenceId',
  'transactionInput',
  'annualOpeningBalances',
  'inheritanceBindings',
] as const
const BALANCE_KEYS = [
  'sourceAccountId',
  'annualOpeningBalanceAmount',
] as const
const INHERITANCE_KEYS = [
  'sourceAccountId',
  'beneficiaryPersonId',
  'decedentPersonId',
  'deathDate',
  'inheritanceEvidenceId',
] as const

function unsupported(): Readonly<
  UnsupportedPlanBeneficiaryTraditionalIraAnnualApplicationResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    transaction: null,
    planBinding: null,
  })
}

function identifierValues(
  value: unknown,
  key = '',
  result = new Set<string>(),
  seen = new WeakSet<object>(),
): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return result
  }
  seen.add(value)
  for (const [childKey, child] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const item of child) if (typeof item === 'string') result.add(item)
    }
    identifierValues(child, childKey, result, seen)
  }
  return result
}

function validPlanBindings(
  plan: Plan,
  beneficiaryPersonId: PersonId,
  decedentPersonId: PersonId,
  taxYear: number,
  sources: readonly AccountId[],
  balances: readonly Readonly<BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence>[],
  inheritances: readonly Readonly<BeneficiaryTraditionalIraPlanInheritanceBinding>[],
): readonly Readonly<PlanBeneficiaryTraditionalIraSourceBinding>[] | null {
  if (
    plan.household.people.filter((person) => person.id === beneficiaryPersonId)
      .length !== 1 ||
    plan.household.people.filter((person) => person.id === decedentPersonId)
      .length !== 1 ||
    balances.length !== sources.length || inheritances.length !== sources.length
  ) return null
  const result: PlanBeneficiaryTraditionalIraSourceBinding[] = []
  for (const sourceAccountId of sources) {
    const accounts = plan.accounts.filter((account) => account.id === sourceAccountId)
    const sourceBalances = balances.filter(
      (entry) => entry.sourceAccountId === sourceAccountId,
    )
    const sourceInheritances = inheritances.filter(
      (entry) => entry.sourceAccountId === sourceAccountId,
    )
    if (
      accounts.length !== 1 || sourceBalances.length !== 1 ||
      sourceInheritances.length !== 1
    ) return null
    const account = accounts[0]!
    const balance = sourceBalances[0]!
    const inheritance = sourceInheritances[0]!
    const death = parseCivilIsoDate(inheritance.deathDate)
    if (
      account.type !== 'traditional' || account.kind !== 'ira' ||
      account.ownerPersonId !== beneficiaryPersonId ||
      account.inherited === undefined ||
      inheritance.beneficiaryPersonId !== beneficiaryPersonId ||
      inheritance.decedentPersonId !== decedentPersonId || death === null ||
      account.inherited.ownerDeathYear !== death.year || death.year > taxYear ||
      !nonblank(inheritance.inheritanceEvidenceId) ||
      !usdCentsSchema.safeParse(balance.annualOpeningBalanceAmount).success
    ) return null
    result.push({
      sourceAccountId,
      beneficiaryPersonId,
      decedentPersonId,
      deathDate: inheritance.deathDate,
      inheritanceEvidenceId: inheritance.inheritanceEvidenceId,
      annualOpeningBalanceAmount: balance.annualOpeningBalanceAmount,
    })
  }
  return result
}

function prepare(
  input: Readonly<PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput>,
): Readonly<PreparePlanBeneficiaryTraditionalIraAnnualApplicationResult> {
  const raw = plainDataSnapshot(input)
  if (
    !exactKeys(raw, INPUT_KEYS) ||
    !nonblank(raw.planSnapshotEvidenceId) ||
    !Array.isArray(raw.annualOpeningBalances) ||
    !Array.isArray(raw.inheritanceBindings) ||
    raw.annualOpeningBalances.some((entry) => !exactKeys(entry, BALANCE_KEYS)) ||
    raw.inheritanceBindings.some((entry) =>
      !exactKeys(entry, INHERITANCE_KEYS))
  ) return unsupported()
  const snapshot = raw as unknown as
    PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput
  const parsedPlan = planSchema.safeParse(snapshot.plan)
  if (!parsedPlan.success) return unsupported()
  const planId = planIdSchema.safeParse(parsedPlan.data.id)
  const transaction =
    prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction(
      snapshot.transactionInput,
    )
  if (!planId.success || transaction.status !== 'annualPhysicalTransactionPrepared') {
    return unsupported()
  }
  const annual = transaction.runtimeEvidence.annualEvidence
  const sourceIds = transaction.sourceBalanceTransitions
    .map((entry) => entry.sourceAccountId)
    .sort(compareUtf16CodeUnits)
  if (
    new Set(sourceIds).size !== sourceIds.length ||
    snapshot.annualOpeningBalances.some((entry) =>
      !accountIdSchema.safeParse(entry.sourceAccountId).success ||
      !usdCentsSchema.safeParse(entry.annualOpeningBalanceAmount).success) ||
    snapshot.inheritanceBindings.some((entry) =>
      !accountIdSchema.safeParse(entry.sourceAccountId).success ||
      !personIdSchema.safeParse(entry.beneficiaryPersonId).success ||
      !personIdSchema.safeParse(entry.decedentPersonId).success)
  ) return unsupported()
  const sourceBindings = validPlanBindings(
    parsedPlan.data,
    annual.beneficiaryPersonId,
    annual.decedentPersonId,
    annual.taxYear,
    sourceIds,
    snapshot.annualOpeningBalances,
    snapshot.inheritanceBindings,
  )
  if (sourceBindings === null) return unsupported()
  for (const transition of transaction.sourceBalanceTransitions) {
    const balance = sourceBindings.find(
      (entry) => entry.sourceAccountId === transition.sourceAccountId,
    )
    if (
      balance === undefined || balance.annualOpeningBalanceAmount !==
        transition.annualOpeningBalanceAmount
    ) return unsupported()
  }
  const transactionIdentifiers = identifierValues(transaction)
  if (new Set(sourceBindings.map((entry) => entry.deathDate)).size !== 1) {
    return unsupported()
  }
  for (const binding of sourceBindings) {
    const canonicalMembers = transaction.runtimeEvidence.annualEvidence
      .canonicalMembers
      .filter((member) => member.candidate.sourceAccountId === binding.sourceAccountId)
    if (canonicalMembers.some((member) => {
      const accepted = member.deathPenaltyEvidence.acceptedEvidence
      return accepted.sourceAccountId !== binding.sourceAccountId ||
        accepted.beneficiaryPersonId !== binding.beneficiaryPersonId ||
        accepted.decedentPersonId !== binding.decedentPersonId ||
        accepted.deathDate !== binding.deathDate ||
        accepted.inheritanceEvidenceId !== binding.inheritanceEvidenceId ||
        member.candidate.inheritanceEvidenceId !== binding.inheritanceEvidenceId
    })) {
      return unsupported()
    }
    if (
      canonicalMembers.length === 0 &&
      transactionIdentifiers.has(binding.inheritanceEvidenceId)
    ) return unsupported()
  }
  const evidenceIds = [
    snapshot.planSnapshotEvidenceId,
    ...sourceBindings.map((entry) => entry.inheritanceEvidenceId),
  ]
  const planIdentifiers = identifierValues(parsedPlan.data)
  if (
    new Set(evidenceIds).size !== evidenceIds.length ||
    transactionIdentifiers.has(planId.data) ||
    transactionIdentifiers.has(snapshot.planSnapshotEvidenceId) ||
    planIdentifiers.has(snapshot.planSnapshotEvidenceId) ||
    sourceBindings.some((entry) =>
      planIdentifiers.has(entry.inheritanceEvidenceId))
  ) return unsupported()
  const bindingWithoutId = {
    predicate:
      'planBeneficiaryTraditionalIraSourcesBoundToDetachedTransaction' as const,
    planId: planId.data,
    planSnapshotEvidenceId: snapshot.planSnapshotEvidenceId,
    beneficiaryPersonId: annual.beneficiaryPersonId,
    decedentPersonId: annual.decedentPersonId,
    taxYear: annual.taxYear,
    sourceAccountIds: sourceIds,
    sourceBindings,
    transactionEvidenceId: transaction.transactionEvidenceId,
  }
  const evidenceId = deriveActionStructuralId(
    'plan-beneficiary-ira-sources-bound-to-detached-transaction',
    [bindingWithoutId],
  )
  if (!nonblank(evidenceId) || identifierValues(snapshot).has(evidenceId) ||
      identifierValues(transaction).has(evidenceId)) return unsupported()
  return deepFreeze({
    status: 'planAnnualApplicationPrepared',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    transactionStatus: 'appliedToDetachedSnapshotOnly',
    reasons: [],
    transaction,
    planBinding: { ...bindingWithoutId, evidenceId },
  })
}

/**
 * Rebuilds a detached beneficiary IRA transaction and binds its complete source
 * set to a Plan snapshot. It neither mutates the Plan nor establishes movement
 * or actionability authority.
 */
export function preparePlanBeneficiaryTraditionalIraAnnualApplication(
  input: Readonly<PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput>,
): Readonly<PreparePlanBeneficiaryTraditionalIraAnnualApplicationResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
