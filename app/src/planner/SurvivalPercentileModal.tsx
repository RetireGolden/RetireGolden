/**
 * Survival-percentile planning-age picker (spending-paths & SWR-lenses plan,
 * Goal 4). Expresses the planning age as "the age I/we have a 25% (10%) chance
 * of reaching" — the standard longevity-risk framing the Actuaries Longevity
 * Illustrator popularized — computed from the same SSA 2022 table as the
 * stochastic-longevity engine (engine/montecarlo/survival.ts). The age is
 * computed once at pick time and written as an ordinary planning age with
 * provenance; it is never silently recomputed later (the anti-drift rule the
 * spending presets follow). A manual edit of the field remains the override.
 */

import { useMemo, useState } from 'react'

import type { Person } from '../engine/model/plan'
import {
  hazardForExpectancyMultiplier,
  jointSurvivalPercentileAge,
  survivalPercentileAge,
} from '../engine/montecarlo/survival'
import { loadLongevity, loadLongevityPartner } from '../longevity/storage'
import { CheckboxField, SelectField } from './fields'
import { Modal } from './Modal'
import { currentStartYear } from './useProjection'

export interface SurvivalPercentileModalProps {
  person: Person
  /** 0 = primary slot, 1 = partner slot (matches the questionnaire storage). */
  personIndex: number
  /** The other household member, when this is a couple plan. */
  partner: Person | null
  onApply: (longevity: Person['longevity']) => void
  onClose: () => void
}

/**
 * Plan-year age: current year − birth year, the same convention the ledger
 * (and ABW's survival25/survival10 horizon) uses — so a percentile picked here
 * and the engine's survival horizon quote the same SSA age, never off by one
 * from birth-month rounding.
 */
function planYearAge(dob: string): number {
  const age = currentStartYear() - Number(dob.slice(0, 4))
  return Math.min(110, Math.max(18, age))
}

const PCT_OPTIONS = [
  { value: '50', label: '50% — the median (half of people live longer)' },
  { value: '25', label: '25% — the standard prudent choice' },
  { value: '10', label: '10% — conservative' },
]

export function SurvivalPercentileModal({ person, personIndex, partner, onApply, onClose }: SurvivalPercentileModalProps) {
  const [pct, setPct] = useState<'50' | '25' | '10'>('25')
  const [joint, setJoint] = useState(partner !== null)
  const [useHealth, setUseHealth] = useState(false)

  // Saved questionnaire multipliers by household slot (this modal's person may
  // be either slot). Absent questionnaire = no adjustment offered for that slot.
  const savedSelf = useMemo(() => (personIndex === 0 ? loadLongevity() : loadLongevityPartner()), [personIndex])
  const savedPartner = useMemo(
    () => (partner ? (personIndex === 0 ? loadLongevityPartner() : loadLongevity()) : null),
    [partner, personIndex],
  )

  const computed = useMemo(() => {
    const pctNum = Number(pct)
    const selfAge = planYearAge(person.dob)
    const selfMultiplier = useHealth && savedSelf ? savedSelf.result.appliedMultiplier : null
    const selfHazard = selfMultiplier !== null ? hazardForExpectancyMultiplier(selfAge, person.sex, selfMultiplier) : 1
    if (joint && partner) {
      const partnerAge = planYearAge(partner.dob)
      const partnerMultiplier = useHealth && savedPartner ? savedPartner.result.appliedMultiplier : null
      const partnerHazard =
        partnerMultiplier !== null ? hazardForExpectancyMultiplier(partnerAge, partner.sex, partnerMultiplier) : 1
      return jointSurvivalPercentileAge(
        { age: selfAge, sex: person.sex, hazard: selfHazard },
        { age: partnerAge, sex: partner.sex, hazard: partnerHazard },
        pctNum,
      )
    }
    return survivalPercentileAge(selfAge, person.sex, pctNum, selfHazard)
  }, [pct, joint, useHealth, person, partner, savedSelf, savedPartner])

  const clampedAge = Math.min(120, Math.max(60, computed))
  const healthAvailable = savedSelf !== null || (joint && savedPartner !== null)

  const apply = () => {
    const isJoint = joint && partner !== null
    onApply({
      planningAge: clampedAge,
      source: 'percentile',
      percentile: {
        pct: Number(pct),
        joint: isJoint,
        // Record every multiplier the computation actually used, so the
        // provenance can restate the pick (partner-only adjustments included).
        ...(useHealth && savedSelf ? { healthMultiplier: savedSelf.result.appliedMultiplier } : {}),
        ...(useHealth && isJoint && savedPartner
          ? { partnerHealthMultiplier: savedPartner.result.appliedMultiplier }
          : {}),
      },
    })
    onClose()
  }

  return (
    <Modal title={`Planning age from a survival percentile — ${person.name}`} onClose={onClose} width="40rem">
      <p className="card-hint">
        Instead of guessing an age, plan to the age you have only a chosen chance of reaching. Probabilities come
        from the Social Security Administration 2022 period life table — the same table behind the questionnaire
        and the Monte Carlo longevity model. The result is written as an ordinary planning age you can still edit.
      </p>
      <div className="form-grid">
        <SelectField
          label="Chance of reaching that age"
          help="The survival probability the planning age is anchored to. Planning to the 25th percentile means only a 1-in-4 chance of outliving the plan horizon — the usual prudent recommendation. The median (50%) is a coin flip; 10% is conservative."
          value={pct}
          options={PCT_OPTIONS}
          onCommit={(v) => setPct(v as '50' | '25' | '10')}
        />
        {partner !== null ? (
          <CheckboxField
            label="Either of us (joint)"
            help="For couples: the age at which there is still the chosen chance that at least one of you is alive (independent lifetimes). Joint horizons are several years longer than either individual's — the usual reason couple plans should run longer. Applying writes the joint age as THIS person's planning age so the household horizon reaches it; your partner's own planning age is left unchanged (the plan always runs to the later of the two)."
            value={joint}
            onCommit={setJoint}
          />
        ) : null}
        {healthAvailable ? (
          <CheckboxField
            label="Adjust for questionnaire answers"
            help="Applies the saved life-expectancy questionnaire's smoking/health/lifestyle multiplier as a mortality adjustment (a proportional-hazards transform of the SSA table), the way the Actuaries Longevity Illustrator adjusts for smoker status and general health. Only available after running Calculate at least once."
            value={useHealth}
            onCommit={setUseHealth}
          />
        ) : null}
      </div>
      <div className="mc-hero" style={{ marginTop: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>
            Age {clampedAge}
          </h2>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            {joint && partner
              ? `There is a ${pct}% chance at least one of you is still alive at ${person.name}'s age ${clampedAge}.`
              : `${person.name} has a ${pct}% chance of reaching age ${clampedAge}.`}
            {computed !== clampedAge ? ' (Clamped to the supported 60–120 planning-age range.)' : ''}
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.9rem' }}>
        <button type="button" className="btn btn-primary btn-small" onClick={apply}>
          Use age {clampedAge} as the planning age
        </button>
        <button type="button" className="btn btn-secondary btn-small" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
