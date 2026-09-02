/** Insurance section: policies, care events, LTC stress. */

import { useEffect, useId, useMemo, useRef } from 'react'

import {
  ltcPolicySchema,
  permanentLifePolicySchema,
  type CareEvent,
  type InsurancePolicy,
  type Plan,
} from '@retiregolden/engine/model/plan'
import { compareLtcStress } from '@retiregolden/engine/projection/compare'
import { usePlan } from '../planContextCore'
import { CheckboxField, MoneyField, NumberField, PercentField, SelectField, TextField } from '../fields'
import { useFieldIssue } from '../useFieldIssue'
import { LearnAboutScreen } from '../../learn/LearnAboutScreen'
import { LearnLink } from '../../learn/LearnLink'
import { LEARN } from '../learnLinks'
import { fmtMoneyCompact } from '../format'
import { currentStartYear, taxCalculatorFor } from '../useProjection'
import { IssueSectionsSentence, Issues } from './shared'
import {
  appendScheduleRow,
  duplicateCareEvents,
  duplicateScheduleAges,
  formatAgeList,
  makeCareEvent,
  maxScheduleAge,
  newId,
  nextCareEvent,
  nextScheduleAge,
  ordinalSuffixes,
} from './sectionHelpers'

const INSURANCE_LABEL: Record<InsurancePolicy['kind'], string> = {
  permanentLife: 'Permanent life',
  ltc: 'Long-term care',
}

/** Display order of the policy kinds: the add-button order above. */
const INSURANCE_KIND_ORDER = Object.keys(INSURANCE_LABEL) as InsurancePolicy['kind'][]

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
  const schedule = policy.kind === 'permanentLife' ? (policy.cashValueSchedule ?? []) : []
  const repeatedAges = duplicateScheduleAges(schedule)
  const nextAge = nextScheduleAge(schedule)
  const scheduleId = useId()
  const scheduleIssue = useFieldIssue(`insurance.${index}.cashValueSchedule`)
  return (
    <div className="form-grid">
      <TextField label="Name" path={`insurance.${index}.name`} value={policy.name} onCommit={(v) => set('name', v || INSURANCE_LABEL[policy.kind])} />
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
        path={`insurance.${index}.annualPremium`}
        value={policy.annualPremium}
        onCommit={(v) => set('annualPremium', v ?? 0)}
      />
      <SelectField
        label="Premium"
        help="Permanent-life and most LTC premiums are level (fixed nominal), so they aren't inflation-adjusted."
        learn={policyLearn}
        value={policy.premiumMode}
        options={PREMIUM_MODE_OPTIONS}
        onCommit={(v) =>
          update((d) => {
            const p = d.insurance[index]!
            p.premiumMode = v
            // The schema requires premiumEndAge while premiums run until an
            // age and still bounds one otherwise, so either side of this switch
            // leaves an age the schema accepts, or none at all (#503). Entering
            // the mode keeps a stored age that parses (a 72 survives the round
            // trip) and otherwise stores the 65 the field already displays as
            // its default; leaving it drops only an age the schema rejects, so
            // no issue is left on a field that is no longer shown. The bound is
            // the engine's, read from this policy kind's own schema.
            const schema = p.kind === 'ltc' ? ltcPolicySchema : permanentLifePolicySchema
            const endAgeParses = schema.shape.premiumEndAge.safeParse(p.premiumEndAge).success
            if (v === 'untilAge') {
              if (p.premiumEndAge === undefined || !endAgeParses) p.premiumEndAge = 65
            } else if (!endAgeParses) delete p.premiumEndAge
          })
        }
      />
      {policy.premiumMode === 'untilAge' ? (
        <NumberField
          label="Premiums end at age"
          help="The age when scheduled premiums stop. Leave the mode as pay for life if premiums continue indefinitely."
          learn={policyLearn}
          path={`insurance.${index}.premiumEndAge`}
          value={policy.premiumEndAge ?? 65}
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
            path={`insurance.${index}.deathBenefit`}
            value={policy.deathBenefit}
            onCommit={(v) => set('deathBenefit', v ?? 0)}
          />
          <MoneyField
            label="Cash value (today)"
            help="Current policy cash value while the insured is alive. Use the policy statement value, not the death benefit."
            learn={LEARN.permanentLife}
            path={`insurance.${index}.cashValue`}
            value={policy.cashValue}
            onCommit={(v) => set('cashValue', v ?? 0)}
          />
          <SelectField
            label="Cash value grows by"
            help="Flat rate is a rough estimate. A pasted illustration schedule is accurate. Whole-life cash value is front-loaded-poor, back-loaded-rich, not linear."
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
              path={`insurance.${index}.cashValueGrowthPct`}
              value={policy.cashValueGrowthPct ?? 0}
              onCommit={(v) => set('cashValueGrowthPct', v ?? 0)}
            />
          ) : (
            // The block is the control for the schedule as a whole: when the
            // engine rejects it, it carries aria-invalid and takes focus, so
            // the save chip's jump lands here rather than on a list (#489).
            <div
              className={scheduleIssue ? 'field field-span-full field--invalid' : 'field field-span-full'}
              role="group"
              aria-labelledby={`${scheduleId}-label`}
              aria-invalid={scheduleIssue ? true : undefined}
              aria-describedby={scheduleIssue ? `${scheduleId}-error` : undefined}
              tabIndex={scheduleIssue ? -1 : undefined}
              data-path={`insurance.${index}.cashValueSchedule`}
            >
              {/* The same caption structure as every field, so the invalid
                  tint on .field--invalid > .field-label-row > .field-label applies. */}
              <span className="field-label-row">
                <span className="field-label" id={`${scheduleId}-label`}>Cash-value schedule (age → value)</span>
              </span>
              {(policy.cashValueSchedule ?? []).map((row, ri) => (
                <div className="add-row" key={ri} style={{ alignItems: 'flex-end' }}>
                  <NumberField label="Age" path={`insurance.${index}.cashValueSchedule.${ri}.age`} value={row.age} onCommit={(v) => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife' && p.cashValueSchedule) p.cashValueSchedule[ri]!.age = Math.round(v ?? row.age) })} />
                  <MoneyField label="Value" path={`insurance.${index}.cashValueSchedule.${ri}.value`} value={row.value} onCommit={(v) => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife' && p.cashValueSchedule) p.cashValueSchedule[ri]!.value = v ?? 0 })} />
                  <button type="button" className="btn-ghost btn-ghost-danger" onClick={() => update((d) => { const p = d.insurance[index]; if (p.kind === 'permanentLife' && p.cashValueSchedule) p.cashValueSchedule.splice(ri, 1) })}>Remove</button>
                </div>
              ))}
              {repeatedAges.length > 0 ? (
                <div className="callout callout--warn" role="status">
                  {repeatedAges.length === 1 ? 'Age' : 'Ages'} {formatAgeList(repeatedAges)}{' '}
                  {repeatedAges.length === 1 ? 'appears' : 'each appear'} more than once in this schedule. Keep one value
                  per age so the illustration reads as one line.
                </div>
              ) : null}
              {/* The engine's issue for the schedule as a whole (an empty schedule
                  under the schedule mode, #489) sits on the block, by the button
                  that adds the first row, rather than in the card-level list. */}
              {scheduleIssue ? (
                <p className="field-error" id={`${scheduleId}-error`}>
                  {scheduleIssue.advice}
                </p>
              ) : null}
              {/* A new row opens one past the latest, so a click never creates a
                  repeat; once the schedule reaches the schema's highest age
                  there is nothing left to add (#489). */}
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={nextAge === null}
                aria-describedby={scheduleIssue ? `${scheduleId}-error` : undefined}
                title={
                  nextAge === null
                    ? `Every age up to ${maxScheduleAge()}, the highest an illustration can hold, already has a row.`
                    : undefined
                }
                onClick={() =>
                  update((d) => {
                    const p = d.insurance[index]
                    if (p.kind !== 'permanentLife') return
                    // The same computation the disabled state read, run on the
                    // draft: a stale click appends a free age or nothing.
                    const next = appendScheduleRow(p.cashValueSchedule ?? [])
                    if (next !== null) p.cashValueSchedule = next
                  })
                }
              >
                + Schedule row
              </button>
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
        path={`careEvents.${index}.startAge`}
        value={event.startAge}
        onCommit={(v) => set('startAge', Math.round(v ?? 85))}
      />
      <NumberField
        label="Duration (years)"
        help="How long the care event lasts. Longer episodes can outlast a policy benefit period and shift more cost back to the household."
        learn={LEARN.ltcCosts}
        path={`careEvents.${index}.durationYears`}
        value={event.durationYears}
        onCommit={(v) => set('durationYears', Math.round(v ?? 3))}
      />
      <MoneyField
        label="Annual cost (today's $)"
        help="The annual care cost in today's dollars before any LTC policy benefit. This is added on top of baseline spending during the event."
        learn={LEARN.ltcCosts}
        hint="Additive to baseline spending; an LTC policy on this person offsets it."
        path={`careEvents.${index}.annualCost`}
        value={event.annualCost}
        onCommit={(v) => set('annualCost', v ?? 0)}
      />
    </div>
  )
}

const lastsLabel = (depletionYear: number | null) => (depletionYear === null ? 'full plan' : `until ${depletionYear}`)

function LtcStressPanel() {
  const { plan, issues } = usePlan()
  // The scenarios are full projections of the plan, so while any entry is
  // invalid (a duration of 0, a schedule mode with no rows, or an entry on
  // another page) the last table would read as authoritative for a plan the
  // engine has refused to store; the panel pauses instead (#517).
  const onHold = issues.length > 0
  const cmp = useMemo(
    () => (onHold ? null : compareLtcStress(plan, { startYear: currentStartYear(), taxCalculator: taxCalculatorFor(plan) })),
    [plan, onHold],
  )
  // Only events on a current household member are priced; a set left over
  // from removed people is an entry to fix, not a stress test to show.
  const liveEvents = plan.careEvents.filter((c) => plan.household.people.some((p) => p.id === c.personId))
  if (liveEvents.length === 0) return null
  const many = liveEvents.length > 1
  const ltcPolicies = plan.insurance.filter((i) => i.kind === 'ltc').length
  const episodes = many ? 'the care episodes' : 'the care episode'
  if (cmp === null) {
    return (
      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h3>LTC stress test</h3>
        <div className="callout callout--warn" role="status">
          Paused while the plan has {issues.length === 1 ? 'an issue' : `${issues.length} issues`} to fix, which may
          be anywhere in the plan: these scenarios are full projections, and a projection is not re-run on a plan the
          engine will not store, so the last result no longer applies. <IssueSectionsSentence />
        </div>
      </div>
    )
  }
  const policyValue = cmp.careInsured.endingNetWorth - cmp.careUninsured.endingNetWorth
  const careShock = cmp.noCare.endingNetWorth - cmp.careUninsured.endingNetWorth
  return (
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <h3>LTC stress test</h3>
      <p className="card-hint">
        Ending net worth if {episodes} {many ? 'happen' : 'happens'}, with and without your LTC coverage offsetting{' '}
        {many ? 'them' : 'it'}.
      </p>
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
      {/* Counts follow the plan: two care events or two LTC policies read as
          plural, since both are modeled (#489). */}
      <p className="card-hint" style={{ marginTop: '0.75rem' }}>
        Unprotected, {episodes} would cost your estate <strong>{fmtMoneyCompact(careShock)}</strong>.{' '}
        {!cmp.hasLtcPolicy ? (
          <>You have no LTC policy to offset {many ? 'them' : 'it'}.</>
        ) : policyValue >= 0 ? (
          <>
            Your LTC {ltcPolicies > 1 ? 'policies improve' : 'policy improves'} the outcome by{' '}
            <strong>{fmtMoneyCompact(policyValue)}</strong>, net of {ltcPolicies > 1 ? 'their' : 'its'} premiums.
          </>
        ) : (
          <>
            Here the {ltcPolicies > 1 ? "policies' lifetime premiums outweigh their" : "policy's lifetime premiums outweigh its"}{' '}
            benefits by <strong>{fmtMoneyCompact(-policyValue)}</strong>.
          </>
        )}
      </p>
    </div>
  )
}

export function InsuranceSection() {
  const { plan, update } = usePlan()
  const firstPerson = plan.household.people[0]!.id
  // Policies are shown grouped by kind, in the add-button order, whatever
  // order they were added in (#550). The plan array is untouched: each card
  // keeps its stored index for edits and removal; the stored index is also
  // the tiebreaker, so the added order within a kind never depends on the
  // sort being stable.
  const policies = plan.insurance
    .map((policy, index) => ({ policy, index }))
    .sort(
      (a, b) =>
        INSURANCE_KIND_ORDER.indexOf(a.policy.kind) - INSURANCE_KIND_ORDER.indexOf(b.policy.kind) || a.index - b.index,
    )
  // Keyed by kind and name because the displayed title is the kind chip
  // plus the name: two "Whole life" policies of one kind repeat and get
  // ordinals; an LTC and a permanent-life policy that share a name do not,
  // since their chips already tell them apart. If the chip ever left the
  // title, the key would have to drop the kind with it.
  const policyOrdinals = ordinalSuffixes(policies.map(({ policy }) => `${policy.kind} ${policy.name}`))
  // Grouping means a new card lands in its kind's group, which can be well
  // above the add row when the other kind fills the list; focus and view
  // follow it there so the add never looks like it did nothing (#550 review).
  // A ref, not state: the add is consumed once the card exists and nothing
  // renders from it, so no re-render is owed when it is set or cleared. It
  // remembers the control that was clicked, so focus is moved only while it
  // is still there (or nowhere): a person who has already moved on to
  // another field between the click and this effect keeps their place.
  const sectionRef = useRef<HTMLElement>(null)
  const addedPolicy = useRef<{ id: string; trigger: HTMLElement } | null>(null)
  useEffect(() => {
    const added = addedPolicy.current
    if (added === null) return
    // One attempt per add, found or not: a row that is not in this section
    // by the time the plan holds it is never going to be, so the ref must
    // not keep retrying on every later change.
    addedPolicy.current = null
    const row = sectionRef.current?.querySelector<HTMLElement>(`[data-policy-id="${added.id}"]`)
    if (!row) return
    const active = document.activeElement
    if (active !== null && active !== document.body && active !== added.trigger) return
    row.querySelector<HTMLElement>('input, select')?.focus()
    row.scrollIntoView?.({ block: 'nearest' })
  }, [plan.insurance])
  // Two events for the same person at the same age would read identically;
  // the ordinal keeps the cards and their Remove buttons apart (#541).
  const careTitles = plan.careEvents.map(
    (c) => `${plan.household.people.find((p) => p.id === c.personId)?.name ?? 'Care'} · age ${c.startAge}`,
  )
  const careOrdinals = ordinalSuffixes(careTitles)
  return (
    <section ref={sectionRef}>
      <div className="card">
        <h2>Insurance</h2>
        <p className="card-hint">
          Long-term-care and permanent-life policies. Premiums feed your spending; permanent-life cash value is an
          asset in net worth, and the death benefit pays income-tax-free at the insured's death. Add care events to
          test whether an LTC policy offsets a late-life care shock. <LearnLink {...LEARN.insuranceOverview} />
        </p>
        {plan.insurance.length === 0 ? <div className="empty-state"><p>No policies yet. Add one below.</p></div> : null}
        {policies.map(({ policy: p, index: i }, position) => (
          <div className="item-row" key={p.id} data-testid="insurance-row" data-insurance-kind={p.kind} data-policy-id={p.id}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">{INSURANCE_LABEL[p.kind]}</span>
                <span>{`${p.name}${policyOrdinals[position]}`}</span>
              </span>
              <button
                type="button"
                className="btn-ghost btn-ghost-danger"
                aria-label={`Remove ${INSURANCE_LABEL[p.kind]} ${p.name}${policyOrdinals[position]}`}
                onClick={() => update((d) => void d.insurance.splice(i, 1))}
              >
                Remove
              </button>
            </div>
            <InsuranceFields policy={p} index={i} />
          </div>
        ))}
        <div className="add-row">
          {(Object.keys(INSURANCE_LABEL) as InsurancePolicy['kind'][]).map((k) => (
            <button
              key={k}
              type="button"
              className="btn btn-secondary btn-small"
              onClick={(e) => {
                const policy = makeInsurance(k, firstPerson)
                addedPolicy.current = { id: policy.id, trigger: e.currentTarget }
                update((d) => void d.insurance.push(policy))
              }}
            >
              + {INSURANCE_LABEL[k]}
            </button>
          ))}
        </div>

        <h3>Care events</h3>
        <p className="card-hint">
          A deterministic late-life care episode, a spending spike an LTC policy on the same person can absorb.
          Add one to see the stress test below. <LearnLink {...LEARN.ltcCosts} />
        </p>
        {plan.careEvents.map((c, i) => (
          <div className="item-row" key={c.id} data-testid="care-event-row">
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">Care</span>
                <span>{`${careTitles[i]}${careOrdinals[i]}`}</span>
              </span>
              <button
                type="button"
                className="btn-ghost btn-ghost-danger"
                aria-label={`Remove care event ${careTitles[i]}${careOrdinals[i]}`}
                onClick={() => update((d) => void d.careEvents.splice(i, 1))}
              >
                Remove
              </button>
            </div>
            <CareEventFields event={c} index={i} />
          </div>
        ))}
        {duplicateCareEvents(plan).map((dupe) => (
          <div className="callout callout--warn" role="status" key={`${dupe.personId}@${dupe.startAge}`}>
            {dupe.name} has {dupe.count} care events starting at age {dupe.startAge}. All {dupe.count} count toward the
            care cost the stress test prices when it runs; remove the extra{dupe.count === 2 ? '' : 's'} if{' '}
            {dupe.count === 2 ? 'it was' : 'they were'} added by mistake.
          </div>
        ))}
        <div className="add-row">
          {/* Disabled once every person has an event at every age the
              schema allows, rather than appending a repeat (#489). */}
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={nextCareEvent(plan) === null}
            title={nextCareEvent(plan) === null ? 'Every start age a care event can have is already taken.' : undefined}
            onClick={() =>
              update((d) => {
                const event = makeCareEvent(d)
                if (event !== null) d.careEvents.push(event)
              })
            }
          >
            + Care event
          </button>
        </div>

        <LtcStressPanel />
        <Issues section="insurance" />
      </div>
      <LearnAboutScreen route="/plan/:planId/insurance" />
    </section>
  )
}
