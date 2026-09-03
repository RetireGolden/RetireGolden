/**
 * Coverage attestations for `spending/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const spendingAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'spending/abw.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'spending/flexibleGoals.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'spending/guardrails.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'spending/layers.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'spending/shapePresets.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
