import {
  persistedRetirementActionRequestSchema,
  type RetirementActionRequest,
} from '../actions/contract.js'
import { parseCivilIsoDate } from '../actions/civilDate.js'

export type CurrentRetirementActionCandidateRequest = Extract<
  RetirementActionRequest,
  { kind: 'ordinaryWithdrawal' | 'rothConversion' | 'qcd' }
>

export interface RetirementActionCandidateScheduleIssue {
  kind:
    | 'invalidRetirementActionSchedule'
    | 'nonCurrentRetirementActionSchedule'
  field: string
  reason: null
  detail: string
}

export type CompleteRetirementActionCandidateScheduleResult =
  | Readonly<{
      ok: true
      actions: readonly CurrentRetirementActionCandidateRequest[]
      actionRequestIds: readonly string[]
    }>
  | Readonly<{
      ok: false
      issue: RetirementActionCandidateScheduleIssue
    }>

const CURRENT_RETIREMENT_ACTION_KINDS = new Set([
  'ordinaryWithdrawal',
  'rothConversion',
  'qcd',
])

function invalid(
  detail: string,
  kind: RetirementActionCandidateScheduleIssue['kind'] =
    'invalidRetirementActionSchedule',
  field = 'plan.strategies.retirementActions',
): CompleteRetirementActionCandidateScheduleResult {
  return {
    ok: false,
    issue: { kind, field, reason: null, detail },
  }
}

/**
 * Inspect a complete identity-bearing retirement-action schedule without
 * upgrading legacy aggregate requests or replacing the caller's exact action
 * objects. The returned array is a stable snapshot of the inspected schedule.
 */
export function inspectCompleteRetirementActionCandidateSchedule(
  value: unknown,
): CompleteRetirementActionCandidateScheduleResult {
  try {
    if (!Array.isArray(value)) {
      return invalid(
        'The Plan retirement-action schedule must be a complete array before requests can be appended.',
      )
    }

    const actions = structuredClone(value) as unknown[]
    const actionRequestIds: string[] = []
    const seenActionIds = new Set<string>()
    for (const [index, action] of actions.entries()) {
      const field = `plan.strategies.retirementActions.${index}`
      const parsed = persistedRetirementActionRequestSchema.safeParse(action)
      if (!parsed.success) {
        return invalid(
          'The preserved retirement-action schedule contains an incomplete or invalid request.',
          'invalidRetirementActionSchedule',
          field,
        )
      }
      if (!CURRENT_RETIREMENT_ACTION_KINDS.has(parsed.data.kind)) {
        return invalid(
          `The preserved retirement-action schedule contains non-current action kind "${parsed.data.kind}"; ` +
          'legacy aggregate actions must be reviewed and sourced before an identity-complete candidate can be built.',
          'nonCurrentRetirementActionSchedule',
          field,
        )
      }
      const current = parsed.data as CurrentRetirementActionCandidateRequest
      const parsedDate = current.executionDate === undefined
        ? null
        : parseCivilIsoDate(current.executionDate)
      const dateValid = parsedDate !== null && parsedDate.year === current.year
      if (
        current.kind === 'ordinaryWithdrawal'
          ? current.executionDate !== undefined && !dateValid
          : !dateValid
      ) {
        return invalid(
          current.kind === 'ordinaryWithdrawal'
            ? 'A dated ordinary withdrawal must carry a canonical civil date in its action year.'
            : 'Every preserved Roth conversion and QCD requires a canonical execution date in its action year.',
          'invalidRetirementActionSchedule',
          `${field}.executionDate`,
        )
      }
      if (seenActionIds.has(parsed.data.actionId)) {
        return invalid(
          `The preserved retirement-action schedule repeats action ID "${parsed.data.actionId}"; ` +
          'identity-complete readiness requires one unique ID per current action.',
          'invalidRetirementActionSchedule',
          `${field}.actionId`,
        )
      }
      seenActionIds.add(parsed.data.actionId)
      actionRequestIds.push(parsed.data.actionId)
    }

    return {
      ok: true,
      actions: actions as CurrentRetirementActionCandidateRequest[],
      actionRequestIds,
    }
  } catch {
    return invalid(
      'The Plan retirement-action schedule could not be inspected losslessly.',
    )
  }
}
