import type { Plan } from '../model/plan.js'
import type { ProjectionResult } from '../projection/types.js'
import type { ProjectionSummary } from '../projection/compare.js'
import type { ParameterPack } from '../params/types.js'

export type InsightCategory =
  | 'tax-brackets'
  | 'accounts-contributions'
  | 'withdrawals-charitable'
  | 'sequence-risk'
  | 'social-security'
  | 'longevity-insurance-geography'

export type InsightActionKind =
  | 'advisory'            // explain + deep-link only (no engine model yet)
  | 'preview-scenario'    // produces a scenario patch → compareScenarios
  | 'apply-toggle'        // trivially-reversible in-plan change

export interface InsightImpact {
  /** Rough (screen) or exact (evaluate) change in ending after-tax estate, today's $. */
  endingAfterTaxEstateDelta?: number
  /** Change in lifetime taxes & penalties, today's $ (negative = savings). */
  lifetimeTaxDelta?: number
  /** Change in Monte Carlo success rate, percentage points. */
  successRateDeltaPct?: number
  /** Free-form for advisory levers that can't produce a clean delta yet. */
  qualitative?: string
}

export interface InsightCard {
  id: string                       // stable detector id, e.g. 'irmaa-tier-edge'
  category: InsightCategory
  title: string                    // one-line headline
  rationale: string                // plain-English "why", references the user's own numbers
  impact: InsightImpact            // rough at screen time; exact after evaluate()
  exact: boolean                   // false = "≈" rough; true = ledger-verified
  confidence: 'high' | 'medium' | 'low'
  learnSlug?: string               // registry slug for LearnLink (validated)
  plannerRoute?: string            // deep link, e.g. 'strategy' or 'social-security-analysis'
  action: InsightAction
}

export type InsightAction =
  | { kind: 'advisory' }
  | { kind: 'preview-scenario'; scenarioName: string; patch: Record<string, unknown> }
  | { kind: 'apply-toggle'; patch: Record<string, unknown> }

export interface DetectorProjection {
  result: ProjectionResult
  summary: ProjectionSummary
  startYear: number
  deflate: (year: number, amount: number) => number
}

export interface DetectorContext {
  plan: Plan
  projection: DetectorProjection  // engine-native shape built from the memoized useProjection result
  params: ParameterPack           // active parameter pack (brackets, IRMAA tiers, FPL, limits)
}

export interface Detector {
  id: string
  category: InsightCategory
  /**
   * Cheap, synchronous, pure. Reads the baseline projection only — NO new
   * simulate() calls. Returns null when the lever doesn't apply to this plan,
   * or a card with a ROUGH impact estimate (exact:false). Must be fast enough
   * to run all detectors on every committed edit.
   */
  screen(ctx: DetectorContext): InsightCard | null
  /**
   * On-demand exact evaluation (only when a card is expanded or previewed).
   * For preview-scenario detectors this builds the patch and the caller runs
   * compareScenarios; this returns the patch + scenario name. Advisory
   * detectors may omit evaluate() entirely.
   */
  evaluate?(ctx: DetectorContext): { action: InsightAction; impact?: InsightImpact }
}
