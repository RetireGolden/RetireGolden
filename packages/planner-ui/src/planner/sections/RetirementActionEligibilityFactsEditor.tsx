/**
 * The writable surface for Plan v3 action-eligibility evidence.
 *
 * Three rules shape every control here:
 *
 * 1. Nothing reaches the Plan without an explicit confirm, and each confirm
 *    control states the exact record it writes.
 * 2. A blank answer stays blank. "Not on record" is a visible state, distinct
 *    from a recorded zero and from a recorded "no employer contribution".
 * 3. When a record cannot survive an edit, the control says what it removes
 *    before it removes it.
 */

import { useState } from 'react'

import { parseCivilIsoDate } from '@retiregolden/engine/actions/civilDate'
import type { Account, Plan } from '@retiregolden/engine/model/plan'

import { usePlan } from '../planContextCore'
import { TypeChip } from '../TypeChip'
import { currentStartYear } from '../useProjection'
import { DateField, MoneyField, SelectField } from '../fields'
import {
  bulkContributionConflictMessage,
  centsToPlanDollars,
  classifiableIraAccounts,
  conflictingContributionYears,
  contributionDonors,
  deductibleContributionFor,
  eligibilityEvidenceIdConflict,
  formatUsdCents,
  iraClassificationFor,
  nonnegativeDollarsToCents,
  recordDeductibleContribution,
  recordDeductibleContributionZeros,
  recordIraClassification,
  recordSepSimpleActivity,
  removeDeductibleContribution,
  removeIraClassification,
  removeSepSimpleActivity,
  sepSimpleActivityFor,
  sepSimpleActivityYears,
  type IraSubtype,
} from '../retirementActionEligibilityFacts'
import { namedQcdYearsForSource } from '../retirementActionQcdSchedule'

const ON_RECORD = 'On record'
const NOT_ON_RECORD = 'Not on record'

/** Anchor the gift form links to when a missing IRA fact is what blocks it. */
export const RETIREMENT_ACTION_IRA_FACTS_ANCHOR = 'retirement-action-ira-facts'
export const RETIREMENT_ACTION_IRA_FACTS_HEADING = 'IRA facts on record'

function accountLabel(account: Account): string {
  return `${account.name} (ID ${account.id})`
}

function Chip({ recorded }: { recorded: boolean }) {
  return <TypeChip>{recorded ? ON_RECORD : NOT_ON_RECORD}</TypeChip>
}

function RowIssue({ issue }: { issue: string | null }) {
  if (issue === null) return null
  return (
    <div className="callout callout--warn" role="alert">
      {issue}
    </div>
  )
}

function iraSubtypeStatement(
  accountName: string,
  subtype: IraSubtype,
  participationStart: string,
): string {
  if (subtype === 'traditional') return `${accountName} is a traditional IRA`
  if (subtype === 'sep') return `${accountName} is a SEP IRA`
  return participationStart === ''
    ? `${accountName} is a SIMPLE IRA`
    : `${accountName} is a SIMPLE IRA I first took part in on ${participationStart}`
}

function IraClassificationRow({ plan, account }: { plan: Readonly<Plan>; account: Account }) {
  const { update } = usePlan()
  const recorded = iraClassificationFor(plan, account.id)
  const recordedStart = recorded?.subtype === 'simple'
    ? recorded.simpleParticipationStartDate ?? ''
    : ''
  const [subtype, setSubtype] = useState<IraSubtype>(recorded?.subtype ?? 'traditional')
  const [participationStart, setParticipationStart] = useState(recordedStart)
  const [issue, setIssue] = useState<string | null>(null)
  const activityYears = sepSimpleActivityYears(plan, account.id)
  const statement = iraSubtypeStatement(account.name, subtype, participationStart)
  const dropsActivities = subtype === 'traditional' && activityYears.length > 0

  const confirm = () => {
    const conflict = eligibilityEvidenceIdConflict(plan, {
      role: 'iraClassification',
      sourceAccountId: account.id,
    })
    if (conflict !== null) {
      setIssue(conflict)
      return
    }
    // Only the SIMPLE arm carries a participation start date, so a stale entry
    // behind a hidden field never blocks a traditional or SEP classification.
    if (
      subtype === 'simple' &&
      participationStart !== '' &&
      parseCivilIsoDate(participationStart) === null
    ) {
      setIssue('Enter a real participation start date, or leave it blank.')
      return
    }
    setIssue(null)
    update((next) => {
      recordIraClassification(
        next,
        account.id,
        subtype,
        subtype === 'simple' && participationStart !== '' ? participationStart : null,
      )
    })
  }

  return (
    <div className="item-row" data-eligibility-ira={account.id}>
      <div className="item-row-head">
        <span className="item-row-title">
          <Chip recorded={recorded !== null} />
          {accountLabel(account)}
        </span>
        {recorded !== null ? (
          <button
            type="button"
            className="btn-ghost btn-ghost-danger"
            onClick={() => update((next) => removeIraClassification(next, account.id))}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="form-grid">
        <SelectField
          label="IRA type"
          help="RetireGolden needs the IRA type on record before it can use this account as the source of a Roth conversion or a charitable gift."
          hint="Filled in from your account details. Nothing is recorded until you confirm."
          value={subtype}
          options={[
            { value: 'traditional', label: 'Traditional IRA' },
            { value: 'sep', label: 'SEP IRA' },
            { value: 'simple', label: 'SIMPLE IRA' },
          ]}
          onCommit={(next) => {
            setSubtype(next)
            setIssue(null)
          }}
        />
        {subtype === 'simple' ? (
          <DateField
            label="SIMPLE participation start date"
            hint="The date you first took part in this SIMPLE plan. Leave blank if you do not have it."
            value={participationStart}
            onCommit={(next) => setParticipationStart(next)}
          />
        ) : null}
      </div>
      {recorded !== null && activityYears.length > 0 ? (
        <p className="card-hint">
          {dropsActivities ? 'Recording' : 'Removing'} this also removes the{' '}
          {activityYears.length} employer-contribution{' '}
          {activityYears.length === 1 ? 'year' : 'years'} on record for this account.
        </p>
      ) : null}
      <RowIssue issue={issue} />
      <div className="add-row">
        <button type="button" className="btn btn-primary btn-small" onClick={confirm}>
          Record: {statement}
        </button>
      </div>
      {recorded !== null && recorded.subtype !== 'traditional' ? (
        <SepSimpleActivityBlock plan={plan} account={account} />
      ) : null}
    </div>
  )
}

type SepSimpleAnswer = '' | 'made' | 'none'

function SepSimpleActivityBlock({
  plan,
  account,
}: {
  plan: Readonly<Plan>
  account: Account
}) {
  const statedYears = sepSimpleActivityYears(plan, account.id)
  const [addedYears, setAddedYears] = useState<readonly number[]>([])
  // A gift scheduled against this IRA brings its own year with it. The engine
  // asks for the activity of the gift's exact tax year, so the household should
  // not have to guess how many times to press "+ Year" to reach it.
  const years = [
    ...new Set([
      ...statedYears,
      ...addedYears,
      ...namedQcdYearsForSource(plan, account.id),
      currentStartYear(),
    ]),
  ].sort((left, right) => left - right)
  const nextYear = Math.max(...years) + 1
  return (
    <div className="nested-form-section field-span-full">
      <h4>Employer contributions to {account.name}</h4>
      <p className="card-hint">
        RetireGolden needs an answer for the year of a charitable gift before it can model one
        from a SEP or SIMPLE IRA. A year you have not answered stays unknown; it is not read as
        a year with no contribution.
      </p>
      {years.map((year) => (
        <SepSimpleActivityRow key={year} plan={plan} account={account} year={year} />
      ))}
      <div className="add-row">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => setAddedYears((current) => [...current, nextYear])}
        >
          + Year
        </button>
      </div>
    </div>
  )
}

function SepSimpleActivityRow({
  plan,
  account,
  year,
}: {
  plan: Readonly<Plan>
  account: Account
  year: number
}) {
  const { update } = usePlan()
  const recorded = sepSimpleActivityFor(plan, account.id, year)
  const [planYearEndDate, setPlanYearEndDate] = useState(recorded?.planYearEndDate ?? '')
  const [answer, setAnswer] = useState<SepSimpleAnswer>(
    recorded === null ? '' : recorded.employerContributionMadeForPlanYear ? 'made' : 'none',
  )
  const [issue, setIssue] = useState<string | null>(null)

  const planYearPhrase = planYearEndDate === ''
    ? 'the plan year you enter above'
    : `the plan year ending ${planYearEndDate}`
  const buttonLabel = answer === ''
    ? `Record ${year}`
    : answer === 'made'
      ? `Record: this IRA received an employer SEP or SIMPLE contribution for ${planYearPhrase}`
      : `Record: this IRA received no employer SEP or SIMPLE contribution for ${planYearPhrase}`

  const confirm = () => {
    if (answer === '') {
      setIssue(`Choose an answer for ${year}, or leave the year off the record.`)
      return
    }
    if (parseCivilIsoDate(planYearEndDate)?.year !== year) {
      setIssue(`Enter the plan year end date; it must fall in ${year}.`)
      return
    }
    const conflict = eligibilityEvidenceIdConflict(plan, {
      role: 'sepSimpleActivity',
      sourceAccountId: account.id,
      actionTaxYear: year,
    })
    if (conflict !== null) {
      setIssue(conflict)
      return
    }
    setIssue(null)
    update((next) => {
      recordSepSimpleActivity(next, account.id, year, planYearEndDate, answer === 'made')
    })
  }

  return (
    <div className="item-row" data-eligibility-activity={`${account.id}:${year}`}>
      <div className="item-row-head">
        <span className="item-row-title">
          <Chip recorded={recorded !== null} />
          {year}
        </span>
        {recorded !== null ? (
          <button
            type="button"
            className="btn-ghost btn-ghost-danger"
            onClick={() => {
              // The row falls back to not-on-record, so its draft answer and
              // plan year end date go with the record they described.
              setPlanYearEndDate('')
              setAnswer('')
              setIssue(null)
              update((next) => removeSepSimpleActivity(next, account.id, year))
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="form-grid">
        <DateField
          label={`Plan year end date for ${year}`}
          hint={`Must fall in ${year}.`}
          value={planYearEndDate}
          onCommit={(next) => setPlanYearEndDate(next)}
        />
        <SelectField
          label={`Employer contribution for ${year}`}
          placeholder={NOT_ON_RECORD}
          value={answer}
          options={[
            { value: 'none', label: 'No employer contribution was made for this plan year' },
            { value: 'made', label: 'An employer contribution was made for this plan year' },
          ]}
          onCommit={(next) => setAnswer(next)}
        />
      </div>
      <RowIssue issue={issue} />
      <div className="add-row">
        <button type="button" className="btn btn-primary btn-small" onClick={confirm}>
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

function DeductibleContributionBlock({
  plan,
  person,
  years,
}: {
  plan: Readonly<Plan>
  person: Plan['household']['people'][number]
  years: readonly number[]
}) {
  const { update } = usePlan()
  const [issue, setIssue] = useState<string | null>(null)
  const recordedCount = years.filter(
    (year) => deductibleContributionFor(plan, person.id, year) !== null,
  ).length
  const firstYear = years[0]
  const lastYear = years[years.length - 1]
  const yearList = years.join(', ')
  return (
    <details data-eligibility-contributions={person.id}>
      <summary>
        {person.name}: deductible IRA contributions, {firstYear} to {lastYear} ({recordedCount} of{' '}
        {years.length} years on record)
      </summary>
      <p className="card-hint">
        RetireGolden needs one answer for each of these tax years before it can model a
        charitable gift from {person.name}&apos;s IRA. A year left blank stays unknown; it is not
        read as a year with no contributions.
      </p>
      {recordedCount === 0 ? (
        <div className="callout callout--info">
          <strong>
            No deductible IRA contributions in any of these years: {yearList}.
          </strong>{' '}
          Recording this writes one answer per year, and you can change any single year
          afterwards.
          <RowIssue issue={issue} />
          <div className="add-row">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => {
                // Every year the statement covers is checked before any of it
                // is written, so one claimed ID never leaves a partial history.
                const conflicts = conflictingContributionYears(plan, person.id, years)
                if (conflicts.length > 0) {
                  setIssue(bulkContributionConflictMessage(conflicts))
                  return
                }
                setIssue(null)
                update((next) => {
                  recordDeductibleContributionZeros(next, person.id, years)
                })
              }}
            >
              Record $0.00 for all {years.length} of these years
            </button>
          </div>
        </div>
      ) : null}
      {years.map((year) => (
        <DeductibleContributionRow key={year} plan={plan} person={person} year={year} />
      ))}
    </details>
  )
}

function DeductibleContributionRow({
  plan,
  person,
  year,
}: {
  plan: Readonly<Plan>
  person: Plan['household']['people'][number]
  year: number
}) {
  const { update } = usePlan()
  const recorded = deductibleContributionFor(plan, person.id, year)
  const [dollars, setDollars] = useState<number | null>(
    recorded === null ? null : centsToPlanDollars(recorded.amountCents),
  )
  const [issue, setIssue] = useState<string | null>(null)
  const cents = nonnegativeDollarsToCents(dollars)

  const confirm = () => {
    if (cents === null) {
      setIssue(`Enter the exact amount contributed for ${year}, or $0.00 if there was none.`)
      return
    }
    const conflict = eligibilityEvidenceIdConflict(plan, {
      role: 'deductibleContribution',
      donorPersonId: person.id,
      taxYear: year,
    })
    if (conflict !== null) {
      setIssue(conflict)
      return
    }
    setIssue(null)
    update((next) => recordDeductibleContribution(next, person.id, year, cents))
  }

  return (
    <div className="item-row" data-eligibility-contribution={`${person.id}:${year}`}>
      <div className="item-row-head">
        <span className="item-row-title">
          <Chip recorded={recorded !== null} />
          {year}
          {recorded === null ? '' : ` · ${formatUsdCents(recorded.amountCents)}`}
        </span>
        {recorded !== null ? (
          <button
            type="button"
            className="btn-ghost btn-ghost-danger"
            onClick={() => {
              // A removed year is unknown again, so the money field goes blank
              // rather than keeping the amount the record used to state.
              setDollars(null)
              setIssue(null)
              update((next) => removeDeductibleContribution(next, person.id, year))
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="form-grid">
        <MoneyField
          label={`Deductible IRA contributions for ${year}`}
          hint="Blank is not $0.00. Enter $0.00 to state that there were none."
          value={dollars}
          allowNull
          fractionDigits={2}
          onCommit={(next) => setDollars(next)}
          onInvalid={() => setDollars(null)}
        />
      </div>
      <RowIssue issue={issue} />
      <div className="add-row">
        <button type="button" className="btn btn-primary btn-small" onClick={confirm}>
          Record: {person.name} contributed{' '}
          {cents === null ? 'an amount' : formatUsdCents(cents)} to a deductible IRA for {year}
        </button>
      </div>
    </div>
  )
}

/** The eligibility-facts section of the Retirement actions card. */
export function RetirementActionEligibilityFactsEditor() {
  const { plan } = usePlan()
  const accounts = classifiableIraAccounts(plan)
  const donors = contributionDonors(plan, currentStartYear())
  if (accounts.length === 0 && donors.length === 0) return null
  return (
    <>
      <h3 id={RETIREMENT_ACTION_IRA_FACTS_ANCHOR}>{RETIREMENT_ACTION_IRA_FACTS_HEADING}</h3>
      <p className="card-hint">
        These are your own statements about your accounts, kept with the plan. Nothing here is
        recorded until you confirm it, and a blank answer stays blank. If you later change an
        account&apos;s type or owner, or a person&apos;s date of birth, RetireGolden removes the
        recorded facts that no longer apply.
      </p>
      {accounts.map((account) => (
        <IraClassificationRow key={account.id} plan={plan} account={account} />
      ))}
      {donors.map((entry) => (
        <DeductibleContributionBlock
          key={entry.person.id}
          plan={plan}
          person={entry.person}
          years={entry.years}
        />
      ))}
    </>
  )
}
