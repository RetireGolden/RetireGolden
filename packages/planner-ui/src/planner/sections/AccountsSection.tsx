/** Accounts section: add/edit accounts. */

import type { Account } from '@retiregolden/engine/model/plan'
import { AccountFields } from './AccountFields'
import { ACCOUNT_LABEL, isIndividuallyOwnedAccount } from './sectionHelpers'
import { usePlan } from '../planContextCore'
import { Issues } from './shared'
import { newId } from './sectionHelpers'
import { UpdateBalancesPanel } from './UpdateBalancesPanel'

function makeAccount(type: Account['type'], primaryPersonId: string): Account {
  const base = { id: newId(), ownerPersonId: isIndividuallyOwnedAccount(type) ? primaryPersonId : null, annualReturnPct: null }
  switch (type) {
    case 'cash':
      return { ...base, type, name: 'Savings', balance: 0, annualContribution: 0 }
    case 'taxable':
      return {
        ...base,
        type,
        name: 'Brokerage',
        balance: 0,
        costBasis: 0,
        interestYieldPct: 0,
        dividendYieldPct: 0,
        qualifiedRatio: 0.85,
        reinvestDividends: true,
        annualContribution: 0,
      }
    case 'equityComp':
      return { ...base, type, name: 'RSU / ESPP', balance: 0, costBasis: 0, annualContribution: 0, vestingMode: 'cliff', vestDate: `${new Date().getFullYear()}-12-31` }
    case 'traditional':
      return { ...base, type, name: '401(k)', kind: 'employer', balance: 0, annualContribution: 0 }
    case 'roth':
      return { ...base, type, name: 'Roth IRA', kind: 'ira', balance: 0, annualContribution: 0 }
    case 'hsa':
      return { ...base, type, name: 'HSA', balance: 0, annualContribution: 0 }
    case 'pension':
      return { ...base, type, name: 'Pension', source: 'private', startAge: 65, monthlyAmount: 0, colaPct: 0, survivorPct: 50 }
    case 'annuity':
      return { ...base, type, name: 'Annuity', startAge: 65, monthlyAmount: 0, colaPct: 0, taxablePct: 100 }
    case 'property':
      return { ...base, type, name: 'Home', value: 0, plannedSaleYear: null, expectedNetProceeds: null }
    case 'debt':
      return { ...base, type, name: 'Mortgage', balance: 0, interestPct: 5, monthlyPayment: 0 }
  }
}


export function AccountsSection() {
  const { plan, update } = usePlan()
  const primaryPersonId = plan.household.people[0]!.id
  return (
    <section>
      <div className="card">
        <h2>Accounts</h2>
        <p className="card-hint">Balances as of today. Investable accounts grow at their expected return (or the default assumption) and are drained per your withdrawal strategy.</p>
        {plan.accounts.length === 0 ? <div className="empty-state"><p>No accounts yet — add your first below.</p></div> : null}
        {plan.accounts.map((a, i) => (
          <div className="item-row" key={a.id} data-testid="account-row" data-account-type={a.type} data-account-name={a.name}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">{ACCOUNT_LABEL[a.type]}</span>
                {a.name}
              </span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.accounts.splice(i, 1))}>
                Remove
              </button>
            </div>
            <AccountFields account={a} index={i} />
          </div>
        ))}
        <div className="add-row">
          {(Object.keys(ACCOUNT_LABEL) as Account['type'][]).map((t) => (
            <button key={t} type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => void d.accounts.push(makeAccount(t, primaryPersonId)))}>
              + {ACCOUNT_LABEL[t]}
            </button>
          ))}
        </div>
        <Issues />
      </div>
      <UpdateBalancesPanel />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

