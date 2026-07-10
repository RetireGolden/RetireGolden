/** Insurance section: policies, care events, LTC stress. */

import { useMemo } from 'react'

import type { CareEvent, InsurancePolicy, Plan } from '../../engine/model/plan'
import { compareLtcStress } from '../../engine/projection/compare'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { fmtMoneyCompact } from '../format'
import { currentStartYear, taxCalculatorFor } from '../useProjection'
import { Issues } from './shared'
import { newId } from './sectionHelpers'

const INSURANCE_LABEL: Record<InsurancePolicy['kind'], string> = {
  permanentLife: 'Permanent life',
  ltc: 'Long-term care',
}

function personOptions(plan: Plan) {
  return plan.household.people.map((p) => ({ value: p.id, label: p.name }))
}

function makeInsurance(kind: InsurancePolicy['kind'], personId: string): InsurancePolicy {
  if (kind === 'ltc') {
    return { kind, id: newId(), name: 'LTC policy', owner: personId, annualPremium: 0, premiumMode: 'lifetime', benefitMonthly: 0, benefitPeriodYears: 3, eliminationPeriodDays: 90 }
  }
  return { kind, id: newId(), name: 'Whole life', insured: personId, beneficiary: 'estate', annualPremium: 0, premiumMode: 'lifetime', deathBenefit: 0, cashValue: 0, cashValueMode: 'flatRate', cashValueGrowthPct: 4 }
}

const PREMIUM_MODE_OPTIONS = [
  { value: 'lifetime', label: 'Pay for life' },
  { value: 'paidUp', label: 'Paid up (none)' },
  { value: 'untilAge', label: 'Until an age' },
] as const

function InsuranceFields({ policy, index }: { policy: InsurancePolicy; index: number }) {
  const { plan, update } = usePlan()
  const set = <K extends string>(key: K, value: unknown) =>
    update((d) => {
      ;(d.insurance[index] as unknown as Record<string, unknown>)[key] = value
    })
  const policyLearn = policy.kind === 'ltc' ? LEARN.ltcInsurance : LEARN.permanentLife
  return (
    <div className="form-grid">
      <TextField label="Name" value={policy.name} onCommit={(v) => set('name', v || INSURANCE_LABEL[policy.kind])} />
      <SelectField
        label={policy.kind === 'ltc' ? 'Owner' : 'Insured'}
        value={policy.kind === 'ltc' ? policy.owner : policy.insured}
        options={personOptions(plan)}
        onCommit={(v) => set(policy.kind === 'ltc' ? 'owner' : 'insured', v)}
      />

      <MoneyField
        label="Annual premium"
        help="The yearly cost of keeping this policy in force. Premiums reduce spending capacity even in years when no claim or death benefit is paid."
        learn={policyLearn}
        value={policy.annualPremium}
        onCommit={(v) => set('annualPremium', v ?? 0)}
      />
      <SelectField
        label="Premium"
        help="Permanent-life and most LTC premiums are level (fixed nominal), so they aren't inflation-adjusted."
        learn={policyLearn}
        value={policy.premiumMode}
        options={PREMIUM_MODE_OPTIONS}
        onCommit={(v) => set('premiumMode', v)}
      />
      {policy.premiumMode === 'untilAge' ? (
        <NumberField
          label="Premiums end at age"
          help="The age when scheduled premiums stop. Leave the mode as pay for life if premiums continue indefinitely."
          learn={policyLearn}
          value={policy.premiumEndAge ?? 65}
          min={40}
          max={110}
          onCommit={(v) => set('premiumEndAge', Math.round(v ?? 65))}
        />
      ) : null}

      {policy.kind === 'permanentLife' ? (
        <>
          <SelectField
            label="Beneficiary"
            value={policy.beneficiary === 'estate' ? 'estate' : policy.beneficiary}
            options={[{ value: 'estate', label: 'Estate' }, ...personOptions(plan)]}
            onCommit={(v) => set('beneficiary', v)}
          />
          <MoneyField
            label="Death benefit"
            help="The modeled face amount paid when the insured person dies. RetireGolden treats it as income-tax-free at death, while avoiding double-counting cash value and death benefit."
            learn={LEARN.permanentLife}
            hint="Face amount, paid income-tax-free at death."
            value={policy.deathBenefit}
            onCommit={(v) => set('deathBenefit', v ?? 0)}
          />
          <MoneyField
            label="Cash value (today)"
            help="Current policy cash value while the insured is alive. Use the policy statement value, not the death benefit."
            learn={LEARN.permanentLife}
            value={policy.cashValue}
            onCommit={(v) => set('cashValue', v ?? 0)}
          />
          <SelectField
            label="Cash value grows by"
            help="Flat rate is a rough estimate. A pasted illustration schedule is accurate — whole-life cash value is front-loaded-poor, back-loaded-rich, not linear."
            learn={LEARN.permanentLife}
            value={policy.cashValueMode}
            options={[
              { value: 'flatRate', label: 'Flat rate' },
              { value: 'schedule', label: 'Illustration schedule' },
            ]}
            onCommit={(v) => set('cashValueMode', v)}
          />
          {policy.cashValueMode === 'flatRate' ? (
            <PercentField
              label="Cash value growth"
              help="A simple annual growth assumption for cash value. If you have an illustration, use the schedule instead because real policy values rarely grow in a straight line."
              learn={LEARN.permanentLife}
              value={policy.cashValueGrowthPct ?? 0}
              onCommit={(v) => set('cashValueGrowthPct', v ?? 0)}
            />
          ) : (
            <div className="field field-span-full">
              <span className="field-label">Cash-value schedule (age → value)</span>
              {(policy.cashValueSchedule ?? []).map((row, ri) => (
                <div className="add-row" key={ri} style={{ alignItems: 'flex-end' }}>
                  <NumberField label="Age" value={row.age} min={0} max={120} onCommit={(v) => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife' && p.cashValueSchedule) p.cashValueSchedule[ri]!.age = Math.round(v ?? row.age) })} />
                  <MoneyField label="Value" value={row.value} onCommit={(v) => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife' && p.cashValueSchedule) p.cashValueSchedule[ri]!.value = v ?? 0 })} />
                  <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife' && p.cashValueSchedule) p.cashValueSchedule.splice(ri, 1) })}>Remove</button>
                </div>
              ))}
              <button type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife') p.cashValueSchedule = [...(p.cashValueSchedule ?? []), { age: 65, value: 0 }] })}>+ Schedule row</button>
            </div>
          )}
        </>
      ) : (
        <>
          <MoneyField
            label="Monthly benefit"
            help="The maximum monthly amount the LTC policy can pay toward a modeled care event, before benefit-period limits and the inflation rider."
            learn={LEARN.ltcInsurance}
            hint="Maximum the policy pays toward care per month."
            value={policy.benefitMonthly}
            onCommit={(v) => set('benefitMonthly', v ?? 0)}
          />
          <CheckboxField
            label="Lifetime benefit period"
            help="When checked, benefits do not run out by years in the model. Most real policies have a finite benefit pool, so use this only if the contract says lifetime."
            learn={LEARN.ltcInsurance}
            value={policy.benefitPeriodYears === 'lifetime'}
            onCommit={(v) => set('benefitPeriodYears', v ? 'lifetime' : 3)}
          />
          {policy.benefitPeriodYears !== 'lifetime' ? (
            <NumberField
              label="Benefit period (years)"
              help="How many years benefits can continue. A care episode that lasts longer than this is partly self-funded."
              learn={LEARN.ltcInsurance}
              value={policy.benefitPeriodYears}
              min={1}
              max={20}
              onCommit={(v) => set('benefitPeriodYears', Math.round(v ?? 3))}
            />
          ) : null}
          <NumberField
            label="Elimination period (days)"
            help="The waiting period before benefits begin. Care costs during this period are self-funded."
            learn={LEARN.ltcInsurance}
            hint="Waiting period before benefits begin."
            value={policy.eliminationPeriodDays}
            min={0}
            max={365}
            onCommit={(v) => set('eliminationPeriodDays', Math.round(v ?? 90))}
          />
          <PercentField
            label="Inflation rider"
            help="Annual compound growth applied to the monthly benefit cap. This protects an old policy from covering less care as costs rise."
            learn={LEARN.ltcInsurance}
            hint="Compound growth of the benefit cap."
            value={policy.inflationRiderPct ?? 0}
            onCommit={(v) => set('inflationRiderPct', v ?? 0)}
          />
        </>
      )}
    </div>
  )
}

function makeCareEvent(personId: string): CareEvent {
  return { id: newId(), personId, startAge: 85, durationYears: 3, annualCost: 90_000 }
}

function CareEventFields({ event, index }: { event: CareEvent; index: number }) {
  const { plan, update } = usePlan()
  const set = (key: keyof CareEvent, value: unknown) =>
    update((d) => {
      ;(d.careEvents[index] as unknown as Record<string, unknown>)[key] = value
    })
  return (
    <div className="form-grid">
      <SelectField
        label="Who needs care"
        help="The person whose late-life care costs are being stress-tested. Only an LTC policy on this same person offsets the event."
        learn={LEARN.ltcCosts}
        value={event.personId}
        options={personOptions(plan)}
        onCommit={(v) => set('personId', v)}
      />
      <NumberField
        label="Starts at age"
        help="The age when the care event begins for the selected person."
        learn={LEARN.ltcCosts}
        value={event.startAge}
        min={40}
        max={110}
        onCommit={(v) => set('startAge', Math.round(v ?? 85))}
      />
      <NumberField
        label="Duration (years)"
        help="How long the care event lasts. Longer episodes can outlast a policy benefit period and shift more cost back to the household."
        learn={LEARN.ltcCosts}
        value={event.durationYears}
        min={1}
        max={25}
        onCommit={(v) => set('durationYears', Math.round(v ?? 3))}
      />
      <MoneyField
        label="Annual cost (today's $)"
        help="The annual care cost in today's dollars before any LTC policy benefit. This is added on top of baseline spending during the event."
        learn={LEARN.ltcCosts}
        hint="Additive to baseline spending; an LTC policy on this person offsets it."
        value={event.annualCost}
        onCommit={(v) => set('annualCost', v ?? 0)}
      />
    </div>
  )
}

const lastsLabel = (depletionYear: number | null) => (depletionYear === null ? 'full plan' : `until ${depletionYear}`)

function LtcStressPanel() {
  const { plan } = usePlan()
  const cmp = useMemo(
    () => compareLtcStress(plan, { startYear: currentStartYear(), taxCalculator: taxCalculatorFor(plan) }),
    [plan],
  )
  if (!cmp.hasCareEvents) return null
  const policyValue = cmp.careInsured.endingNetWorth - cmp.careUninsured.endingNetWorth
  const careShock = cmp.noCare.endingNetWorth - cmp.careUninsured.endingNetWorth
  return (
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <h3>LTC stress test</h3>
      <p className="card-hint">Ending net worth if the care episode happens, with and without your LTC coverage offsetting it.</p>
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">Scenario</th>
            <th scope="col">Ending net worth</th>
            <th scope="col">Money lasts</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">No care needed</th>
            <td>{fmtMoneyCompact(cmp.noCare.endingNetWorth)}</td>
            <td>{lastsLabel(cmp.noCare.depletionYear)}</td>
          </tr>
          <tr>
            <th scope="row">Care, self-funded</th>
            <td>{fmtMoneyCompact(cmp.careUninsured.endingNetWorth)}</td>
            <td>{lastsLabel(cmp.careUninsured.depletionYear)}</td>
          </tr>
          <tr>
            <th scope="row">Care, insured</th>
            <td>{fmtMoneyCompact(cmp.careInsured.endingNetWorth)}</td>
            <td>{lastsLabel(cmp.careInsured.depletionYear)}</td>
          </tr>
        </tbody>
      </table>
      <p className="card-hint" style={{ marginTop: '0.75rem' }}>
        Unprotected, the care episode would cost your estate <strong>{fmtMoneyCompact(careShock)}</strong>.{' '}
        {!cmp.hasLtcPolicy ? (
          <>You have no LTC policy to offset it.</>
        ) : policyValue >= 0 ? (
          <>Your LTC policy improves the outcome by <strong>{fmtMoneyCompact(policyValue)}</strong>, net of its premiums.</>
        ) : (
          <>Here the policy's lifetime premiums outweigh its benefits by <strong>{fmtMoneyCompact(-policyValue)}</strong>.</>
        )}
      </p>
    </div>
  )
}

export function InsuranceSection() {
  const { plan, update } = usePlan()
  const firstPerson = plan.household.people[0]!.id
  return (
    <section>
      <div className="card">
        <h2>Insurance</h2>
        <p className="card-hint">
          Long-term-care and permanent-life policies. Premiums feed your spending; permanent-life cash value is an
          asset in net worth, and the death benefit pays income-tax-free at the insured's death. Add care events to
          test whether an LTC policy offsets a late-life care shock. <LearnLink {...LEARN.insuranceOverview} />
        </p>
        {plan.insurance.length === 0 ? <div className="empty-state"><p>No policies yet — add one below.</p></div> : null}
        {plan.insurance.map((p, i) => (
          <div className="item-row" key={p.id}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">{INSURANCE_LABEL[p.kind]}</span>
                {p.name}
              </span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.insurance.splice(i, 1))}>
                Remove
              </button>
            </div>
            <InsuranceFields policy={p} index={i} />
          </div>
        ))}
        <div className="add-row">
          {(Object.keys(INSURANCE_LABEL) as InsurancePolicy['kind'][]).map((k) => (
            <button key={k} type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => void d.insurance.push(makeInsurance(k, firstPerson)))}>
              + {INSURANCE_LABEL[k]}
            </button>
          ))}
        </div>

        <h3>Care events</h3>
        <p className="card-hint">
          A deterministic late-life care episode — a spending spike an LTC policy on the same person can absorb.
          Add one to see the stress test below. <LearnLink {...LEARN.ltcCosts} />
        </p>
        {plan.careEvents.map((c, i) => (
          <div className="item-row" key={c.id}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">Care</span>
                {plan.household.people.find((p) => p.id === c.personId)?.name ?? 'Care'} · age {c.startAge}
              </span>
              <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => void d.careEvents.splice(i, 1))}>
                Remove
              </button>
            </div>
            <CareEventFields event={c} index={i} />
          </div>
        ))}
        <div className="add-row">
          <button type="button" className="btn btn-secondary btn-small" onClick={() => update((d) => void d.careEvents.push(makeCareEvent(firstPerson)))}>
            + Care event
          </button>
        </div>

        <LtcStressPanel />
        <Issues />
      </div>
      <LearnAboutScreen route="/plan/:planId/insurance" />
    </section>
  )
}
