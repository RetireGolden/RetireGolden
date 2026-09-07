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
  'params/provenance.ts': Object.freeze({
    status: 'rule-free',
    sweptOn: '2026-09-07',
    note: 'Display-only aggregate parameter provenance metadata; the state-income-tax group summarizes the registered Delaware 2026 deduction and 5.55% band, Hawaii TY2026 deduction, Rhode Island TY2026 deduction and schedule, Utah TY2026 4.45% rate and unmodeled Social Security credit, plus the previously registered WV rates and MI ordinary retirement ceiling. Primary authority belongs to the state domain notes and law records, not this display layer. Not a statute registry and not an authority claim for other states.',
  }),
  'params/state/data/year2026.ts': Object.freeze({
    status: 'partial',
    sweptOn: '2026-09-07',
    note: 'de-code-30-1108-standard-deduction names the § 1108 basic and age-65 enforcers for single/MFJ; de-pit-est-2026-qss-standard-deduction-joint-mapper names the QSS standard-deduction approximation; de-code-30-1102-a-14-rate-schedule names the Delaware 5.55% bracket cell and bracketTax; hi-hrs-235-2-4-a-2-f-2026-standard-deduction names the Hawaii TY2026 single/MFJ deduction cell and taxable-income enforcer; ri-dot-adv-2025-22-2026-deduction-and-rate-schedule names the Rhode Island TY2026 single/MFJ deduction and bracket cells plus their taxable-income and bracket enforcers; ut-code-59-10-104-2026-individual-rate names the Utah TY2026 4.45% rate cell and bracketTax. Blindness, itemization, credits, and retirement qualifying-income scope remain partial or unmodelled. Existing law records name this pack, including WV rates and Social Security; residuals include KY aggregate MFJ deduction convention without spouse-allocation record, IA minimum-income/alternate and enhanced-senior conformity omissions, DC August emergency statutory-conformity timing unresolved, ME modeled Maine-AGI proxy / personal exemption / blindness / part-year month approximation, WV personal exemptions / senior any-income / disability / pension-subtype modifications, and MI source qualification / (9)/(10)/(11) elections / pre-1946 public exception / per-person agesAlive proxy versus return-level ceiling. Not complete law coverage.',
  }),
  'params/state/index.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-05', note: 'conformStateStandardDeduction named by whole-federal and Maine age-addition records; resolves independent age-addition adoption without scaling a state-published basic; unresolved selector contract: years before the earliest published pack receive that earliest pack with no supported-year guard or validity marker — a current-pack historical approximation, not enforcement of per-record effectiveFrom metadata' }),
  'params/state/types.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-05', note: 'types only; named by records for the shapes they define, including standardDeductionAge65AdditionConformity and standardDeductionPhaseout' }),
  'params/types.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: 'types only; named by records for the shapes they define' }),
})
