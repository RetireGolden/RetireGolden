/** Per-account form fields. */

import { useMemo, useState } from 'react'

import type { Account, Plan } from '../../engine/model/plan'
import { analyzePensionElections } from '../../engine/decisions/pensionElection'
import { packForYear } from '../../engine/params'
import { AllocationPanel, ReturnEstimatorModal } from './AllocationPanel'
import { ACCOUNT_LABEL, EVEN_START_WEIGHTS, isAllocatable, isIndividuallyOwnedAccount, type AllocatableAccount } from './sectionHelpers'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, ReadonlyField, SelectField, TextField } from '../fields'
import { fmtMoney } from '../format'
import { currentStartYear } from '../useProjection'
import { LEARN } from '../learnLinks'

function ownerOptions(plan: Plan, type: Account['type']) {
  const peopleOptions = plan.household.people.map((p) => ({ value: p.id, label: p.name }))
  return isIndividuallyOwnedAccount(type) ? peopleOptions : [{ value: 'joint', label: 'Joint' }, ...peopleOptions]
}

export function AccountFields({ account, index }: { account: Account; index: number }) {
  const { plan, update } = usePlan()
  const [estimating, setEstimating] = useState(false)
  const set = <K extends string>(key: K, value: unknown) =>
    update((d) => {
      ;(d.accounts[index] as unknown as Record<string, unknown>)[key] = value
    })
  return (
    <div className="form-grid">
      <TextField label="Name" value={account.name} onCommit={(v) => set('name', v || ACCOUNT_LABEL[account.type])} />
      <SelectField
        label="Owner"
        value={account.ownerPersonId ?? 'joint'}
        options={ownerOptions(plan, account.type)}
        onCommit={(v) => set('ownerPersonId', v === 'joint' ? null : v)}
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
      {account.type === 'roth' ? (
        <MoneyField
          label="Contribution basis"
          help="Your total direct Roth contributions (today's dollars). Contributions come out tax- and penalty-free at any age — before conversions and earnings — so this is what you can tap penalty-free in early retirement. Leave blank to treat the whole current balance as contributions (the safe default). Roth conversions made inside this app automatically start their own 5-year clocks."
          hint="Blank = treat whole balance as contributions."
          value={account.contributionBasis ?? null}
          allowNull
          onCommit={(v) => set('contributionBasis', v ?? undefined)}
        />
      ) : null}
      {account.type === 'traditional' && account.kind === 'ira' && !account.inherited ? (
        <MoneyField
          label="Nondeductible basis (Form 8606)"
          help="After-tax money already inside this traditional IRA — nondeductible contributions you've reported on IRS Form 8606. When set, every withdrawal and Roth conversion from your IRAs is part tax-free basis and part taxable, in proportion to the basis across all your IRAs (the pro-rata rule). Leave blank if all your IRA money was pre-tax."
          hint="Blank = fully pre-tax IRA."
          value={account.nondeductibleBasis ?? null}
          allowNull
          onCommit={(v) => set('nondeductibleBasis', v ?? undefined)}
        />
      ) : null}
      {account.type === 'hsa' ? (
        <>
          <SelectField
            label="Withdrawal treatment"
            help="How HSA withdrawals are taxed. 'Assume all qualified' treats every withdrawal as a tax- and penalty-free medical reimbursement (simplest; use if you track receipts). 'Cap at modeled medical costs' only lets withdrawals up to your modeled healthcare premiums and care costs come out tax-free — the excess is taxed as ordinary income and, before 65, penalized 20%. Leave on the default to keep the conservative legacy behavior (tax-free but penalized before 65)."
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
              help="Model the 'pay medical costs out of pocket now, reimburse yourself from the HSA later' strategy. Modeled medical costs you don't withdraw for in a given year accumulate as a carryover that future withdrawals can draw against tax-free — letting the HSA keep growing while the reimbursable balance grows with it."
              value={account.reimburseLater === true}
              onCommit={(v) => set('reimburseLater', v ? true : undefined)}
            />
          ) : null}
          <SelectField
            label="Beneficiary"
            help="Who inherits this HSA. A spouse inherits it as their own HSA and it passes untaxed. Any other beneficiary (child, estate, single-person plans) receives a fully taxable distribution of the balance in the year of death — so the after-tax estate metric taxes the remaining HSA at your assumed heir tax rate, like a traditional account."
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
          help="If checked and your spouse is more than 10 years younger, RMDs use the larger IRS Joint Life divisor. Leave unchecked when the beneficiary is a child, trust, estate, or split — RMDs then use the standard Uniform Lifetime Table."
          value={account.spouseSoleBeneficiary === true}
          onCommit={(v) => set('spouseSoleBeneficiary', v)}
        />
      ) : null}
      {account.type === 'traditional' ? (
        <CheckboxField
          label="Inherited account (10-year rule)"
          help="A non-spouse beneficiary must empty an inherited IRA/401(k) by the end of the 10th year after the original owner's death. Distributions are taxable but never carry the 10% early-withdrawal penalty, and the account is exempt from your own age-based RMDs."
          value={account.inherited !== undefined}
          onCommit={(v) => set('inherited', v ? { ownerDeathYear: new Date().getFullYear() - 1, decedentHadStartedRmds: false } : undefined)}
        />
      ) : null}
      {account.type === 'traditional' && account.inherited ? (
        <>
          <NumberField
            label="Original owner's death year"
            hint="Starts the 10-year clock; the account must be empty by the end of this year + 10."
            value={account.inherited.ownerDeathYear}
            min={1990}
            max={2100}
            onCommit={(v) => set('inherited', { ...account.inherited, ownerDeathYear: Math.round(v ?? new Date().getFullYear() - 1) })}
          />
          <CheckboxField
            label="Owner had started RMDs"
            help="If the original owner had reached their required beginning date, you must also take an annual RMD in years 1–9 of the window (based on your single life expectancy), not just empty it by year 10."
            value={account.inherited.decedentHadStartedRmds}
            onCommit={(v) => set('inherited', { ...account.inherited, decedentHadStartedRmds: v })}
          />
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
              { value: 'rmd', label: 'RMD — recomputed yearly (smaller, flexible)' },
              { value: 'amortization', label: 'Amortization — level payment (larger)' },
            ]}
            onCommit={(v) => set('sepp', { ...account.sepp, method: v })}
          />
        </>
      ) : null}
      {(account.type === 'traditional' || account.type === 'roth') && account.kind === 'employer' ? (
        account.employerMatch !== undefined ? (
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
        )
      ) : null}
      {account.type === 'pension' ? (
        <SelectField
          label="Pension source"
          help="Used for state income tax when public civil-service or military pensions receive a different exclusion than private retirement income."
          value={account.source ?? 'private'}
          options={[
            { value: 'private', label: 'Private pension' },
            { value: 'public', label: 'Public / military pension' },
          ]}
          onCommit={(v) => set('source', v)}
        />
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
      {'annualContribution' in account ? (
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
      {account.type === 'pension' || account.type === 'annuity' ? (
        <>
          <NumberField label="Start age" value={account.startAge} min={40} max={95} onCommit={(v) => set('startAge', Math.round(v ?? 65))} />
          <MoneyField label="Monthly amount" value={account.monthlyAmount} onCommit={(v) => set('monthlyAmount', v ?? 0)} />
          <PercentField label="COLA" value={account.colaPct} onCommit={(v) => set('colaPct', v ?? 0)} />
        </>
      ) : null}
      {account.type === 'pension' ? <PercentField label="Survivor benefit" value={account.survivorPct} onCommit={(v) => set('survivorPct', v ?? 0)} /> : null}
      {account.type === 'pension' ? (
        <CheckboxField
          label="Lump-sum offer on record"
          help="Record a lump-sum buyout offer to unlock the decision view: the annuity's discounted present value against the offer, a discount-rate × longevity sensitivity table, and the survivor option's value. Recording the offer changes nothing in the projection until you elect it."
          value={account.lumpSumOffer !== undefined}
          onCommit={(v) =>
            update((d) => {
              const p = d.accounts[index] as Extract<Account, { type: 'pension' }>
              if (v) {
                p.lumpSumOffer = { amount: 0, electionYear: new Date().getFullYear() }
              } else {
                p.lumpSumOffer = undefined
                p.lumpSumElection = undefined
              }
            })
          }
        />
      ) : null}
      {account.type === 'pension' && account.lumpSumOffer ? (
        <>
          <MoneyField
            label="Lump sum offered"
            help="The one-time payment offered instead of the lifetime annuity (from your plan administrator's election packet)."
            value={account.lumpSumOffer.amount}
            onCommit={(v) => set('lumpSumOffer', { ...account.lumpSumOffer!, amount: v ?? 0 })}
          />
          <NumberField
            label="Election year"
            help="The year the election is due — and the year the lump sum would be paid if taken."
            value={account.lumpSumOffer.electionYear}
            min={1900}
            max={2200}
            onCommit={(v) => set('lumpSumOffer', { ...account.lumpSumOffer!, electionYear: Math.round(v ?? new Date().getFullYear()) })}
          />
          <SelectField
            label="Election"
            help="Take the lump sum: in the election year the offer rolls over tax-free into the chosen traditional IRA/401(k) and the pension never pays its annuity. Keep the annuity: the offer stays on record for comparison only. Taking the lump sum requires a traditional account to receive the rollover."
            value={account.lumpSumElection ? 'lumpSum' : 'annuity'}
            options={[
              { value: 'annuity', label: 'Keep the annuity (undecided)' },
              ...(plan.accounts.some((a) => a.type === 'traditional' && !a.inherited)
                ? [{ value: 'lumpSum', label: 'Take the lump sum (rollover)' }]
                : []),
            ]}
            onCommit={(v) => {
              const target = plan.accounts.find((a) => a.type === 'traditional' && !a.inherited)
              set('lumpSumElection', v === 'lumpSum' && target ? { rolloverAccountId: target.id } : undefined)
            }}
          />
          {account.lumpSumElection ? (
            <SelectField
              label="Rollover account"
              help="The traditional account receiving the tax-free direct rollover in the election year."
              value={account.lumpSumElection.rolloverAccountId}
              options={plan.accounts
                .filter((a) => a.type === 'traditional' && !a.inherited)
                .map((a) => ({ value: a.id, label: a.name }))}
              onCommit={(v) => set('lumpSumElection', { rolloverAccountId: v })}
            />
          ) : null}
          <PensionDecisionPanel plan={plan} pensionId={account.id} />
        </>
      ) : null}
      {account.type === 'annuity' && !account.purchase ? <PercentField label="Taxable share" hint="Simplified exclusion ratio." value={account.taxablePct} onCommit={(v) => set('taxablePct', v ?? 0)} /> : null}
      {account.type === 'annuity' && account.purchase ? (
        <ReadonlyField label="Taxable share" value="Determined by purchase (exclusion ratio for non-qualified; fully taxable for qualified)" />
      ) : null}
      {account.type === 'annuity' ? (
        <SelectField
          label="Payout form"
          help="Life only: payments stop at the owner's death (the default). Life with period certain: payments are guaranteed for N years from the start age — if the owner dies inside the window, the household keeps receiving them. Joint & survivor: payments continue to the other household member at the chosen share for their lifetime. Non-qualified exclusion-ratio taxation adjusts to the form."
          value={account.payoutForm?.kind ?? 'lifeOnly'}
          options={[
            { value: 'lifeOnly', label: 'Life only' },
            { value: 'periodCertain', label: 'Life with period certain' },
            ...(plan.household.people.length >= 2 ? [{ value: 'jointSurvivor', label: 'Joint & survivor' }] : []),
          ]}
          onCommit={(v) =>
            set(
              'payoutForm',
              v === 'periodCertain'
                ? { kind: 'periodCertain', certainYears: account.payoutForm?.kind === 'periodCertain' ? account.payoutForm.certainYears : 10 }
                : v === 'jointSurvivor'
                  ? { kind: 'jointSurvivor', survivorPct: account.payoutForm?.kind === 'jointSurvivor' ? account.payoutForm.survivorPct : 50 }
                  : undefined,
            )
          }
        />
      ) : null}
      {account.type === 'annuity' && account.payoutForm?.kind === 'periodCertain' ? (
        <NumberField
          label="Guaranteed years"
          help="Years of payments guaranteed from the start age, paid to the household even if the owner dies inside the window."
          value={account.payoutForm.certainYears}
          min={1}
          max={40}
          onCommit={(v) => set('payoutForm', { kind: 'periodCertain', certainYears: Math.round(v ?? 10) })}
        />
      ) : null}
      {account.type === 'annuity' && account.payoutForm?.kind === 'jointSurvivor' ? (
        <PercentField
          label="Survivor share"
          help="Percent of the payment continuing to the surviving joint annuitant for their lifetime (100% / 75% / 50% are the common contract options)."
          value={account.payoutForm.survivorPct}
          onCommit={(v) => set('payoutForm', { kind: 'jointSurvivor', survivorPct: Math.min(100, Math.max(1, v ?? 50)) })}
        />
      ) : null}
      {account.type === 'annuity' ? (
        <CheckboxField
          label="Model a purchase event"
          help="Configure an annuity purchase: the engine withdraws the premium from a funding account in the purchase year, then applies IRS exclusion-ratio taxation for non-qualified purchases or fully ordinary taxation for qualified purchases. QLAC purchases are capped at the statutory limit."
          value={account.purchase !== undefined}
          onCommit={(v) => {
            // Default to the first eligible non-qualified funding source (cash /
            // taxable / equity comp) so toggling the feature on leaves the plan
            // valid rather than immediately failing the funding-account refinement.
            const defaultFunding = plan.accounts.find(
              (a) => a.id !== account.id && (a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp'),
            )
            set(
              'purchase',
              v
                ? {
                    year: new Date().getFullYear(),
                    premium: 100_000,
                    fundingAccountId: defaultFunding?.id ?? '',
                    taxQualification: 'nonQualified' as const,
                  }
                : undefined,
            )
          }}
        />
      ) : null}
      {account.type === 'annuity' && account.purchase ? (
        <>
          <NumberField
            label="Purchase year"
            value={account.purchase.year}
            min={1900}
            max={2200}
            onCommit={(v) => set('purchase', { ...account.purchase!, year: Math.round(v ?? new Date().getFullYear()) })}
          />
          <MoneyField
            label="Premium"
            help="The lump sum paid to purchase the annuity contract, withdrawn from the funding account in the purchase year."
            value={account.purchase.premium}
            onCommit={(v) => set('purchase', { ...account.purchase!, premium: v ?? 0 })}
          />
          <SelectField
            label="Funding account"
            help="Which account the premium is withdrawn from. Non-qualified purchases must come from cash, taxable, or equity comp; qualified purchases from a traditional IRA or 401(k)."
            value={account.purchase.fundingAccountId}
            options={plan.accounts
              .filter((a) =>
                a.id !== account.id &&
                (account.purchase!.taxQualification === 'qualified'
                  ? a.type === 'traditional'
                  : a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp'),
              )
              .map((a) => ({ value: a.id, label: a.name }))}
            onCommit={(v) => set('purchase', { ...account.purchase!, fundingAccountId: v })}
          />
          <SelectField
            label="Tax qualification"
            help="Non-qualified: purchased with after-tax money; payouts use the IRS Pub 939 exclusion ratio (part tax-free, part taxable) until the investment is recovered. Qualified: purchased with pre-tax IRA/401(k) money; every payout is fully ordinary income."
            value={account.purchase.taxQualification}
            options={[
              { value: 'nonQualified', label: 'Non-qualified (after-tax money)' },
              { value: 'qualified', label: 'Qualified (pre-tax IRA/401k)' },
            ]}
            onCommit={(v) => {
              const taxQualification = v as 'nonQualified' | 'qualified'
              // The current funding account may no longer be eligible for the new
              // qualification; re-default to the first eligible source so the plan
              // stays valid instead of pointing at an impossible funding type.
              const stillEligible = plan.accounts.some(
                (a) =>
                  a.id === account.purchase!.fundingAccountId &&
                  (taxQualification === 'qualified'
                    ? a.type === 'traditional'
                    : a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp'),
              )
              const fundingAccountId = stillEligible
                ? account.purchase!.fundingAccountId
                : plan.accounts.find((a) =>
                    a.id !== account.id &&
                    (taxQualification === 'qualified'
                      ? a.type === 'traditional'
                      : a.type === 'cash' || a.type === 'taxable' || a.type === 'equityComp'),
                  )?.id ?? ''
              set('purchase', {
                ...account.purchase!,
                taxQualification,
                fundingAccountId,
                qlac: taxQualification === 'nonQualified' ? undefined : account.purchase!.qlac,
              })
            }}
          />
          {account.purchase.taxQualification === 'qualified' ? (
            <CheckboxField
              label="QLAC (qualified longevity annuity)"
              help="A deferred-start longevity annuity purchased inside a traditional account. The premium is capped at the SECURE 2.0 statutory limit ($210,000 for 2026) and excluded from the RMD base until payouts begin."
              value={account.purchase.qlac === true}
              onCommit={(v) => set('purchase', { ...account.purchase!, qlac: v || undefined })}
            />
          ) : null}
        </>
      ) : null}
      {account.type === 'property' ? (
        <>
          <MoneyField label="Value" value={account.value} onCommit={(v) => set('value', v ?? 0)} />
          <NumberField label="Planned sale year" value={account.plannedSaleYear} allowNull min={1900} max={2200} onCommit={(v) => set('plannedSaleYear', v === null ? null : Math.round(v))} />
          <MoneyField
            label="Cost basis"
            help="What you paid for the property plus improvements (not inflation-adjusted). Set this to have the sale taxed exactly: capital-gains tax on the gain above basis, net of selling costs, minus the primary-residence exclusion. Leave blank to fall back to the simple tax-free 'expected net proceeds' estimate below."
            hint="Blank = use expected net proceeds (tax-free)."
            value={account.costBasis ?? null}
            allowNull
            onCommit={(v) => set('costBasis', v ?? undefined)}
          />
          {account.costBasis !== undefined ? (
            <>
              <PercentField
                label="Selling costs"
                help="Commissions plus closing costs as a percent of the sale price, deducted from the amount realized before computing the gain. Typical all-in cost to sell a home is 6–8%."
                hint="% of sale price."
                value={account.sellingCostPct ?? null}
                allowNull
                onCommit={(v) => set('sellingCostPct', v ?? undefined)}
              />
              <CheckboxField
                label="Primary residence (§121 exclusion)"
                help="If this is your main home and you meet the ownership/use tests (lived there 2 of the last 5 years), the IRS §121 exclusion shields $250,000 of gain ($500,000 if married filing jointly) from tax. Only the gain above the exclusion is taxed."
                value={account.primaryResidence === true}
                onCommit={(v) => set('primaryResidence', v ? true : undefined)}
              />
              <MoneyField
                label="Depreciation to recapture"
                help="Depreciation you claimed (e.g. rental years or a home office). It is recaptured as ordinary income on sale and cannot be shielded by the §121 exclusion. Leave blank if none."
                hint="Blank = none."
                value={account.depreciationRecapture ?? null}
                allowNull
                onCommit={(v) => set('depreciationRecapture', v ?? undefined)}
              />
            </>
          ) : (
            <MoneyField label="Expected net proceeds" hint="Blank = sell at projected value." value={account.expectedNetProceeds} allowNull onCommit={(v) => set('expectedNetProceeds', v)} />
          )}
          <MoneyField label="Property tax / year" help="Annual property tax in today's dollars. Charged as a recurring expense while you own the home — and, unlike the mortgage, it keeps going after the loan is paid off." hint="Today's $; continues after payoff." value={account.propertyTaxAnnual ?? null} allowNull onCommit={(v) => set('propertyTaxAnnual', v ?? undefined)} />
          <MoneyField label="Insurance / year" hint="Homeowner's/hazard insurance, today's $." value={account.insuranceAnnual ?? null} allowNull onCommit={(v) => set('insuranceAnnual', v ?? undefined)} />
          <CheckboxField
            label="Model a HECM line of credit"
            help="An FHA reverse-mortgage line of credit on your primary residence (borrowers 62+). The unused line grows every year regardless of home value; draws are tax-free loan proceeds; the loan is repaid from the home at sale or the end of the plan, non-recourse (never more than the home is worth). Turning this on marks the home as your primary residence."
            value={account.hecm !== undefined}
            onCommit={(v) =>
              update((d) => {
                const p = d.accounts[index] as Extract<Account, { type: 'property' }>
                if (v) {
                  p.primaryResidence = true
                  p.hecm = {
                    openYear: new Date().getFullYear(),
                    growthRatePct: packForYear(new Date().getFullYear()).pack.hecm.defaultGrowthRatePct,
                    drawPolicy: 'lastResort',
                  }
                } else {
                  p.hecm = undefined
                }
              })
            }
          />
          {account.hecm ? (
            <>
              <NumberField
                label="Line opens in"
                help="The year the line of credit is opened. Pfau's research favors opening early — the unused credit compounds from that point regardless of home value."
                value={account.hecm.openYear}
                min={1900}
                max={2200}
                onCommit={(v) => set('hecm', { ...account.hecm!, openYear: Math.round(v ?? new Date().getFullYear()) })}
              />
              <PercentField
                label="Line size (% of value)"
                help="The initial principal limit as a percent of the home's value — enter your lender-quoted figure. Blank uses the published HUD principal-limit-factor table by the youngest borrower's age (35–61% between 62 and 90 at a 5.875% expected rate)."
                hint="Blank = published factor table."
                value={account.hecm.principalLimitPct ?? null}
                allowNull
                onCommit={(v) => set('hecm', { ...account.hecm!, principalLimitPct: v ?? undefined })}
              />
              <PercentField
                label="Line & loan growth / yr"
                help="Annual growth applied to both the credit line and the loan balance: the note rate plus the 0.5% annual mortgage-insurance premium (roughly 7–8% at 2026 rates)."
                value={account.hecm.growthRatePct}
                onCommit={(v) => set('hecm', { ...account.hecm!, growthRatePct: v ?? 7.5 })}
              />
              <PercentField
                label="Upfront costs (% of value)"
                help="Origination, closing costs, and the initial 2% FHA mortgage-insurance premium, financed into the loan balance at open (typically 3–6% of home value)."
                hint="Blank = none."
                value={account.hecm.upfrontCostPct ?? null}
                allowNull
                onCommit={(v) => set('hecm', { ...account.hecm!, upfrontCostPct: v ?? undefined })}
              />
              <SelectField
                label="Draw policy"
                help="Coordinated (buffer asset): draw for spending in years after a negative market return so depressed holdings can recover — visible in Monte Carlo, where down years exist. Last resort: draw only once the portfolio cannot cover spending. Either way an open line backstops a true shortfall."
                value={account.hecm.drawPolicy}
                options={[
                  { value: 'lastResort', label: 'Last resort (when portfolio is exhausted)' },
                  { value: 'coordinated', label: 'Coordinated (after down market years)' },
                ]}
                onCommit={(v) => set('hecm', { ...account.hecm!, drawPolicy: v as 'coordinated' | 'lastResort' })}
              />
            </>
          ) : null}
        </>
      ) : null}
      {account.type === 'debt' ? (
        <>
          <PercentField label="Interest rate" value={account.interestPct} onCommit={(v) => set('interestPct', v ?? 0)} />
          <MoneyField label="Monthly payment" help="Principal & interest only. Don't include escrowed property tax or homeowner's insurance here — put those on the home (property) account so they correctly continue after the loan is paid off." hint="P&I only — escrow goes on the home account." value={account.monthlyPayment} onCommit={(v) => set('monthlyPayment', v ?? 0)} />
          <NumberField label="Lump-sum payoff year" help="Optional. In this year the entire remaining balance is paid off at once, funded from your withdrawal order (selling taxable holdings realizes gains/tax, just like any other withdrawal). Use it to compare keeping a low-rate loan vs. paying it off early or mid-retirement." hint="Blank = run to term." value={account.payoffYear ?? null} allowNull min={1900} max={2200} onCommit={(v) => set('payoffYear', v === null ? undefined : Math.round(v))} />
        </>
      ) : null}
      {account.type !== 'debt' && account.type !== 'property' && account.type !== 'pension' ? (
        <>
          <SelectField
            label="Estate beneficiary"
            help="Who inherits this account's balance. Spouse: rolls over untaxed (spousal IRA rollover or HSA inheritance). Non-spouse: the balance is taxed at the heir tax rate for this account class. Charity: passes untaxed and leaves the heirs' estate entirely. Default treats each account by its type — traditional (and a non-spouse HSA) pass to a non-spouse heir taxed at the heir rate; cash, taxable, and Roth pass through untaxed."
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

/**
 * Lump-sum vs annuity decision view (annuity-pension-and-home-equity, step 3):
 * deterministic PV math against the recorded offer — a curve-anchored
 * discounted value, the survivor option's worth, and a discount-rate ×
 * longevity sensitivity table. Framed as tradeoffs; the exact-ledger scenario
 * pair (Insights preview / decision engine) prices taxes and sequence risk.
 */
function PensionDecisionPanel({ plan, pensionId }: { plan: Plan; pensionId: string }) {
  // Captured per render (not just inside the memo) so a start-year rollover
  // invalidates the memoized analysis even without a plan edit.
  const startYear = currentStartYear()
  const analysis = useMemo(
    () => analyzePensionElections(plan, startYear).find((a) => a.pensionId === pensionId),
    [plan, pensionId, startYear],
  )
  if (!analysis) return null
  if (analysis.lumpSum <= 0) {
    return (
      <p className="muted field-span-full" style={{ margin: 0 }}>
        Enter the offered amount to see the decision view: the annuity's discounted value against the lump sum across
        discount rates and longevity.
      </p>
    )
  }
  const ratio = analysis.presentValueAtCurveRate / analysis.lumpSum
  const survivorOptionValue = analysis.presentValueAtCurveRate - analysis.presentValueSingleLife
  return (
    <div className="field-span-full">
      <h4 style={{ marginBottom: '0.25rem' }}>Lump sum vs annuity</h4>
      <p className="card-hint" style={{ marginTop: 0 }}>
        At the {analysis.curveRatePct.toFixed(1)}% curve-anchored discount rate (TIPS real yield + your inflation
        assumption) to the owner's planning age, the annuity's payments are worth{' '}
        <strong>{fmtMoney(analysis.presentValueAtCurveRate)}</strong> against the{' '}
        <strong>{fmtMoney(analysis.lumpSum)}</strong> offer ({(ratio * 100).toFixed(0)}%).
        {survivorOptionValue > 1 ? (
          <> The survivor continuation accounts for {fmtMoney(survivorOptionValue)} of that value.</>
        ) : null}{' '}
        Living longer or discounting at lower rates favors the annuity; dying earlier, higher rates, bequest goals, and
        control over the money favor the lump sum — the table shows how the comparison moves, and the Insights page can
        preview the rollover against your full plan. A tradeoff, not advice.
      </p>
      <div className="year-table-wrap" style={{ border: 'none' }}>
        <table className="compare-table">
          <thead>
            <tr>
              <th>Annuity value ÷ offer</th>
              {analysis.sensitivity.discountRatesPct.map((r) => (
                <th key={r}>{r.toFixed(1)}%</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analysis.sensitivity.rows.map((row) => (
              <tr key={row.ownerDeathAge}>
                <td>To age {row.ownerDeathAge}</td>
                {row.cells.map((cell) => (
                  <td key={cell.discountRatePct} title={fmtMoney(cell.presentValue)}>
                    {(cell.ratioToLumpSum * 100).toFixed(0)}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

