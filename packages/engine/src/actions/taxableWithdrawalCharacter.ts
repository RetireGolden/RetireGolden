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
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { exactCentProRataNearestHalfUp } from './exactCentProRata.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import { deepFreeze } from './freeze.js'

export type TaxableWithdrawalFederalFilingStatus =
  | 'single'
  | 'marriedFilingJointly'
  | 'marriedFilingSeparately'
  | 'headOfHousehold'
  | 'qualifyingSurvivingSpouse'

export interface TaxableWithdrawalTaxUnitEvidence {
  taxUnitId: string
  taxUnitMemberPersonIds: readonly [PersonId, ...PersonId[]]
  federalFilingStatus: TaxableWithdrawalFederalFilingStatus
  stateFilingStatusId: string
  taxUnitEvidenceId: string
  taxYear: number
}

export interface IndividuallyOwnedTaxableAccountOwnershipEvidence {
  accountOwnerPersonIds: readonly [PersonId]
  accountOwnershipEvidenceId: string
  beneficialOwnershipShare: Readonly<{
    representation: 'exactRational'
    numerator: 1
    denominator: 1
    intermediateArithmetic: 'bigintRational'
  }>
  attributionEvidenceId: string
}

export interface ClassifyIndividuallyOwnedTaxableWithdrawalInput {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  actingPersonId: PersonId
  evaluationDate: string
  executedAmount: UsdCents
  preExecutionFairMarketValue: PositiveUsdCents
  remainingCostBasisBeforeExecution: UsdCents
  ownership: Readonly<IndividuallyOwnedTaxableAccountOwnershipEvidence>
  taxUnit: Readonly<TaxableWithdrawalTaxUnitEvidence>
}

export interface TaxableAccountTaxAttributionEntry {
  taxAttributionEntryId: string
  incomeRecipientPersonId: PersonId
  taxUnitId: string
  taxUnitMemberPersonIds: readonly [PersonId, ...PersonId[]]
  federalFilingStatus: TaxableWithdrawalFederalFilingStatus
  stateFilingStatusId: string
  taxUnitEvidenceId: string
  beneficialOwnershipShare: Readonly<{
    representation: 'exactRational'
    numerator: 1
    denominator: 1
    intermediateArithmetic: 'bigintRational'
  }>
  attributedGainOrLossAmount: number
  attributionEvidenceId: string
}

export interface TaxableAccountTaxAttributionEvidence {
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  taxYear: number
  accountOwnerPersonIds: readonly [PersonId]
  accountOwnershipEvidenceId: string
  allocationRule: 'recordedBeneficialOwnership'
  realizedCapitalGainOrLossAmount: number
  entries: readonly TaxableAccountTaxAttributionEntry[]
  taxAttributionEvidenceId: string
}

export interface IndividuallyOwnedTaxableWithdrawalBasisEvidence {
  method: 'planningAggregateBasisRatio'
  preExecutionFairMarketValue: PositiveUsdCents
  remainingCostBasisBeforeExecution: UsdCents
  aggregateBasisRatio: Readonly<{
    representation: 'exactMinorUnitRational'
    numeratorMinorUnits: UsdCents
    denominatorMinorUnits: PositiveUsdCents
    intermediateArithmetic: 'bigintRational'
  }>
  executedAmount: UsdCents
  basisRecoveredAmount: UsdCents
  realizedCapitalGainOrLossAmount: number
  basisRecoveryQuantization: 'nearestCentHalfUp'
  basisEvidenceId: string
  taxAttributionEvidence: Readonly<TaxableAccountTaxAttributionEvidence>
}

export interface AcceptedIndividuallyOwnedTaxableSourceEligibilityEvidence {
  predicate: 'classifyWithdrawalSource'
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  sourceClass: 'taxable'
  basisEvidence: Readonly<IndividuallyOwnedTaxableWithdrawalBasisEvidence>
}

interface TaxableWithdrawalTaxCharacterBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'taxable'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'planningAggregateBasisRatio'
    allocationId: AllocationId
    basisEvidenceId: string
    segmentAmount: PositiveUsdCents
  }>
}

export interface TaxableWithdrawalBasisReturnTaxCharacter
  extends TaxableWithdrawalTaxCharacterBase {
  kind: 'basisReturn'
  taxAttribution: null
}

export interface TaxableWithdrawalCapitalGainOrLossTaxCharacter
  extends TaxableWithdrawalTaxCharacterBase {
  kind: 'capitalGain' | 'capitalLoss'
  taxAttribution: Readonly<{
    taxAttributionEvidenceId: string
    taxAttributionEntryId: string
    incomeRecipientPersonId: PersonId
    taxUnitId: string
    taxUnitEvidenceId: string
    attributedSegmentAmount: PositiveUsdCents
  }>
}

export type IndividuallyOwnedTaxableWithdrawalTaxCharacter =
  | TaxableWithdrawalBasisReturnTaxCharacter
  | TaxableWithdrawalCapitalGainOrLossTaxCharacter

export interface ClassifyIndividuallyOwnedTaxableWithdrawalResult {
  acceptedSourceEligibility: Readonly<AcceptedIndividuallyOwnedTaxableSourceEligibilityEvidence>
  taxCharacter: readonly IndividuallyOwnedTaxableWithdrawalTaxCharacter[]
}

const filingStatuses = new Set<TaxableWithdrawalFederalFilingStatus>([
  'single',
  'marriedFilingJointly',
  'marriedFilingSeparately',
  'headOfHousehold',
  'qualifyingSurvivingSpouse',
])

function nonblankId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonblank stable identifier`)
  }
  return value
}

function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function centsFromBigInt(value: bigint): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Exact taxable character arithmetic exceeded the safe-integer range')
  }
  return asUsdCents(Number(value))
}

function signedCentsFromBigInt(value: bigint): number {
  const absolute = value < 0n ? -value : value
  if (absolute > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Signed taxable character arithmetic exceeded the safe-integer range')
  }
  return Number(value)
}

function stableId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${JSON.stringify(parts)}`
}

function validateInput(input: ClassifyIndividuallyOwnedTaxableWithdrawalInput) {
  const actionId = actionIdSchema.parse(input.actionId)
  const allocationId = allocationIdSchema.parse(input.allocationId)
  const sourceAccountId = accountIdSchema.parse(input.sourceAccountId)
  const actingPersonId = personIdSchema.parse(input.actingPersonId)
  const parsedDate = parseCivilIsoDate(input.evaluationDate)
  if (parsedDate === null) {
    throw new RangeError('Taxable withdrawal evaluation date must be a valid civil date')
  }
  const evaluationDate = formatCivilDate(parsedDate)
  const executedAmount = usdCentsSchema.parse(input.executedAmount)
  const preExecutionFairMarketValue = positiveUsdCentsSchema.parse(
    input.preExecutionFairMarketValue,
  )
  const remainingCostBasisBeforeExecution = usdCentsSchema.parse(
    input.remainingCostBasisBeforeExecution,
  )
  if (executedAmount > preExecutionFairMarketValue) {
    throw new RangeError('Taxable withdrawal execution cannot exceed pre-execution fair market value')
  }

  if (input.ownership.accountOwnerPersonIds.length !== 1) {
    throw new RangeError('Individual taxable character requires exactly one recorded owner')
  }
  const ownerPersonId = personIdSchema.parse(
    input.ownership.accountOwnerPersonIds[0],
  )
  if (actingPersonId !== ownerPersonId) {
    throw new RangeError('Acting person and recorded owner must match')
  }
  const share = input.ownership.beneficialOwnershipShare
  if (
    share.representation !== 'exactRational' ||
    !Number.isSafeInteger(share.numerator) ||
    !Number.isSafeInteger(share.denominator) ||
    share.numerator !== 1 ||
    share.denominator !== 1 ||
    share.intermediateArithmetic !== 'bigintRational'
  ) {
    throw new RangeError('Individual taxable beneficial ownership must be the exact safe-integer rational 1/1')
  }
  const accountOwnershipEvidenceId = nonblankId(
    input.ownership.accountOwnershipEvidenceId,
    'Account-ownership evidence ID',
  )
  const attributionEvidenceId = nonblankId(
    input.ownership.attributionEvidenceId,
    'Attribution evidence ID',
  )

  const taxUnitId = nonblankId(input.taxUnit.taxUnitId, 'Tax-unit ID')
  const taxUnitEvidenceId = nonblankId(
    input.taxUnit.taxUnitEvidenceId,
    'Tax-unit evidence ID',
  )
  const stateFilingStatusId = nonblankId(
    input.taxUnit.stateFilingStatusId,
    'State filing-status ID',
  )
  if (!filingStatuses.has(input.taxUnit.federalFilingStatus)) {
    throw new RangeError('Federal filing status is unsupported')
  }
  if (
    !Number.isSafeInteger(input.taxUnit.taxYear) ||
    input.taxUnit.taxYear < 1 ||
    input.taxUnit.taxYear > 9999 ||
    input.taxUnit.taxYear !== parsedDate.year
  ) {
    throw new RangeError('Tax-unit year must equal the taxable withdrawal evaluation year')
  }
  if (input.taxUnit.taxUnitMemberPersonIds.length === 0) {
    throw new RangeError('Tax-unit evidence requires at least one member')
  }
  const taxUnitMemberPersonIds = input.taxUnit.taxUnitMemberPersonIds
    .map((personId) => personIdSchema.parse(personId))
    .sort(compareUtf16CodeUnits) as [PersonId, ...PersonId[]]
  if (new Set(taxUnitMemberPersonIds).size !== taxUnitMemberPersonIds.length) {
    throw new RangeError('Tax-unit member identities must be duplicate-free')
  }
  if (!taxUnitMemberPersonIds.includes(ownerPersonId)) {
    throw new RangeError('The taxable income recipient must belong to the supplied tax unit')
  }

  return {
    actionId,
    allocationId,
    sourceAccountId,
    actingPersonId,
    evaluationDate,
    executedAmount,
    preExecutionFairMarketValue,
    remainingCostBasisBeforeExecution,
    ownership: {
      accountOwnerPersonIds: [ownerPersonId] as [PersonId],
      accountOwnershipEvidenceId,
      beneficialOwnershipShare: {
        representation: 'exactRational' as const,
        numerator: 1 as const,
        denominator: 1 as const,
        intermediateArithmetic: 'bigintRational' as const,
      },
      attributionEvidenceId,
    },
    taxUnit: {
      taxUnitId,
      taxUnitMemberPersonIds,
      federalFilingStatus: input.taxUnit.federalFilingStatus,
      stateFilingStatusId,
      taxUnitEvidenceId,
      taxYear: input.taxUnit.taxYear,
    },
  }
}

function assertResult(
  result: ClassifyIndividuallyOwnedTaxableWithdrawalResult,
): void {
  const accepted = result.acceptedSourceEligibility
  const basis = accepted.basisEvidence
  const expectedRecovered = exactCentProRataNearestHalfUp(
    BigInt(basis.executedAmount),
    BigInt(basis.aggregateBasisRatio.numeratorMinorUnits),
    BigInt(basis.aggregateBasisRatio.denominatorMinorUnits),
  )
  const expectedSigned = BigInt(basis.executedAmount) - expectedRecovered
  if (
    basis.method !== 'planningAggregateBasisRatio' ||
    basis.basisRecoveryQuantization !== 'nearestCentHalfUp' ||
    basis.aggregateBasisRatio.representation !== 'exactMinorUnitRational' ||
    basis.aggregateBasisRatio.intermediateArithmetic !== 'bigintRational' ||
    BigInt(basis.basisRecoveredAmount) !== expectedRecovered ||
    BigInt(basis.realizedCapitalGainOrLossAmount) !== expectedSigned
  ) {
    throw new Error('Taxable withdrawal basis evidence does not reconcile exactly')
  }
  const attribution = basis.taxAttributionEvidence
  if (
    attribution.allocationId !== accepted.allocationId ||
    attribution.sourceAccountId !== accepted.sourceAccountId ||
    attribution.evaluationDate !== accepted.evaluationDate ||
    attribution.realizedCapitalGainOrLossAmount !==
      basis.realizedCapitalGainOrLossAmount
  ) {
    throw new Error('Taxable attribution evidence does not bind its source character')
  }
  if (expectedSigned === 0n) {
    if (
      attribution.entries.length !== 0 ||
      result.taxCharacter.some((character) => character.kind !== 'basisReturn')
    ) {
      throw new Error('Zero taxable gain or loss cannot emit attributed character')
    }
  } else {
    const entry = attribution.entries[0]
    const capital = result.taxCharacter.filter(
      (character) => character.kind !== 'basisReturn',
    )
    if (
      attribution.entries.length !== 1 ||
      entry?.attributedGainOrLossAmount !== Number(expectedSigned) ||
      capital.length !== 1 ||
      capital[0]?.kind !== (expectedSigned > 0n ? 'capitalGain' : 'capitalLoss') ||
      capital[0].amount !== Math.abs(Number(expectedSigned)) ||
      capital[0].taxAttribution.attributedSegmentAmount !==
        Math.abs(Number(expectedSigned))
    ) {
      throw new Error('Taxable gain or loss attribution does not match the signed residual')
    }
  }
  const basisReturn = result.taxCharacter.find(
    (character) => character.kind === 'basisReturn',
  )
  if (
    (basis.basisRecoveredAmount === 0 && basisReturn !== undefined) ||
    (basis.basisRecoveredAmount > 0 &&
      (basisReturn === undefined ||
        basisReturn.amount !== basis.basisRecoveredAmount ||
        basisReturn.taxAttribution !== null))
  ) {
    throw new Error('Taxable basis-return character does not match recovered basis')
  }
  const characterTotal = result.taxCharacter.reduce((total, character) => {
    if (character.kind === 'capitalLoss') return total - BigInt(character.amount)
    return total + BigInt(character.amount)
  }, 0n)
  if (characterTotal !== BigInt(basis.executedAmount)) {
    throw new Error('Taxable character cents do not reconcile to executed principal')
  }
}

/**
 * Pure exact-cent classifier for one individually owned taxable-account sale.
 * It characterizes principal only and never moves a balance or mutates basis.
 */
export function classifyIndividuallyOwnedTaxableWithdrawal(
  input: ClassifyIndividuallyOwnedTaxableWithdrawalInput,
): Readonly<ClassifyIndividuallyOwnedTaxableWithdrawalResult> {
  const value = validateInput(input)
  const recoveredBigInt = exactCentProRataNearestHalfUp(
    BigInt(value.executedAmount),
    BigInt(value.remainingCostBasisBeforeExecution),
    BigInt(value.preExecutionFairMarketValue),
  )
  const basisRecoveredAmount = centsFromBigInt(recoveredBigInt)
  const signedAmount = signedCentsFromBigInt(
    BigInt(value.executedAmount) - recoveredBigInt,
  )
  const basisEvidenceId = stableId('taxable-basis', [
    value.actionId,
    value.allocationId,
    value.sourceAccountId,
    value.actingPersonId,
    value.evaluationDate,
    value.executedAmount,
    value.preExecutionFairMarketValue,
    value.remainingCostBasisBeforeExecution,
    value.ownership.accountOwnershipEvidenceId,
    value.ownership.attributionEvidenceId,
    value.taxUnit.taxUnitId,
    value.taxUnit.taxUnitMemberPersonIds,
    value.taxUnit.federalFilingStatus,
    value.taxUnit.stateFilingStatusId,
    value.taxUnit.taxUnitEvidenceId,
  ])
  const taxAttributionEvidenceId = stableId('taxable-tax-attribution', [
    basisEvidenceId,
    value.allocationId,
    value.sourceAccountId,
    value.evaluationDate,
    value.taxUnit.taxYear,
  ])

  const entries: TaxableAccountTaxAttributionEntry[] = []
  if (signedAmount !== 0) {
    entries.push({
      taxAttributionEntryId: stableId('taxable-tax-attribution-entry', [
        taxAttributionEvidenceId,
        value.ownership.accountOwnerPersonIds[0],
        value.taxUnit.taxUnitId,
      ]),
      incomeRecipientPersonId: value.ownership.accountOwnerPersonIds[0],
      taxUnitId: value.taxUnit.taxUnitId,
      taxUnitMemberPersonIds: value.taxUnit.taxUnitMemberPersonIds,
      federalFilingStatus: value.taxUnit.federalFilingStatus,
      stateFilingStatusId: value.taxUnit.stateFilingStatusId,
      taxUnitEvidenceId: value.taxUnit.taxUnitEvidenceId,
      beneficialOwnershipShare: value.ownership.beneficialOwnershipShare,
      attributedGainOrLossAmount: signedAmount,
      attributionEvidenceId: value.ownership.attributionEvidenceId,
    })
  }
  const taxAttributionEvidence: TaxableAccountTaxAttributionEvidence = {
    allocationId: value.allocationId,
    sourceAccountId: value.sourceAccountId,
    evaluationDate: value.evaluationDate,
    taxYear: value.taxUnit.taxYear,
    accountOwnerPersonIds: value.ownership.accountOwnerPersonIds,
    accountOwnershipEvidenceId: value.ownership.accountOwnershipEvidenceId,
    allocationRule: 'recordedBeneficialOwnership',
    realizedCapitalGainOrLossAmount: signedAmount,
    entries,
    taxAttributionEvidenceId,
  }
  const basisEvidence: IndividuallyOwnedTaxableWithdrawalBasisEvidence = {
    method: 'planningAggregateBasisRatio',
    preExecutionFairMarketValue: value.preExecutionFairMarketValue,
    remainingCostBasisBeforeExecution:
      value.remainingCostBasisBeforeExecution,
    aggregateBasisRatio: {
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: value.remainingCostBasisBeforeExecution,
      denominatorMinorUnits: value.preExecutionFairMarketValue,
      intermediateArithmetic: 'bigintRational',
    },
    executedAmount: value.executedAmount,
    basisRecoveredAmount,
    realizedCapitalGainOrLossAmount: signedAmount,
    basisRecoveryQuantization: 'nearestCentHalfUp',
    basisEvidenceId,
    taxAttributionEvidence,
  }
  const characterEvidence = (amount: PositiveUsdCents) => ({
    rule: 'planningAggregateBasisRatio' as const,
    allocationId: value.allocationId,
    basisEvidenceId,
    segmentAmount: amount,
  })
  const taxCharacter: IndividuallyOwnedTaxableWithdrawalTaxCharacter[] = []
  if (basisRecoveredAmount > 0) {
    const amount = asPositiveUsdCents(basisRecoveredAmount)
    taxCharacter.push({
      actionId: value.actionId,
      allocationId: value.allocationId,
      sourceAccountId: value.sourceAccountId,
      sourceClass: 'taxable',
      kind: 'basisReturn',
      amount,
      taxAttribution: null,
      characterEvidence: characterEvidence(amount),
    })
  }
  if (signedAmount !== 0) {
    const entry = entries[0]!
    const amount = asPositiveUsdCents(Math.abs(signedAmount))
    taxCharacter.push({
      actionId: value.actionId,
      allocationId: value.allocationId,
      sourceAccountId: value.sourceAccountId,
      sourceClass: 'taxable',
      kind: signedAmount > 0 ? 'capitalGain' : 'capitalLoss',
      amount,
      taxAttribution: {
        taxAttributionEvidenceId,
        taxAttributionEntryId: entry.taxAttributionEntryId,
        incomeRecipientPersonId: entry.incomeRecipientPersonId,
        taxUnitId: entry.taxUnitId,
        taxUnitEvidenceId: entry.taxUnitEvidenceId,
        attributedSegmentAmount: amount,
      },
      characterEvidence: characterEvidence(amount),
    })
  }

  const result: ClassifyIndividuallyOwnedTaxableWithdrawalResult = {
    acceptedSourceEligibility: {
      predicate: 'classifyWithdrawalSource',
      allocationId: value.allocationId,
      sourceAccountId: value.sourceAccountId,
      evaluationDate: value.evaluationDate,
      sourceClass: 'taxable',
      basisEvidence,
    },
    taxCharacter,
  }
  assertResult(result)
  return deepFreeze(result)
}
