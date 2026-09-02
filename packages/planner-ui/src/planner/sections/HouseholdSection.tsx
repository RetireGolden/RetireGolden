/** Household section: people, filing status, state, longevity. */

import { useState } from 'react'

import { invalidateAcaEvidence, removePartner, updatePersonLongevity } from '../householdActions'
import { updatePersonDob } from '../eligibilityFactActions'
import { usePlan } from '../planContextCore'
import { CheckboxField, DateField, NumberField, SelectField, TextField } from '../fields'
import { LEARN } from '../learnLinks'
import { LongevityModal } from '../LongevityModal'
import { SurvivalPercentileModal } from '../SurvivalPercentileModal'
import { US_STATES } from '../usStates'
import { Issues } from './shared'
import { fallbackPersonName, MONTH_OPTIONS, newId } from './sectionHelpers'

// ---------------------------------------------------------------------------
// Household
// ---------------------------------------------------------------------------

export function HouseholdSection() {
  const { plan, update } = usePlan()
  const couple = plan.household.people.length === 2
  const [longevityFor, setLongevityFor] = useState<number | null>(null)
  const [percentileFor, setPercentileFor] = useState<number | null>(null)
  return (
    <section>
      <div className="card">
        <h2>Household</h2>
        <p className="card-hint">
          Who the plan is for. The projection runs from this year until the later planning age, pays wages until each
          person's retirement age, and models survivor rules (filing status, Social Security step-up) after the first
          death. Hover any ⓘ for details.
        </p>
        <div className="form-grid">
          <SelectField
            label="Filing status"
            help="Sets the federal tax brackets, deductions, and IRMAA tiers. Married filing jointly requires two people; the death year remains joint, then the survivor normally files single."
            value={plan.household.filingStatus}
            options={[
              { value: 'single', label: 'Single' },
              { value: 'marriedFilingJointly', label: 'Married filing jointly' },
            ]}
            onCommit={(v) =>
              update((d) => {
                d.household.filingStatus = v
                invalidateAcaEvidence(d)
              })
            }
          />
          {couple && plan.household.filingStatus === 'marriedFilingJointly' ? (
            <CheckboxField
              label="Qualifying dependent for survivor"
              help="Opt in when the surviving spouse would qualify for qualifying surviving spouse filing status. RetireGolden does not model dependents, so this uses joint brackets and deductions for the two years after the spouse's death."
              value={plan.household.hasQualifyingDependent}
              onCommit={(v) => update((d) => void (d.household.hasQualifyingDependent = v))}
            />
          ) : null}
          <SelectField
            label="State (starting residence)"
            help="Drives state income tax. Several states are modeled with real brackets and retirement-income rules; others fall back to the flat effective-rate override under Assumptions. Add a move below to change states mid-retirement."
            value={plan.household.state}
            options={US_STATES}
            onCommit={(v) =>
              update((d) => {
                d.household.state = v
                invalidateAcaEvidence(d)
              })
            }
          />
        </div>
        {plan.household.people.map((person, i) => (
          <div className="item-row" key={person.id} style={{ marginTop: '1rem' }}>
            <div className="item-row-head">
              <span className="item-row-title">
                {/* The stored name always shows. The role chip is dropped only
                    when the name is the placeholder, which already states the
                    role: "PARTNER Unnamed partner" would say it twice (#523). */}
                {person.name === fallbackPersonName(i) ? null : (
                  <span className="type-chip">{i === 0 ? 'Primary' : 'Partner'}</span>
                )}
                {person.name}
              </span>
              {i === 1 ? (
                <button
                  type="button"
                  className="btn-ghost btn-ghost-danger"
                  onClick={() => update((d) => removePartner(d, person.id))}
                >
                  Remove
                </button>
              ) : null}
            </div>
            <div className="form-grid">
              <TextField
                label="Name"
                hint={`Blank = shown as ${fallbackPersonName(i)}.`}
                value={person.name}
                onCommit={(v) => update((d) => void (d.household.people[i]!.name = v || fallbackPersonName(i)))}
              />
              <DateField
                label="Date of birth"
                value={person.dob}
                onCommit={(v) =>
                  update((d) => {
                    updatePersonDob(d, i, v)
                    invalidateAcaEvidence(d)
                  })
                }
              />
              <SelectField
                label="Sex"
                help="Only used as the baseline for the life-expectancy estimate (SSA period life tables differ by sex). Pick 'Average' to use a blended table."
                value={person.sex}
                options={[
                  { value: 'female', label: 'Female' },
                  { value: 'male', label: 'Male' },
                  { value: 'average', label: 'Average' },
                ]}
                onCommit={(v) => update((d) => void (d.household.people[i]!.sex = v))}
              />
              <NumberField
                label="Retirement age"
                help="Wages and payroll contributions stop in the year this age is reached. Leave blank if this person never has wages in the plan."
                value={person.retirementAge}
                allowNull
                min={30}
                max={80}
                onCommit={(v) => update((d) => void (d.household.people[i]!.retirementAge = v))}
              />
              <div className="field-with-action field-with-action--wide">
                <NumberField
                  label="Planning age"
                  help="How long the plan runs for this person. The age the money must last to, not a prediction of death. Planning beyond average life expectancy is prudent; 'Calculate' estimates an age from a short health questionnaire, and 'Percentile' anchors it to a survival probability (e.g. the age you have a 25% chance of reaching). Typing a number always overrides."
                  learn={LEARN.longevity}
                  value={person.longevity.planningAge}
                  min={60}
                  max={120}
                  onCommit={(v) =>
                    update((d) =>
                      updatePersonLongevity(d, i, {
                        planningAge: Math.round(v ?? 95),
                        source: 'manual',
                      }),
                    )
                  }
                />
                <div className="field-with-action-actions">
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setLongevityFor(i)}>
                    Calculate
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" onClick={() => setPercentileFor(i)}>
                    Percentile
                  </button>
                </div>
              </div>
              {person.longevity.source === 'percentile' && person.longevity.percentile ? (
                <p className="field-hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
                  Planning age {person.longevity.planningAge} = the age{' '}
                  {person.longevity.percentile.joint ? 'at least one of you' : person.name} had a{' '}
                  {person.longevity.percentile.pct}% chance of reaching when picked
                  {person.longevity.percentile.healthMultiplier !== undefined ||
                  person.longevity.percentile.partnerHealthMultiplier !== undefined
                    ? ', health-adjusted'
                    : ''}{' '}
                  (SSA 2022 table). Re-open Percentile to refresh it as ages change.
                </p>
              ) : null}
            </div>
          </div>
        ))}
        {longevityFor !== null && plan.household.people[longevityFor] ? (
          <LongevityModal
            person={plan.household.people[longevityFor]!}
            personIndex={longevityFor}
            onApply={(age) =>
              update((d) => {
                updatePersonLongevity(d, longevityFor, { planningAge: age, source: 'model' })
              })
            }
            onClose={() => setLongevityFor(null)}
          />
        ) : null}
        {percentileFor !== null && plan.household.people[percentileFor] ? (
          <SurvivalPercentileModal
            person={plan.household.people[percentileFor]!}
            personIndex={percentileFor}
            partner={plan.household.people[1 - percentileFor] ?? null}
            onApply={(longevity) =>
              update((d) => {
                updatePersonLongevity(d, percentileFor, longevity)
              })
            }
            onClose={() => setPercentileFor(null)}
          />
        ) : null}
        {!couple ? (
          <div className="add-row">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() =>
                update((d) => {
                  d.household.people.push({
                    id: newId(),
                    name: 'Partner',
                    dob: '1965-01-01',
                    sex: 'average',
                    retirementAge: 65,
                    longevity: { planningAge: 95, source: 'manual' },
                  })
                  d.household.filingStatus = 'marriedFilingJointly'
                  invalidateAcaEvidence(d)
                })
              }
            >
              + Add partner
            </button>
          </div>
        ) : null}

        <h3>Moving in retirement</h3>
        <p className="card-hint">
          Optional. Add a relocation and the projection splits the move year by month, then uses the new state's rules afterward.
        </p>
        {plan.household.stateMoves.map((move, i) => (
          <div className="item-row" key={i}>
            <div className="item-row-head">
              <span className="item-row-title">
                <span className="type-chip">Move</span>to {US_STATES.find((s) => s.value === move.state)?.label ?? move.state} in {MONTH_OPTIONS.find((m) => m.value === String(move.fromMonth))?.label ?? 'July'} {move.fromYear}
              </span>
              <button
                type="button"
                className="btn-ghost btn-ghost-danger"
                onClick={() =>
                  update((d) => {
                    d.household.stateMoves.splice(i, 1)
                    invalidateAcaEvidence(d)
                  })
                }
              >
                Remove
              </button>
            </div>
            <div className="form-grid">
              <NumberField
                label="Move year"
                help="The calendar year of residence in the new state. The projection allocates this year by move month."
                value={move.fromYear}
                min={1900}
                max={2200}
                onCommit={(v) =>
                  update((d) => {
                    d.household.stateMoves[i]!.fromYear = Math.round(v ?? move.fromYear)
                    invalidateAcaEvidence(d)
                  })
                }
              />
              <SelectField
                label="Move month"
                value={String(move.fromMonth)}
                options={MONTH_OPTIONS}
                onCommit={(v) =>
                  update((d) => {
                    d.household.stateMoves[i]!.fromMonth = Number(v)
                    invalidateAcaEvidence(d)
                  })
                }
              />
              <SelectField
                label="New state"
                value={move.state}
                options={US_STATES}
                onCommit={(v) =>
                  update((d) => {
                    d.household.stateMoves[i]!.state = v
                    invalidateAcaEvidence(d)
                  })
                }
              />
            </div>
          </div>
        ))}
        <div className="add-row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              update((d) => {
                const lastYear = d.household.stateMoves[d.household.stateMoves.length - 1]?.fromYear
                d.household.stateMoves.push({ fromYear: (lastYear ?? new Date().getFullYear()) + 1, fromMonth: 7, state: d.household.state })
                invalidateAcaEvidence(d)
              })
            }
          >
            + Add a move
          </button>
        </div>

        <Issues />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

