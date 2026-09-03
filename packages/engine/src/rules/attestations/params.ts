/**
 * Coverage attestations for `params/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const paramsAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'params/data/realYieldCurve2026.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: 'Treasury market-data snapshot; provenance in params/provenance.ts, not statute' }),
  'params/data/year2026.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'params/index.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'The Trustees default haircut (2034, 17 percent) is registered under ssa-2026-trustees-oasdi-depletion-default-haircut, which pins the constant; the C-CPI-U-versus-plan-inflation indexing liberty is stated in the annually-indexed records naming indexFederalTaxPack' }),
  'params/indexingScale.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-03', note: 'the statutory-indexing projection rule shared by the ledger, the optimizer LP and the widow-penalty detector: at or below the newest published pack the scale is exactly 1, above it the caller supplied cumulative inflation factor from the pack year. Registered under the IRC 1(j)(3)(B) family of annual-adjustment records already named at params/index.ts#indexFederalTaxPack, which names an implementer of the rule downstream but does not call indexingScaleFor itself; the direct callers of the factor this returns are simulate.ts (limitScale, which also covers contribution and QLAC-cap limits outside 1(j)(3)(B)), optimizePlan.ts and insights/detectors/widowsPenalty.ts. The inflation index is the plan assumed rate rather than the C-CPI-U of 1(f)(3), and statutory rounding is not reproduced, exactly as before the rule was shared. No projection number moves' }),
  'params/provenance.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-08-24', note: null }),
  'params/state/data/year2026.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'params/state/index.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'params/state/types.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: 'types only; named by records for the shapes they define' }),
  'params/types.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: 'types only; named by records for the shapes they define' }),
})
