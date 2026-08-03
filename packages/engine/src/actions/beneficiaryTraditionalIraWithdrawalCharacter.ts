import {
  allocateAnnualIraBasis,
  type AnnualIraBasisAllocationEntryInput,
  type AnnualIraBasisAllocationEvidence,
  type AnnualIraBasisRatio,
} from './annualIraBasisAllocation.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
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
import {
  asPositiveUsdCents,
  asUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'

export interface BeneficiaryTraditionalIraInheritanceEvidence {
  predicate: 'beneficiaryTraditionalIraInheritance'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  accountType: 'traditional'
  accountKind: 'ira'
  ownershipKind: 'beneficiary'
  deathDate: string
  inheritanceEvidenceId: string
}

export interface CompleteBeneficiaryTraditionalIraBasisPoolEvidence {
  predicate: 'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear'
  beneficiaryPersonId: PersonId
  inheritedFromPersonId: PersonId
  poolId: string
  taxYear: number
  accountIds: readonly [AccountId, ...AccountId[]]
  openingInheritedBasisAmount: UsdCents
  yearEndApplicablePoolBalanceAmount: UsdCents
  form8606Line7DistributionAmount: UsdCents
  /**
   * IRC 408(d)(3)(C)(ii) excludes the surviving spouse from inherited-IRA
   * treatment, and Treas. Reg. 1.408-8(c)(2) makes the election an act of
   * redesignation -- so a surviving spouse can hold as beneficiary and still
   * convert, and this line can be non-zero for them. It stays structurally zero
   * for every other beneficiary, whom 408(d)(3)(C)(i) bars from converting.
   *
   * Typed as cents rather than the literal 0 so that case is expressible and
   * gets an explicit refusal below. Pinning it at the type level meant a caller
   * holding a real conversion had to drop it to compile, which understates the
   * pro-rata denominator and the ordinary income that falls out of it.
   */
  form8606Line8NetConversionAmount: UsdCents
  evidenceId: string
}

export interface CompleteBeneficiaryTraditionalIraRmdPoolEvidence {
  predicate: 'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  beneficiaryPersonId: PersonId
  inheritedFromPersonId: PersonId
  poolId: string
  taxYear: number
  accountIds: readonly [AccountId, ...AccountId[]]
  requiredAmount: UsdCents
  satisfiedBeforeExecution: UsdCents
  remainingBeforeExecution: UsdCents
  evidenceId: string
}

export interface ClassifyBeneficiaryTraditionalIraWithdrawalInput {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  taxYear: number
  executedAmount: UsdCents
  inheritanceEvidence:
    Readonly<BeneficiaryTraditionalIraInheritanceEvidence> | null
  basisPoolEvidence:
    Readonly<CompleteBeneficiaryTraditionalIraBasisPoolEvidence> | null
  line7Distributions:
    readonly Readonly<AnnualIraBasisAllocationEntryInput>[] | null
  rmdPoolEvidence:
    Readonly<CompleteBeneficiaryTraditionalIraRmdPoolEvidence> | null
}

export interface BeneficiaryTraditionalIraAnnualBasisEvidence {
  poolId: string
  taxYear: number
  beneficiaryPersonId: PersonId
  inheritedFromPersonId: PersonId
  accountIds: readonly [AccountId, ...AccountId[]]
  openingInheritedBasisAmount: UsdCents
  basisNumeratorAmount: UsdCents
  yearEndApplicablePoolBalanceAmount: UsdCents
  form8606Line7DistributionAmount: UsdCents
  form8606Line8NetConversionAmount: UsdCents
  annualBasisDenominatorAmount: UsdCents
  annualBasisRatio: Readonly<AnnualIraBasisRatio>
  annualDistributionBasisAllocation:
    Readonly<AnnualIraBasisAllocationEvidence & {
      calculationScope: 'form8606Line7Distributions'
    }>
  executedAmount: UsdCents
  basisRecoveredAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  basisRecoveryQuantization: 'nearestCentHalfUp'
  evidenceId: string
}

export interface BeneficiaryTraditionalIraRmdSnapshot {
  poolId: string
  taxYear: number
  beneficiaryPersonId: PersonId
  inheritedFromPersonId: PersonId
  accountIds: readonly [AccountId, ...AccountId[]]
  requiredAmount: UsdCents
  satisfiedBeforeExecution: UsdCents
  remainingBeforeExecution: UsdCents
  evidenceId: string
}

export interface AcceptedBeneficiaryTraditionalIraSourceEligibilityEvidence {
  predicate: 'inheritedWithdrawalEligibility'
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  sourceClass: 'beneficiaryTraditionalIra'
  ownershipKind: 'beneficiary'
  inheritanceEvidenceId: string
  basisEvidence: Readonly<BeneficiaryTraditionalIraAnnualBasisEvidence>
  rmdEvidence: Readonly<BeneficiaryTraditionalIraRmdSnapshot>
}

interface BeneficiaryTraditionalIraTaxCharacterBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'beneficiaryTraditionalIra'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'beneficiaryAnnualIraBasisAllocation'
    allocationId: AllocationId
    basisEvidenceId: string
    allocationEvidenceId: string
    segmentAmount: PositiveUsdCents
  }>
}

export interface BeneficiaryTraditionalIraBasisReturnTaxCharacter
  extends BeneficiaryTraditionalIraTaxCharacterBase {
  kind: 'basisReturn'
}

export interface BeneficiaryTraditionalIraOrdinaryIncomeTaxCharacter
  extends BeneficiaryTraditionalIraTaxCharacterBase {
  kind: 'ordinaryIncome'
}

export type BeneficiaryTraditionalIraWithdrawalTaxCharacter =
  | BeneficiaryTraditionalIraBasisReturnTaxCharacter
  | BeneficiaryTraditionalIraOrdinaryIncomeTaxCharacter

export interface AcceptedBeneficiaryTraditionalIraWithdrawalClassification {
  status: 'accepted'
  reasons: readonly []
  acceptedSourceEligibility:
    Readonly<AcceptedBeneficiaryTraditionalIraSourceEligibilityEvidence>
  taxCharacter: readonly Readonly<BeneficiaryTraditionalIraWithdrawalTaxCharacter>[]
}

export interface UnsupportedBeneficiaryTraditionalIraWithdrawalClassification {
  status: 'unsupported'
  reasons: readonly [ActionReason<'withdrawal-inherited-facts-missing'>]
  acceptedSourceEligibility: null
  taxCharacter: readonly []
}

export type ClassifyBeneficiaryTraditionalIraWithdrawalResult =
  | AcceptedBeneficiaryTraditionalIraWithdrawalClassification
  | UnsupportedBeneficiaryTraditionalIraWithdrawalClassification

interface BoundIdentity {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  evaluationDate: string
  taxYear: number
  executedAmount: UsdCents
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
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

function canonicalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = parseCivilIsoDate(value)
  return parsed === null ? null : formatCivilDate(parsed)
}

function exactIdentity(
  evidence: Readonly<BeneficiaryTraditionalIraInheritanceEvidence>,
  input: BoundIdentity,
): boolean {
  return evidence.actionId === input.actionId &&
    evidence.allocationId === input.allocationId &&
    evidence.sourceAccountId === input.sourceAccountId &&
    evidence.beneficiaryPersonId === input.beneficiaryPersonId &&
    evidence.decedentPersonId === input.decedentPersonId &&
    evidence.evaluationDate === input.evaluationDate
}

function exactPoolIdentity(
  evidence: Readonly<{
    beneficiaryPersonId: PersonId
    inheritedFromPersonId: PersonId
    taxYear: number
  }>,
  input: BoundIdentity,
): boolean {
  return evidence.beneficiaryPersonId === input.beneficiaryPersonId &&
    evidence.inheritedFromPersonId === input.decedentPersonId &&
    evidence.taxYear === input.taxYear
}

function validatedAccountSet(
  value: unknown,
  sourceAccountId: AccountId,
): [AccountId, ...AccountId[]] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const parsed: AccountId[] = []
  for (const candidate of value) {
    const result = accountIdSchema.safeParse(candidate)
    if (!result.success) return null
    parsed.push(result.data)
  }
  if (new Set(parsed).size !== parsed.length) return null
  if (parsed.filter((id) => id === sourceAccountId).length !== 1) return null
  parsed.sort(compareUtf16CodeUnits)
  return parsed as [AccountId, ...AccountId[]]
}

function unsupported(
  input: BoundIdentity,
): Readonly<UnsupportedBeneficiaryTraditionalIraWithdrawalClassification> {
  return deepFreeze({
    status: 'unsupported',
    reasons: [createActionReason('withdrawal-inherited-facts-missing', {
      personId: input.beneficiaryPersonId,
      accountId: input.sourceAccountId,
      allocationId: input.allocationId,
    })],
    acceptedSourceEligibility: null,
    taxCharacter: [],
  })
}

function safeMoney(value: unknown): UsdCents | null {
  const parsed = usdCentsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

/**
 * Pure evidence boundary for one beneficiary traditional-IRA withdrawal.
 * It classifies the current allocation from one complete annual inherited
 * basis inventory, without moving money or evaluating penalty treatment.
 */
export function classifyBeneficiaryTraditionalIraWithdrawal(
  input: Readonly<ClassifyBeneficiaryTraditionalIraWithdrawalInput>,
): Readonly<ClassifyBeneficiaryTraditionalIraWithdrawalResult> {
  const actionId = actionIdSchema.parse(input.actionId)
  const allocationId = allocationIdSchema.parse(input.allocationId)
  const sourceAccountId = accountIdSchema.parse(input.sourceAccountId)
  const beneficiaryPersonId = personIdSchema.parse(input.beneficiaryPersonId)
  const decedentPersonId = personIdSchema.parse(input.decedentPersonId)
  const evaluationDate = canonicalDate(input.evaluationDate)
  if (evaluationDate === null || evaluationDate !== input.evaluationDate) {
    throw new RangeError('Inherited withdrawal evaluation date must be canonical')
  }
  if (
    !Number.isSafeInteger(input.taxYear) ||
    input.taxYear < 1 ||
    input.taxYear > 9999 ||
    parseCivilIsoDate(evaluationDate)?.year !== input.taxYear
  ) {
    throw new RangeError('Inherited withdrawal tax year must match the evaluation date')
  }
  const identity: BoundIdentity = {
    actionId,
    allocationId,
    sourceAccountId,
    beneficiaryPersonId,
    decedentPersonId,
    evaluationDate,
    taxYear: input.taxYear,
    executedAmount: usdCentsSchema.parse(input.executedAmount),
  }
  if (beneficiaryPersonId === decedentPersonId) return unsupported(identity)

  const inheritance = input.inheritanceEvidence
  if (
    inheritance == null ||
    typeof inheritance !== 'object' ||
    Array.isArray(inheritance)
  ) {
    return unsupported(identity)
  }
  const deathDate = canonicalDate(inheritance.deathDate)
  if (
    inheritance.predicate !== 'beneficiaryTraditionalIraInheritance' ||
    !exactIdentity(inheritance, identity) ||
    inheritance.accountType !== 'traditional' ||
    inheritance.accountKind !== 'ira' ||
    inheritance.ownershipKind !== 'beneficiary' ||
    deathDate === null ||
    deathDate !== inheritance.deathDate ||
    deathDate > evaluationDate ||
    !nonblank(inheritance.inheritanceEvidenceId)
  ) {
    return unsupported(identity)
  }

  const basis = input.basisPoolEvidence
  if (
    basis == null ||
    typeof basis !== 'object' ||
    Array.isArray(basis)
  ) {
    return unsupported(identity)
  }
  const basisAccounts = validatedAccountSet(basis.accountIds, sourceAccountId)
  const openingBasis = safeMoney(basis.openingInheritedBasisAmount)
  const yearEndBalance = safeMoney(basis.yearEndApplicablePoolBalanceAmount)
  const line7Amount = safeMoney(basis.form8606Line7DistributionAmount)
  const line8Amount = safeMoney(basis.form8606Line8NetConversionAmount)
  if (
    basis.predicate !==
      'completeBeneficiaryTraditionalIraBasisPoolForBeneficiaryDecedentAndTaxYear' ||
    !exactPoolIdentity(basis, identity) ||
    !nonblank(basis.poolId) ||
    basisAccounts === null ||
    openingBasis === null ||
    yearEndBalance === null ||
    line7Amount === null ||
    line8Amount === null ||
    // Refused rather than characterized: a non-zero line 8 belongs to a
    // pre-election surviving spouse, whose denominator and own-pool folding
    // this module does not yet model. Answering with the conversion dropped
    // would understate ordinary income.
    !Object.is(line8Amount, 0) ||
    !nonblank(basis.evidenceId)
  ) {
    return unsupported(identity)
  }

  const rmd = input.rmdPoolEvidence
  if (
    rmd == null ||
    typeof rmd !== 'object' ||
    Array.isArray(rmd)
  ) {
    return unsupported(identity)
  }
  const rmdAccounts = validatedAccountSet(rmd.accountIds, sourceAccountId)
  const required = safeMoney(rmd.requiredAmount)
  const satisfied = safeMoney(rmd.satisfiedBeforeExecution)
  const remaining = safeMoney(rmd.remainingBeforeExecution)
  if (
    rmd.predicate !==
      'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear' ||
    rmd.actionId !== actionId ||
    rmd.allocationId !== allocationId ||
    rmd.sourceAccountId !== sourceAccountId ||
    rmd.evaluationDate !== evaluationDate ||
    !exactPoolIdentity(rmd, identity) ||
    !nonblank(rmd.poolId) ||
    rmdAccounts === null ||
    required === null ||
    satisfied === null ||
    remaining === null ||
    remaining !== Math.max(0, required - satisfied) ||
    !nonblank(rmd.evidenceId)
  ) {
    return unsupported(identity)
  }

  const annualActionSources = new Set<string>()
  if (
    new Set([
      inheritance.inheritanceEvidenceId,
      basis.evidenceId,
      rmd.evidenceId,
    ]).size !== 3 ||
    basis.poolId === rmd.poolId ||
    !Array.isArray(input.line7Distributions) ||
    input.line7Distributions.some(
      (entry) => {
        const parsedActionId = actionIdSchema.safeParse(entry?.actionId)
        const parsedSourceAccountId = accountIdSchema.safeParse(
          entry?.sourceAccountId,
        )
        if (
          entry === null ||
          typeof entry !== 'object' ||
          !parsedActionId.success ||
          !parsedSourceAccountId.success ||
          !basisAccounts.includes(parsedSourceAccountId.data)
        ) {
          return true
        }
        const actionSource = JSON.stringify([
          parsedActionId.data,
          parsedSourceAccountId.data,
        ])
        if (annualActionSources.has(actionSource)) return true
        annualActionSources.add(actionSource)
        return false
      },
    )
  ) {
    return unsupported(identity)
  }
  const currentEntries = input.line7Distributions.filter(
    (entry) => entry.actionId === actionId && entry.allocationId === allocationId,
  )
  if (
    currentEntries.length !== 1 ||
    currentEntries[0]?.sourceAccountId !== sourceAccountId ||
    currentEntries[0]?.scheduledDate !== evaluationDate ||
    currentEntries[0]?.grossAmount !== identity.executedAmount
  ) {
    return unsupported(identity)
  }

  const denominatorBig = BigInt(yearEndBalance) + BigInt(line7Amount)
  if (denominatorBig > BigInt(Number.MAX_SAFE_INTEGER)) {
    return unsupported(identity)
  }
  const denominator = asUsdCents(Number(denominatorBig))
  const numerator = asUsdCents(Math.min(openingBasis, denominator))
  const annualBasisRatio: AnnualIraBasisRatio = denominator === 0
    ? {
        representation: 'notApplicableZeroDenominator',
        numeratorMinorUnits: 0,
        denominatorMinorUnits: 0,
        intermediateArithmetic: 'notApplicable',
      }
    : {
        representation: 'exactMinorUnitRational',
        numeratorMinorUnits: numerator,
        denominatorMinorUnits: asPositiveUsdCents(denominator),
        intermediateArithmetic: 'bigintRational',
      }

  let allocation: Readonly<AnnualIraBasisAllocationEvidence>
  try {
    allocation = allocateAnnualIraBasis({
      poolId: basis.poolId,
      taxYear: identity.taxYear,
      calculationScope: 'form8606Line7Distributions',
      annualBasisRatio,
      annualGrossAmount: line7Amount,
      entries: input.line7Distributions,
    })
  } catch {
    return unsupported(identity)
  }
  if (allocation.calculationScope !== 'form8606Line7Distributions') {
    return unsupported(identity)
  }
  const annualDistributionBasisAllocation = allocation as Readonly<
    AnnualIraBasisAllocationEvidence & {
      calculationScope: 'form8606Line7Distributions'
    }
  >

  const currentAllocation = annualDistributionBasisAllocation.allocations.find(
    (entry) => entry.actionId === actionId && entry.allocationId === allocationId,
  )
  const basisRecoveredAmount = currentAllocation?.allocatedBasisAmount ?? asUsdCents(0)
  const ordinaryIncomeAmount = currentAllocation?.taxableAmount ?? asUsdCents(0)
  if (
    basisRecoveredAmount + ordinaryIncomeAmount !== identity.executedAmount ||
    (identity.executedAmount > 0 && currentAllocation === undefined)
  ) {
    return unsupported(identity)
  }

  const basisEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-basis-evidence',
    [
      actionId,
      allocationId,
      sourceAccountId,
      beneficiaryPersonId,
      decedentPersonId,
      evaluationDate,
      inheritance.inheritanceEvidenceId,
      basis.evidenceId,
      basis.poolId,
      basisAccounts,
      openingBasis,
      yearEndBalance,
      line7Amount,
      0,
      denominator,
      annualBasisRatio,
      annualDistributionBasisAllocation,
      identity.executedAmount,
      basisRecoveredAmount,
      ordinaryIncomeAmount,
    ],
  )
  if (
    new Set([
      inheritance.inheritanceEvidenceId,
      basis.evidenceId,
      rmd.evidenceId,
      allocation.allocationEvidenceId,
      basisEvidenceId,
    ]).size !== 5
  ) {
    return unsupported(identity)
  }

  const basisEvidence: BeneficiaryTraditionalIraAnnualBasisEvidence = {
    poolId: basis.poolId,
    taxYear: identity.taxYear,
    beneficiaryPersonId,
    inheritedFromPersonId: decedentPersonId,
    accountIds: basisAccounts,
    openingInheritedBasisAmount: openingBasis,
    basisNumeratorAmount: openingBasis,
    yearEndApplicablePoolBalanceAmount: yearEndBalance,
    form8606Line7DistributionAmount: line7Amount,
    form8606Line8NetConversionAmount: line8Amount,
    annualBasisDenominatorAmount: denominator,
    annualBasisRatio,
    annualDistributionBasisAllocation,
    executedAmount: identity.executedAmount,
    basisRecoveredAmount,
    ordinaryIncomeAmount,
    basisRecoveryQuantization: 'nearestCentHalfUp',
    evidenceId: basisEvidenceId,
  }
  const rmdSnapshot: BeneficiaryTraditionalIraRmdSnapshot = {
    poolId: rmd.poolId,
    taxYear: identity.taxYear,
    beneficiaryPersonId,
    inheritedFromPersonId: decedentPersonId,
    accountIds: rmdAccounts,
    requiredAmount: required,
    satisfiedBeforeExecution: satisfied,
    remainingBeforeExecution: remaining,
    evidenceId: rmd.evidenceId,
  }
  const characterEvidence = (amount: PositiveUsdCents) => ({
    rule: 'beneficiaryAnnualIraBasisAllocation' as const,
    allocationId,
    basisEvidenceId,
    allocationEvidenceId: allocation.allocationEvidenceId,
    segmentAmount: amount,
  })
  const taxCharacter: BeneficiaryTraditionalIraWithdrawalTaxCharacter[] = []
  for (const [kind, cents] of [
    ['basisReturn', basisRecoveredAmount],
    ['ordinaryIncome', ordinaryIncomeAmount],
  ] as const) {
    if (cents > 0) {
      const amount = asPositiveUsdCents(cents)
      taxCharacter.push({
        actionId,
        allocationId,
        sourceAccountId,
        sourceClass: 'beneficiaryTraditionalIra',
        kind,
        amount,
        characterEvidence: characterEvidence(amount),
      })
    }
  }

  return deepFreeze({
    status: 'accepted',
    reasons: [],
    acceptedSourceEligibility: {
      predicate: 'inheritedWithdrawalEligibility',
      allocationId,
      sourceAccountId,
      beneficiaryPersonId,
      decedentPersonId,
      evaluationDate,
      sourceClass: 'beneficiaryTraditionalIra',
      ownershipKind: 'beneficiary',
      inheritanceEvidenceId: inheritance.inheritanceEvidenceId,
      basisEvidence,
      rmdEvidence: rmdSnapshot,
    },
    taxCharacter,
  })
}
