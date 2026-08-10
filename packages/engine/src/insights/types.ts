import type { Plan } from '../model/plan.js'
import type { ProjectionResult } from '../projection/types.js'
import type { ProjectionSummary } from '../projection/compare.js'
import type { ParameterPack } from '../params/types.js'
import type { RetirementActionCandidateReadiness } from '../decisions/types.js'

export type InsightCategory =
  | 'tax-brackets'
  | 'accounts-contributions'
  | 'withdrawals-charitable'
  | 'sequence-risk'
  | 'social-security'
  | 'longevity-insurance-geography'

/** Finding-level severity. See GOVERNANCE.md for the ladder definitions. */
export type InsightSeverity = 'info' | 'attention' | 'urgent'

/** One exact triggering value behind a card — the user's own number that tripped the detector. */
export interface InsightEvidence {
  /** Short human label, e.g. 'MAGI in 2031' */
  label: string
  /** Formatted exact value, e.g. '$212,400' — must contain the actual number */
  value: string
  /** Plan year the value belongs to, when year-specific */
  year?: number
}

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
  /** Finding-level severity. */
  severity: InsightSeverity
  /** Exact triggering values; the tuple type enforces at least one entry. */
  evidence: [InsightEvidence, ...InsightEvidence[]]
  learnSlug?: string               // registry slug for LearnLink (validated)
  plannerRoute?: string            // deep link, e.g. 'strategy' or 'social-security-analysis'
  action: InsightAction
}

export type InsightAction =
  | { kind: 'advisory' }
  | {
      kind: 'preview-scenario'
      scenarioName: string
      patch: Record<string, unknown>
      /** Required when the preview changes retirement-account movement. */
      retirementActionReadiness?: RetirementActionCandidateReadiness
      /** Detector-authored provenance consumed by a narrow candidate adapter. */
      candidateMetadata?: Record<string, unknown>
    }
  | {
      kind: 'apply-toggle'
      patch: Record<string, unknown>
      /** Required when the toggle changes retirement-account movement. */
      retirementActionReadiness?: RetirementActionCandidateReadiness
      /** Detector-authored provenance consumed by a narrow candidate adapter. */
      candidateMetadata?: Record<string, unknown>
    }

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
  /** Integer >= 1; bump for material trigger, threshold, severity, or evidence changes. */
  version: number
  /** Shipped IDs remain reserved; deprecated detectors are excluded from the default registry. */
  deprecated?: { since: string; reason: string; replacedBy?: string }
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
