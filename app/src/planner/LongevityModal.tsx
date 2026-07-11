/**
 * Life-expectancy questionnaire in a modal, seeded from the person's profile.
 * On completion the wizard's planning age is applied straight to the plan —
 * the standalone /longevity page is no longer part of the main navigation.
 */

import { useCallback } from 'react'

import { LongevityWizard } from '../longevity/LongevityWizard'
import { loadLongevity, loadLongevityPartner } from '../longevity/storage'
import type { Person } from '@retiregolden/engine/model/plan'
import { Modal } from './Modal'

export interface LongevityModalProps {
  person: Person
  /** 0 = primary slot, 1 = partner slot (matches the questionnaire's storage). */
  personIndex: number
  onApply: (planningAge: number) => void
  onClose: () => void
}

function ageToday(dob: string): number {
  const y = Number(dob.slice(0, 4))
  const m = Number(dob.slice(5, 7))
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m) age -= 1
  return Math.min(110, Math.max(18, age))
}

export function LongevityModal({ person, personIndex, onApply, onClose }: LongevityModalProps) {
  const target = personIndex === 0 ? 'primary' : 'partner'

  const handleComplete = useCallback(() => {
    const saved = personIndex === 0 ? loadLongevity() : loadLongevityPartner()
    if (saved) {
      onApply(Math.min(120, Math.max(60, Math.round(saved.result.illustrativePlanningAge))))
    }
    onClose()
  }, [personIndex, onApply, onClose])

  return (
    <Modal title={`Estimate planning age — ${person.name}`} onClose={onClose} width="40rem">
      <p className="card-hint">
        A short questionnaire combining a Social Security period life table with conservative lifestyle adjustments.
        The result becomes {person.name}'s planning age; you can still override it afterwards.
      </p>
      <LongevityWizard
        initialAnswers={{ age: ageToday(person.dob), sex: person.sex }}
        storageTarget={target}
        onComplete={handleComplete}
      />
    </Modal>
  )
}
