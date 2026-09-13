/**
 * Typed annual state tax worksheet facts under Assumptions.
 * One row per tax year; a state filter only controls which jurisdiction-specific
 * fields are visible — it never creates duplicate year rows.
 */

import { useMemo, useState } from 'react'

import type { Plan, StateTaxYearHouseholdFacts } from '@retiregolden/engine/model/plan'

import { usePlan } from '../planContextCore'
import { MoneyField, NumberField, SelectField } from '../fields'
import { TypeChip } from '../TypeChip'
import {
  addHouseholdYearFactsRow,
  householdYearFactsFor,
  patchHouseholdYearFacts,
  removeHouseholdYearFacts,
  STATE_TAX_WORKSHEET_ANCHOR,
  STATE_TAX_WORKSHEET_STATES,
  type StateTaxWorksheetState,
} from '../stateTaxFactsActions'
import { currentStartYear } from '../useProjection'

const STATE_FILING_OPTIONS: ReadonlyArray<{ value: NonNullable<StateTaxYearHouseholdFacts['stateFilingStatus']>; label: string }> = [
  { value: 'single', label: 'Single' },
  { value: 'marriedFilingJointly', label: 'Married filing jointly' },
  { value: 'marriedFilingSeparately', label: 'Married filing separately' },
  { value: 'headOfHousehold', label: 'Head of household' },
  { value: 'qualifyingSurvivingSpouse', label: 'Qualifying surviving spouse' },
]

const VT_ELECTION_OPTIONS: ReadonlyArray<{ value: NonNullable<StateTaxYearHouseholdFacts['vermontRetirementElection']>; label: string }> = [
  { value: 'civilService', label: 'Civil service retirement exclusion' },
  { value: 'socialSecurity', label: 'Social Security inclusion election' },
]

const ZERO_FEDERAL_EXEMPTION_OPTIONS: ReadonlyArray<{ value: NonNullable<StateTaxYearHouseholdFacts['zeroFederalExemptionReason']>; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'irc151d2', label: 'IRC §151(d)(2) — another taxpayer may claim you' },
  { value: 'other', label: 'Other documented reason' },
]

type OptionalBool = '' | 'true' | 'false'

type RecipientSocialSecurityRow = NonNullable<StateTaxYearHouseholdFacts['recipientSocialSecurity']>[number]
type RecipientSocialSecurityKey =
  | 'grossSocialSecurity'
  | 'federallyIncludedSocialSecurity'
  | 'grossRailroadTier1'
  | 'federallyIncludedRailroadTier1'

const RECIPIENT_SOCIAL_SECURITY_KEYS: readonly RecipientSocialSecurityKey[] = [
  'grossSocialSecurity',
  'federallyIncludedSocialSecurity',
  'grossRailroadTier1',
  'federallyIncludedRailroadTier1',
]

function optionalBoolValue(value: boolean | undefined): OptionalBool {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}

function parseOptionalBool(value: OptionalBool): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function OptionalBooleanSelect({
  label,
  help,
  value,
  onCommit,
}: {
  label: string
  help?: string
  value: boolean | undefined
  onCommit: (value: boolean | undefined) => void
}) {
  return (
    <SelectField
      label={label}
      help={help}
      value={optionalBoolValue(value)}
      options={[
        { value: '', label: 'Unknown' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ]}
      onCommit={(next) => onCommit(parseOptionalBool(next))}
    />
  )
}

function fieldVisible(stateFilter: StateTaxWorksheetState | '', state: StateTaxWorksheetState): boolean {
  return stateFilter === '' || stateFilter === state
}

function YearRowEditor({
  plan,
  year,
  stateFilter,
}: {
  plan: Plan
  year: number
  stateFilter: StateTaxWorksheetState | ''
}) {
  const { update } = usePlan()
  const row = householdYearFactsFor(plan, year) ?? { year }
  const people = plan.household.people
  const [recipientDrafts, setRecipientDrafts] = useState<Record<string, Partial<RecipientSocialSecurityRow>>>({})
  const [federalExemptionModeDraft, setFederalExemptionModeDraft] = useState<'' | 'count' | undefined>(undefined)
  const patch = (next: Partial<Omit<StateTaxYearHouseholdFacts, 'year'>>) =>
    update((draft) => patchHouseholdYearFacts(draft, year, next))

  const recipientRows = row.recipientSocialSecurity ?? []
  const setRecipientField = (
    ownerPersonId: string,
    key: RecipientSocialSecurityKey,
    value: number | null,
  ) => {
    const existing = recipientRows.find((entry) => entry.ownerPersonId === ownerPersonId)
    const draft = recipientDrafts[ownerPersonId]
    const merged: Partial<RecipientSocialSecurityRow> = {
      ...(existing ?? { ownerPersonId }),
      ...(draft ?? {}),
    }
    if (value === null) delete merged[key]
    else merged[key] = value
    const complete = RECIPIENT_SOCIAL_SECURITY_KEYS.every(
      (field) => typeof merged[field] === 'number' && Number.isFinite(merged[field]),
    )
    const others = recipientRows.filter((entry) => entry.ownerPersonId !== ownerPersonId)
    if (!complete) {
      // The persisted schema requires all four amounts. Keep an incomplete
      // edit local so a blank remains unknown and existing unrelated facts stay
      // in the plan until the recipient row is complete again.
      setRecipientDrafts((current) => ({ ...current, [ownerPersonId]: merged }))
      return
    }
    patch({ recipientSocialSecurity: [...others, merged as RecipientSocialSecurityRow] })
    setRecipientDrafts((current) => {
      const next = { ...current }
      delete next[ownerPersonId]
      return next
    })
  }

  const federalExemptionMode: 'unknown' | 'zero' | 'count' =
    federalExemptionModeDraft === 'count'
      ? 'count'
      : row.federalExemptionCount === undefined
        ? 'unknown'
        : !row.federalExemptionCount.known
          ? 'unknown'
          : row.federalExemptionCount.value === 0
            ? 'zero'
            : 'count'

  return (
    <div className="item-row" data-state-tax-year={year}>
      <div className="item-row-head">
        <span className="item-row-title">
          <TypeChip>Tax year {year}</TypeChip>
          <span>Household worksheet row</span>
        </span>
        <button
          type="button"
          className="btn-ghost btn-ghost-danger"
          aria-label={`Remove state tax worksheet facts for ${year}`}
          onClick={() => update((draft) => removeHouseholdYearFacts(draft, year))}
        >
          Remove
        </button>
      </div>
      <p className="card-hint">
        This row is shared across every state you lived in during {year}. Generic counts apply to the
        whole household; state-prefixed amounts stay on this row when you move — use the state filter
        above to show only the fields that matter for a jurisdiction.
      </p>
      <div className="form-grid">
        <SelectField
          label="State filing status (override)"
          help="Leave unknown to use the household filing status from the Household screen for this year."
          value={row.stateFilingStatus ?? ''}
          options={[{ value: '', label: 'Unknown — use household default' }, ...STATE_FILING_OPTIONS]}
          onCommit={(value) =>
            patch({
              stateFilingStatus:
                value === '' ? undefined : value,
            })
          }
        />
        <NumberField
          label="Personal exemption count"
          help="Taxpayers claiming a personal exemption on the state return. Blank stays unknown; enter 0 when none apply."
          value={row.exemptionTaxpayerCount ?? null}
          allowNull
          min={0}
          onCommit={(value) => patch({ exemptionTaxpayerCount: value === null ? undefined : Math.max(0, Math.round(value)) })}
        />
        <NumberField
          label="Dependent exemption count"
          help="Dependents claimed on the state return. Blank stays unknown; enter 0 when none apply."
          value={row.exemptionDependentCount ?? null}
          allowNull
          min={0}
          onCommit={(value) => patch({ exemptionDependentCount: value === null ? undefined : Math.max(0, Math.round(value)) })}
        />
        <NumberField
          label="Age 65+ exemption count"
          help="Household members age 65 or older qualifying for a state age exemption (Massachusetts, Illinois, Wisconsin, and similar). Derived from dates of birth when left blank."
          value={row.age65EligibleCount ?? null}
          allowNull
          min={0}
          onCommit={(value) => patch({ age65EligibleCount: value === null ? undefined : Math.max(0, Math.round(value)) })}
        />
        {(fieldVisible(stateFilter, 'VT') || fieldVisible(stateFilter, 'MA')) ? (
          <NumberField
            label="§63(f) qualification count"
            help="Vermont and Massachusetts age-blindness §63(f) qualifications. Blank stays unknown."
            value={row.section63fQualificationCount ?? null}
            allowNull
            min={0}
            onCommit={(value) => patch({ section63fQualificationCount: value === null ? undefined : Math.max(0, Math.round(value)) })}
          />
        ) : null}
        {fieldVisible(stateFilter, 'WV') ? (
          <>
            <SelectField
              label="Federal personal exemption count"
              help="West Virginia uses this count for its personal exemptions. Choose unknown, explicitly zero, or enter the count. A known zero also needs the reason below."
              value={federalExemptionMode}
              options={[
                { value: 'unknown', label: 'Unknown — not recorded' },
                { value: 'zero', label: 'Explicitly zero federal exemptions' },
                { value: 'count', label: 'Known count' },
              ]}
              onCommit={(mode) => {
                if (mode === 'unknown') {
                  setFederalExemptionModeDraft(undefined)
                  patch({ federalExemptionCount: undefined, zeroFederalExemptionReason: undefined })
                } else if (mode === 'zero') {
                  setFederalExemptionModeDraft(undefined)
                  patch({ federalExemptionCount: { known: true, value: 0 } })
                } else {
                  // Do not manufacture a known zero when switching from
                  // unknown; the numeric field must supply the count.
                  setFederalExemptionModeDraft('count')
                }
              }}
            />
            {federalExemptionMode === 'count' ? (
              <NumberField
                label="Federal exemption count (value)"
                value={row.federalExemptionCount?.known ? row.federalExemptionCount.value : null}
                allowNull
                min={0}
                onCommit={(value) => {
                  if (value === null) {
                    patch({ federalExemptionCount: undefined })
                    return
                  }
                  setFederalExemptionModeDraft(undefined)
                  patch({ federalExemptionCount: { known: true, value: Math.max(0, Math.round(value)) } })
                }}
              />
            ) : null}
            {row.federalExemptionCount?.known === true && row.federalExemptionCount.value === 0 ? (
              <SelectField
                label="Zero federal exemption reason"
                value={row.zeroFederalExemptionReason ?? ''}
                options={[{ value: '', label: 'Unknown' }, ...ZERO_FEDERAL_EXEMPTION_OPTIONS]}
                onCommit={(value) =>
                  patch({
                    zeroFederalExemptionReason:
                      value === '' ? undefined : value,
                  })
                }
              />
            ) : null}
          </>
        ) : null}
        {fieldVisible(stateFilter, 'WI') ? (
          <>
            <OptionalBooleanSelect
              label="Claimed as dependent (Wisconsin)"
              help="Whether anyone could claim you as a dependent on a federal return."
              value={row.claimedAsDependent}
              onCommit={(value) => patch({ claimedAsDependent: value })}
            />
            <MoneyField
              label="Wisconsin worksheet income (standard deduction)"
              help="The Wisconsin Form 1 income line used for the standard deduction worksheet — not federal AGI."
              value={row.wisconsinIncomeForStandardDeduction ?? null}
              allowNull
              onCommit={(value) => patch({ wisconsinIncomeForStandardDeduction: value === null ? undefined : value })}
            />
          </>
        ) : null}
        {fieldVisible(stateFilter, 'CT') ? (
          <MoneyField
            label="Connecticut AGI"
            help="Connecticut adjusted gross income from your CT return — not copied from federal AGI."
            value={row.connecticutAgi ?? null}
            allowNull
            onCommit={(value) => patch({ connecticutAgi: value === null ? undefined : value })}
          />
        ) : null}
        {fieldVisible(stateFilter, 'OR') ? (
          <>
            <MoneyField
              label="Oregon household income"
              help="Oregon household income for the retirement income credit worksheet."
              value={row.oregonHouseholdIncome ?? null}
              allowNull
              onCommit={(value) => patch({ oregonHouseholdIncome: value === null ? undefined : value })}
            />
          </>
        ) : null}
        {fieldVisible(stateFilter, 'VT') ? (
          <>
            <MoneyField
              label="Vermont U.S. obligation adjustment"
              help="Interest on U.S. obligations subtracted on the Vermont return."
              value={row.vermontUsObligationAdjustment ?? null}
              allowNull
              onCommit={(value) => patch({ vermontUsObligationAdjustment: value === null ? undefined : value })}
            />
            <SelectField
              label="Vermont retirement election"
              help="When both civil-service and Social Security exclusions could apply, which election you made."
              value={row.vermontRetirementElection ?? ''}
              options={[{ value: '', label: 'Unknown — not recorded' }, ...VT_ELECTION_OPTIONS]}
              onCommit={(value) =>
                patch({
                  vermontRetirementElection:
                    value === '' ? undefined : value,
                })
              }
            />
          </>
        ) : null}
        {fieldVisible(stateFilter, 'IA') ? (
          <>
            <MoneyField
              label="Iowa alternate tax net income"
              value={row.iowaTestNetIncome ?? null}
              allowNull
              onCommit={(value) => patch({ iowaTestNetIncome: value === null ? undefined : value })}
            />
            <MoneyField
              label="Iowa combined spouse net income"
              value={row.iowaCombinedSpouseTestNetIncome ?? null}
              allowNull
              onCommit={(value) => patch({ iowaCombinedSpouseTestNetIncome: value === null ? undefined : value })}
            />
            <MoneyField
              label="Iowa spouse taxable income"
              value={row.iowaSpouseTaxableIncome ?? null}
              allowNull
              onCommit={(value) => patch({ iowaSpouseTaxableIncome: value === null ? undefined : value })}
            />
            <MoneyField
              label="Iowa claimant net income"
              value={row.iowaClaimantTestNetIncome ?? null}
              allowNull
              onCommit={(value) => patch({ iowaClaimantTestNetIncome: value === null ? undefined : value })}
            />
            <OptionalBooleanSelect
              label="Iowa spouse NOL carry election"
              value={row.iowaSpouseNolCarryElection}
              onCommit={(value) => patch({ iowaSpouseNolCarryElection: value })}
            />
            <OptionalBooleanSelect
              label="Iowa claimed as dependent"
              value={row.iowaClaimedAsDependent}
              onCommit={(value) => patch({ iowaClaimedAsDependent: value })}
            />
            <OptionalBooleanSelect
              label="Iowa joint threshold election"
              value={row.iowaClaimantJointThreshold}
              onCommit={(value) => patch({ iowaClaimantJointThreshold: value })}
            />
            <OptionalBooleanSelect
              label="Iowa senior for threshold"
              value={row.iowaSeniorForThreshold}
              onCommit={(value) => patch({ iowaSeniorForThreshold: value })}
            />
            <OptionalBooleanSelect
              label="Iowa alternate tax facts complete"
              value={row.iowaAlternateTaxFactsComplete}
              onCommit={(value) => patch({ iowaAlternateTaxFactsComplete: value })}
            />
            <OptionalBooleanSelect
              label="Iowa alternate tax eligible"
              value={row.iowaAlternateTaxEligible}
              onCommit={(value) => patch({ iowaAlternateTaxEligible: value })}
            />
          </>
        ) : null}
      </div>
      {(fieldVisible(stateFilter, 'VT') || fieldVisible(stateFilter, 'OR')) && people.length > 0 ? (
        <details className="nested-form-section">
          <summary>Per-person Social Security and Railroad Tier I (VT / OR)</summary>
          <p className="card-hint">
            Enter gross and federally included amounts per recipient. Leave a money field blank to keep it unknown;
            enter 0 when the return shows zero.
          </p>
          {people.map((person) => {
            const persisted = recipientRows.find((row) => row.ownerPersonId === person.id)
            const draft = recipientDrafts[person.id]
            const entry = draft ?? persisted
            return (
              <div key={person.id} className="form-grid" data-recipient-ss={person.id}>
                <h4 className="field-span-full">{person.name}</h4>
                {draft && !RECIPIENT_SOCIAL_SECURITY_KEYS.every((field) => typeof draft[field] === 'number') ? (
                  <p className="field-note field-span-full" role="status">
                    Complete all four recipient amounts to record this row. Existing recorded amounts remain preserved while a field is blank.
                  </p>
                ) : null}
                <MoneyField
                  label="Gross Social Security"
                  value={entry?.grossSocialSecurity ?? null}
                  allowNull
                  onCommit={(value) => setRecipientField(person.id, 'grossSocialSecurity', value)}
                />
                <MoneyField
                  label="Federally included Social Security"
                  value={entry?.federallyIncludedSocialSecurity ?? null}
                  allowNull
                  onCommit={(value) => setRecipientField(person.id, 'federallyIncludedSocialSecurity', value)}
                />
                <MoneyField
                  label="Gross Railroad Tier I"
                  value={entry?.grossRailroadTier1 ?? null}
                  allowNull
                  onCommit={(value) => setRecipientField(person.id, 'grossRailroadTier1', value)}
                />
                <MoneyField
                  label="Federally included Railroad Tier I"
                  value={entry?.federallyIncludedRailroadTier1 ?? null}
                  allowNull
                  onCommit={(value) => setRecipientField(person.id, 'federallyIncludedRailroadTier1', value)}
                />
              </div>
            )
          })}
        </details>
      ) : null}
    </div>
  )
}

export function StateTaxFactsEditor() {
  const { plan, update } = usePlan()
  const startYear = currentStartYear()
  const [stateFilter, setStateFilter] = useState<StateTaxWorksheetState | ''>('')
  const [draftYear, setDraftYear] = useState(startYear)
  const years = useMemo(
    () => [...plan.stateTaxFacts.householdYearFacts].map((row) => row.year).sort((a, b) => a - b),
    [plan.stateTaxFacts.householdYearFacts],
  )

  return (
    <div id={STATE_TAX_WORKSHEET_ANCHOR} className="nested-form-section" data-testid="state-tax-facts-editor">
      <h3>State tax worksheet facts</h3>
      <p className="card-hint">
        Optional per-year household facts some state returns need beyond federal AGI. Add a row for each tax year you
        want to characterize; blank fields stay unknown, and an explicit 0 stays zero. RetireGolden does not copy
        federal AGI into state worksheet lines or pre-fill future years.
      </p>
      <div className="form-grid">
        <SelectField
          label="Show fields for"
          help="Filters which jurisdiction-specific controls appear below. Changing this never splits or duplicates year rows."
          value={stateFilter}
          options={[
            { value: '', label: 'All supported states' },
            ...STATE_TAX_WORKSHEET_STATES.map((state) => ({ value: state, label: state })),
          ]}
          onCommit={(value) => setStateFilter(value)}
        />
        <NumberField
          label="Add tax year"
          help="One shared row per calendar year. Pick a year, then add it once."
          value={draftYear}
          min={1900}
          max={2200}
          onCommit={(value) => setDraftYear(Math.round(value ?? startYear))}
        />
      </div>
      <div className="add-row">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => update((draft) => void addHouseholdYearFactsRow(draft, draftYear))}
        >
          + Add {draftYear} worksheet row
        </button>
      </div>
      {years.length === 0 ? (
        <p className="muted">No annual state worksheet rows on record yet.</p>
      ) : (
        years.map((year) => <YearRowEditor key={year} plan={plan} year={year} stateFilter={stateFilter} />)
      )}
    </div>
  )
}
