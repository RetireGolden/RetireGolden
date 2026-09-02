/** Genuinely shared account-editor layout and field groups. */

import { type ReactNode, useState } from 'react'

import type { Account, Plan } from '@retiregolden/engine/model/plan'

import { AllocationPanel, ReturnEstimatorModal } from './AllocationPanel'
import type { CommitAccountField } from './AccountEditorTypes'
import {
  ACCOUNT_LABEL,
  clampedAnnuityStartAge,
  EVEN_START_WEIGHTS,
  isAllocatable,
  isIndividuallyOwnedAccount,
  type AllocatableAccount,
} from './sectionHelpers'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { LEARN } from '../learnLinks'
import { usePlan } from '../planContextCore'
import { updateAccountField } from '../eligibilityFactActions'

function ownerOptions(plan: Plan, type: Account['type']) {
  const peopleOptions = plan.household.people.map((person) => ({ value: person.id, label: person.name }))
  return isIndividuallyOwnedAccount(type)
    ? peopleOptions
    : [{ value: 'joint', label: 'Joint' }, ...peopleOptions]
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

export function AccountEditorShell({
  account,
  index,
  children,
}: {
  account: Account
  index: number
  children: (onCommit: CommitAccountField) => ReactNode
}) {
  const { plan, update } = usePlan()
  const [estimating, setEstimating] = useState(false)
  const onCommit: CommitAccountField = (key, value) =>
    update((draft) => {
      updateAccountField(draft, index, key, value)
    })
  const setOwner = (next: string | null) => {
    if (account.type !== 'annuity') {
      onCommit('ownerPersonId', next)
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
      <TextField
        label="Name"
        value={account.name}
        onCommit={(value) => onCommit('name', value || ACCOUNT_LABEL[account.type])}
      />
      <SelectField
        label="Owner"
        value={account.ownerPersonId ?? 'joint'}
        options={ownerOptions(plan, account.type)}
        onCommit={(value) => setOwner(value === 'joint' ? null : value)}
      />
      {'balance' in account ? (
        <MoneyField
          label={account.type === 'debt' ? 'Balance owed' : 'Balance'}
          path={`accounts.${index}.balance`}
          value={account.balance}
          onCommit={(value) => onCommit('balance', value ?? 0)}
        />
      ) : null}
      {children(onCommit)}
      <InvestmentFields
        account={account}
        index={index}
        plan={plan}
        onCommit={onCommit}
        onEstimate={() => setEstimating(true)}
      />
      <ContributionFields account={account} onCommit={onCommit} />
      <EstateBeneficiaryFields account={account} index={index} onCommit={onCommit} />
      {estimating ? (
        <ReturnEstimatorModal
          initialPct={account.annualReturnPct}
          onApply={(percent) => onCommit('annualReturnPct', percent)}
          onClose={() => setEstimating(false)}
        />
      ) : null}
    </div>
  )
}

function InvestmentFields({
  account,
  index,
  plan,
  onCommit,
  onEstimate,
}: {
  account: Account
  index: number
  plan: Plan
  onCommit: CommitAccountField
  onEstimate: () => void
}) {
  const { update } = usePlan()
  const showsStandaloneExpectedReturn =
    account.type === 'cash' ||
    account.type === 'equityComp' ||
    (isAllocatable(account) && account.allocation === undefined)

  return (
    <>
      {showsStandaloneExpectedReturn ? (
        <div className="field-with-action">
          <PercentField
            label="Expected return"
            help="Average annual nominal growth for this account. Leave blank to use the plan-wide default from Assumptions, or click Calculate to estimate it from how the account is invested."
            hint="Blank = default assumption."
            value={account.annualReturnPct}
            allowNull
            onCommit={(value) => onCommit('annualReturnPct', value)}
          />
          <button type="button" className="btn btn-secondary btn-small" onClick={onEstimate}>
            Calculate
          </button>
        </div>
      ) : null}
      {isAllocatable(account) ? (
        <CheckboxField
          label="Model asset classes"
          help="Instead of one expected return, describe the account as a mix of US stocks, international stocks, bonds, and cash. Growth becomes the blended class return, glidepaths and annual rebalancing become available, Monte Carlo shocks each class with realistic correlations, and a brokerage account's taxable yield follows the mix. Class assumptions are editable under Assumptions."
          value={account.allocation !== undefined}
          onCommit={(value) =>
            update((draft) => {
              const target = draft.accounts[index] as AllocatableAccount
              target.allocation = value
                ? { mode: 'static', rebalancing: 'annual', weights: { ...EVEN_START_WEIGHTS } }
                : undefined
              if (target.type === 'taxable' && value) {
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
        <AllocationPanel account={account} plan={plan} onCommit={(allocation) => onCommit('allocation', allocation)} />
      ) : null}
    </>
  )
}

function ContributionFields({
  account,
  onCommit,
}: {
  account: Account
  onCommit: CommitAccountField
}) {
  if (inheritedContributionsBlocked(account)) {
    return <p className="field-hint">{INHERITED_CONTRIBUTIONS_BLOCKED_HINT}</p>
  }
  if (!('annualContribution' in account)) return null

  return (
    <>
      <CheckboxField
        label="Schedule contributions over time"
        help="Toggle this to model different contribution amounts during different periods (e.g. Coast-FIRE, or saving more later in your career). This will override the flat annual contribution."
        learn={LEARN.accumulation}
        value={account.contributionSchedule !== undefined}
        onCommit={(value) => {
          onCommit(
            'contributionSchedule',
            value
              ? [{ annualAmount: account.annualContribution, fromAge: null, toAge: null, escalationPct: 0 }]
              : undefined,
          )
        }}
      />
      {account.contributionSchedule !== undefined ? (
        <div className="nested-form-section field-span-full" data-testid="contribution-schedule-panel">
          <h4>Contribution Schedule</h4>
          {account.contributionSchedule.map((phase, phaseIndex) => {
            const updatePhase = (key: string, value: unknown) => {
              const schedule = [...(account.contributionSchedule ?? [])]
              schedule[phaseIndex] = { ...phase, [key]: value }
              onCommit('contributionSchedule', schedule)
            }
            const removePhase = () => {
              const schedule = (account.contributionSchedule ?? []).filter((_, index) => index !== phaseIndex)
              onCommit('contributionSchedule', schedule.length > 0 ? schedule : undefined)
            }
            return (
              <div key={phaseIndex} className="nested-phase-row">
                <div className="form-grid">
                  <MoneyField
                    label="Amount / year"
                    value={phase.annualAmount}
                    onCommit={(value) => updatePhase('annualAmount', value ?? 0)}
                  />
                  <PercentField
                    label="Phase escalation"
                    help="Optional. Annual rate at which this phase's contribution amount increases, on top of inflation."
                    learn={LEARN.accumulation}
                    value={phase.escalationPct}
                    onCommit={(value) => updatePhase('escalationPct', value ?? 0)}
                  />
                  <NumberField
                    label="From age"
                    hint="Blank = start age."
                    value={phase.fromAge}
                    allowNull
                    min={0}
                    max={100}
                    onCommit={(value) => updatePhase('fromAge', value)}
                  />
                  <NumberField
                    label="To age"
                    hint="Blank = run forever."
                    value={phase.toAge}
                    allowNull
                    min={0}
                    max={100}
                    onCommit={(value) => updatePhase('toAge', value)}
                  />
                </div>
                <button type="button" className="btn btn-secondary btn-small" onClick={removePhase}>
                  Remove Phase
                </button>
              </div>
            )
          })}
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              onCommit('contributionSchedule', [
                ...(account.contributionSchedule ?? []),
                { annualAmount: 0, fromAge: null, toAge: null, escalationPct: 0 },
              ])
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
          onCommit={(value) => onCommit('annualContribution', value ?? 0)}
        />
      )}
    </>
  )
}

function EstateBeneficiaryFields({
  account,
  index,
  onCommit,
}: {
  account: Account
  index: number
  onCommit: CommitAccountField
}) {
  if (account.type === 'debt' || account.type === 'property') return null
  // A guaranteed-income contract is not a logical balance account, so
  // `estateBreakdown` never reads an estate beneficiary off a pension or an
  // annuity: what the contract leaves behind is its own survivor benefit,
  // period-certain, or lump-sum term. The control was hidden on Pension and
  // shown on Annuity, which made the same inert field look meaningful on one
  // card and absent on the other (#486). Decision D8 on #495: hide it on both
  // and say why. The schema keeps the field, so an imported plan that carries
  // one still round-trips.
  if (account.type === 'pension' || account.type === 'annuity') {
    return (
      <p className="card-hint">
        Guaranteed income does not pass to the estate. What continues after a death comes from the contract
        itself — a survivor benefit, guaranteed years, or a lump sum — not from an estate beneficiary.
      </p>
    )
  }

  return (
    <>
      <SelectField
        label="Estate beneficiary"
        help="Who inherits this account's balance. Spouse: rolls over untaxed (spousal IRA rollover or HSA inheritance). Non-spouse: the balance is taxed at the heir tax rate for this account class. Charity: passes untaxed and leaves the heirs' estate entirely. Default treats each account by its type, traditional (and a non-spouse HSA) pass to a non-spouse heir taxed at the heir rate; cash, taxable, and Roth pass through untaxed."
        // An HSA also carries the older Beneficiary shorthand above; the engine
        // lets an explicit estate destination win and otherwise follows the
        // shorthand, and the two hints say so (#516).
        hint={account.type === 'hsa' ? 'Blank = follows the Beneficiary above.' : 'Blank = default by account type.'}
        value={account.estateBeneficiary?.destination ?? ''}
        options={[
          { value: '', label: account.type === 'hsa' ? 'Default (follows Beneficiary above)' : 'Default (by account type)' },
          { value: 'spouse', label: 'Spouse (rolls over untaxed)' },
          { value: 'nonSpouse', label: 'Non-spouse heir' },
          { value: 'charity', label: 'Charity' },
        ]}
        onCommit={(value) =>
          onCommit(
            'estateBeneficiary',
            value === '' || value === 'nonSpouse'
              ? value === 'nonSpouse'
                ? { destination: 'nonSpouse' }
                : undefined
              : value === 'charity'
                ? { destination: 'charity', charityPct: 100 }
                : { destination: 'spouse' },
          )
        }
      />
      {account.estateBeneficiary?.destination === 'charity' ? (
        <PercentField
          label="Charity share"
          help="What percentage of this account goes to charity. The remainder goes to a non-spouse heir and is taxed at the heir tax rate."
          path={`accounts.${index}.estateBeneficiary.charityPct`}
          value={account.estateBeneficiary.charityPct ?? 100}
          onCommit={(value) =>
            onCommit('estateBeneficiary', { destination: 'charity', charityPct: value ?? 100 })
          }
        />
      ) : null}
    </>
  )
}
