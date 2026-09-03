/**
 * Coverage attestations for `montecarlo/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const montecarloAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'montecarlo/frontiers.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/historicalReturns.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/historicalSuites.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/ltcShock.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/marketModels.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/mortality.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-29', note: 'Derives q(x) from the period life table registered at longevity/ssaPeriod2022.ts (ssa-table-4c6-period-life-table-vintage); the e(x)-to-q(x) derivation itself is engine math with no separate statutory claim, and this consumer is deliberately not pinned' }),
  'montecarlo/riskBasedGuardrails.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/rng.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/run.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/sharedPaths.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/survival.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
