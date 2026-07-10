import { useMemo, useState } from 'react'
import type {
  Activity,
  Alcohol,
  BmiCategory,
  Diabetes,
  LongevityAnswers,
  ParentalLongevity,
  SelfRatedHealth,
  Sex,
  Smoking,
} from './types'
import { computeLongevity } from './model'
import { saveLongevity, saveLongevityPartner } from './storage'

const defaultAnswers = (): LongevityAnswers => ({
  age: 55,
  sex: 'average',
  bmiCategory: 'normal',
  smoking: 'never',
  alcohol: 'moderate',
  activity: 'moderate',
  diabetes: 'no',
  selfRatedHealth: 'good',
  parentalLongevity: 'unknown',
})

type Step =
  | 'age'
  | 'sex'
  | 'bmi'
  | 'smoking'
  | 'alcohol'
  | 'activity'
  | 'diabetes'
  | 'health'
  | 'parents'

const STEPS: Step[] = [
  'age',
  'sex',
  'bmi',
  'smoking',
  'alcohol',
  'activity',
  'diabetes',
  'health',
  'parents',
]

function mergeInitial(initial?: Partial<LongevityAnswers>): LongevityAnswers {
  return { ...defaultAnswers(), ...initial }
}

export interface LongevityWizardProps {
  initialAnswers?: Partial<LongevityAnswers>
  onComplete: () => void
  /** Which localStorage slot to write on completion (default primary). */
  storageTarget?: 'primary' | 'partner'
}

export function LongevityWizard({
  initialAnswers,
  onComplete,
  storageTarget = 'primary',
}: LongevityWizardProps) {
  const [answers, setAnswers] = useState<LongevityAnswers>(() => mergeInitial(initialAnswers))
  const [stepIndex, setStepIndex] = useState(0)
  const step = STEPS[stepIndex]!

  const canNext = useMemo(() => {
    if (step === 'age') {
      return Number.isFinite(answers.age) && answers.age >= 18 && answers.age <= 110
    }
    return true
  }, [step, answers.age])

  function patch<K extends keyof LongevityAnswers>(key: K, value: LongevityAnswers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }))
  }

  function goNext() {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1)
    else {
      const result = computeLongevity(answers)
      const payload = {
        version: 1 as const,
        answers,
        result,
        updatedAt: new Date().toISOString(),
      }
      if (storageTarget === 'partner') {
        saveLongevityPartner(payload)
      } else {
        saveLongevity(payload)
      }
      onComplete()
    }
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1)
  }

  return (
    <div className="wizard">
      <p className="wizard-progress">
        Step {stepIndex + 1} of {STEPS.length}
      </p>

      {step === 'age' && (
        <fieldset className="wizard-fieldset">
          <legend>Your current age</legend>
          <label className="field">
            <span>Age (whole years)</span>
            <input
              type="number"
              min={18}
              max={110}
              value={answers.age}
              onChange={(e) => patch('age', Number.parseInt(e.target.value, 10) || 0)}
            />
          </label>
          <p className="field-hint">Use 18–110. We use this to read the SSA period life table row.</p>
        </fieldset>
      )}

      {step === 'sex' && (
        <fieldset className="wizard-fieldset">
          <legend>Life table column</legend>
          <p className="field-hint">
            SSA publishes separate male and female period expectancies. Pick the row to use, or
            average both.
          </p>
          <RadioRow
            name="sex"
            value={answers.sex}
            onChange={(v) => patch('sex', v as Sex)}
            options={[
              { value: 'male', label: 'Male table' },
              { value: 'female', label: 'Female table' },
              { value: 'average', label: 'Average of male and female' },
            ]}
          />
        </fieldset>
      )}

      {step === 'bmi' && (
        <fieldset className="wizard-fieldset">
          <legend>BMI category</legend>
          <p className="field-hint">Pick the closest category; this is a coarse adjustment only.</p>
          <RadioRow
            name="bmi"
            value={answers.bmiCategory}
            onChange={(v) => patch('bmiCategory', v as BmiCategory)}
            options={[
              { value: 'underweight', label: 'Underweight' },
              { value: 'normal', label: 'Normal' },
              { value: 'overweight', label: 'Overweight' },
              { value: 'obese_i', label: 'Obese (class I)' },
              { value: 'obese_ii_plus', label: 'Obese (class II or higher)' },
            ]}
          />
        </fieldset>
      )}

      {step === 'smoking' && (
        <fieldset className="wizard-fieldset">
          <legend>Smoking</legend>
          <RadioRow
            name="smoking"
            value={answers.smoking}
            onChange={(v) => patch('smoking', v as Smoking)}
            options={[
              { value: 'never', label: 'Never smoked' },
              { value: 'former_15y', label: 'Former, quit 15+ years ago' },
              { value: 'former_lt15y', label: 'Former, quit less than 15 years ago' },
              { value: 'current_light', label: 'Current, light / occasional' },
              { value: 'current_moderate', label: 'Current, about a pack per day' },
              { value: 'current_heavy', label: 'Current, more than a pack per day' },
            ]}
          />
        </fieldset>
      )}

      {step === 'alcohol' && (
        <fieldset className="wizard-fieldset">
          <legend>Alcohol</legend>
          <RadioRow
            name="alcohol"
            value={answers.alcohol}
            onChange={(v) => patch('alcohol', v as Alcohol)}
            options={[
              { value: 'never', label: 'None / rarely' },
              { value: 'light', label: 'Light (e.g. 1–4 drinks per week)' },
              { value: 'moderate', label: 'Moderate' },
              { value: 'heavy', label: 'Heavy' },
            ]}
          />
        </fieldset>
      )}

      {step === 'activity' && (
        <fieldset className="wizard-fieldset">
          <legend>Physical activity</legend>
          <RadioRow
            name="activity"
            value={answers.activity}
            onChange={(v) => patch('activity', v as Activity)}
            options={[
              { value: 'high', label: 'High (most days, 30+ minutes)' },
              { value: 'moderate', label: 'Moderate (weekly exercise)' },
              { value: 'low', label: 'Low (occasional)' },
              { value: 'sedentary', label: 'Mostly sedentary' },
            ]}
          />
        </fieldset>
      )}

      {step === 'diabetes' && (
        <fieldset className="wizard-fieldset">
          <legend>Diabetes</legend>
          <RadioRow
            name="diabetes"
            value={answers.diabetes}
            onChange={(v) => patch('diabetes', v as Diabetes)}
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes_controlled', label: 'Yes — generally controlled' },
              { value: 'yes_uncontrolled', label: 'Yes — often not well controlled' },
            ]}
          />
        </fieldset>
      )}

      {step === 'health' && (
        <fieldset className="wizard-fieldset">
          <legend>Overall health (self-rated)</legend>
          <RadioRow
            name="health"
            value={answers.selfRatedHealth}
            onChange={(v) => patch('selfRatedHealth', v as SelfRatedHealth)}
            options={[
              { value: 'excellent', label: 'Excellent' },
              { value: 'good', label: 'Good' },
              { value: 'fair', label: 'Fair' },
              { value: 'poor', label: 'Poor' },
              { value: 'very_poor', label: 'Very poor' },
            ]}
          />
        </fieldset>
      )}

      {step === 'parents' && (
        <fieldset className="wizard-fieldset">
          <legend>Parents lived to age 80 or older?</legend>
          <p className="field-hint">Rough family-longevity signal; skip if unsure.</p>
          <RadioRow
            name="parents"
            value={answers.parentalLongevity}
            onChange={(v) => patch('parentalLongevity', v as ParentalLongevity)}
            options={[
              { value: 'both_80', label: 'Both did' },
              { value: 'one_80', label: 'One did' },
              { value: 'neither_80', label: 'Neither / not to 80' },
              { value: 'unknown', label: 'Unknown / not applicable' },
            ]}
          />
        </fieldset>
      )}

      <div className="wizard-actions">
        <button type="button" className="btn btn-secondary" onClick={goBack} disabled={stepIndex === 0}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={goNext} disabled={!canNext}>
          {stepIndex === STEPS.length - 1 ? 'See results' : 'Next'}
        </button>
      </div>
    </div>
  )
}

function RadioRow<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string
  value: T
  onChange: (v: string) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="radio-stack" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <label key={o.value} className="radio-option">
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  )
}
