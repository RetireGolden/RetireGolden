/** Account-type-specific fields for traditional and Roth retirement accounts. */

import { useState } from 'react'

import type { Account, InheritedBeneficiary } from '@retiregolden/engine/model/plan'

import { ROTH_FIVE_YEAR_INCOMPLETE_NOTE } from '../../report/reportModel'
import { CheckboxField, DateField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { LEARN } from '../learnLinks'
import { usePlan } from '../planContextCore'
import { currentStartYear } from '../useProjection'
import type { CommitAccountField } from './AccountEditorTypes'
import { localCalendarDateIso } from './sectionHelpers'

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
                value={beneficiary.soleBeneficiary === true ? 'true' : beneficiary.soleBeneficiary === false ? 'false' : ''}
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
                  source={beneficiary.election === 'ten-year-election' ? TEN_YEAR_ELECTION_SOURCE : ELECTION_SOURCE}
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
                  onCommit={(value) => commit({ ...beneficiary, ownerYearOfDeathRmdSatisfied: value === 'true' })}
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
                  {beneficiary.roth5YearStartYear !== undefined && beneficiary.roth5YearStartYear + 4 >= planningYear ? (
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

export function RetirementAccountEditor({
  account,
  index,
  onCommit,
}: {
  account: Extract<Account, { type: 'traditional' | 'roth' }>
  index: number
  onCommit: CommitAccountField
}) {
  const { plan, update } = usePlan()
  const planningYear = currentStartYear()
  const set = onCommit

  return (
    <>
      <SelectField
        label="Kind"
        value={account.kind}
        options={[
          { value: 'employer', label: '401(k)/403(b)' },
          { value: 'ira', label: 'IRA' },
        ]}
        onCommit={(v) => set('kind', v)}
      />
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
      {account.type === 'traditional' && plan.household.people.length === 2 ? (
        <CheckboxField
          label="Spouse is sole beneficiary"
          help="If checked and your spouse is more than 10 years younger, RMDs use the larger IRS Joint Life divisor. Leave unchecked when the beneficiary is a child, trust, estate, or split, RMDs then use the standard Uniform Lifetime Table."
          value={account.spouseSoleBeneficiary === true}
          onCommit={(v) => set('spouseSoleBeneficiary', v)}
        />
      ) : null}
      <CheckboxField
        label={account.type === 'roth' ? 'Inherited Roth account' : 'Inherited account'}
        help={
          account.type === 'roth'
            ? 'An inherited Roth account follows beneficiary distribution rules and requires beneficiary details in this planner. The original Roth owner is treated as dying before the required beginning date.'
            : 'An account inherited from its original owner. The distribution schedule depends on the beneficiary facts below: many beneficiaries must empty the account within 10 years, while a surviving spouse or other eligible beneficiary may follow a life-expectancy schedule. Distributions are taxable but never carry the 10% early-withdrawal penalty, and the account is exempt from your own age-based RMDs.'
        }
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
      {account.inherited ? (
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
      {account.kind === 'employer' ? (
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
    </>
  )
}
