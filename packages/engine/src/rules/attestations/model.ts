/**
 * Coverage attestations for `model/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const modelAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'model/migrations.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-24', note: 'Lump-sum election load repairs; inherited qualified-annuity premium retarget/stand-down beyond annuity-start ceiling records' }),
  'model/plan.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-24', note: 'Inherited IRA regime parse rules; spouse J&S RMD gate; 403(b) aggregation; SEPP schema; Roth inherited rules; HSA/stateMove/retirement-action eligibility gates' }),
  'model/planCrossFieldChecks.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-03', note: 'The cross-field validator, moved verbatim out of the superRefine body in model/plan.ts and unchanged in rule, message, or order; it carries the same residual claims the model/plan.ts entry names for cross-field rules: inherited IRA regime parse rules; spouse J&S RMD gate; SEPP schema; Roth inherited rules; HSA/stateMove/retirement-action eligibility gates. The qualified-annuity start-age bounds it applies come from the latestNonQlacQualifiedAnnuityStartAge and latestQlacAnnuityStartAge helpers that stay in model/plan.ts' }),
  'model/retirementActionAnnualTaxFacts.ts': Object.freeze({ status: 'partial', sweptOn: '2026-08-24', note: 'April filing deadline w/ weekend & Emancipation Day adjustments; post-year IRA contribution window invariants; record names other files' }),
})
