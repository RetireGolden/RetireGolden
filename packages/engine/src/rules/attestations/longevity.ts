/**
 * Coverage attestations for `longevity/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const longevityAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'longevity/ssaPeriod2022.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'Table provenance and vintage registered under ssa-table-4c6-period-life-table-vintage, approximated with the embedded 2022-period value pinned against the currently published 2023-period table' }),
  'longevity/types.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
