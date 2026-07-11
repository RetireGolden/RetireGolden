/**
 * Wire types between the Relocation Compare page and its worker. Same rules
 * as src/mc/messages.ts: everything must survive structured clone — the
 * comparison rows are plain data (numbers, strings, small arrays).
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type { MarketModelConfig } from '@retiregolden/engine/montecarlo/marketModels'
import type { RelocationCandidate, RelocationComparison } from '@retiregolden/engine/projection/relocation'

export interface RelocationCompareRequest {
  plan: Plan
  candidates: RelocationCandidate[]
  startYear: number
  /** When present, rows get a Monte Carlo success rate on shared market paths. */
  monteCarlo?: { model: MarketModelConfig; pathCount: number; seed: number } | null
}

export type RelocationCompareResponse =
  | { type: 'done'; result: RelocationComparison }
  | { type: 'error'; message: string }
