/** Context + hook for the plan workspace (separate file keeps fast refresh happy). */

import { createContext, useContext } from 'react'

import type { Plan } from '@retiregolden/engine/model/plan'

import { parseIssues, type ParsedIssue } from './validationIssues'

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

/**
 * The plan's issues parsed once, so the sixty-odd wired fields on screen do
 * not each re-derive section, label, and advice for the whole list on every
 * render (r3-7). The provider fills this; `useParsedIssues` falls back to
 * parsing for the tests and embedded editors that render a field under a bare
 * `PlanCtx`.
 */
export interface ParsedIssues {
  /** In the engine's order, for the card lists. */
  all: readonly ParsedIssue[]
  /** By schema path, for a field asking about itself. */
  byPath: ReadonlyMap<string, ParsedIssue>
}

export const ParsedIssuesCtx = createContext<ParsedIssues | null>(null)

export function parsedIssuesOf(issues: readonly string[], plan: Plan): ParsedIssues {
  const all = parseIssues(issues, plan)
  return { all, byPath: new Map(all.map((issue) => [issue.path, issue] as const)) }
}

export const PlanCtx = createContext<PlanContextValue | null>(null)

export function usePlan(): PlanContextValue {
  const v = useContext(PlanCtx)
  if (!v) throw new Error('usePlan must be used inside <PlanProvider>')
  return v
}

/**
 * The parsed issues for the plan in context: the provider's memoised set where
 * there is one, else parsed on demand (a field rendered under a bare
 * `PlanCtx`, as the section tests do).
 */
export function useParsedIssues(): ParsedIssues | null {
  const parsed = useContext(ParsedIssuesCtx)
  const plan = useContext(PlanCtx)
  if (parsed) return parsed
  return plan ? parsedIssuesOf(plan.issues, plan.plan) : null
}
