/**
 * Coverage attestations for top-level engine source files.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const topLevelAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'index.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'version.generated.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: 'generated file' }),
  'version.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
