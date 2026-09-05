/**
 * Coverage attestations for `socialSecurity/`.
 *
 * One slice of the coverage attestation registry. `../coverageAttestations.ts`
 * composes every slice into `COVERAGE_ATTESTATIONS`; read it for what an
 * attestation means and how sweeps work. Entries were moved here verbatim from
 * the single file this registry used to be.
 */
import type { CoverageAttestation } from '../coverageAttestations.js'

export const socialSecurityAttestations: Readonly<Record<string, CoverageAttestation>> = Object.freeze({
  'socialSecurity/annualTiming.ts': Object.freeze({ status: 'rule-free', sweptOn: '2026-09-01', note: 'shared parser for the already-schema-validated ISO birth date used by annual Social Security projection and milestone consumers. It performs no age, entitlement, or benefit arithmetic; the rule-bearing payable-month boundary remains registered in projection/internal/annualSocialSecurity.ts' }),
  'socialSecurity/benefitFactor.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'socialSecurity/claimFactor.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-29', note: 'Worker 62y0m-70y0m claim window registered under usc-42-402-worker-claim-window-62-to-70; DRC and early-reduction composition registered under cfr-20-404-313 and cfr-20-404-410 which now name the factor; spousal and ARF records already named it' }),
  'socialSecurity/disability.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-27', note: null }),
  'socialSecurity/familyMaximum.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'socialSecurity/maritalBenefits.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-04', note: 'Living-divorced and ordinary-widow eligibility gates, plus half-PIA pricing, are named on this file. Residual: claimant-has-claimed timing (claimantAge vs claimAge) is an engine convention with no record; survivor amount assembly is delegated to already-registered survivorBenefit.ts/claimFactor.ts/nra.ts without a borrowed pin here' }),
  'socialSecurity/nra.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-26', note: null }),
  'socialSecurity/piaFromEarnings.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-04', note: 'Initial-computation base window, annual indexed-earnings penny rounding, and computation-year count/five-year dropout with 1951 floor registered as approximations on records/socialSecurityEarnings.ts. Residuals: future unpublished AWI/bend points use awiForYearOrLatest / bendPointsForEligibilityYearOrLatest (missing_awi is unused); disability young-worker dropout, disability-year eligibility/indexing, prior-entitlement termination gaps, childcare dropout, and alternative widow indexing remain unmodeled. Disability freeze and post-entitlement recomputation stay on the socialSecurity shard.' }),
  'socialSecurity/ssaWageData.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'socialSecurity/survivorBenefit.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
})
