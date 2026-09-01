/** Per-account form fields. */

import { useState } from 'react'

import type { Account, Plan } from '@retiregolden/engine/model/plan'
import { AllocationPanel, ReturnEstimatorModal } from './AllocationPanel'
import {
  ACCOUNT_LABEL,
  clampedAnnuityStartAge,
  EVEN_START_WEIGHTS,
  isAllocatable,
  isIndividuallyOwnedAccount,
  showTaxExemptAllocationDoubleCountWarning,
  TAX_EXEMPT_ALLOCATION_DOUBLE_COUNT_WARNING,
  type AllocatableAccount,
} from './sectionHelpers'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { LEARN } from '../learnLinks'
import { updateAccountField } from '../eligibilityFactActions'
import { HsaAccountEditor } from './HsaAccountEditor'
import { AnnuityAccountEditor, PensionAccountEditor } from './PensionAnnuityAccountEditors'
import { DebtAccountEditor, PropertyAccountEditor } from './PropertyDebtAccountEditors'
import { RetirementAccountEditor } from './RetirementAccountEditors'

function ownerOptions(plan: Plan, type: Account['type']) {
  const peopleOptions = plan.household.people.map((p) => ({ value: p.id, label: p.name }))
  return isIndividuallyOwnedAccount(type) ? peopleOptions : [{ value: 'joint', label: 'Joint' }, ...peopleOptions]
}

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

export function AccountFields({ account, index }: { account: Account; index: number }) {
  const { plan, update } = usePlan()
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
        <RetirementAccountEditor account={account} index={index} onCommit={set} />
      ) : null}
      {account.type === 'hsa' ? <HsaAccountEditor account={account} onCommit={set} /> : null}
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

