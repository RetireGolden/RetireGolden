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
  'montecarlo/deathProbability.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-27', note: 'Reads SSA\'s published q(x) from the period life table registered at longevity/ssaPeriodLifeTable.ts (ssa-table-4c6-period-life-table-vintage), cataloged as calculation record mortality-published-death-probability; the closed last row is an engine convention stated in that record, with no separate statutory claim, and this consumer is deliberately not pinned' }),
  'montecarlo/frontiers.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/headline.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-09-28', note: null }),
  'montecarlo/historicalReturns.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/historicalSuites.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/ltcShock.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/marketModels.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/mortality.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-27', note: 'Draws death ages and the joint expectancy off the survival curve, which reads the period life table registered at longevity/ssaPeriodLifeTable.ts (ssa-table-4c6-period-life-table-vintage) through montecarlo/deathProbability.ts; the \'average\' mixture is an engine convention stated in survival-probability-product, with no separate statutory claim, and this consumer is deliberately not pinned' }),
  'montecarlo/riskBasedGuardrails.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/rng.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/run.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/sharedPaths.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'montecarlo/survival.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
