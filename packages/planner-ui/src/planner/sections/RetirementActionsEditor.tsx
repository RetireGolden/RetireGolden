import { useMemo, useState } from 'react'

import { reviewAndReplaceRetirementActionManually } from
  '@retiregolden/engine/actions/retirementActionManualReview'
import type { Plan } from '@retiregolden/engine/model/plan'

import { usePlan } from '../planContextCore'
import { currentStartYear, taxCalculatorFor } from '../useProjection'
import {
  classifiableIraAccounts,
  contributionDonors,
} from '../retirementActionEligibilityFacts'
import { namedQcdActions } from '../retirementActionQcdSchedule'
import { RetirementActionEligibilityFactsEditor } from './RetirementActionEligibilityFactsEditor'
import { RetirementActionQcdAuthoringSection } from './RetirementActionQcdAuthoringSection'
import {
  CheckboxField,
  DateField,
  MoneyField,
  SelectField,
  TextField,
} from '../fields'
import {
  buildRetirementActionManualIntent,
  emptyRetirementActionManualEditorDraft,
  formatPositiveUsdCents,
  migratedRetirementActionsNeedingReview,
  retirementActionManualDestinationCandidate,
  retirementActionManualDestinationSupportIssue,
  retirementActionManualExecutionIssue,
  retirementActionManualPersonSupportIssue,
  retirementActionManualSourceCandidate,
  retirementActionManualSourceSupportIssue,
  retirementActionReviewLabel,
  type EditableMigratedRetirementAction,
  type RetirementActionManualEditorDraft,
} from '../retirementActionManualEditor'

function accountOptionLabel(account: Plan['accounts'][number]): string {
  const classification = account.type === 'traditional' || account.type === 'roth'
    ? `${account.type}/${account.kind}`
    : account.type
  return `${account.name} (${classification}; ID ${account.id})`
}

function accountOptions(
  plan: Readonly<Plan>,
  personId: string,
  kind: EditableMigratedRetirementAction['kind'],
  executionDate: string,
  actionYear: number,
  requestedAmount: EditableMigratedRetirementAction['requestedAmount'],
) {
  if (personId === '') return []
  return plan.accounts
    .filter((account) => {
      return retirementActionManualSourceCandidate(kind, account) &&
        retirementActionManualSourceSupportIssue(
          kind,
          account,
          executionDate,
          actionYear,
          requestedAmount,
          personId,
          plan,
        ) === null
    })
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map((account) => ({ value: account.id, label: accountOptionLabel(account) }))
}

function sourceBoundaryIssues(
  plan: Readonly<Plan>,
  personId: string,
  kind: EditableMigratedRetirementAction['kind'],
  executionDate: string,
  actionYear: number,
  requestedAmount: EditableMigratedRetirementAction['requestedAmount'],
): readonly string[] {
  if (personId === '') return []
  const issues = plan.accounts
    .filter((account) =>
      retirementActionManualSourceCandidate(kind, account),
    )
    .map((account) => retirementActionManualSourceSupportIssue(
      kind,
      account,
      executionDate,
      actionYear,
      requestedAmount,
      personId,
      plan,
    ))
    .filter((issue): issue is string => issue !== null)
  return [...new Set(issues)]
}

function destinationOptions(plan: Readonly<Plan>, personId: string) {
  if (personId === '') return []
  return plan.accounts
    .filter((account) =>
      retirementActionManualDestinationCandidate(account) &&
      retirementActionManualDestinationSupportIssue(account, personId) === null,
    )
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map((account) => ({ value: account.id, label: accountOptionLabel(account) }))
}

function ManualReviewRow({
  target,
  plan,
}: {
  target: Readonly<EditableMigratedRetirementAction>
  plan: Readonly<Plan>
}) {
  const { update } = usePlan()
  const [draft, setDraft] = useState<RetirementActionManualEditorDraft>(
    emptyRetirementActionManualEditorDraft,
  )
  const [issues, setIssues] = useState<readonly string[]>([])
  const unavailablePeople = plan.household.people
    .map((person) => retirementActionManualPersonSupportIssue(person, target.year))
    .filter((issue): issue is string => issue !== null)
  const people = plan.household.people
    .filter((person) => retirementActionManualPersonSupportIssue(person, target.year) === null)
    .map((person) => ({
      value: person.id,
      label: `${person.name} (ID ${person.id})`,
    }))
  const sources = useMemo(
    () => accountOptions(
      plan,
      draft.personId,
      target.kind,
      draft.executionDate,
      target.year,
      target.requestedAmount,
    ),
    [draft.executionDate, draft.personId, plan, target.kind, target.requestedAmount, target.year],
  )
  const unavailableSourceIssues = useMemo(
    () => sourceBoundaryIssues(
      plan,
      draft.personId,
      target.kind,
      draft.executionDate,
      target.year,
      target.requestedAmount,
    ),
    [draft.executionDate, draft.personId, plan, target.kind, target.requestedAmount, target.year],
  )
  const destinations = useMemo(
    () => destinationOptions(plan, draft.personId),
    [draft.personId, plan],
  )
  const set = <K extends keyof RetirementActionManualEditorDraft>(
    key: K,
    value: RetirementActionManualEditorDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const submit = () => {
    const built = buildRetirementActionManualIntent(
      target,
      draft,
      plan.strategies.retirementActions,
      plan,
    )
    if (!built.ok) {
      setIssues(built.issues)
      return
    }
    const result = reviewAndReplaceRetirementActionManually({
      plan,
      targetActionId: target.actionId,
      replacementIntent: built.intent,
    })
    if (result.status !== 'replacementReady') {
      setIssues(result.issues.map((entry) => entry.detail))
      return
    }
    const executionIssue = retirementActionManualExecutionIssue(
      result.plan,
      result.replacement.actionId,
      currentStartYear(),
      taxCalculatorFor(result.plan),
    )
    if (executionIssue !== null) {
      setIssues([executionIssue])
      return
    }
    update((next) => {
      next.strategies.retirementActions = structuredClone(
        result.plan.strategies.retirementActions,
      )
    })
    setIssues([])
  }

  const showFundingAmount =
    target.kind === 'legacyAggregateRothConversion' &&
    draft.conversionTaxFunding === 'externalCash'

  return (
    <div className="item-row" data-retirement-action-id={target.actionId}>
      <div className="item-row-head">
        <span className="item-row-title">
          <span className="type-chip">Needs source review</span>
          {retirementActionReviewLabel(target)} · {target.year} ·{' '}
          {formatPositiveUsdCents(target.requestedAmount)}
        </span>
      </div>
      <p className="card-hint">
        This amount came from an aggregate schedule. Choose every identity and execution fact;
        nothing below is preselected from account order or household position.
      </p>
      {unavailablePeople.length > 0 ? (
        <div className="callout callout--warn" role="status">
          <strong>Some household members are unavailable for this action year.</strong>
          <ul>
            {unavailablePeople.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="form-grid">
        <SelectField
          label="Person"
          value={draft.personId}
          placeholder="Choose a person"
          options={people}
          onCommit={(personId) => setDraft((current) => ({
            ...current,
            personId,
            sourceAccountId: '',
            destinationRothAccountId: '',
            fullSourceAmountConfirmed: false,
          }))}
        />
        <SelectField
          label="Source account"
          value={draft.sourceAccountId}
          placeholder="Choose a source account"
          options={sources}
          hint={`This bounded review assigns one source. The exact preserved amount is ${formatPositiveUsdCents(target.requestedAmount)}.`}
          onCommit={(sourceAccountId) => setDraft((current) => ({
            ...current,
            sourceAccountId,
            fullSourceAmountConfirmed: false,
          }))}
        />
        {draft.personId !== '' && unavailableSourceIssues.length > 0 ? (
          <div className="callout callout--warn" role="status">
            <strong>
              {sources.length === 0
                ? 'No currently executable source is available for this person.'
                : 'Some source accounts are unavailable for this review.'}
            </strong>
            <ul>
              {unavailableSourceIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
        ) : null}
        <CheckboxField
          label={`Assign the full ${formatPositiveUsdCents(target.requestedAmount)} to this source`}
          value={draft.fullSourceAmountConfirmed}
          onCommit={(fullSourceAmountConfirmed) =>
            set('fullSourceAmountConfirmed', fullSourceAmountConfirmed)}
        />
        <DateField
          label="Execution date"
          value={draft.executionDate}
          hint={`Must fall in ${target.year}; the action will not be moved to another date.`}
          onCommit={(executionDate) => setDraft((current) => {
            const selectedSource = plan.accounts.find(
              (account) => account.id === current.sourceAccountId,
            )
            const sourceRemainsSupported = selectedSource !== undefined &&
              retirementActionManualSourceSupportIssue(
                target.kind,
                selectedSource,
                executionDate,
                target.year,
                target.requestedAmount,
                draft.personId,
                plan,
              ) === null
            return {
              ...current,
              executionDate,
              ...(sourceRemainsSupported
                ? {}
                : { sourceAccountId: '', fullSourceAmountConfirmed: false }),
            }
          })}
        />
        <TextField
          label="Execution sequence"
          value={draft.executionSequence}
          hint="Positive whole number; actions on the same date run in this order."
          onCommit={(executionSequence) => set('executionSequence', executionSequence)}
        />
        {target.kind === 'legacyAggregateWithdrawal' ? (
          <SelectField
            label="Withdrawal purpose"
            value={draft.withdrawalPurpose}
            placeholder="Choose a purpose"
            options={[
              { value: 'spending', label: 'Spending' },
              { value: 'goal', label: 'Goal' },
              { value: 'taxPayment', label: 'Tax payment' },
              { value: 'other', label: 'Other' },
            ]}
            onCommit={(withdrawalPurpose) => set('withdrawalPurpose', withdrawalPurpose)}
          />
        ) : (
          <>
            <SelectField
              label="Roth destination account"
              value={draft.destinationRothAccountId}
              placeholder="Choose a Roth IRA"
              options={destinations}
              onCommit={(destinationRothAccountId) =>
                set('destinationRothAccountId', destinationRothAccountId)}
            />
            <SelectField
              label="Conversion tax funding"
              value={draft.conversionTaxFunding}
              placeholder="Choose tax funding"
              options={[
                { value: 'externalCash', label: 'External cash' },
                {
                  value: 'conversionPrincipalWithholding',
                  label: 'Withhold conversion principal (unsupported)',
                },
                { value: 'noneExpected', label: 'No tax funding expected' },
              ]}
              onCommit={(conversionTaxFunding) => {
                setDraft((current) => ({
                  ...current,
                  conversionTaxFunding,
                  taxFundingAmountDollars: null,
                  externalCashAttested: false,
                }))
              }}
            />
            {draft.conversionTaxFunding === 'conversionPrincipalWithholding' ? (
              <div className="callout callout--warn" role="status">
                <strong>Conversion-principal withholding is not supported.</strong>{' '}
                Choose external cash or no tax funding expected to complete this review.
              </div>
            ) : null}
            {showFundingAmount ? (
              <MoneyField
                label="Tax-funding amount"
                value={draft.taxFundingAmountDollars}
                allowNull
                fractionDigits={2}
                onCommit={(taxFundingAmountDollars) => setDraft((current) => ({
                  ...current,
                  taxFundingAmountDollars,
                  externalCashAttested: false,
                }))}
                onInvalid={() => setDraft((current) => ({
                  ...current,
                  taxFundingAmountDollars: null,
                  externalCashAttested: false,
                }))}
              />
            ) : null}
            {draft.conversionTaxFunding === 'externalCash' ? (
              <CheckboxField
                label="I confirm this external cash is available"
                value={draft.externalCashAttested}
                onCommit={(externalCashAttested) =>
                  set('externalCashAttested', externalCashAttested)}
              />
            ) : null}
          </>
        )}
      </div>
      {issues.length > 0 ? (
        <div className="callout callout--warn" role="alert">
          <strong>Source review is incomplete.</strong>
          <ul>
            {issues.map((entry) => <li key={entry}>{entry}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="add-row">
        <button type="button" className="btn btn-primary btn-small" onClick={submit}>
          Save reviewed action
        </button>
      </div>
    </div>
  )
}

function QcdManualReviewRow({
  plan,
  targetActionId,
  year,
  requestedAmount,
}: {
  plan: Readonly<Plan>
  targetActionId: Plan['strategies']['retirementActions'][number]['actionId']
  year: number
  requestedAmount: number
}) {
  const result = useMemo(
    () => reviewAndReplaceRetirementActionManually({ plan, targetActionId }),
    [plan, targetActionId],
  )
  const detail = result.status === 'manualReviewRequired'
    ? result.issues[0].detail
    : 'This QCD could not enter manual source review.'
  return (
    <div className="item-row" data-retirement-action-id={targetActionId}>
      <div className="item-row-head">
        <span className="item-row-title">
          <span className="type-chip">Needs source review</span>
          Qualified charitable distribution · {year} · {formatPositiveUsdCents(requestedAmount)}
        </span>
      </div>
      <div className="callout callout--warn" role="status">
        <strong>Manual review required — QCD source editing is not supported yet.</strong>{' '}
        {detail}
      </div>
    </div>
  )
}

/**
 * Public Strategy-screen control for the facts an action needs on record, for
 * scheduling a charitable gift from an IRA, and for resolving migrated
 * aggregate actions.
 *
 * The card mounts whenever any of the three has something to show. A plan with
 * no migrated rows still needs somewhere to record an IRA's type, which is what
 * a conversion review refuses without, and somewhere to schedule a gift.
 */
export function RetirementActionsEditor() {
  const { plan } = usePlan()
  const actions = migratedRetirementActionsNeedingReview(plan)
  const hasFacts = classifiableIraAccounts(plan).length > 0 ||
    contributionDonors(plan, currentStartYear()).length > 0
  const hasGifts = namedQcdActions(plan).length > 0
  if (actions.length === 0 && !hasFacts && !hasGifts) return null

  return (
    <div className="card">
      <h2>Retirement actions</h2>
      <p className="card-hint">
        What your IRAs need on record before RetireGolden can model an action against them, the
        charitable gifts you have scheduled from them, and any actions carried in from an older
        plan format.
      </p>
      <RetirementActionEligibilityFactsEditor />
      {hasFacts || hasGifts ? <RetirementActionQcdAuthoringSection /> : null}
      {actions.length > 0 ? (
        <>
          <h3>Actions carried in from an older plan</h3>
          <p className="card-hint">
            Migrated aggregate actions stay non-actionable until their execution source is
            reviewed.
          </p>
          {actions.map((action) => action.kind === 'legacyAggregateQcd' ? (
            <QcdManualReviewRow
              key={action.actionId}
              plan={plan}
              targetActionId={action.actionId}
              year={action.year}
              requestedAmount={action.requestedAmount}
            />
          ) : (
            <ManualReviewRow
              key={action.actionId}
              plan={plan}
              target={action}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}
