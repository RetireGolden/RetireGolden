import {
  accountIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  allocateAnnualIraBasis,
  type AnnualIraBasisAllocationEntryInput,
  type AnnualIraBasisAllocationEvidence,
  type AnnualIraBasisRatio,
} from './annualIraBasisAllocation.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'

export type OwnedNonRothIraSubtype = 'traditional' | 'sep' | 'simple'

export interface OwnedNonRothIraPoolMemberEvidence {
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  accountType: 'traditional'
  accountKind: 'ira'
  inheritanceStatus: 'owned'
  subtype: OwnedNonRothIraSubtype
  yearEndApplicableBalanceAmount: UsdCents
  iraClassificationEvidenceId: string
  accountOwnershipEvidenceId: string
}

export interface CompleteOwnedNonRothIraPoolEvidence {
  predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear'
  ownerPersonId: PersonId
  ownerWideNonRothIraPoolId: string
  taxYear: number
  accountIds: readonly [AccountId, ...AccountId[]]
  yearEndApplicablePoolBalanceAmount: UsdCents
  evidenceId: string
}

export interface OwnedNonRothIraAnnualFacts {
  openingBasisAmount: UsdCents
  taxYearNondeductibleContributionAmount: UsdCents
  postYearNondeductibleContributionExcludedAmount: UsdCents
  yearEndApplicablePoolBalanceAmount: UsdCents
  outstandingRolloverAmount: UsdCents
  rolloverRepaymentAdjustmentAmount: UsdCents
  form8606Line7DistributionAmount: UsdCents
  form8606Line8NetConversionAmount: UsdCents
}

export interface ClassifyOwnedNonRothIraAnnualWithdrawalsInput {
  ownerPersonId: PersonId
  ownerWideNonRothIraPoolId: string
  completePoolEvidence: Readonly<CompleteOwnedNonRothIraPoolEvidence>
  annualBasisRecordEvidenceId: string
  taxYear: number
  poolMembers: readonly Readonly<OwnedNonRothIraPoolMemberEvidence>[]
  annualFacts: Readonly<OwnedNonRothIraAnnualFacts>
  line7Distributions:
    readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
  line8Conversions:
    readonly Readonly<AnnualIraBasisAllocationEntryInput>[]
}

export interface OwnedNonRothIraAnnualBasisEvidence
  extends OwnedNonRothIraAnnualFacts {
  ownerPersonId: PersonId
  ownerWideNonRothIraPoolId: string
  completePoolEvidence: Readonly<CompleteOwnedNonRothIraPoolEvidence>
  annualBasisRecordEvidenceId: string
  taxYear: number
  poolMembers: readonly Readonly<OwnedNonRothIraPoolMemberEvidence>[]
  basisNumeratorAmount: UsdCents
  line6AdjustedYearEndAndRolloverAmount: UsdCents
  annualBasisDenominatorAmount: UsdCents
  annualBasisRatio: Readonly<AnnualIraBasisRatio>
  basisEvidenceId: string
}

interface OwnedNonRothIraWithdrawalTaxCharacterBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'ownedNonRothIra'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'ownerWideAnnualIraBasisAllocation'
    allocationId: AllocationId
    basisEvidenceId: string
    allocationEvidenceId: string
    segmentAmount: PositiveUsdCents
  }>
}

export interface OwnedNonRothIraBasisReturnTaxCharacter
  extends OwnedNonRothIraWithdrawalTaxCharacterBase {
  kind: 'basisReturn'
}

export interface OwnedNonRothIraOrdinaryIncomeTaxCharacter
  extends OwnedNonRothIraWithdrawalTaxCharacterBase {
  kind: 'ordinaryIncome'
}

export type OwnedNonRothIraWithdrawalTaxCharacter =
  | OwnedNonRothIraBasisReturnTaxCharacter
  | OwnedNonRothIraOrdinaryIncomeTaxCharacter

export interface OwnedNonRothIraWithdrawalClassification {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  subtype: OwnedNonRothIraSubtype
  executedAmount: PositiveUsdCents
  basisRecoveredAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  taxCharacter: readonly Readonly<OwnedNonRothIraWithdrawalTaxCharacter>[]
}

export interface ClassifyOwnedNonRothIraAnnualWithdrawalsResult {
  annualBasisEvidence: Readonly<OwnedNonRothIraAnnualBasisEvidence>
  line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  withdrawals: readonly Readonly<OwnedNonRothIraWithdrawalClassification>[]
}

function nonblankId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonblank stable identifier`)
  }
  return value
}

function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
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

function stableId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${JSON.stringify(parts)}`
}

function centsFromBigInt(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(`${label} exceeded the safe-integer range`)
  }
  return asUsdCents(Number(value))
}

function validatePoolMembers(
  members: readonly Readonly<OwnedNonRothIraPoolMemberEvidence>[],
  ownerPersonId: PersonId,
): OwnedNonRothIraPoolMemberEvidence[] {
  if (members.length === 0) {
    throw new RangeError('An owned non-Roth IRA pool requires at least one account')
  }
  const accountIds = new Set<AccountId>()
  const classificationIds = new Set<string>()
  const ownershipIds = new Set<string>()
  return members
    .map((member): OwnedNonRothIraPoolMemberEvidence => {
      const sourceAccountId = accountIdSchema.parse(member.sourceAccountId)
      const memberOwnerPersonId = personIdSchema.parse(member.ownerPersonId)
      if (memberOwnerPersonId !== ownerPersonId) {
        throw new RangeError('Every owned non-Roth IRA pool member must share its owner')
      }
      if (
        member.accountType !== 'traditional' ||
        member.accountKind !== 'ira' ||
        member.inheritanceStatus !== 'owned' ||
        !(['traditional', 'sep', 'simple'] as const).includes(member.subtype)
      ) {
        throw new RangeError(
          'Owned non-Roth IRA pool members must be owned traditional, SEP, or SIMPLE IRAs',
        )
      }
      const iraClassificationEvidenceId = nonblankId(
        member.iraClassificationEvidenceId,
        'IRA-classification evidence ID',
      )
      const accountOwnershipEvidenceId = nonblankId(
        member.accountOwnershipEvidenceId,
        'Account-ownership evidence ID',
      )
      if (accountIds.has(sourceAccountId)) {
        throw new RangeError('Owned non-Roth IRA pool account IDs must be unique')
      }
      if (classificationIds.has(iraClassificationEvidenceId)) {
        throw new RangeError('IRA-classification evidence IDs must be unique')
      }
      if (ownershipIds.has(accountOwnershipEvidenceId)) {
        throw new RangeError('Account-ownership evidence IDs must be unique')
      }
      accountIds.add(sourceAccountId)
      classificationIds.add(iraClassificationEvidenceId)
      ownershipIds.add(accountOwnershipEvidenceId)
      return {
        sourceAccountId,
        ownerPersonId: memberOwnerPersonId,
        accountType: 'traditional',
        accountKind: 'ira',
        inheritanceStatus: 'owned',
        subtype: member.subtype,
        yearEndApplicableBalanceAmount: usdCentsSchema.parse(
          member.yearEndApplicableBalanceAmount,
        ),
        iraClassificationEvidenceId,
        accountOwnershipEvidenceId,
      }
    })
    .sort((left, right) =>
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
    )
}

function sumActivity(
  entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[],
  label: string,
): UsdCents {
  const total = entries.reduce(
    (sum, entry) => sum + BigInt(usdCentsSchema.parse(entry.grossAmount)),
    0n,
  )
  return centsFromBigInt(total, label)
}

/**
 * Builds complete annual owned-IRA Form 8606 evidence and derives line-7
 * withdrawal character. It is a pure evidence boundary: it does not establish
 * source eligibility, calculate penalties, or move balances.
 */
export function classifyOwnedNonRothIraAnnualWithdrawals(
  input: Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>,
): Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsResult> {
  const ownerPersonId = personIdSchema.parse(input.ownerPersonId)
  const ownerWideNonRothIraPoolId = nonblankId(
    input.ownerWideNonRothIraPoolId,
    'Owner-wide non-Roth IRA pool ID',
  )
  const annualBasisRecordEvidenceId = nonblankId(
    input.annualBasisRecordEvidenceId,
    'Annual IRA basis-record evidence ID',
  )
  if (
    !Number.isSafeInteger(input.taxYear) ||
    input.taxYear < 1 ||
    input.taxYear > 9999
  ) {
    throw new RangeError('Owned non-Roth IRA tax year must be a four-digit year')
  }
  const poolMembers = validatePoolMembers(input.poolMembers, ownerPersonId)
  const completePoolEvidenceId = nonblankId(
    input.completePoolEvidence.evidenceId,
    'Complete IRA pool evidence ID',
  )
  if (
    input.completePoolEvidence.predicate !==
      'completeOwnedNonRothIraPoolForOwnerAndTaxYear' ||
    personIdSchema.parse(input.completePoolEvidence.ownerPersonId) !==
      ownerPersonId ||
    nonblankId(
      input.completePoolEvidence.ownerWideNonRothIraPoolId,
      'Complete IRA pool ID',
    ) !== ownerWideNonRothIraPoolId ||
    input.completePoolEvidence.taxYear !== input.taxYear
  ) {
    throw new RangeError(
      'Complete IRA pool evidence must bind the classifier owner, pool, and tax year',
    )
  }
  const completePoolAccountIds = input.completePoolEvidence.accountIds
    .map((accountId) => accountIdSchema.parse(accountId))
    .sort(compareUtf16CodeUnits)
  if (
    completePoolAccountIds.length === 0 ||
    new Set(completePoolAccountIds).size !== completePoolAccountIds.length ||
    JSON.stringify(completePoolAccountIds) !==
      JSON.stringify(poolMembers.map((member) => member.sourceAccountId))
  ) {
    throw new RangeError(
      'Complete IRA pool evidence account set must exactly match the classified members',
    )
  }
  const completePoolYearEndAmount = usdCentsSchema.parse(
    input.completePoolEvidence.yearEndApplicablePoolBalanceAmount,
  )
  const memberYearEndAmount = centsFromBigInt(
    poolMembers.reduce(
      (sum, member) => sum + BigInt(member.yearEndApplicableBalanceAmount),
      0n,
    ),
    'Complete IRA pool member balances',
  )
  if (memberYearEndAmount !== completePoolYearEndAmount) {
    throw new RangeError(
      'Complete IRA pool member balances must equal its authoritative aggregate',
    )
  }
  const completePoolEvidence: CompleteOwnedNonRothIraPoolEvidence = {
    predicate: 'completeOwnedNonRothIraPoolForOwnerAndTaxYear',
    ownerPersonId,
    ownerWideNonRothIraPoolId,
    taxYear: input.taxYear,
    accountIds: completePoolAccountIds as [AccountId, ...AccountId[]],
    yearEndApplicablePoolBalanceAmount: completePoolYearEndAmount,
    evidenceId: completePoolEvidenceId,
  }
  const poolMemberById = new Map(
    poolMembers.map((member) => [member.sourceAccountId, member]),
  )

  const openingBasisAmount = usdCentsSchema.parse(
    input.annualFacts.openingBasisAmount,
  )
  const taxYearNondeductibleContributionAmount = usdCentsSchema.parse(
    input.annualFacts.taxYearNondeductibleContributionAmount,
  )
  const postYearNondeductibleContributionExcludedAmount = usdCentsSchema.parse(
    input.annualFacts.postYearNondeductibleContributionExcludedAmount,
  )
  if (
    postYearNondeductibleContributionExcludedAmount >
    taxYearNondeductibleContributionAmount
  ) {
    throw new RangeError(
      'Post-year excluded IRA contributions cannot exceed tax-year nondeductible contributions',
    )
  }
  const yearEndApplicablePoolBalanceAmount = usdCentsSchema.parse(
    input.annualFacts.yearEndApplicablePoolBalanceAmount,
  )
  if (yearEndApplicablePoolBalanceAmount !== completePoolYearEndAmount) {
    throw new RangeError(
      'Annual IRA basis facts must match the complete pool year-end aggregate',
    )
  }
  const outstandingRolloverAmount = usdCentsSchema.parse(
    input.annualFacts.outstandingRolloverAmount,
  )
  const rolloverRepaymentAdjustmentAmount = usdCentsSchema.parse(
    input.annualFacts.rolloverRepaymentAdjustmentAmount,
  )
  const yearEndAndRollover =
    BigInt(yearEndApplicablePoolBalanceAmount) +
    BigInt(outstandingRolloverAmount)
  if (BigInt(rolloverRepaymentAdjustmentAmount) > yearEndAndRollover) {
    throw new RangeError(
      'IRA rollover repayment adjustment cannot exceed year-end value plus rollovers',
    )
  }
  const form8606Line7DistributionAmount = usdCentsSchema.parse(
    input.annualFacts.form8606Line7DistributionAmount,
  )
  const form8606Line8NetConversionAmount = usdCentsSchema.parse(
    input.annualFacts.form8606Line8NetConversionAmount,
  )
  if (
    sumActivity(input.line7Distributions, 'Form 8606 line-7 activity') !==
    form8606Line7DistributionAmount
  ) {
    throw new RangeError(
      'Complete line-7 activity must equal the Form 8606 line-7 amount',
    )
  }
  if (
    sumActivity(input.line8Conversions, 'Form 8606 line-8 activity') !==
    form8606Line8NetConversionAmount
  ) {
    throw new RangeError(
      'Complete line-8 activity must equal the Form 8606 line-8 amount',
    )
  }

  const activityIdentities = new Set<string>()
  const activitySourcesByAction = new Set<string>()
  const activityScopeByAction = new Map<ActionId, 'line7' | 'line8'>()
  const activitySlotByAction = new Map<ActionId, string>()
  const activityActionBySlot = new Map<string, ActionId>()
  const scopedActivity = [
    ...input.line7Distributions.map((entry) => ({ entry, scope: 'line7' as const })),
    ...input.line8Conversions.map((entry) => ({ entry, scope: 'line8' as const })),
  ]
  for (const { entry, scope } of scopedActivity) {
    const sourceAccountId = accountIdSchema.parse(entry.sourceAccountId)
    if (!poolMemberById.has(sourceAccountId)) {
      throw new RangeError(
        'Every annual IRA activity source must belong to the owner-wide pool',
      )
    }
    const identity = JSON.stringify([entry.actionId, entry.allocationId])
    if (activityIdentities.has(identity)) {
      throw new RangeError(
        'An IRA action allocation cannot appear in both annual line ledgers',
      )
    }
    activityIdentities.add(identity)
    const sourceIdentity = JSON.stringify([entry.actionId, sourceAccountId])
    if (activitySourcesByAction.has(sourceIdentity)) {
      throw new RangeError(
        'One IRA action cannot allocate the same source account more than once',
      )
    }
    activitySourcesByAction.add(sourceIdentity)
    const existingScope = activityScopeByAction.get(entry.actionId)
    if (existingScope !== undefined && existingScope !== scope) {
      throw new RangeError(
        'One IRA action cannot appear in both annual line scopes',
      )
    }
    activityScopeByAction.set(entry.actionId, scope)
    const slot = JSON.stringify([entry.scheduledDate, entry.scheduledSequence])
    const existingActionSlot = activitySlotByAction.get(entry.actionId)
    if (existingActionSlot !== undefined && existingActionSlot !== slot) {
      throw new RangeError(
        'Every allocation from one IRA action must share its schedule position',
      )
    }
    activitySlotByAction.set(entry.actionId, slot)
    const existingSlotAction = activityActionBySlot.get(slot)
    if (existingSlotAction !== undefined && existingSlotAction !== entry.actionId) {
      throw new RangeError(
        'Different IRA actions cannot occupy the same annual schedule position',
      )
    }
    activityActionBySlot.set(slot, entry.actionId)
  }

  const basisNumeratorAmount = centsFromBigInt(
    BigInt(openingBasisAmount) +
      BigInt(taxYearNondeductibleContributionAmount) -
      BigInt(postYearNondeductibleContributionExcludedAmount),
    'Annual IRA basis numerator',
  )
  const line6AdjustedYearEndAndRolloverAmount = centsFromBigInt(
    yearEndAndRollover - BigInt(rolloverRepaymentAdjustmentAmount),
    'IRA adjusted line-6 amount',
  )
  const annualBasisDenominatorAmount = centsFromBigInt(
    BigInt(line6AdjustedYearEndAndRolloverAmount) +
      BigInt(form8606Line7DistributionAmount) +
      BigInt(form8606Line8NetConversionAmount),
    'Annual IRA basis denominator',
  )
  const annualBasisRatio: AnnualIraBasisRatio =
    annualBasisDenominatorAmount === 0
      ? {
          representation: 'notApplicableZeroDenominator',
          numeratorMinorUnits: 0,
          denominatorMinorUnits: 0,
          intermediateArithmetic: 'notApplicable',
        }
      : {
          representation: 'exactMinorUnitRational',
          numeratorMinorUnits: asUsdCents(
            Math.min(basisNumeratorAmount, annualBasisDenominatorAmount),
          ),
          denominatorMinorUnits: asPositiveUsdCents(
            annualBasisDenominatorAmount,
          ),
          intermediateArithmetic: 'bigintRational',
        }

  const annualFacts: OwnedNonRothIraAnnualFacts = {
    openingBasisAmount,
    taxYearNondeductibleContributionAmount,
    postYearNondeductibleContributionExcludedAmount,
    yearEndApplicablePoolBalanceAmount,
    outstandingRolloverAmount,
    rolloverRepaymentAdjustmentAmount,
    form8606Line7DistributionAmount,
    form8606Line8NetConversionAmount,
  }
  const basisEvidenceId = stableId('owned-non-roth-ira-annual-basis', [
    ownerPersonId,
    ownerWideNonRothIraPoolId,
    completePoolEvidence,
    annualBasisRecordEvidenceId,
    input.taxYear,
    poolMembers,
    annualFacts,
    basisNumeratorAmount,
    line6AdjustedYearEndAndRolloverAmount,
    annualBasisDenominatorAmount,
    annualBasisRatio,
  ])
  const annualBasisEvidence: OwnedNonRothIraAnnualBasisEvidence = {
    ownerPersonId,
    ownerWideNonRothIraPoolId,
    completePoolEvidence,
    annualBasisRecordEvidenceId,
    taxYear: input.taxYear,
    poolMembers,
    ...annualFacts,
    basisNumeratorAmount,
    line6AdjustedYearEndAndRolloverAmount,
    annualBasisDenominatorAmount,
    annualBasisRatio,
    basisEvidenceId,
  }

  const line8AllocationEvidence = allocateAnnualIraBasis({
    poolId: ownerWideNonRothIraPoolId,
    taxYear: input.taxYear,
    calculationScope: 'form8606Line8NetConversions',
    annualBasisRatio,
    annualGrossAmount: form8606Line8NetConversionAmount,
    entries: input.line8Conversions,
  })
  const line7AllocationEvidence = allocateAnnualIraBasis({
    poolId: ownerWideNonRothIraPoolId,
    taxYear: input.taxYear,
    calculationScope: 'form8606Line7Distributions',
    annualBasisRatio,
    annualGrossAmount: form8606Line7DistributionAmount,
    entries: input.line7Distributions,
  })
  if (
    BigInt(line7AllocationEvidence.annualNontaxableBasisAmount) +
      BigInt(line8AllocationEvidence.annualNontaxableBasisAmount) >
    BigInt(basisNumeratorAmount)
  ) {
    throw new RangeError(
      'Independent Form 8606 line rounding cannot recover more than annual IRA basis',
    )
  }

  const withdrawals: OwnedNonRothIraWithdrawalClassification[] =
    line7AllocationEvidence.allocations.map((entry) => {
      const member = poolMemberById.get(entry.sourceAccountId)
      if (member === undefined) {
        throw new Error('Canonical IRA allocation lost its pool-member binding')
      }
      const taxCharacter: OwnedNonRothIraWithdrawalTaxCharacter[] = []
      if (entry.allocatedBasisAmount > 0) {
        const amount = asPositiveUsdCents(entry.allocatedBasisAmount)
        taxCharacter.push({
          actionId: entry.actionId,
          allocationId: entry.allocationId,
          sourceAccountId: entry.sourceAccountId,
          sourceClass: 'ownedNonRothIra',
          kind: 'basisReturn',
          amount,
          characterEvidence: {
            rule: 'ownerWideAnnualIraBasisAllocation',
            allocationId: entry.allocationId,
            basisEvidenceId,
            allocationEvidenceId:
              line7AllocationEvidence.allocationEvidenceId,
            segmentAmount: amount,
          },
        })
      }
      if (entry.taxableAmount > 0) {
        const amount = asPositiveUsdCents(entry.taxableAmount)
        taxCharacter.push({
          actionId: entry.actionId,
          allocationId: entry.allocationId,
          sourceAccountId: entry.sourceAccountId,
          sourceClass: 'ownedNonRothIra',
          kind: 'ordinaryIncome',
          amount,
          characterEvidence: {
            rule: 'ownerWideAnnualIraBasisAllocation',
            allocationId: entry.allocationId,
            basisEvidenceId,
            allocationEvidenceId:
              line7AllocationEvidence.allocationEvidenceId,
            segmentAmount: amount,
          },
        })
      }
      const characterTotal = taxCharacter.reduce(
        (sum, character) => sum + BigInt(character.amount),
        0n,
      )
      if (characterTotal !== BigInt(entry.grossAmount)) {
        throw new Error('Owned non-Roth IRA character does not reconcile to gross')
      }
      return {
        actionId: entry.actionId,
        allocationId: entry.allocationId,
        sourceAccountId: entry.sourceAccountId,
        subtype: member.subtype,
        executedAmount: entry.grossAmount,
        basisRecoveredAmount: entry.allocatedBasisAmount,
        ordinaryIncomeAmount: entry.taxableAmount,
        taxCharacter,
      }
    })

  return deepFreeze({
    annualBasisEvidence,
    line7AllocationEvidence,
    line8AllocationEvidence,
    withdrawals,
  })
}
