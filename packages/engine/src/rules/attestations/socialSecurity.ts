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
  'socialSecurity/dualEntitlement.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-27', note: 'own benefit plus the separately reduced spouse excess, the first month of the spouse benefit, and the spouse factor at that month, for a current and a divorced spouse; named by usc-42-402-q-3-B-k-3-A-current-spouse-dual-entitlement and the dual-entitlement-composition calculation' }),
  'socialSecurity/disability.ts': Object.freeze({ status: 'registered', sweptOn: '2026-09-12', note: 'cash-benefit TWP/EPE/SGA helpers retained; Medicare continuation boundary assertSsdiMedicareContinuationNotDeterminedFromCashBenefitFacts (usc-42-426-b-disability-trial-work-medicare-continuation)' }),
  'socialSecurity/familyMaximum.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'socialSecurity/maritalBenefits.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-27', note: 'Living-divorced, ordinary-widow, surviving-divorced duration, and surviving-divorced remarriage eligibility gates, plus half-PIA and survivor pricing, are named on this file; the divorced-spouse amount delegates to the registered dualEntitlement.ts composition. Residual: claimant-has-claimed timing (claimantAge vs claimAge) is an engine convention with no record; survivor amount assembly is delegated to already-registered survivorBenefit.ts/claimFactor.ts/nra.ts without a borrowed pin here' }),
  'socialSecurity/nra.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-26', note: null }),
  'socialSecurity/piaFromEarnings.ts': Object.freeze({ status: 'partial', sweptOn: '2026-09-27', note: 'Initial-computation base window and annual indexed-earnings penny rounding registered as approximations on records/socialSecurityEarnings.ts; the computation-year count with the 1951 floor, the contribution and benefit base cap and the cost-of-living increases since eligibility are settled there. Residuals: future unpublished AWI/bend points use awiForYearOrLatest / bendPointsForEligibilityYearOrLatest; disability young-worker dropout, disability-year eligibility/indexing, prior-entitlement termination gaps, childcare dropout, and alternative widow indexing remain unmodeled. Disability freeze and post-entitlement recomputation stay on the socialSecurity shard.' }),
  'socialSecurity/ssaWageData.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
  'socialSecurity/survivorBenefit.ts': Object.freeze({ status: 'registered', sweptOn: '2026-08-24', note: null }),
})
