import type {
  LegacyAggregateRetirementActionRequest,
  RetirementActionRequest,
} from '@retiregolden/engine/actions/contract'
import type {
  RetirementActionCandidateIdentityIntent,
} from '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
import { asPersonId, type AccountId, type PersonId } from '@retiregolden/engine/actions/identity'
import { asPositiveUsdCents } from '@retiregolden/engine/actions/money'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '@retiregolden/engine/actions/planBalanceAdapter'
import { addCalendarMonths, parseCivilIsoDate } from '@retiregolden/engine/actions/civilDate'
import type { Plan } from '@retiregolden/engine/model/plan'

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

function exactExecutionSequence(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null
  const sequence = Number(value)
  return Number.isSafeInteger(sequence) ? sequence : null
}

function exactDateForYear(value: string, year: number): boolean {
  return parseCivilIsoDate(value)?.year === year
}

function executionSlotAlreadyUsed(
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

function hasUnambiguousProjectedTaxUnit(
  plan: ManualSourceSupportPlan,
  actionYear: number,
): boolean {
  const alivePeople = plan.household.people.filter(
    (person) => retirementActionManualPersonSupportIssue(person, actionYear) === null,
  )
  try {
    alivePeople.map((person) => asPersonId(person.id))
  } catch {
    return false
  }
  const filingStatus = projectedFilingStatus(plan, actionYear, alivePeople.length)
  return (filingStatus === 'marriedFilingJointly' && alivePeople.length === 2) ||
    (
      (filingStatus === 'single' || filingStatus === 'qualifyingSurvivingSpouse') &&
      alivePeople.length === 1
    )
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
  plan: ManualSourceSupportPlan,
): string | null {
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

function positiveDollarsToCents(value: number | null): ReturnType<typeof asPositiveUsdCents> | null {
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
  if (draft.personId.trim() === '') issues.push('Choose the person responsible for this action.')
  if (draft.sourceAccountId.trim() === '') issues.push('Choose the exact source account.')
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

  const selectedSourceMatches = plan.accounts.filter(
    (account) => account.id === draft.sourceAccountId,
  )
  if (selectedSourceMatches.length === 1) {
    const sourceIssue = retirementActionManualSourceSupportIssue(
      target.kind,
      selectedSourceMatches[0]!,
      draft.executionDate,
      target.year,
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
