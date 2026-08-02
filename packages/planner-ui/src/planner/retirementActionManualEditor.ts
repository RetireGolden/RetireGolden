import type {
  LegacyAggregateRetirementActionRequest,
  RetirementActionRequest,
} from '@retiregolden/engine/actions/contract'
import type {
  RetirementActionCandidateIdentityIntent,
} from '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
import type { AccountId, PersonId } from '@retiregolden/engine/actions/identity'
import { asPositiveUsdCents } from '@retiregolden/engine/actions/money'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from '@retiregolden/engine/actions/planBalanceAdapter'
import { parseCivilIsoDate } from '@retiregolden/engine/actions/civilDate'
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

function employerConversionSourceSelected(
  sourceAccountId: string,
  planAccounts: readonly Plan['accounts'][number][],
): boolean {
  const matches = planAccounts.filter((account) => account.id === sourceAccountId)
  return matches.length === 1 &&
    matches[0]!.type === 'traditional' &&
    matches[0]!.kind === 'employer'
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
  planAccounts: readonly Plan['accounts'][number][],
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

  if (target.kind === 'legacyAggregateWithdrawal') {
    if (draft.withdrawalPurpose === '') issues.push('Choose the withdrawal purpose.')
  } else {
    if (employerConversionSourceSelected(draft.sourceAccountId, planAccounts)) {
      issues.push(
        'Employer-plan conversion sources are not supported until plan-availability evidence is modeled. Choose a traditional IRA.',
      )
    }
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
