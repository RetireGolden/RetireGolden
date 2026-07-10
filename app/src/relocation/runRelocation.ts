/**
 * Executes one relocation-compare sweep. Shared by the Web Worker entry and
 * the synchronous fallback (tests / no-Worker environments). The engine
 * builds the app-standard per-candidate tax stacks itself (federal + modeled
 * state packs with the plan's flat rate as an override), so both paths run
 * identical numbers.
 */

import { compareRelocationCandidates, type RelocationComparison } from '../engine/projection/relocation'
import type { RelocationCompareRequest } from './messages'

export function runRelocationCompareRequest(req: RelocationCompareRequest): RelocationComparison {
  return compareRelocationCandidates(req.plan, req.candidates, {
    startYear: req.startYear,
    monteCarlo: req.monteCarlo ?? null,
  })
}
