/** Context + hook for the plan workspace (separate file keeps fast refresh happy). */

import { createContext, useContext } from 'react'

import type { Plan } from '../engine/model/plan'

export type SaveState = 'loading' | 'saved' | 'saving' | 'dirty' | 'invalid' | 'error'

export interface PlanContextValue {
  plan: Plan
  /** Mutate a draft clone of the plan; the result is validated and autosaved. */
  update: (mutator: (draft: Plan) => void) => void
  /** Cancel pending autosave so an unmount flush cannot resurrect a deleted demo. */
  discardPendingSave: () => void
  saveState: SaveState
  /** Zod issues for the current (possibly unsaved) state; empty when valid. */
  issues: string[]
}

export const PlanCtx = createContext<PlanContextValue | null>(null)

export function usePlan(): PlanContextValue {
  const v = useContext(PlanCtx)
  if (!v) throw new Error('usePlan must be used inside <PlanProvider>')
  return v
}
