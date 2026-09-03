export type CoverageAttestationStatus = 'registered' | 'partial' | 'rule-free' | 'unswept'

export interface CoverageAttestation {
  readonly status: CoverageAttestationStatus
  /** ISO date of the sweep that assigned this status; null only while unswept. */
  readonly sweptOn: string | null
  /** For 'partial': the residual unregistered claims, one short clause each. */
  readonly note: string | null
}

/**
 * An attestation is a dated, re-falsifiable sweep claim with the same epistemic
 * standing as a registry record's verifiedOn: it records what a reviewer
 * checked, not a permanent conclusion.
 *
 * - registered — every claim found in the file is represented by a rule.
 * - partial — the file was swept, but note names residual unregistered claims.
 * - rule-free — the file was swept and contains no claims requiring a rule.
 * - unswept — the file has not received a coverage sweep (retained for re-sweeps;
 *   the 2026-08-24 baseline sweep closed the grandfather window).
 *
 * BASELINE_UNSWEPT is frozen empty: the baseline sweep is complete and no file
 * may hold status unswept.
 *
 * The attestations themselves live in the per-top-level-directory modules
 * under `./attestations/` (one shard per top-level `src/` directory, plus a
 * `topLevel` shard for files directly under `src/`), which this file spreads
 * into the single frozen `COVERAGE_ATTESTATIONS`. This mirrors how
 * `taxRuleRegistry.ts` composes `./records/*` into `TAX_RULE_REGISTRY` — see
 * that file's header for the rationale. Adding a source file means adding its
 * attestation entry to the shard for its top-level directory; a new top-level
 * directory means adding a new shard module and wiring it in below.
 * `coverageAttestations.conformance.test.ts` fails when a shard's keys stray
 * outside its directory prefix, when two shards overlap, when the shard counts
 * do not sum to the total, or when the attested set drifts from the engine
 * source-file set on disk.
 */
import { topLevelAttestations } from './attestations/topLevel.js'
import { actionsAttestations } from './attestations/actions.js'
import { allocationAttestations } from './attestations/allocation.js'
import { decisionsAttestations } from './attestations/decisions.js'
import { insightsAttestations } from './attestations/insights.js'
import { internalAttestations } from './attestations/internal.js'
import { ladderAttestations } from './attestations/ladder.js'
import { longevityAttestations } from './attestations/longevity.js'
import { modelAttestations } from './attestations/model.js'
import { montecarloAttestations } from './attestations/montecarlo.js'
import { paramsAttestations } from './attestations/params.js'
import { projectionAttestations } from './attestations/projection.js'
import { rmdAttestations } from './attestations/rmd.js'
import { rulesAttestations } from './attestations/rules.js'
import { scenariosAttestations } from './attestations/scenarios.js'
import { schemaAttestations } from './attestations/schema.js'
import { socialSecurityAttestations } from './attestations/socialSecurity.js'
import { spendingAttestations } from './attestations/spending.js'
import { strategiesAttestations } from './attestations/strategies.js'
import { taxAttestations } from './attestations/tax.js'
import { testingAttestations } from './attestations/testing.js'

export const COVERAGE_ATTESTATION_MODULES: readonly (readonly [
  string,
  Readonly<Record<string, CoverageAttestation>>,
])[] = Object.freeze([
  ['topLevel', topLevelAttestations],
  ['actions', actionsAttestations],
  ['allocation', allocationAttestations],
  ['decisions', decisionsAttestations],
  ['insights', insightsAttestations],
  ['internal', internalAttestations],
  ['ladder', ladderAttestations],
  ['longevity', longevityAttestations],
  ['model', modelAttestations],
  ['montecarlo', montecarloAttestations],
  ['params', paramsAttestations],
  ['projection', projectionAttestations],
  ['rmd', rmdAttestations],
  ['rules', rulesAttestations],
  ['scenarios', scenariosAttestations],
  ['schema', schemaAttestations],
  ['socialSecurity', socialSecurityAttestations],
  ['spending', spendingAttestations],
  ['strategies', strategiesAttestations],
  ['tax', taxAttestations],
  ['testing', testingAttestations],
])

const attestations = {
  ...topLevelAttestations,
  ...actionsAttestations,
  ...allocationAttestations,
  ...decisionsAttestations,
  ...insightsAttestations,
  ...internalAttestations,
  ...ladderAttestations,
  ...longevityAttestations,
  ...modelAttestations,
  ...montecarloAttestations,
  ...paramsAttestations,
  ...projectionAttestations,
  ...rmdAttestations,
  ...rulesAttestations,
  ...scenariosAttestations,
  ...schemaAttestations,
  ...socialSecurityAttestations,
  ...spendingAttestations,
  ...strategiesAttestations,
  ...taxAttestations,
  ...testingAttestations,
} satisfies Record<string, CoverageAttestation>

export const COVERAGE_ATTESTATIONS: Readonly<Record<string, CoverageAttestation>> = Object.freeze(attestations)

/** Grandfather window closed with the 2026-08-24 baseline sweep; must stay empty. */
export const BASELINE_UNSWEPT: readonly string[] = Object.freeze([])
