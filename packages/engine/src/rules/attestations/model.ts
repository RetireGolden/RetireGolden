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
  'model/plan.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-05', note: 'latestNonQlacQualifiedAnnuityStartAge and latestQlacAnnuityStartAge helpers covered; inherited/election contradiction checks are law-sensitive mirrored validation with missing-fact/year-granular limits; 403(b)/spouse/SEPP carriers are not calculators' }),
  'model/planCrossFieldChecks.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-05', note: 'qualified-annuity start-age ceilings covered; checkAccountCrossFieldRules still directly enforces uncovered Form 8606 basis placement/exclusion on inherited IRAs, qualified-annuity funding from owned traditional funds, QLAC qualification, and other cross-field gates' }),
  'model/retirementActionAnnualTaxFacts.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-05', note: 'IRC 219(f)(3) designated post-year contribution window now covered via persistedPlanOwnedNonRothIraAnnualFilingSourceRecordSchema; remaining persistence contracts are opening-basis, completeness, finalization, identity, and safe-cent totals' }),
})
