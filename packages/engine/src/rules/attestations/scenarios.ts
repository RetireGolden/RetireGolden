/**
 * Coverage attestations for `scenarios/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const scenariosAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'scenarios/actionRows.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/comparison.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/contract.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/patch.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/scenarios.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/taxOpportunityView.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/taxStrategyEvaluation.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/taxStrategyEvaluationRegistryCheck.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'scenarios/taxStrategyTradeoffs.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
