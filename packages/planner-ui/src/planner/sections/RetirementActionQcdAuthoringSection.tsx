/**
 * The named charitable gift a household schedules for itself.
 *
 * Three rules shape every control here, and they are the eligibility-facts
 * editor's rules carried into an authoring surface:
 *
 * 1. Nothing reaches the Plan without an explicit save, and every identity
 *    fact behind the saved gift is one the household chose.
 * 2. An option the engine cannot model is shown and explained, never hidden.
 *    That holds for the source IRAs the gift cannot come from and for the
 *    charity types the exclusion does not cover.
 * 3. A refusal is the engine's sentence, rendered as the engine wrote it. The
 *    only copy this file owns around one is the frame that introduces it.
 */

import { useMemo, useState } from 'react'

import {
  allocateRetirementActionCandidateIdentity,
} from '@retiregolden/engine/actions/retirementActionCandidateIdentityAllocator'
import type { Plan } from '@retiregolden/engine/model/plan'

import { usePlan } from '../planContextCore'
import { currentStartYear, taxCalculatorFor } from '../useProjection'
import { CheckboxField, DateField, MoneyField, SelectField, TextField } from '../fields'
import { formatPositiveUsdCents } from '../retirementActionManualEditor'
import {
  buildQcdAuthoringIntent,
  emptyQcdAuthoringDraft,
  exactActionYear,
  projectNamedQcdGifts,
  qcdSourceBoundaryIssues,
  qcdSourceOptions,
  QCD_CHARITY_ATTESTATIONS,
  QCD_DESIGNATION_KIND_OPTIONS,
  type QcdAuthoringDraft,
  type QcdDesignationKindChoice,
  type QcdGiftProjection,
} from '../retirementActionQcdAuthoring'
import {
  namedQcdActions,
  QCD_NAMED_STANDS_DOWN_SCALAR,
  QCD_SECTION_HEADING,
} from '../retirementActionQcdSchedule'
import {
  RETIREMENT_ACTION_IRA_FACTS_ANCHOR,
  RETIREMENT_ACTION_IRA_FACTS_HEADING,
} from './RetirementActionEligibilityFactsEditor'

const REFUSAL_FRAME = 'This gift is not modeled as executing. The projection gives these reasons:'
const CREATE_FAILURE_FRAME = 'This gift was not created.'

function personLabel(person: Plan['household']['people'][number]): string {
  return `${person.name} (ID ${person.id})`
}

function FactsLink() {
  return (
    <p className="card-hint">
      Record what an IRA needs under{' '}
      <a href={`#${RETIREMENT_ACTION_IRA_FACTS_ANCHOR}`}>
        {RETIREMENT_ACTION_IRA_FACTS_HEADING}
      </a>{' '}
      above, then choose it here.
    </p>
  )
}

function GiftOutcome({
  outcome,
  donorName,
  year,
  startYear,
}: {
  outcome: QcdGiftProjection | undefined
  donorName: string
  year: number
  startYear: number
}) {
  if (outcome === undefined || outcome.status === 'unavailable') return null
  if (outcome.status === 'beforeProjectionStart') {
    return (
      <div className="callout callout--warn" role="status">
        This gift is scheduled for {year}, before this projection starts in {startYear}, so
        RetireGolden cannot model it.
      </div>
    )
  }
  const executing = outcome.status === 'executing'
  return (
    <div className={executing ? 'callout callout--info' : 'callout callout--warn'} role="status">
      {executing ? (
        <strong>
          This gift is modeled as executing on {outcome.executedDate ?? `a date in ${year}`} for{' '}
          {formatPositiveUsdCents(outcome.executedAmountCents)}.
        </strong>
      ) : (
        <strong>{REFUSAL_FRAME}</strong>
      )}
      {outcome.reasons.length > 0 ? (
        <ul>
          {outcome.reasons.map((reason, index) => (
            <li key={`${reason.code}:${index}`}>
              <strong>{reason.code}</strong>: {reason.message}
            </li>
          ))}
        </ul>
      ) : null}
      {outcome.executionIssues.length > 0 ? (
        <ul>
          {outcome.executionIssues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      ) : null}
      {outcome.age70HalfThresholdDate !== null ? (
        <p className="card-hint">
          RetireGolden has {donorName} reaching age 70½ on {outcome.age70HalfThresholdDate}.
        </p>
      ) : null}
      {outcome.beyondRequiredDistribution ? (
        <p className="card-hint">
          In this projection the year&apos;s required distribution is taken in cash before the
          gift, so the gift is modeled as coming out of the IRA on top of it. If you intend the
          gift to come out of your required amount, this projection will show a larger IRA
          drawdown and more ordinary income than you would see in practice.
        </p>
      ) : null}
    </div>
  )
}

function ScheduledGiftRow({
  plan,
  gift,
  outcome,
  startYear,
}: {
  plan: Readonly<Plan>
  gift: ReturnType<typeof namedQcdActions>[number]
  outcome: QcdGiftProjection | undefined
  startYear: number
}) {
  const { update } = usePlan()
  const donor = plan.household.people.find((person) => person.id === gift.donorPersonId)
  const source = plan.accounts.find(
    (account) => account.id === String(gift.allocation.sourceAccountId),
  )
  return (
    <div className="item-row" data-qcd-gift-id={gift.actionId}>
      <div className="item-row-head">
        <span className="item-row-title">
          <span className="type-chip">Scheduled gift</span>
          Qualified charitable distribution · {gift.year} ·{' '}
          {formatPositiveUsdCents(gift.requestedAmount)}
        </span>
        <button
          type="button"
          className="btn-ghost btn-ghost-danger"
          onClick={() => update((next) => {
            next.strategies.retirementActions = next.strategies.retirementActions.filter(
              (action) => action.actionId !== gift.actionId,
            )
          })}
        >
          Remove
        </button>
      </div>
      <p className="card-hint">
        {gift.charity.name} · from {source?.name ?? String(gift.allocation.sourceAccountId)} ·
        given by {donor?.name ?? String(gift.donorPersonId)} on{' '}
        {gift.executionDate ?? 'a date not on record'} (sequence {gift.executionSequence})
      </p>
      <GiftOutcome
        outcome={outcome}
        donorName={donor?.name ?? String(gift.donorPersonId)}
        year={gift.year}
        startYear={startYear}
      />
    </div>
  )
}

function GiftDraftForm({
  plan,
  startYear,
  onClose,
}: {
  plan: Readonly<Plan>
  startYear: number
  onClose: () => void
}) {
  const { update } = usePlan()
  const [draft, setDraft] = useState<QcdAuthoringDraft>(() =>
    emptyQcdAuthoringDraft(startYear))
  const [issues, setIssues] = useState<readonly string[]>([])
  const year = exactActionYear(draft.year)
  const donors = plan.household.people.map((person) => ({
    value: person.id,
    label: personLabel(person),
  }))
  const sources = useMemo(
    () => qcdSourceOptions(plan, draft.donorPersonId, year),
    [draft.donorPersonId, plan, year],
  )
  const boundary = useMemo(
    () => qcdSourceBoundaryIssues(plan, draft.donorPersonId, year),
    [draft.donorPersonId, plan, year],
  )
  const set = <K extends keyof QcdAuthoringDraft>(key: K, value: QcdAuthoringDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = () => {
    const built = buildQcdAuthoringIntent(draft, plan, plan.strategies.retirementActions)
    if (!built.ok) {
      setIssues(built.issues)
      return
    }
    const allocated = allocateRetirementActionCandidateIdentity(plan, built.intent)
    if (allocated.status !== 'allocated' || allocated.request.kind !== 'qcd') {
      setIssues(
        allocated.status === 'allocated'
          ? ['This gift did not produce a charitable-distribution request.']
          : allocated.issues.map((entry) => entry.detail),
      )
      return
    }
    const request = structuredClone(allocated.request)
    update((next) => {
      next.strategies.retirementActions = [...next.strategies.retirementActions, request]
    })
    setDraft(emptyQcdAuthoringDraft(startYear))
    setIssues([])
    onClose()
  }

  return (
    <div className="item-row" data-qcd-gift-draft="new">
      <div className="item-row-head">
        <span className="item-row-title">
          <span className="type-chip">New gift</span>
          Schedule a charitable gift
        </span>
        <button type="button" className="btn-ghost btn-ghost-danger" onClick={onClose}>
          Discard
        </button>
      </div>
      <div className="form-grid">
        <TextField
          label="Tax year"
          hint="The year the gift is made. RetireGolden models a gift only in a year it has a published QCD limit for."
          value={draft.year}
          onCommit={(value) => setDraft((current) => ({
            ...current,
            year: value,
            sourceAccountId: '',
          }))}
        />
        <SelectField
          label="Donor"
          placeholder="Choose the donor"
          value={draft.donorPersonId}
          options={donors}
          onCommit={(donorPersonId) => setDraft((current) => ({
            ...current,
            donorPersonId,
            sourceAccountId: '',
          }))}
        />
        <SelectField
          label="Source IRA"
          placeholder="Choose the source IRA"
          hint="The IRA the gift comes out of. RetireGolden pays the whole gift from this one account."
          value={draft.sourceAccountId}
          options={sources}
          onCommit={(sourceAccountId) => set('sourceAccountId', sourceAccountId)}
        />
        {boundary.issues.length > 0 ? (
          <div className="callout callout--warn" role="status">
            <strong>
              {sources.length === 0
                ? `No IRA in this plan can fund a gift by this donor in ${draft.year}.`
                : 'Some accounts cannot fund this gift.'}
            </strong>
            <ul>
              {boundary.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
            {boundary.resolvableInFacts ? <FactsLink /> : null}
          </div>
        ) : null}
        <MoneyField
          label="Gift amount"
          value={draft.giftAmountDollars}
          allowNull
          fractionDigits={2}
          onCommit={(giftAmountDollars) => set('giftAmountDollars', giftAmountDollars)}
          onInvalid={() => set('giftAmountDollars', null)}
        />
        <DateField
          label="Gift date"
          hint={year === null ? 'Must fall in the gift’s tax year.' : `Must fall in ${year}.`}
          value={draft.executionDate}
          onCommit={(executionDate) => set('executionDate', executionDate)}
        />
        <TextField
          label="Execution sequence"
          hint="Positive whole number; actions on the same date run in this order."
          value={draft.executionSequence}
          onCommit={(executionSequence) => set('executionSequence', executionSequence)}
        />
        <TextField
          label="Charity name"
          value={draft.charityName}
          onCommit={(charityName) => set('charityName', charityName)}
        />
        <SelectField
          label="Charity type"
          placeholder="Choose the charity type"
          hint="Every type is listed. RetireGolden models the gift for some of them and says so for the rest."
          value={draft.designationKind}
          options={QCD_DESIGNATION_KIND_OPTIONS}
          onCommit={(designationKind: Exclude<QcdDesignationKindChoice, ''>) =>
            set('designationKind', designationKind)}
        />
      </div>
      <div className="nested-form-section field-span-full">
        <h4>What you&apos;re telling the model about this gift</h4>
        <p className="card-hint">
          RetireGolden models this gift only when all five are true. It cannot check them — those
          answers come from your custodian and the charity.
        </p>
        <div className="form-grid">
          {QCD_CHARITY_ATTESTATIONS.map((attestation) => (
            <CheckboxField
              key={attestation.key}
              label={attestation.label}
              value={draft[attestation.key]}
              onCommit={(value) => set(attestation.key, value)}
            />
          ))}
        </div>
      </div>
      {issues.length > 0 ? (
        <div className="callout callout--warn" role="alert">
          <strong>{CREATE_FAILURE_FRAME}</strong>
          <ul>
            {issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="add-row">
        <button type="button" className="btn btn-primary btn-small" onClick={save}>
          Schedule this gift
        </button>
      </div>
    </div>
  )
}

/** The charitable-gift section of the Retirement actions card. */
export function RetirementActionQcdAuthoringSection() {
  const { plan } = usePlan()
  const [drafting, setDrafting] = useState(false)
  const startYear = currentStartYear()
  const gifts = namedQcdActions(plan)
  const outcomes = useMemo(
    () => projectNamedQcdGifts(plan, startYear, taxCalculatorFor(plan)),
    [plan, startYear],
  )
  return (
    <>
      <h3>{QCD_SECTION_HEADING}</h3>
      <p className="card-hint">
        A gift RetireGolden sends straight from one IRA to one charity on a date you choose.
        Everything below is your own statement about the gift; nothing is filled in for you.{' '}
        {QCD_NAMED_STANDS_DOWN_SCALAR}
      </p>
      {gifts.length === 0 && !drafting ? (
        <p className="card-hint">No charitable gifts are scheduled.</p>
      ) : null}
      {gifts.map((gift) => (
        <ScheduledGiftRow
          key={gift.actionId}
          plan={plan}
          gift={gift}
          outcome={outcomes.get(gift.actionId)}
          startYear={startYear}
        />
      ))}
      {drafting ? (
        <GiftDraftForm
          plan={plan}
          startYear={startYear}
          onClose={() => setDrafting(false)}
        />
      ) : null}
      {drafting ? null : (
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => setDrafting(true)}
          >
            + Charitable gift
          </button>
        </div>
      )}
    </>
  )
}
