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
  'longevity/ssaPeriodLifeTable.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-27', note: 'Table provenance and edition registered under ssa-table-4c6-period-life-table-vintage, settled: the embedded columns are SSA\'s 2023 period table of the 2026 Trustees Report, the edition the page presents; cataloged as calculation record ssa-period-life-table' }),
  'longevity/types.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
})
