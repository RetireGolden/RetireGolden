/** Per-account form fields. */

import { useState } from 'react'

import type { Account, InheritedBeneficiary, Plan } from '@retiregolden/engine/model/plan'
import { AllocationPanel, ReturnEstimatorModal } from './AllocationPanel'
import {
  ACCOUNT_LABEL,
  clampedAnnuityStartAge,
  EVEN_START_WEIGHTS,
  isAllocatable,
  isIndividuallyOwnedAccount,
  localCalendarDateIso,
  showTaxExemptAllocationDoubleCountWarning,
  TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING,
  type AllocatableAccount,
} from './sectionHelpers'
import { usePlan } from '../planContextCore'
import { ROTH_FIVE_YEAR_INCOMPLETE_NOTE } from '../../report/reportModel'
import { CheckboxField, DateField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { currentStartYear } from '../useProjection'
import { LEARN } from '../learnLinks'
import { updateAccountField } from '../eligibilityFactActions'
import { AnnuityAccountEditor, PensionAccountEditor } from './PensionAnnuityAccountEditors'
import { DebtAccountEditor, PropertyAccountEditor } from './PropertyDebtAccountEditors'

function ownerOptions(plan: Plan, type: Account['type']) {
  const peopleOptions = plan.household.people.map((p) => ({ value: p.id, label: p.name }))
  return isIndividuallyOwnedAccount(type) ? peopleOptions : [{ value: 'joint', label: 'Joint' }, ...peopleOptions]
}

const TAX_EXEMPT_INTEREST_HELP =
  "Annual tax-exempt interest from municipal bonds held in this account, as a percent of the account's whole start-of-year balance. Weight a municipal sleeve's yield by its share of the account, and enter that yield here or in Interest yield, not in both fields. This income never joins ordinary taxable income, but it counts toward the income that decides how much of your Social Security is taxable, toward ACA household MAGI, and toward the income Medicare reads for IRMAA two years later. Two limits to know: the model treats none of it as private-activity-bond interest for AMT, and it does not add any of it to state taxable income even though some states tax municipal bonds from other states."

function TaxExemptInterestYieldField({
  account,
  onCommit,
}: {
  account: Extract<Account, { type: 'taxable' }>
  onCommit: (value: number) => void
}) {
  return (
    <>
      <PercentField
        label="Tax-exempt interest yield"
        help={TAX_EXEMPT_INTEREST_HELP}
        value={account.taxExemptInterestYieldPct ?? 0}
        onCommit={(v) => onCommit(v ?? 0)}
      />
      {showTaxExemptAllocationDoubleCountWarning(account) ? (
        <p className="field-hint" style={{ color: 'var(--warn)' }} role="status">
          {TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING}
        </p>
      ) : null}
    </>
  )
}

type InheritedRetirementAccount = Extract<Account, { type: 'traditional' | 'roth' }>
type InheritedDetails = NonNullable<InheritedRetirementAccount['inherited']>

const EDB_SOURCE = {
  label: 'eCFR §1.401(a)(9)-4(e)',
  url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-4',
}
const ELECTION_SOURCE = {
  label: 'eCFR §1.408-8(c)',
  url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
}
const TEN_YEAR_ELECTION_SOURCE = {
  label: 'eCFR §1.401(a)(9)-3(c)(5)(iii)',
  url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-3',
}
const INHERITED_ROTH_CONTRIBUTION_BASIS_HINT =
  'The model does not use contribution basis on an inherited Roth; its withdrawals are modeled untaxed with the five-year caution below.'
const INHERITED_ROTH_EMPLOYER_HINT =
  'Workplace-plan schedules are not modeled; this account uses the simpler planning estimate, and these facts are kept for review.'
const INHERITED_CONTRIBUTIONS_BLOCKED_HINT = 'Inherited accounts cannot receive contributions.'

/** Contributions stay blocked on inherited Roth accounts and on treat-as-own traditional accounts (WS5 residual). */
function inheritedContributionsBlocked(account: Account): boolean {
  if (!('inherited' in account) || account.inherited === undefined) return false
  if (account.type === 'roth') return true
  if (account.type === 'traditional') {
    return account.inherited.beneficiary?.election === 'treat-as-own'
  }
  return false
}

function beneficiaryWithClass(
  beneficiaryClass: InheritedBeneficiary['beneficiaryClass'],
  prior?: InheritedBeneficiary,
): InheritedBeneficiary {
  const next: InheritedBeneficiary = {
    beneficiaryClass,
    provenance: prior?.provenance ?? { source: 'user-entered', asOf: localCalendarDateIso() },
  }
  if (prior?.ownerBirthYear !== undefined) next.ownerBirthYear = prior.ownerBirthYear
  if (prior?.ownerBirthMonth !== undefined) next.ownerBirthMonth = prior.ownerBirthMonth
  if (prior?.ownerBirthDay !== undefined) next.ownerBirthDay = prior.ownerBirthDay
  if (prior?.ownerYearOfDeathRmdSatisfied !== undefined) {
    next.ownerYearOfDeathRmdSatisfied = prior.ownerYearOfDeathRmdSatisfied
  }
  if (prior?.roth5YearStartYear !== undefined) next.roth5YearStartYear = prior.roth5YearStartYear
  return next
}

function BeneficiaryDetails({
  account,
  inherited,
  planningYear,
  onCommit,
}: {
  account: InheritedRetirementAccount
  inherited: InheritedDetails
  planningYear: number
  onCommit: (inherited: InheritedDetails) => void
}) {
  const [showDetails, setShowDetails] = useState(account.type === 'roth' || inherited.beneficiary !== undefined)
  const [showBirthPrecision, setShowBirthPrecision] = useState(
    inherited.beneficiary?.ownerBirthMonth !== undefined || inherited.beneficiary?.ownerBirthDay !== undefined,
  )
  const beneficiary = inherited.beneficiary
  const commit = (next: InheritedBeneficiary) => onCommit({ ...inherited, beneficiary: next })
  const isDesignatedIndividual = beneficiary?.beneficiaryClass === 'designated-individual'
  const isSpouse = beneficiary?.edbCategory === 'surviving-spouse'
  const mayElectTenYear =
    isDesignatedIndividual &&
    beneficiary?.edbCategory !== undefined &&
    beneficiary.edbCategory !== 'none' &&
    !inherited.decedentHadStartedRmds
  const mayElectTreatAsOwn = isSpouse && beneficiary?.soleBeneficiary === true

  return (
    <div className="nested-form-section field-span-full" data-testid="beneficiary-details-panel">
      <h4>Beneficiary details</h4>
      {account.type === 'traditional' ? (
        <CheckboxField
          label="Use beneficiary details"
          help="Optional. Without these details the account keeps the simpler planning estimate. Adding them lets the projection follow the IRS schedule that matches your facts."
          value={showDetails}
          onCommit={(value) => {
            setShowDetails(value)
            if (!value) onCommit({ ...inherited, beneficiary: undefined })
          }}
        />
      ) : (
        <p className="field-hint">Inherited Roth accounts need beneficiary details; the simpler planning estimate never covered Roth.</p>
      )}
      {showDetails ? (
        <div className="form-grid nested-control-grid">
          <SelectField
            label="Beneficiary class"
            help="Choose the person or legal recipient named for this account at the owner's death. Estate, trust, entity, and successor cases are recorded but not modeled; the planner shows the limitation rather than guessing a schedule."
            source={{ label: 'eCFR §1.401(a)(9)-4(c)', url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-4' }}
            value={beneficiary?.beneficiaryClass ?? ''}
            placeholder="Choose beneficiary class"
            options={[
              { value: 'designated-individual', label: 'Designated individual' },
              { value: 'estate', label: 'Estate (not modeled)' },
              { value: 'trust', label: 'Trust (not modeled)' },
              { value: 'entity', label: 'Entity (not modeled)' },
              { value: 'successor-beneficiary', label: 'Successor beneficiary (not modeled)' },
            ]}
            onCommit={(beneficiaryClass) => commit(beneficiaryWithClass(beneficiaryClass, beneficiary))}
          />
          {beneficiary && isDesignatedIndividual ? (
            <>
              <SelectField
                label="Eligible designated beneficiary category"
                help="A category fixed at the owner's death. Select None for an ordinary designated beneficiary. Disability and chronic illness are legal determinations; enter them only if they have been established."
                source={EDB_SOURCE}
                value={beneficiary.edbCategory ?? ''}
                placeholder="Choose EDB category"
                options={[
                  { value: 'none', label: 'None (ordinary designated beneficiary)' },
                  { value: 'surviving-spouse', label: 'Surviving spouse' },
                  { value: 'minor-child', label: 'Minor child of the owner' },
                  { value: 'disabled', label: 'Disabled' },
                  { value: 'chronically-ill', label: 'Chronically ill' },
                  { value: 'not-more-than-10-years-younger', label: 'Not more than 10 years younger' },
                ]}
                onCommit={(edbCategory) => {
                  // Changing category always drops election-scoped fields so a
                  // prior spouse or treat-as-own fact cannot linger under a new class.
                  const next = {
                    ...beneficiary,
                    edbCategory,
                    election: undefined,
                    treatAsOwnElectionYear: undefined,
                  }
                  if (edbCategory !== 'surviving-spouse') {
                    next.spouseUnlimitedWithdrawalRight = undefined
                  }
                  commit(next)
                }}
              />
              <NumberField
                label="Beneficiary birth year"
                help="The beneficiary's year of birth supports life-expectancy schedules and checks that the asserted beneficiary was alive when the owner died."
                source={{ label: 'eCFR §1.401(a)(9)-4', url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-4' }}
                value={beneficiary.beneficiaryBirthYear ?? null}
                allowNull
                min={1900}
                max={2100}
                onCommit={(value) => commit({ ...beneficiary, beneficiaryBirthYear: value ?? undefined })}
              />
              <SelectField
                label="Sole beneficiary"
                help="Whether this person is the sole beneficiary. If there are several beneficiaries, this planner does not model separate-account facts and will show that limitation instead of a classified schedule."
                source={{ label: 'eCFR §1.401(a)(9)-8(a)', url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-8' }}
                value={
                  beneficiary.soleBeneficiary === true
                    ? 'true'
                    : beneficiary.soleBeneficiary === false
                      ? 'false'
                      : ''
                }
                placeholder="Choose..."
                options={[
                  { value: 'true', label: 'Yes, sole beneficiary' },
                  { value: 'false', label: 'No, one of several' },
                ]}
                onCommit={(value) => {
                  const soleBeneficiary = value === 'true'
                  if (!soleBeneficiary && beneficiary.election === 'treat-as-own') {
                    commit({
                      ...beneficiary,
                      soleBeneficiary,
                      election: undefined,
                      treatAsOwnElectionYear: undefined,
                      spouseUnlimitedWithdrawalRight: undefined,
                    })
                    return
                  }
                  commit({ ...beneficiary, soleBeneficiary })
                }}
              />
              {isSpouse || mayElectTenYear ? (
                <SelectField
                  label="Distribution election"
                  help="Record an explicit election only when it was made. The available choices depend on the beneficiary category; this planner does not infer an election from inaction. Spouse remain-beneficiary and treat-as-own elections are governed by Treas. Reg. §1.408-8(c); electing the 10-year rule is governed by Treas. Reg. §1.401(a)(9)-3(c)(5)(iii)."
                  source={
                    beneficiary.election === 'ten-year-election'
                      ? TEN_YEAR_ELECTION_SOURCE
                      : ELECTION_SOURCE
                  }
                  value={beneficiary.election ?? 'none'}
                  options={[
                    { value: 'none', label: 'No separate election recorded' },
                    ...(isSpouse ? [{ value: 'remain-beneficiary', label: 'Remain beneficiary' }] : []),
                    ...(mayElectTreatAsOwn ? [{ value: 'treat-as-own', label: 'Treat as own IRA' }] : []),
                    ...(mayElectTenYear ? [{ value: 'ten-year-election', label: 'Elect 10-year rule' }] : []),
                  ]}
                  onCommit={(committed) => {
                    // The select's options are drawn from the schema's own
                    // election values, so the committed string narrows safely.
                    const election = committed as NonNullable<InheritedBeneficiary['election']>
                    if (election === 'treat-as-own') {
                      commit({ ...beneficiary, election })
                      return
                    }
                    // Leaving treat-as-own clears the election-year fact; parse
                    // rejects treatAsOwnElectionYear without that election.
                    commit({
                      ...beneficiary,
                      election,
                      treatAsOwnElectionYear: undefined,
                      spouseUnlimitedWithdrawalRight: undefined,
                    })
                  }}
                />
              ) : null}
              {beneficiary.election === 'treat-as-own' ? (
                <>
                  <NumberField
                    label="Treat-as-own election year"
                    help="The calendar year the surviving spouse's election takes effect. Before that year, this remains an inherited account in the model."
                    source={ELECTION_SOURCE}
                    value={beneficiary.treatAsOwnElectionYear ?? null}
                    allowNull
                    min={inherited.ownerDeathYear}
                    max={2100}
                    onCommit={(value) => commit({ ...beneficiary, treatAsOwnElectionYear: value ?? undefined })}
                  />
                  <CheckboxField
                    label="Spouse has unlimited withdrawal right"
                    help="A treat-as-own election requires the surviving spouse to have an unlimited right to withdraw from the account. Confirm the account terms with a professional if uncertain."
                    source={ELECTION_SOURCE}
                    value={beneficiary.spouseUnlimitedWithdrawalRight === true}
                    onCommit={(spouseUnlimitedWithdrawalRight) => commit({ ...beneficiary, spouseUnlimitedWithdrawalRight })}
                  />
                </>
              ) : null}
            </>
          ) : null}
          {beneficiary ? (
            <>
              <NumberField
                label="Original owner birth year"
                help="The original owner's birth year helps check the required-beginning-date boundary and, in some schedules, the applicable life-expectancy divisor. Year-only information can leave a boundary unsettled."
                source={{ label: 'eCFR §1.401(a)(9)-5', url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5' }}
                value={beneficiary.ownerBirthYear ?? null}
                allowNull
                min={1900}
                max={inherited.ownerDeathYear}
                onCommit={(value) => commit({ ...beneficiary, ownerBirthYear: value ?? undefined })}
              />
              {showBirthPrecision ? (
                <>
                  <NumberField
                    label="Original owner birth month"
                    help="Optional month precision for required-beginning-date boundary cases. Supply a real birth date when you add day precision."
                    source={{ label: 'eCFR §1.401(a)(9)-5', url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5' }}
                    value={beneficiary.ownerBirthMonth ?? null}
                    allowNull
                    min={1}
                    max={12}
                    onCommit={(value) => commit({ ...beneficiary, ownerBirthMonth: value ?? undefined })}
                  />
                  <NumberField
                    label="Original owner birth day"
                    help="Optional day precision for required-beginning-date boundary cases. Month and day must form a real calendar date with the birth year."
                    source={{ label: 'eCFR §1.401(a)(9)-5', url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5' }}
                    value={beneficiary.ownerBirthDay ?? null}
                    allowNull
                    min={1}
                    max={31}
                    onCommit={(value) => commit({ ...beneficiary, ownerBirthDay: value ?? undefined })}
                  />
                </>
              ) : (
                <div className="field">
                  <span className="field-label">Original owner birth date</span>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setShowBirthPrecision(true)}>
                    Add month/day precision
                  </button>
                </div>
              )}
              {inherited.decedentHadStartedRmds ? (
                <SelectField
                  label="Owner's year-of-death RMD was satisfied"
                  help="If the owner had started RMDs, record whether the owner's final-year RMD was already distributed. Leaving this unanswered treats the RMD as not taken in the schedule; choose No or not sure to commit that explicitly."
                  source={{ label: 'eCFR §1.408-8(e)', url: 'https://www.ecfr.gov/current/title-26/section-1.408-8' }}
                  value={
                    beneficiary.ownerYearOfDeathRmdSatisfied === true
                      ? 'true'
                      : beneficiary.ownerYearOfDeathRmdSatisfied === false
                        ? 'false'
                        : ''
                  }
                  placeholder="Choose..."
                  options={[
                    { value: 'true', label: 'Yes, already taken' },
                    { value: 'false', label: 'No or not sure' },
                  ]}
                  onCommit={(value) =>
                    commit({ ...beneficiary, ownerYearOfDeathRmdSatisfied: value === 'true' })
                  }
                />
              ) : null}
              {account.type === 'roth' ? (
                <>
                  <NumberField
                    label="Roth 5-year start year"
                    help="The original owner's first Roth contribution year starts the five-taxable-year evidence used for inherited-Roth taxability. It is planning evidence, not a filing record."
                    source={{ label: 'eCFR §1.408A-6', url: 'https://www.ecfr.gov/current/title-26/section-1.408A-6' }}
                    value={beneficiary.roth5YearStartYear ?? null}
                    allowNull
                    min={1900}
                    max={2100}
                    onCommit={(value) => commit({ ...beneficiary, roth5YearStartYear: value ?? undefined })}
                  />
                  {beneficiary.roth5YearStartYear !== undefined &&
                  beneficiary.roth5YearStartYear + 4 >= planningYear ? (
                    <p className="field-hint" data-testid="roth-five-year-incomplete-hint">
                      {ROTH_FIVE_YEAR_INCOMPLETE_NOTE}
                    </p>
                  ) : null}
                </>
              ) : null}
              <TextField
                label="Fact source"
                help="Who or what supplied these beneficiary facts. The default records that you entered them; use a concise source such as a plan document or custodian statement when appropriate."
                value={beneficiary.provenance.source}
                onCommit={(source) => commit({ ...beneficiary, provenance: { ...beneficiary.provenance, source } })}
              />
              <DateField
                label="Facts as of"
                help="The calendar date these beneficiary facts were checked. Review dates help keep planning inputs distinct from legal or tax administration records."
                value={beneficiary.provenance.asOf}
                onCommit={(asOf) => commit({ ...beneficiary, provenance: { ...beneficiary.provenance, asOf } })}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function AccountFields({ account, index }: { account: Account; index: number }) {
  const { plan, update } = usePlan()
  const planningYear = currentStartYear()
  const [estimating, setEstimating] = useState(false)
  const set = <K extends string>(key: K, value: unknown) =>
    update((d) => {
      updateAccountField(d, index, key, value)
    })
  const setOwner = (next: string | null) => {
    if (account.type !== 'annuity') {
      set('ownerPersonId', next)
      return
    }
    // A different annuity owner can change the applicable RMD-age ceiling.
    // Commit the owner and any required start-age clamp together so this shared
    // identity field cannot leave an annuity in a parse-invalid state.
    const clamped = clampedAnnuityStartAge(plan, { ...account, ownerPersonId: next })
    update((draft) => {
      updateAccountField(draft, index, 'ownerPersonId', next)
      if (clamped !== null) updateAccountField(draft, index, 'startAge', clamped)
    })
  }
  return (
    <div className="form-grid">
      <TextField label="Name" value={account.name} onCommit={(v) => set('name', v || ACCOUNT_LABEL[account.type])} />
      <SelectField
        label="Owner"
        value={account.ownerPersonId ?? 'joint'}
        options={ownerOptions(plan, account.type)}
        onCommit={(v) => setOwner(v === 'joint' ? null : v)}
      />
      {'balance' in account ? <MoneyField label={account.type === 'debt' ? 'Balance owed' : 'Balance'} value={account.balance} onCommit={(v) => set('balance', v ?? 0)} /> : null}
      {account.type === 'taxable' || account.type === 'equityComp' ? <MoneyField label="Cost basis" hint="Aggregate basis; gains realize pro-rata." value={account.costBasis} onCommit={(v) => set('costBasis', v ?? 0)} /> : null}
      {account.type === 'taxable' && account.allocation === undefined ? (
        <>
          <PercentField
            label="Interest yield"
            help="Annual taxable interest yield generated from this brokerage account before market-price growth."
            value={account.interestYieldPct ?? 0}
            onCommit={(v) => set('interestYieldPct', v ?? 0)}
          />
          <PercentField
            label="Dividend yield"
            help="Annual dividend yield generated from this brokerage account before market-price growth."
            value={account.dividendYieldPct ?? 0}
            onCommit={(v) => set('dividendYieldPct', v ?? 0)}
          />
          <PercentField
            label="Qualified dividends"
            help="Share of dividends taxed at long-term capital-gain rates federally. The rest is taxed as ordinary dividends."
            value={(account.qualifiedRatio ?? 0.85) * 100}
            onCommit={(v) => set('qualifiedRatio', Math.min(1, Math.max(0, (v ?? 85) / 100)))}
          />
          <TaxExemptInterestYieldField account={account} onCommit={(v) => set('taxExemptInterestYieldPct', v)} />
          <CheckboxField
            label="Reinvest yield"
            help="When checked, interest and dividends stay in the brokerage account and add to basis. When unchecked, they flow into annual cash surplus."
            value={account.reinvestDividends ?? true}
            onCommit={(v) => set('reinvestDividends', v)}
          />
        </>
      ) : null}
      {account.type === 'taxable' && account.allocation !== undefined ? (
        <>
          <PercentField
            label="Interest yield override"
            help="Optional. Leave blank to use the blended interest yield from the class mix (shown as 'This year's blend' above). Enter a value to override it for this account."
            hint="Blank = use blended yield."
            value={account.interestYieldPct ?? null}
            allowNull
            onCommit={(v) => set('interestYieldPct', v ?? undefined)}
          />
          <PercentField
            label="Dividend yield override"
            help="Optional. Leave blank to use the blended dividend yield from the class mix. Enter a value to override it for this account."
            hint="Blank = use blended yield."
            value={account.dividendYieldPct ?? null}
            allowNull
            onCommit={(v) => set('dividendYieldPct', v ?? undefined)}
          />
          <PercentField
            label="Qualified dividends override"
            help="Optional. Leave blank to use the blended qualified share from the class mix. Enter a value to override the share of dividends taxed at long-term capital-gain rates."
            hint="Blank = use blended share."
            value={account.qualifiedRatio === undefined ? null : account.qualifiedRatio * 100}
            allowNull
            onCommit={(v) => set('qualifiedRatio', v === null || v === undefined ? undefined : Math.min(1, Math.max(0, v / 100)))}
          />
          <TaxExemptInterestYieldField account={account} onCommit={(v) => set('taxExemptInterestYieldPct', v)} />
          <CheckboxField
            label="Reinvest yield"
            help="When checked, interest and dividends stay in the brokerage account and add to basis. When unchecked, they flow into annual cash surplus."
            value={account.reinvestDividends ?? true}
            onCommit={(v) => set('reinvestDividends', v)}
          />
        </>
      ) : null}
      {account.type === 'equityComp' ? (
        <>
          <SelectField
            label="Availability"
            value={account.vestingMode}
            options={[
              { value: 'cliff', label: 'Locked until vest date' },
              { value: 'final', label: 'Available now' },
            ]}
            onCommit={(v) => set('vestingMode', v)}
          />
          {account.vestingMode === 'cliff' ? (
            <TextField label="Vest date" hint="YYYY-MM-DD; balance counts in net worth but is unavailable for withdrawals before this year." value={account.vestDate ?? ''} onCommit={(v) => set('vestDate', v || null)} />
          ) : null}
        </>
      ) : null}
      {account.type === 'traditional' || account.type === 'roth' ? (
        <SelectField
          label="Kind"
          value={account.kind}
          options={[
            { value: 'employer', label: '401(k)/403(b)' },
            { value: 'ira', label: 'IRA' },
          ]}
          onCommit={(v) => set('kind', v)}
        />
      ) : null}
      {account.type === 'roth' && !account.inherited ? (
        <MoneyField
          label="Contribution basis"
          help="Your total direct Roth contributions (today's dollars). Contributions come out tax- and penalty-free at any age, before conversions and earnings, so this is what you can tap penalty-free in early retirement. Leave blank to treat the whole current balance as contributions (the safe default). Roth conversions made inside this app automatically start their own 5-year clocks."
          hint="Blank = treat whole balance as contributions."
          value={account.contributionBasis ?? null}
          allowNull
          onCommit={(v) => set('contributionBasis', v ?? undefined)}
        />
      ) : null}
      {account.type === 'roth' && account.inherited ? (
        <p className="field-hint" data-testid="inherited-roth-contribution-basis-hint">
          {INHERITED_ROTH_CONTRIBUTION_BASIS_HINT}
        </p>
      ) : null}
      {account.type === 'traditional' && account.kind === 'ira' && !account.inherited ? (
        <MoneyField
          label="Nondeductible basis (Form 8606)"
          help="Planning estimate for after-tax money already inside this traditional IRA. It affects projected withdrawals and Roth conversions under the owner-wide pro-rata rule, but it is not a complete annual tax record and cannot establish filing-grade action evidence. Leave blank if all your IRA money was pre-tax."
          hint="Planning input only; blank = fully pre-tax IRA."
          value={account.nondeductibleBasis ?? null}
          allowNull
          onCommit={(v) => set('nondeductibleBasis', v ?? undefined)}
        />
      ) : null}
      {account.type === 'hsa' ? (
        <>
          <SelectField
            label="Withdrawal treatment"
            help="How HSA withdrawals are taxed. 'Assume all qualified' treats every withdrawal as a tax- and penalty-free medical reimbursement (simplest; use if you track receipts). 'Cap at modeled medical costs' only lets withdrawals up to your modeled healthcare premiums and care costs come out tax-free. The excess is taxed as ordinary income and, before 65, penalized 20%. Leave on the default to keep the conservative legacy behavior (tax-free but penalized before 65)."
            value={account.withdrawalTreatment ?? 'legacy'}
            options={[
              { value: 'legacy', label: 'Default (tax-free, penalized before 65)' },
              { value: 'assumeAllQualified', label: 'Assume all withdrawals qualified' },
              { value: 'capByMedicalExpenses', label: 'Cap at modeled medical costs' },
            ]}
            onCommit={(v) => {
              const next = v === 'legacy' ? undefined : (v as 'assumeAllQualified' | 'capByMedicalExpenses')
              set('withdrawalTreatment', next)
              if (next !== 'capByMedicalExpenses' && account.reimburseLater) set('reimburseLater', undefined)
            }}
          />
          {account.withdrawalTreatment === 'capByMedicalExpenses' ? (
            <CheckboxField
              label="Accumulate unreimbursed expenses (reimburse later)"
              help="Model the 'pay medical costs out of pocket now, reimburse yourself from the HSA later' strategy. Modeled medical costs you don't withdraw for in a given year accumulate as a carryover that future withdrawals can draw against tax-free, letting the HSA keep growing while the reimbursable balance grows with it."
              value={account.reimburseLater === true}
              onCommit={(v) => set('reimburseLater', v ? true : undefined)}
            />
          ) : null}
          <SelectField
            label="Beneficiary"
            help="Who inherits this HSA. A spouse inherits it as their own HSA and it passes untaxed. Any other beneficiary (child, estate, single-person plans) receives a fully taxable distribution of the balance in the year of death, so the after-tax estate metric taxes the remaining HSA at your assumed heir tax rate, like a traditional account."
            value={account.beneficiary ?? 'spouse'}
            options={[
              { value: 'spouse', label: 'Spouse (inherits as HSA, untaxed)' },
              { value: 'nonSpouse', label: 'Non-spouse (fully taxable to heir)' },
            ]}
            onCommit={(v) => set('beneficiary', v === 'spouse' ? undefined : 'nonSpouse')}
          />
        </>
      ) : null}
      {account.type === 'traditional' && plan.household.people.length === 2 ? (
        <CheckboxField
          label="Spouse is sole beneficiary"
          help="If checked and your spouse is more than 10 years younger, RMDs use the larger IRS Joint Life divisor. Leave unchecked when the beneficiary is a child, trust, estate, or split, RMDs then use the standard Uniform Lifetime Table."
          value={account.spouseSoleBeneficiary === true}
          onCommit={(v) => set('spouseSoleBeneficiary', v)}
        />
      ) : null}
      {account.type === 'traditional' || account.type === 'roth' ? (
        <CheckboxField
          label={account.type === 'roth' ? 'Inherited Roth account' : 'Inherited account'}
          help={account.type === 'roth'
            ? "An inherited Roth account follows beneficiary distribution rules and requires beneficiary details in this planner. The original Roth owner is treated as dying before the required beginning date."
            : "An account inherited from its original owner. The distribution schedule depends on the beneficiary facts below: many beneficiaries must empty the account within 10 years, while a surviving spouse or other eligible beneficiary may follow a life-expectancy schedule. Distributions are taxable but never carry the 10% early-withdrawal penalty, and the account is exempt from your own age-based RMDs."}
          value={account.inherited !== undefined}
          onCommit={(v) => {
            if (!v) {
              set('inherited', undefined)
              return
            }
            const inherited = {
              ownerDeathYear: new Date().getFullYear() - 1,
              decedentHadStartedRmds: false,
            }
            if (account.type === 'roth') {
              update((draft) => {
                const target = draft.accounts[index] as Extract<Account, { type: 'roth' }>
                target.inherited = inherited
                target.annualContribution = 0
                target.contributionSchedule = undefined
                target.contributionBasis = undefined
              })
              return
            }
            update((draft) => {
              const target = draft.accounts[index] as Extract<Account, { type: 'traditional' }>
              target.inherited = inherited
              target.sepp = undefined
            })
          }}
        />
      ) : null}
      {(account.type === 'traditional' || account.type === 'roth') && account.inherited ? (
        <>
          <NumberField
            label="Original owner's death year"
            hint="Starts the distribution clock. What is due each year depends on the beneficiary facts below."
            value={account.inherited.ownerDeathYear}
            min={1990}
            max={2100}
            onCommit={(v) => set('inherited', { ...account.inherited, ownerDeathYear: Math.round(v ?? new Date().getFullYear() - 1) })}
          />
          {account.type === 'traditional' ? (
            <CheckboxField
              label="Owner had started RMDs"
              help="If the original owner had reached their required beginning date, you must also take an annual RMD in years 1–9 of the window (based on your single life expectancy), not just empty it by year 10."
              value={account.inherited!.decedentHadStartedRmds}
              onCommit={(v) => {
                // The surrounding guard renders this control only when the
                // inherited block exists; closures cannot carry the narrowing.
                const inheritedBlock = account.inherited!
                const ben = inheritedBlock.beneficiary
                if (v || ben === undefined) {
                  if (v && ben?.election === 'ten-year-election') {
                    set('inherited', {
                      ...inheritedBlock,
                      decedentHadStartedRmds: true,
                      beneficiary: { ...ben, election: undefined },
                    })
                    return
                  }
                  set('inherited', { ...inheritedBlock, decedentHadStartedRmds: v })
                  return
                }
                // year-of-death RMD satisfaction only applies when the owner
                // had started RMDs; keep the fact set parse-valid on toggle-off.
                const nextBeneficiary = { ...inheritedBlock.beneficiary }
                delete nextBeneficiary.ownerYearOfDeathRmdSatisfied
                set('inherited', {
                  ...inheritedBlock,
                  decedentHadStartedRmds: false,
                  beneficiary: nextBeneficiary,
                })
              }}
            />
          ) : null}
          {account.kind === 'employer' && account.type === 'traditional' ? (
            <p className="field-hint" data-testid="inherited-employer-hint">
              Beneficiary details apply to inherited IRAs. Inherited workplace plans stay on the simpler planning estimate.
            </p>
          ) : (
            <>
              {account.kind === 'employer' ? (
                <p className="field-hint" data-testid="inherited-roth-employer-hint">
                  {INHERITED_ROTH_EMPLOYER_HINT}
                </p>
              ) : null}
              <BeneficiaryDetails
                account={account}
                inherited={account.inherited!}
                planningYear={planningYear}
                onCommit={(inherited) => {
                  const wasTreatAsOwn = account.inherited!.beneficiary?.election === 'treat-as-own'
                  const isTreatAsOwn = inherited.beneficiary?.election === 'treat-as-own'
                  if (account.type === 'traditional' && isTreatAsOwn && !wasTreatAsOwn) {
                    update((draft) => {
                      const target = draft.accounts[index] as Extract<Account, { type: 'traditional' }>
                      target.inherited = inherited
                      target.annualContribution = 0
                      target.contributionSchedule = undefined
                    })
                    return
                  }
                  set('inherited', inherited)
                }}
              />
            </>
          )}
        </>
      ) : null}
      {account.type === 'traditional' && !account.inherited ? (
        <CheckboxField
          label="72(t) SEPP (penalty-free early access)"
          help="Substantially-equal periodic payments let you tap this account before 59½ without the 10% penalty, taken for the longer of 5 years or until 59½. The Rule of 55 already waives the penalty automatically on a 401(k) you separate from at 55+, so SEPP is mainly for IRAs or for access before 55."
          value={account.sepp !== undefined}
          onCommit={(v) => set('sepp', v ? { startAge: 55, method: 'rmd' } : undefined)}
        />
      ) : null}
      {account.type === 'traditional' && account.sepp && !account.inherited ? (
        <>
          <NumberField
            label="SEPP start age"
            hint="Under 59½. Payments run for the longer of 5 years or until 59½."
            value={account.sepp.startAge}
            min={40}
            max={59}
            onCommit={(v) => set('sepp', { ...account.sepp, startAge: Math.round(v ?? 55) })}
          />
          <SelectField
            label="SEPP method"
            value={account.sepp.method}
            options={[
              { value: 'rmd', label: 'RMD: recomputed yearly (smaller, flexible)' },
              { value: 'amortization', label: 'Amortization: level payment (larger)' },
            ]}
            onCommit={(v) => set('sepp', { ...account.sepp, method: v })}
          />
        </>
      ) : null}
      {(account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer' ? (
        <>
        <MoneyField
          label="Prior-year FICA wages (Box 3)"
          help="Social Security wages from this plan's sponsoring employer for the calendar year before the contribution year (Form W-2 Box 3, IRC 3121(a)). Leave at $0 if this person had no FICA wages from that employer — a new hire or self-employment only. When the amount exceeds the IRS threshold ($150,000 for 2026), catch-up contributions must be designated Roth; if this same person has no Roth employer account of their own, that catch-up is $0. A spouse's Roth 401(k) does not count. This is not MAGI and not the highly compensated employee test."
          hint="Blank or $0 = not subject to the Roth catch-up mandate."
          source={{
            label: 'IRC 414(v)(7)(A)',
            url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
          }}
          value={account.priorCalendarYearFicaWages ?? 0}
          fractionDigits={2}
          onCommit={(v) => set('priorCalendarYearFicaWages', v ?? 0)}
        />
        {account.employerMatch !== undefined ? (
          <div className="nested-form-section field-span-full" data-testid="employer-match-panel">
            <div className="form-grid nested-control-grid">
              <CheckboxField
                label="Employer match"
                help="Configure a first-class employer matching program for this payroll account. The match does not count against your employee elective contribution limit, but is constrained by the IRS Section 415(c) annual additions limit."
                learn={LEARN.employerMatch}
                value
                onCommit={(v) => {
                  set('employerMatch', v ? { matchPct: 100, capPctOfPay: 4 } : undefined)
                }}
              />
              <PercentField
                label="Match percent"
                help="The percentage of your contributions the employer matches. E.g., 100% means a dollar-for-dollar match."
                learn={LEARN.employerMatch}
                value={account.employerMatch.matchPct}
                onCommit={(v) => set('employerMatch', { ...account.employerMatch, matchPct: v ?? 100 })}
              />
              <PercentField
                label="Up to % of wages"
                help="The maximum employee pay percentage the employer will match. E.g., 4% means the employer matches contributions up to 4% of your salary."
                learn={LEARN.employerMatch}
                value={account.employerMatch.capPctOfPay}
                onCommit={(v) => set('employerMatch', { ...account.employerMatch, capPctOfPay: v ?? 4 })}
              />
            </div>
          </div>
        ) : (
          <CheckboxField
            label="Employer match"
            help="Configure a first-class employer matching program for this payroll account. The match does not count against your employee elective contribution limit, but is constrained by the IRS Section 415(c) annual additions limit."
            learn={LEARN.employerMatch}
            value={false}
            onCommit={(v) => {
              set('employerMatch', v ? { matchPct: 100, capPctOfPay: 4 } : undefined)
            }}
          />
        )}
        </>
      ) : null}
      {(account.type === 'cash' || account.type === 'equityComp' || (isAllocatable(account) && account.allocation === undefined)) ? (
        <div className="field-with-action">
          <PercentField
            label="Expected return"
            help="Average annual nominal growth for this account. Leave blank to use the plan-wide default from Assumptions, or click Calculate to estimate it from how the account is invested."
            hint="Blank = default assumption."
            value={account.annualReturnPct}
            allowNull
            onCommit={(v) => set('annualReturnPct', v)}
          />
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setEstimating(true)}>
            Calculate
          </button>
        </div>
      ) : null}
      {isAllocatable(account) ? (
        <CheckboxField
          label="Model asset classes"
          help="Instead of one expected return, describe the account as a mix of US stocks, international stocks, bonds, and cash. Growth becomes the blended class return, glidepaths and annual rebalancing become available, Monte Carlo shocks each class with realistic correlations, and a brokerage account's taxable yield follows the mix. Class assumptions are editable under Assumptions."
          value={account.allocation !== undefined}
          onCommit={(v) =>
            update((d) => {
              const target = d.accounts[index] as AllocatableAccount
              target.allocation = v ? { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } } : undefined
              if (target.type === 'taxable' && v) {
                // Let the class mix drive taxable yield unless re-entered later.
                target.interestYieldPct = undefined
                target.dividendYieldPct = undefined
                target.qualifiedRatio = undefined
              }
            })
          }
        />
      ) : null}
      {isAllocatable(account) && account.allocation !== undefined ? (
        <AllocationPanel account={account} plan={plan} onCommit={(a) => set('allocation', a)} />
      ) : null}
      {inheritedContributionsBlocked(account) ? (
        <p className="field-hint">{INHERITED_CONTRIBUTIONS_BLOCKED_HINT}</p>
      ) : null}
      {'annualContribution' in account && !inheritedContributionsBlocked(account) ? (
        <>
          <CheckboxField
            label="Schedule contributions over time"
            help="Toggle this to model different contribution amounts during different periods (e.g. Coast-FIRE, or saving more later in your career). This will override the flat annual contribution."
            learn={LEARN.accumulation}
            value={account.contributionSchedule !== undefined}
            onCommit={(v) => {
              set('contributionSchedule', v ? [{ annualAmount: account.annualContribution, fromAge: null, toAge: null, escalationPct: 0 }] : undefined)
            }}
          />
          {account.contributionSchedule !== undefined ? (
            <div className="nested-form-section field-span-full" data-testid="contribution-schedule-panel">
              <h4>Contribution Schedule</h4>
              {account.contributionSchedule.map((phase, pIdx) => {
                const updatePhase = (key: string, val: unknown) => {
                  const newSchedule = [...(account.contributionSchedule ?? [])]
                  newSchedule[pIdx] = { ...phase, [key]: val }
                  set('contributionSchedule', newSchedule)
                }
                const removePhase = () => {
                  const newSchedule = (account.contributionSchedule ?? []).filter((_, idx) => idx !== pIdx)
                  set('contributionSchedule', newSchedule.length > 0 ? newSchedule : undefined)
                }
                return (
                  <div key={pIdx} className="nested-phase-row">
                    <div className="form-grid nested-phase-grid">
                      <MoneyField
                        label="Amount / year"
                        value={phase.annualAmount}
                        onCommit={(v) => updatePhase('annualAmount', v ?? 0)}
                      />
                      <PercentField
                        label="Phase escalation"
                        help="Optional. Annual rate at which this phase's contribution amount increases, on top of inflation."
                        learn={LEARN.accumulation}
                        value={phase.escalationPct}
                        onCommit={(v) => updatePhase('escalationPct', v ?? 0)}
                      />
                      <NumberField
                        label="From age"
                        hint="Blank = start age."
                        value={phase.fromAge}
                        allowNull
                        min={0}
                        max={100}
                        onCommit={(v) => updatePhase('fromAge', v)}
                      />
                      <NumberField
                        label="To age"
                        hint="Blank = run forever."
                        value={phase.toAge}
                        allowNull
                        min={0}
                        max={100}
                        onCommit={(v) => updatePhase('toAge', v)}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={removePhase}
                    >
                      Remove Phase
                    </button>
                  </div>
                )
              })}
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  set('contributionSchedule', [...(account.contributionSchedule ?? []), { annualAmount: 0, fromAge: null, toAge: null, escalationPct: 0 }])
                }}
              >
                Add Contribution Phase
              </button>
            </div>
          ) : (
            <MoneyField
              label="Annual contribution"
              hint="While the owner has wages; IRS caps applied."
              value={account.annualContribution}
              onCommit={(v) => set('annualContribution', v ?? 0)}
            />
          )}
        </>
      ) : null}
      {account.type === 'pension' ? <PensionAccountEditor account={account} index={index} onCommit={set} /> : null}
      {account.type === 'annuity' ? <AnnuityAccountEditor account={account} index={index} onCommit={set} /> : null}
      {account.type === 'property' ? <PropertyAccountEditor account={account} index={index} onCommit={set} /> : null}
      {account.type === 'debt' ? <DebtAccountEditor account={account} onCommit={set} /> : null}
      {account.type !== 'debt' && account.type !== 'property' && account.type !== 'pension' ? (
        <>
          <SelectField
            label="Estate beneficiary"
            help="Who inherits this account's balance. Spouse: rolls over untaxed (spousal IRA rollover or HSA inheritance). Non-spouse: the balance is taxed at the heir tax rate for this account class. Charity: passes untaxed and leaves the heirs' estate entirely. Default treats each account by its type, traditional (and a non-spouse HSA) pass to a non-spouse heir taxed at the heir rate; cash, taxable, and Roth pass through untaxed."
            hint="Blank = default by account type."
            value={account.estateBeneficiary?.destination ?? ''}
            options={[
              { value: '', label: 'Default (by account type)' },
              { value: 'spouse', label: 'Spouse (rolls over untaxed)' },
              { value: 'nonSpouse', label: 'Non-spouse heir' },
              { value: 'charity', label: 'Charity' },
            ]}
            onCommit={(v) =>
              set(
                'estateBeneficiary' as string,
                v === '' || v === 'nonSpouse'
                  ? v === 'nonSpouse' ? { destination: 'nonSpouse' } : undefined
                  : v === 'charity'
                    ? { destination: 'charity', charityPct: 100 }
                    : { destination: 'spouse' },
              )
            }
          />
          {account.estateBeneficiary?.destination === 'charity' ? (
            <PercentField
              label="Charity share"
              help="What percentage of this account goes to charity. The remainder goes to a non-spouse heir and is taxed at the heir tax rate."
              value={account.estateBeneficiary.charityPct ?? 100}
              min={0}
              max={100}
              onCommit={(v) => set('estateBeneficiary' as string, { destination: 'charity', charityPct: v ?? 100 })}
            />
          ) : null}
        </>
      ) : null}
      {estimating ? (
        <ReturnEstimatorModal
          initialPct={account.annualReturnPct}
          onApply={(pct) => set('annualReturnPct', pct)}
          onClose={() => setEstimating(false)}
        />
      ) : null}
    </div>
  )
}

