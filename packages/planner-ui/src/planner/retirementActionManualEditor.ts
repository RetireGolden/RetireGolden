import type {
  LegacyAggregateRetirementActionRequest,
  RetirementActionRequest,
} from '@retiregolden/engine/actions/contract'
import type {
  RetirementActionCandidateIdentityIntent,
} from '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
import {
  asAccountId,
  asPersonId,
  type AccountId,
  type PersonId,
} from '@retiregolden/engine/actions/identity'
import { asPositiveUsdCents, asUsdCents } from '@retiregolden/engine/actions/money'
import {
  assessOrdinaryWithdrawalPlanBoundary,
  executeOrdinaryWithdrawals,
  type TaxableAccountOpeningSnapshot,
} from '@retiregolden/engine/actions/execution'
import {
  ledgerCentTotalToPlanDollars,
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '@retiregolden/engine/actions/planBalanceAdapter'
import { addCalendarMonths, parseCivilIsoDate } from '@retiregolden/engine/actions/civilDate'
import type { Plan } from '@retiregolden/engine/model/plan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import type { TaxCalculator } from '@retiregolden/engine/projection/types'
import type {
  NonpersistedActionPersonAliveEvidence,
} from '@retiregolden/engine/strategies/accountEligibility'

export type EditableMigratedRetirementAction = Extract<
  LegacyAggregateRetirementActionRequest,
  { kind: 'legacyAggregateWithdrawal' | 'legacyAggregateRothConversion' }
>

export type MigratedRetirementActionNeedingReview =
  LegacyAggregateRetirementActionRequest

export type WithdrawalPurposeChoice = '' | 'spending' | 'goal' | 'taxPayment' | 'other'
export type ConversionTaxFundingChoice =
  | ''
  | 'externalCash'
  | 'noneExpected'
  | 'conversionPrincipalWithholding'

export const RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY =
  'Roth-conversion review cannot be completed until canonical conversion movement is executable. This migrated conversion remains under review.'

/**
 * Every blank is intentional. A migrated aggregate action has no trustworthy
 * person/account/date/sequence identity to seed these controls from.
 */
export interface RetirementActionManualEditorDraft {
  personId: string
  sourceAccountId: string
  destinationRothAccountId: string
  executionDate: string
  executionSequence: string
  withdrawalPurpose: WithdrawalPurposeChoice
  conversionTaxFunding: ConversionTaxFundingChoice
  taxFundingAmountDollars: number | null
  externalCashAttested: boolean
  fullSourceAmountConfirmed: boolean
}

export const emptyRetirementActionManualEditorDraft =
  (): RetirementActionManualEditorDraft => ({
    personId: '',
    sourceAccountId: '',
    destinationRothAccountId: '',
    executionDate: '',
    executionSequence: '',
    withdrawalPurpose: '',
    conversionTaxFunding: '',
    taxFundingAmountDollars: null,
    externalCashAttested: false,
    fullSourceAmountConfirmed: false,
  })

export type BuildRetirementActionManualIntentResult =
  | Readonly<{
      ok: true
      intent: Readonly<RetirementActionCandidateIdentityIntent>
    }>
  | Readonly<{
      ok: false
      issues: readonly string[]
    }>

export function migratedRetirementActionsNeedingReview(
  plan: Readonly<Plan>,
): readonly MigratedRetirementActionNeedingReview[] {
  return plan.strategies.retirementActions.filter(
    (action): action is LegacyAggregateRetirementActionRequest =>
      action.provenance.source === 'migration' &&
      (
        action.kind === 'legacyAggregateWithdrawal' ||
        action.kind === 'legacyAggregateRothConversion' ||
        action.kind === 'legacyAggregateQcd'
      ),
  )
}

export function exactExecutionSequence(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null
  const sequence = Number(value)
  return Number.isSafeInteger(sequence) ? sequence : null
}

export function exactDateForYear(value: string, year: number): boolean {
  return parseCivilIsoDate(value)?.year === year
}

export function executionSlotAlreadyUsed(
  targetActionId: string,
  preservedActions: readonly RetirementActionRequest[],
  executionDate: string,
  executionSequence: number,
): boolean {
  return preservedActions.some((action) =>
    action.actionId !== targetActionId &&
    (
      action.kind === 'ordinaryWithdrawal' ||
      action.kind === 'rothConversion' ||
      action.kind === 'qcd'
    ) &&
    action.executionDate === executionDate &&
    action.executionSequence === executionSequence,
  )
}

type ManualSourceSupportPlan = Readonly<
  Pick<Plan, 'accounts' | 'household' | 'retirementActionEligibilityFacts'>
>

function projectedLastAliveYear(person: Plan['household']['people'][number]): number {
  return Number(person.dob.slice(0, 4)) + person.longevity.planningAge
}

export function retirementActionManualPersonSupportIssue(
  person: Plan['household']['people'][number],
  actionYear: number,
): string | null {
  const lastAliveYear = projectedLastAliveYear(person)
  return actionYear <= lastAliveYear
    ? null
    : `${person.name} (ID ${person.id}) is not modeled alive in ${actionYear}; their last modeled-alive year is ${lastAliveYear}.`
}

function projectedFilingStatus(
  plan: ManualSourceSupportPlan,
  actionYear: number,
  aliveCount: number,
): 'single' | 'marriedFilingJointly' | 'qualifyingSurvivingSpouse' {
  if (plan.household.filingStatus !== 'marriedFilingJointly') return 'single'
  if (aliveCount >= 2) return 'marriedFilingJointly'
  if (
    aliveCount === 1 &&
    plan.household.people.length === 2 &&
    plan.household.hasQualifyingDependent
  ) {
    const firstDeathYear = Math.min(...plan.household.people.map(projectedLastAliveYear))
    if (actionYear > firstDeathYear && actionYear <= firstDeathYear + 2) {
      return 'qualifyingSurvivingSpouse'
    }
  }
  return 'single'
}

function projectedTaxUnit(
  plan: ManualSourceSupportPlan,
  actionYear: number,
): Readonly<{
  memberPersonIds: readonly [PersonId, ...PersonId[]]
  filingStatus: ReturnType<typeof projectedFilingStatus>
}> | null {
  const alivePeople = plan.household.people.filter(
    (person) => retirementActionManualPersonSupportIssue(person, actionYear) === null,
  )
  let memberPersonIds: PersonId[]
  try {
    memberPersonIds = alivePeople
      .map((person) => asPersonId(person.id))
      .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
  } catch {
    return null
  }
  const filingStatus = projectedFilingStatus(plan, actionYear, alivePeople.length)
  const unambiguous =
    (filingStatus === 'marriedFilingJointly' && alivePeople.length === 2) ||
    (
      (filingStatus === 'single' || filingStatus === 'qualifyingSurvivingSpouse') &&
      alivePeople.length === 1
    )
  return unambiguous
    ? {
        memberPersonIds: memberPersonIds as [PersonId, ...PersonId[]],
        filingStatus,
      }
    : null
}

function hasUnambiguousProjectedTaxUnit(
  plan: ManualSourceSupportPlan,
  actionYear: number,
): boolean {
  return projectedTaxUnit(plan, actionYear) !== null
}

/**
 * Preview every action in the replacement's year through the canonical exact-
 * cent executor. This catches chronology, proportional taxable-basis rounding,
 * and annual Plan-number totals before the migrated row is removed.
 */
export function retirementActionManualExecutionIssue(
  plan: Readonly<Plan>,
  replacementActionId: string,
  projectionStartYear: number,
  taxCalculator: TaxCalculator,
): string | null {
  const replacements = plan.strategies.retirementActions.filter(
    (action) => action.actionId === replacementActionId,
  )
  if (replacements.length !== 1 || replacements[0]!.kind !== 'ordinaryWithdrawal') {
    return 'The reviewed replacement could not be identified for exact-cent execution preview.'
  }
  const replacement = replacements[0]!
  const requests = plan.strategies.retirementActions.filter(
    (action) => action.year === replacement.year,
  )
  const openingBalances = plan.accounts.flatMap((account) => {
    if (
      account.type !== 'cash' &&
      account.type !== 'taxable' &&
      account.type !== 'equityComp'
    ) return []
    try {
      return [{
        accountId: asAccountId(account.id),
        openingBalance: planDollarsToLedgerCents(account.balance),
      }]
    } catch {
      return []
    }
  })

  const taxUnit = projectedTaxUnit(plan, replacement.year)
  const taxableAccountSnapshots: TaxableAccountOpeningSnapshot[] =
    taxUnit === null
      ? []
      : plan.accounts.flatMap((account) => {
          if (account.type !== 'taxable' || account.ownerPersonId === null) return []
          try {
            const accountId = asAccountId(account.id)
            const ownerPersonId = asPersonId(account.ownerPersonId)
            if (!taxUnit.memberPersonIds.includes(ownerPersonId)) return []
            const identity = JSON.stringify([
              replacement.year,
              taxUnit.filingStatus,
              taxUnit.memberPersonIds,
              accountId,
              ownerPersonId,
            ])
            return [{
              accountId,
              openingCostBasis: planDollarsToLedgerCents(account.costBasis),
              ownership: {
                accountOwnerPersonIds: [ownerPersonId],
                accountOwnershipEvidenceId: `planner-preview-ownership:${identity}`,
                beneficialOwnershipShare: {
                  representation: 'exactRational' as const,
                  numerator: 1 as const,
                  denominator: 1 as const,
                  intermediateArithmetic: 'bigintRational' as const,
                },
                attributionEvidenceId: `planner-preview-attribution:${identity}`,
              },
              taxUnit: {
                taxUnitId: `planner-preview-tax-unit:${identity}`,
                taxUnitMemberPersonIds: taxUnit.memberPersonIds,
                federalFilingStatus: taxUnit.filingStatus,
                stateFilingStatusId: `planner-preview-state-filing:${identity}`,
                taxUnitEvidenceId: `planner-preview-tax-unit-evidence:${identity}`,
                taxYear: replacement.year,
              },
            }]
          } catch {
            return []
          }
        })
  const personAliveEvidence = requests.flatMap(
    (request): NonpersistedActionPersonAliveEvidence[] => {
      if (
        request.kind === 'legacyAggregateWithdrawal' ||
        request.kind === 'legacyAggregateRothConversion' ||
        request.kind === 'legacyAggregateQcd'
      ) return []
      const personId = request.kind === 'qcd' ? request.donorPersonId : request.personId
      const person = plan.household.people.find((candidate) => candidate.id === personId)
      return [{
        evidenceId: `planner-preview-alive:${JSON.stringify([
          request.actionId,
          personId,
          replacement.year,
          request.executionDate ?? null,
        ])}`,
        actionId: request.actionId,
        personId,
        actionYear: replacement.year,
        actionDate: request.executionDate ?? null,
        alive: person !== undefined &&
          retirementActionManualPersonSupportIssue(person, replacement.year) === null,
      }]
    },
  )

  let execution: ReturnType<typeof executeOrdinaryWithdrawals>
  try {
    execution = executeOrdinaryWithdrawals({
      year: replacement.year,
      plan,
      requests,
      openingBalances,
      taxableAccountSnapshots,
      runtimeEvidence: { personAliveEvidence },
    })
  } catch {
    return 'The reviewed replacement could not be previewed losslessly. The migrated row remains under review.'
  }
  if (!execution.committed) {
    return 'The reviewed replacement conflicts with another same-year execution slot. Choose a unique date and sequence.'
  }
  const evidence = execution.evidence.find(
    (entry) => entry.actionId === replacement.actionId,
  )
  if (
    evidence === undefined ||
    evidence.readiness !== 'actionable' ||
    evidence.disposition.executedAmount <= 0
  ) {
    return 'The reviewed withdrawal would execute no funds after earlier same-year actions. Choose another source, date, or sequence.'
  }

  const sourceIds = new Set(replacement.allocations.map(
    (allocation) => String(allocation.sourceAccountId),
  ))
  const boundary = assessOrdinaryWithdrawalPlanBoundary(execution)
  if (boundary.unrepresentableClosingBasisAccountIds.some(
    (accountId) => sourceIds.has(String(accountId)),
  )) {
    return 'The reviewed taxable withdrawal would leave a cost basis that cannot be represented exactly in the Plan. Choose another source or amount.'
  }
  if (boundary.unrepresentableClosingBalanceAccountIds.some(
    (accountId) => sourceIds.has(String(accountId)),
  )) {
    return 'The reviewed withdrawal would leave a source balance that cannot be represented exactly in the Plan. Choose another source or amount.'
  }
  if (boundary.aggregateFailureSourceAccountIds.some(
    (accountId) => sourceIds.has(String(accountId)),
  )) {
    return 'This withdrawal would make a same-year retirement-action total that cannot be represented exactly in the Plan. Choose another source or amount.'
  }

  if (replacement.year < projectionStartYear) {
    return `The reviewed withdrawal is scheduled before the current projection starts in ${projectionStartYear}, so its action-year source state cannot be established. The migrated row remains under review.`
  }
  let projectedExecution: ReturnType<typeof executeOrdinaryWithdrawals> | undefined
  try {
    const projection = simulatePlan(structuredClone(plan), {
      startYear: projectionStartYear,
      horizonEndYear: replacement.year,
      taxCalculator,
    })
    const projectedYear = projection.years.find((year) => year.year === replacement.year)
    projectedExecution = projectedYear?.retirementActionExecution
  } catch {
    return 'The reviewed withdrawal could not be previewed through its projected action-year source state. The migrated row remains under review.'
  }
  const projectedEvidence = projectedExecution?.evidence.find(
    (entry) => entry.actionId === replacement.actionId,
  )
  if (
    projectedExecution?.committed !== true ||
    projectedEvidence === undefined ||
    projectedEvidence.readiness !== 'actionable' ||
    projectedEvidence.disposition.executedAmount <= 0
  ) {
    return 'The reviewed withdrawal would execute no funds from its projected action-year source state after prior-year activity. Choose another source or keep the migrated row under review.'
  }
  return null
}

export function retirementActionManualSourceCandidate(
  kind: EditableMigratedRetirementAction['kind'],
  account: Plan['accounts'][number],
): boolean {
  if (kind === 'legacyAggregateRothConversion') {
    return account.type === 'traditional' && account.inherited === undefined
  }
  return ['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'].includes(
    account.type,
  )
}

export function retirementActionManualSourceSupportIssue(
  kind: EditableMigratedRetirementAction['kind'],
  account: Plan['accounts'][number],
  executionDate: string,
  actionYear: number,
  requestedAmount: EditableMigratedRetirementAction['requestedAmount'],
  actingPersonId: string,
  plan: ManualSourceSupportPlan,
): string | null {
  if (account.ownerPersonId === null) {
    return 'This jointly owned source does not record the individual acting-owner identity required for manual review.'
  }
  if (account.ownerPersonId !== actingPersonId) {
    return 'This source account is owned by a different household member than the selected person.'
  }
  const owners = plan.household.people.filter((person) => person.id === account.ownerPersonId)
  if (owners.length !== 1) {
    return 'The selected source account must have exactly one household owner.'
  }
  const ownerIssue = retirementActionManualPersonSupportIssue(owners[0]!, actionYear)
  if (ownerIssue !== null) return ownerIssue

  if (kind === 'legacyAggregateWithdrawal') {
    if (account.type !== 'cash' && account.type !== 'taxable' && account.type !== 'equityComp') {
      return 'Manual withdrawal review currently supports only cash, taxable, and vested equity-compensation sources.'
    }
    let openingBalance: ReturnType<typeof planDollarsToLedgerCents>
    try {
      openingBalance = planDollarsToLedgerCents(account.balance)
    } catch {
      return 'This source account balance cannot be represented in the exact-cent execution ledger. Reduce the balance before completing review.'
    }
    if (openingBalance === 0) {
      return 'This source account has no available exact-cent balance for the reviewed withdrawal. Choose a funded source.'
    }
    const executedAmount = Math.min(openingBalance, requestedAmount)
    const closingBalance = asUsdCents(openingBalance - executedAmount)
    try {
      ledgerCentTotalToPlanDollars(BigInt(executedAmount))
    } catch {
      return 'The prospective executed amount cannot be represented exactly in the Plan. Choose another funded source.'
    }
    try {
      ledgerCentsToPlanDollars(closingBalance)
    } catch {
      return 'This source account would have a closing balance that cannot be represented exactly in the Plan after the reviewed withdrawal. Choose another funded source.'
    }
    if (account.type === 'taxable') {
      try {
        planDollarsToLedgerCents(account.costBasis)
      } catch {
        return 'This taxable source account cost basis cannot be represented in the exact-cent execution ledger. Reduce the cost basis before completing review.'
      }
    }
    if (account.type === 'taxable' && !hasUnambiguousProjectedTaxUnit(plan, actionYear)) {
      const aliveCount = plan.household.people.filter(
        (person) => retirementActionManualPersonSupportIssue(person, actionYear) === null,
      ).length
      return `Taxable-account withdrawal review requires an unambiguous projected tax unit; ${aliveCount} household members are modeled alive in ${actionYear} under ${plan.household.filingStatus === 'single' ? 'Single' : 'Married filing jointly'} status.`
    }
    if (account.type !== 'equityComp' || account.vestingMode === 'final') return null
    if (account.vestDate === null || parseCivilIsoDate(account.vestDate) === null) {
      return 'This cliff-vesting equity-compensation source has no valid vest date and cannot be reviewed as executable.'
    }
    if (parseCivilIsoDate(executionDate) === null) {
      return `Choose an execution date on or after ${account.vestDate} before selecting this cliff-vesting equity-compensation source.`
    }
    return executionDate < account.vestDate
      ? `This equity-compensation source does not vest until ${account.vestDate}. Choose an execution date on or after that date.`
      : null
  }

  if (account.type !== 'traditional' || account.inherited !== undefined) {
    return 'Manual conversion review currently requires a non-inherited traditional IRA source.'
  }
  if (account.kind === 'employer') {
    return 'Employer-plan conversion sources are not supported until plan-availability evidence is modeled. Choose a traditional IRA.'
  }
  const classifications = plan.retirementActionEligibilityFacts?.iraClassifications.filter(
    (record) => record.sourceAccountId === account.id,
  ) ?? []
  if (classifications.length !== 1) {
    return 'This IRA needs exactly one explicit subtype classification before it can be reviewed as a conversion source.'
  }
  const classification = classifications[0]!
  if (classification.subtype !== 'simple') return null
  const periodEnd = classification.simpleParticipationStartDate === undefined
    ? null
    : addCalendarMonths(classification.simpleParticipationStartDate, 24)
  if (periodEnd === null) {
    return 'This SIMPLE IRA needs an explicit participation start date before conversion review.'
  }
  if (parseCivilIsoDate(executionDate) === null) {
    return `Choose an execution date on or after ${periodEnd} before selecting this SIMPLE IRA.`
  }
  return executionDate < periodEnd
    ? `This SIMPLE IRA cannot be converted before ${periodEnd}. Choose an execution date on or after that date.`
    : null
}

export function positiveDollarsToCents(
  value: number | null,
): ReturnType<typeof asPositiveUsdCents> | null {
  if (value === null || !Number.isFinite(value) || value <= 0) return null
  try {
    const cents = planDollarsToLedgerCents(value)
    if (cents <= 0 || ledgerCentsToPlanDollars(cents) !== value) return null
    return asPositiveUsdCents(cents)
  } catch {
    return null
  }
}

export function formatPositiveUsdCents(cents: number): string {
  const value = BigInt(asPositiveUsdCents(cents))
  const dollars = (value / 100n).toLocaleString('en-US')
  const fraction = String(value % 100n).padStart(2, '0')
  return `$${dollars}.${fraction}`
}

/**
 * Builds the adapter input only from affirmatively completed controls. The
 * target supplies the immutable family/year/cent invariants; no Plan person,
 * account order, account category, date, or sequence is selected here.
 */
export function buildRetirementActionManualIntent(
  target: Readonly<EditableMigratedRetirementAction>,
  draft: Readonly<RetirementActionManualEditorDraft>,
  preservedActions: readonly Readonly<RetirementActionRequest>[],
  plan: ManualSourceSupportPlan,
): BuildRetirementActionManualIntentResult {
  const issues: string[] = []
  const personSelected = draft.personId.trim() !== ''
  const selectedPeopleMatches = personSelected
    ? plan.household.people.filter((person) => person.id === draft.personId)
    : []
  if (!personSelected) {
    issues.push('Choose the person responsible for this action.')
  } else if (selectedPeopleMatches.length === 0) {
    issues.push('The selected person is no longer available in this Plan. Choose a current household member.')
  } else if (selectedPeopleMatches.length !== 1) {
    issues.push('The selected person ID is duplicated in this Plan. Choose a unique household member.')
  }

  const sourceSelected = draft.sourceAccountId.trim() !== ''
  const selectedSourceMatches = sourceSelected
    ? plan.accounts.filter((account) => account.id === draft.sourceAccountId)
    : []
  if (!sourceSelected) {
    issues.push('Choose the exact source account.')
  } else if (selectedSourceMatches.length === 0) {
    issues.push('The selected source account is no longer available in this Plan. Choose the exact source account again.')
  } else if (selectedSourceMatches.length !== 1) {
    issues.push('The selected source account ID is duplicated in this Plan. Choose a unique source account.')
  }
  if (!draft.fullSourceAmountConfirmed) {
    issues.push('Confirm that the full preserved amount belongs to the selected source account.')
  }
  if (!exactDateForYear(draft.executionDate, target.year)) {
    issues.push(`Choose a valid execution date in ${target.year}.`)
  }
  const executionSequence = exactExecutionSequence(draft.executionSequence)
  if (executionSequence === null) issues.push('Enter a positive whole-number execution sequence.')
  else if (
    exactDateForYear(draft.executionDate, target.year) &&
    executionSlotAlreadyUsed(
      target.actionId,
      preservedActions,
      draft.executionDate,
      executionSequence,
    )
  ) {
    issues.push(
      'Another retirement action already uses this execution date and sequence. Choose an unused sequence.',
    )
  }

  if (selectedSourceMatches.length === 1) {
    const sourceIssue = retirementActionManualSourceSupportIssue(
      target.kind,
      selectedSourceMatches[0]!,
      draft.executionDate,
      target.year,
      target.requestedAmount,
      draft.personId,
      plan,
    )
    if (sourceIssue !== null) issues.push(sourceIssue)
  }

  if (target.kind === 'legacyAggregateWithdrawal') {
    if (draft.withdrawalPurpose === '') issues.push('Choose the withdrawal purpose.')
  } else {
    issues.push(RETIREMENT_ACTION_CONVERSION_EXECUTOR_BOUNDARY)
    if (draft.destinationRothAccountId.trim() === '') {
      issues.push('Choose the exact Roth destination account.')
    }
    if (draft.conversionTaxFunding === '') {
      issues.push('Choose how conversion taxes are funded.')
    } else if (draft.conversionTaxFunding === 'conversionPrincipalWithholding') {
      issues.push(
        'Conversion-principal withholding is not supported. Choose external cash or no tax funding expected.',
      )
    } else if (draft.conversionTaxFunding === 'externalCash') {
      if (positiveDollarsToCents(draft.taxFundingAmountDollars) === null) {
        issues.push('Enter a positive exact-cent tax-funding amount.')
      }
      if (!draft.externalCashAttested) {
        issues.push('Confirm that the external cash is available for conversion taxes.')
      }
    }
  }

  if (issues.length > 0 || executionSequence === null) return { ok: false, issues }

  const base = {
    year: target.year,
    executionDate: draft.executionDate,
    executionSequence,
    requestedAmount: target.requestedAmount,
    personId: draft.personId as PersonId,
    provenance: { source: 'manual' as const },
    sourceAllocations: [{
      sourceAccountId: draft.sourceAccountId as AccountId,
      requestedAmount: target.requestedAmount,
    }],
  }

  if (target.kind === 'legacyAggregateWithdrawal') {
    return {
      ok: true,
      intent: {
        ...base,
        kind: 'ordinaryWithdrawal',
        purpose: { kind: draft.withdrawalPurpose as Exclude<WithdrawalPurposeChoice, ''> },
      },
    }
  }

  const amount = positiveDollarsToCents(draft.taxFundingAmountDollars)
  const taxFunding = draft.conversionTaxFunding === 'noneExpected'
    ? { kind: 'noneExpected' as const }
    : draft.conversionTaxFunding === 'externalCash'
      ? { kind: 'externalCash' as const, amount: amount!, attested: true as const }
      : {
          kind: 'conversionPrincipalWithholding' as const,
          amount: amount!,
        }
  return {
    ok: true,
    intent: {
      ...base,
      kind: 'rothConversion',
      destinationRothAccountId: draft.destinationRothAccountId as AccountId,
      taxFunding,
    },
  }
}

export function retirementActionReviewLabel(
  action: Readonly<RetirementActionRequest>,
): string {
  if (action.kind === 'legacyAggregateWithdrawal') return 'Withdrawal'
  if (action.kind === 'legacyAggregateRothConversion') return 'Roth conversion'
  if (action.kind === 'legacyAggregateQcd') return 'Qualified charitable distribution'
  if (action.kind === 'ordinaryWithdrawal') return 'Withdrawal'
  if (action.kind === 'rothConversion') return 'Roth conversion'
  return 'Qualified charitable distribution'
}
