/** Income section: wages, pensions, annuities, other streams. */

import { Link } from 'react-router-dom'

import type { IncomeStream } from '@retiregolden/engine/model/plan'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, ReadonlyField, SelectField, TextField } from '../fields'
import { LEARN } from '../learnLinks'
import { fmtMoney } from '../format'
import { resolvePia } from '../ssAnalysis'
import { Issues } from './shared'
import { newId } from './sectionHelpers'

const INCOME_LABEL: Record<IncomeStream['type'], string> = {
  wages: 'Wages',
  socialSecurity: 'Social Security',
  recurring: 'Recurring',
  oneTime: 'One-time',
}

function makeIncome(type: IncomeStream['type'], personId: string): IncomeStream {
  switch (type) {
    case 'wages':
      return { type, id: newId(), personId, annualGross: 0, endAge: null, realGrowthPct: 0 }
    case 'socialSecurity':
      return { type, id: newId(), personId, piaMonthly: 0, earnings: null, claimAge: { years: 67, months: 0 } }
    case 'recurring':
      return { type, id: newId(), label: 'Rental income', annualAmount: 0, startYear: null, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' }
    case 'oneTime':
      return { type, id: newId(), label: 'Inheritance', year: new Date().getFullYear() + 1, amount: 0, taxTreatment: 'none' }
  }
}

function IncomeFields({ stream, index }: { stream: IncomeStream; index: number }) {
  const { plan, update } = usePlan()
  const set = (key: string, value: unknown) =>
    update((d) => {
      ;(d.incomes[index] as unknown as Record<string, unknown>)[key] = value
    })
  const personOpts = plan.household.people.map((p) => ({ value: p.id, label: p.name }))
  switch (stream.type) {
    case 'wages': {
      const wagePerson = plan.household.people.find((p) => p.id === stream.personId)
      const retireAge = wagePerson?.retirementAge ?? null
      return (
        <div className="form-grid">
          <SelectField label="Person" value={stream.personId} options={personOpts} onCommit={(v) => set('personId', v)} />
          <MoneyField label="Annual gross" value={stream.annualGross} onCommit={(v) => set('annualGross', v ?? 0)} />
          <PercentField
            label="Real raise rate"
            help="Annual wage growth rate on top of inflation (e.g. raises or promotions). A 1% rate means wages grow 1% faster than inflation each year."
            learn={LEARN.accumulation}
            value={stream.realGrowthPct ?? 0}
            onCommit={(v) => set('realGrowthPct', v ?? 0)}
          />
          <NumberField
            label="Stop age"
            help="Only set this to end wages at a different age than the retirement age from the Household form — e.g. part-time work that winds down earlier."
            hint={retireAge !== null ? `Blank = retirement age (${retireAge}).` : 'Blank = retirement age.'}
            value={stream.endAge}
            allowNull
            min={30}
            max={80}
            onCommit={(v) => set('endAge', v)}
          />
        </div>
      )
    }
    case 'socialSecurity': {
      const ssPerson = plan.household.people.find((p) => p.id === stream.personId)
      const resolved = ssPerson ? resolvePia(ssPerson, stream) : null
      const pia = resolved?.piaMonthly ?? stream.piaMonthly
      const sourceLabel = stream.piaMonthly === null ? 'earnings record' : 'quick PIA'
      const claim = `${stream.claimAge.years}y${stream.claimAge.months ? ` ${stream.claimAge.months}m` : ''}`
      return (
        <>
          <div className="form-grid">
            <ReadonlyField label="Person" value={ssPerson?.name ?? '—'} />
            <ReadonlyField label="PIA (monthly at FRA)" value={pia != null ? `${fmtMoney(pia)} (${sourceLabel})` : 'Not set'} />
            <ReadonlyField label="Claim age" value={claim} />
          </div>
          <p className="field-hint">
            Social Security is managed on the <Link to="../social-security">Social Security</Link> step so the
            earnings-derived benefit stays in one place. Edit the benefit and claim age there; the{' '}
            <Link to="../social-security-analysis">Social Security analysis</Link> can apply the best claim age.
          </p>
        </>
      )
    }
    case 'recurring':
      return (
        <div className="form-grid">
          <TextField label="Label" value={stream.label} onCommit={(v) => set('label', v || 'Income')} />
          <MoneyField label="Annual amount" value={stream.annualAmount} onCommit={(v) => set('annualAmount', v ?? 0)} />
          <NumberField label="Start year" value={stream.startYear} allowNull min={1900} max={2200} onCommit={(v) => set('startYear', v === null ? null : Math.round(v))} />
          <NumberField label="End year" value={stream.endYear} allowNull min={1900} max={2200} onCommit={(v) => set('endYear', v === null ? null : Math.round(v))} />
          <SelectField
            label="Tax treatment"
            value={stream.taxTreatment}
            options={[
              { value: 'ordinary', label: 'Ordinary income' },
              { value: 'none', label: 'Not taxed' },
            ]}
            onCommit={(v) => set('taxTreatment', v)}
          />
          <CheckboxField label="Inflation-adjusted" value={stream.inflationAdjusted} onCommit={(v) => set('inflationAdjusted', v)} />
        </div>
      )
    case 'oneTime':
      return (
        <div className="form-grid">
          <TextField label="Label" value={stream.label} onCommit={(v) => set('label', v || 'Event')} />
          <NumberField label="Year" value={stream.year} min={1900} max={2200} onCommit={(v) => set('year', Math.round(v ?? new Date().getFullYear()))} />
          <MoneyField label="Amount" value={stream.amount} onCommit={(v) => set('amount', v ?? 0)} />
          <SelectField
            label="Tax treatment"
            value={stream.taxTreatment}
            options={[
              { value: 'none', label: 'Not taxed' },
              { value: 'ordinary', label: 'Ordinary income' },
              { value: 'capitalGain', label: 'Capital gain' },
            ]}
            onCommit={(v) => set('taxTreatment', v)}
          />
        </div>
      )
  }
}

export function IncomeSection() {
  const { plan, update } = usePlan()
  const firstPerson = plan.household.people[0]!.id
  return (
    <section>
      <div className="card">
        <h2>Income</h2>
        <p className="card-hint">Wages run until each person's retirement age and drive contributions and the SS earnings test. Social Security uses monthly claiming factors.</p>
        {plan.incomes.map((s, i) => (
          <div className="item-row" key={s.id}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">{INCOME_LABEL[s.type]}</span>
                {'label' in s ? s.label : (plan.household.people.find((p) => 'personId' in s && p.id === s.personId)?.name ?? '')}
              </span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.incomes.splice(i, 1))}>
                Remove
              </button>
            </div>
            <IncomeFields stream={s} index={i} />
          </div>
        ))}
        <div className="add-row">
          {(Object.keys(INCOME_LABEL) as IncomeStream['type'][])
            .filter((t) => t !== 'socialSecurity')
            .map((t) => (
              <button key={t} type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => void d.incomes.push(makeIncome(t, firstPerson)))}>
                + {INCOME_LABEL[t]}
              </button>
            ))}
        </div>
        <Issues />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Spending
// ---------------------------------------------------------------------------

