import { useCallback, useState } from 'react'

import { readLocal, STORAGE_KEYS, writeLocal } from '../../data/localStore'
import type { PlanSummary } from '../../data/planStore'

export const WELCOME_DISMISSED_KEY = STORAGE_KEYS.homeWelcomeDismissed

export type HomeMode = 'first-run' | 'returning'

function readWelcomeDismissed(): boolean {
  if (typeof window === 'undefined') return true
  return readLocal(WELCOME_DISMISSED_KEY) !== 'false'
}

function writeWelcomeDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return
  writeLocal(WELCOME_DISMISSED_KEY, dismissed ? 'true' : 'false')
}

export function deriveHomeMode(plans: PlanSummary[] | null): HomeMode {
  if (plans !== null && plans.length === 0) return 'first-run'
  return 'returning'
}

export function isWelcomeExpanded(mode: HomeMode, welcomeDismissed: boolean): boolean {
  if (mode === 'first-run') return true
  return !welcomeDismissed
}

export function useHomeMode(plans: PlanSummary[] | null) {
  const [welcomeDismissed, setWelcomeDismissed] = useState(readWelcomeDismissed)

  const mode = deriveHomeMode(plans)
  const welcomeExpanded = isWelcomeExpanded(mode, welcomeDismissed)

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true)
    writeWelcomeDismissed(true)
  }, [])

  const showWelcome = useCallback(() => {
    setWelcomeDismissed(false)
    writeWelcomeDismissed(false)
  }, [])

  return { mode, welcomeExpanded, dismissWelcome, showWelcome }
}
