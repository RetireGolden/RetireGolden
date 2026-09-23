/**
 * The kind of every `approximated` tax rule: why the engine computes a figure
 * the authority does not require, sorted into one of three kinds.
 *
 * - `fix`: the engine can compute the authority's figure from facts the plan
 *   already collects, so the approximation is a defect with a known home.
 *   `implementation` is the `<path>#<symbol>` where the fix goes, resolved to
 *   its declaration line when the ledger is published. This count should trend
 *   to zero.
 * - `needs-fact`: the authority's figure turns on a fact the plan does not
 *   collect. `missingInput` names that fact in plain words.
 * - `convention`: a deliberate planning convention, kept on purpose.
 *   `reason` says why, in plain words.
 *
 * Source: the B1-P2 approximations triage of the bidirectional validation plan
 * (`approximations-triage.json`), pinned at engine commit fb398216, with its
 * ids re-verified against the registry's `approximated` rules at 3a23de9c.
 * The entries transcribe its `fix.implementationPath`,
 * `needsFact.missingInput` and `convention.reason`, with six departures:
 * - two convention reasons named the "exact ledger", an internal term; they now
 *   say "the full year-by-year projection" (and the first spells out "the LP"
 *   as the optimizer's linear program):
 *   irc-86-a-optimizer-taxable-social-security-linearization and
 *   irc-1-h-optimizer-flat-fifteen-percent-preferential-rate.
 * - four fix pins named the file's basename as the symbol, which the file does
 *   not declare; each now names the rule's own registry pin in that same file:
 *   treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd,
 *   irc-1014-a-1-basis-at-death-fair-market-value,
 *   usc-42-416-l-survivor-fra-age-60-attainment-cohorts and
 *   de-pit-est-2026-qss-standard-deduction-joint-mapper.
 *
 * This text is published. `scripts/rules-coverage.mjs` writes each entry onto
 * its rule in the ledger (`DOCS/operations/rule-coverage/`), and the public
 * methodology site renders it in its known-limits table, so every string must
 * read as plain words to a member of the public: no em dashes and none of the
 * internal test vocabulary `approximationKinds.conformance.test.ts` bans.
 *
 * A rule reclassified out of `approximated`, newly classified into it, or
 * fixed must update its entry here in the same change. The type below makes a
 * missing or stale key a compile error, and the conformance suite checks the
 * keys, the shapes, the fix pins, the counts by kind and the public text.
 */
import type { TAX_RULE_REGISTRY, TaxRuleId } from './taxRuleRegistry.js'

export type ApproximationKind = 'fix' | 'needs-fact' | 'convention'

export type ApproximationEntry =
  | { readonly kind: 'fix'; readonly implementation: string }
  | { readonly kind: 'needs-fact'; readonly missingInput: string }
  | { readonly kind: 'convention'; readonly reason: string }

/** The registry ids classified `approximated`: exactly the keys this module must carry. */
export type ApproximatedTaxRuleId = {
  [Id in TaxRuleId]: (typeof TAX_RULE_REGISTRY)[Id]['classification'] extends 'approximated' ? Id : never
}[TaxRuleId]

export const APPROXIMATION_KINDS: Readonly<Record<ApproximatedTaxRuleId, ApproximationEntry>> = Object.freeze({
  'aca-26-51-815-b-3-ten-million-dollar-gain-exemption': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'al-form40-defined-benefit-414j-exemption': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'al-form40-personal-and-dependent-exemptions-not-modeled': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'al-form40-standard-deduction-agi-slide': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ars-43-1022-2-government-pension-exclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ars-43-1022-22-long-term-capital-gain-subtraction': { kind: 'needs-fact', missingInput: 'acquisition date and long-term character for each Arizona gain lot' },
  'ars-43-1023-e-age-65-exemption': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'cfr-20-404-1592-trial-work-period': { kind: 'convention', reason: 'future monthly service cannot be recovered from annual earnings without fabricated history' },
  'cfr-20-404-1592a-extended-period-of-eligibility': { kind: 'convention', reason: 'future month-by-month SGA is unknowable from annual wages' },
  'cfr-20-404-211-d-3-indexed-earnings-nearer-penny': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings' },
  'cfr-20-404-331-living-divorced-spouse-eligibility': { kind: 'needs-fact', missingInput: 'worker entitlement and fully-insured status plus exact divorce date' },
  'cfr-20-404-335-ordinary-widow-eligibility': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/maritalBenefits.ts#maritalBenefitFor' },
  'cfr-20-404-336-e-surviving-divorced-remarriage': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/maritalBenefits.ts#maritalBenefitFor' },
  'cfr-20-404-435-grace-year-monthly-earnings-test': { kind: 'convention', reason: 'annual plans cannot credibly place future earnings in service versus non-service months' },
  'ct-cgs-12-701-20-b-social-security-retirement': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'de-code-30-1106-social-security-retirement-subtractions': { kind: 'fix', implementation: 'packages/engine/src/tax/stateNortheastExtras.ts#delawareUnder60PensionDeduction' },
  'de-pit-est-2026-qss-standard-deduction-joint-mapper': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/types/tax.ts#taxParameterFilingStatus' },
  'ga-code-48-7-27-retirement-and-social-security-exclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'hi-hrs-235-7-pension-and-social-security': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ic-6-3-1-3-5-exemptions-not-a-standard-deduction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ic-6-3-2-3-7-civil-service-annuity-age-62': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ic-6-3-2-4-military-retirement-deduction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ic-6-3-6-2-2-county-income-tax-shares-the-state-base': { kind: 'needs-fact', missingInput: 'Indiana county of residence or applicable county rate' },
  'irc-1-h-1-E-unrecaptured-section-1250-gain': { kind: 'fix', implementation: 'packages/engine/src/tax/propertySale.ts#propertySaleTax' },
  'irc-1-h-optimizer-flat-fifteen-percent-preferential-rate': { kind: 'convention', reason: 'a constant rate keeps the optimizer linear and the full year-by-year projection re-prices its choice' },
  'irc-1014-a-1-basis-at-death-fair-market-value': { kind: 'fix', implementation: 'packages/engine/src/projection/compare.ts#summarizeProjection' },
  'irc-1091-a-wash-sale-thirty-day-window': { kind: 'convention', reason: 'future security lots and replacement purchases cannot be forecast credibly in an aggregate-account plan' },
  'irc-121-a-b-principal-residence-eligibility-tests': { kind: 'needs-fact', missingInput: 'ownership/use history, prior exclusion date, and disqualifying expatriation facts' },
  'irc-1212-b-2-zero-income-section-1211-allowance-preserves-carryforward': { kind: 'fix', implementation: 'packages/engine/src/tax/federalTax.ts#computeFederalTax' },
  'irc-1411-d-modified-agi-foreign-exclusion-addback': { kind: 'fix', implementation: 'packages/engine/src/tax/federalTax.ts#computeFederalTax' },
  'irc-163-h-3-E-i-pmi-qualified-residence-interest-restart': { kind: 'needs-fact', missingInput: 'annual qualified mortgage-insurance premiums' },
  'irc-163-h-3-F-acquisition-indebtedness-limit': { kind: 'needs-fact', missingInput: 'acquisition-debt balance, origination date, and qualified-residence use per mortgage' },
  'irc-164-b-7-B-magi-phasedown': { kind: 'fix', implementation: 'packages/engine/src/tax/federalTax.ts#computeFederalTax' },
  'irc-165-c-personal-use-sale-loss-nondeductible': { kind: 'needs-fact', missingInput: 'profit-motive versus personal-use status of the sold property' },
  'irc-170-b-1-G-projection-cash-ceiling-not-applied': { kind: 'needs-fact', missingInput: 'opening charitable carryforward by contribution class and expiration year' },
  'irc-170-p-projection-nonitemizer-deduction-not-allowed': { kind: 'fix', implementation: 'packages/engine/src/tax/federalTax.ts#computeFederalTax' },
  'irc-213-a-medical-expense-deduction': { kind: 'needs-fact', missingInput: 'annual unreimbursed qualifying medical expenses by tax category' },
  'irc-219-g-traditional-ira-deduction-phaseout': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch' },
  'irc-223-b-2-7-projection-coverage-proration-and-medicare': { kind: 'needs-fact', missingInput: 'monthly HSA eligibility, HDHP tier, and Medicare-entitlement month per owner' },
  'irc-223-f-4-C-hsa-age-65-annual-proxy': { kind: 'convention', reason: 'annual HSA withdrawals have no date, so the day-after-65 boundary cannot be located honestly' },
  'irc-223-f-8-B-estate-predeath-expense-reduction': { kind: 'needs-fact', missingInput: 'death-date HSA value, legal beneficiary class, and qualifying expenses timely paid' },
  'irc-401-a-17-plan-compensation-cap': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch' },
  'irc-401-a-9-C-i-II-still-working-exception': { kind: 'needs-fact', missingInput: 'still-employed-by-sponsor and five-percent-owner status per employer plan and year' },
  'irc-401-a-9-C-i-elected-deferral-ignores-attainment-year-distributions': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualOwnerRmdPlan.ts#annualOwnerRmdPlan' },
  'irc-401-a-9-E-ii-eligible-designated-beneficiary': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions' },
  'irc-401-c-2-earned-income-not-modeled': { kind: 'needs-fact', missingInput: 'annual net self-employment earnings eligible as section 219 compensation' },
  'irc-402-c-1-pension-lump-sum-direct-rollover-eligibility': { kind: 'needs-fact', missingInput: 'qualified-trust, eligible-rollover-distribution, and plan-permission facts for the pension offer' },
  'irc-402-c-4-B-rmd-not-eligible-rollover-distribution': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/pensionLumpSumRollovers.ts#pensionLumpSumRollovers' },
  'irc-408-d-2-C-annuity-contract-close-of-year-value': { kind: 'convention', reason: 'future insurer FMV or actuarial reserve cannot be inferred without inventing contract economics' },
  'irc-408-d-2-C-projection-pro-rata-measurement-instant': { kind: 'fix', implementation: 'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts#replayOwnedNonRothIraContiguousYears' },
  'irc-408-d-2-estate-household-basis-allocation': { kind: 'fix', implementation: 'packages/engine/src/projection/estateTraditionalBasis.ts#estateTraditionalTaxableBase' },
  'irc-408-d-8-B-ii-projection-annual-age-proxy': { kind: 'convention', reason: 'the annual legacy gift has no execution date and an invented future date would be false precision' },
  'irc-408A-c-3-roth-contribution-agi-phase-out': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch' },
  'irc-408A-d-2-roth-qualified-distribution': { kind: 'needs-fact', missingInput: 'first taxable year of any Roth IRA contribution for each person' },
  'irc-408A-d-4-B-converted-layer-taxable-portion-first': { kind: 'fix', implementation: 'packages/engine/src/strategies/rothBasis.ts#splitRothWithdrawal' },
  'irc-408A-d-4-B-same-year-conversion-aggregation': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualForcedDistributionQcdAndRetirementActionsPhase.ts#annualForcedDistributionQcdAndRetirementActionsPhase' },
  'irc-414-v-1-plan-permitted-catch-up': { kind: 'needs-fact', missingInput: 'whether each sponsoring plan permits catch-up contributions' },
  'irc-414-v-7-A-prior-year-fica-wage-proxy': { kind: 'convention', reason: 'exact future Box 3 wages by sponsor are unknowable over decades; the entered proxy fails closed' },
  'irc-4973-a-b-f-ira-and-roth-excess-contribution-excise': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch' },
  'irc-4973-a-g-hsa-excess-contribution-excise': { kind: 'needs-fact', missingInput: 'year-end uncorrected HSA excess after monthly eligibility and corrections' },
  'irc-57-a-5-private-activity-bond-interest-amt-preference': { kind: 'convention', reason: 'future holdings lack issue-level identity and carve-out facts; guessing decades-out PAB mix would falsely exactify an AMT screen' },
  'irc-72-e-8-D-pre-1987-employee-contributions': { kind: 'convention', reason: 'administrator-only 1986 records are not reasonably recoverable for long-range household planning' },
  'irc-72-t-2-A-i-age-59-half-annual-proxy': { kind: 'convention', reason: 'annual withdrawals have no date, so a day-exact 59.5 boundary would fabricate timing' },
  'irc-72-t-2-A-v-rule-of-55-separation-proxy': { kind: 'needs-fact', missingInput: 'actual separation date and sponsoring-employer account identity' },
  'irc-72-t-3-B-sepp-separation-annual-proxy': { kind: 'needs-fact', missingInput: 'actual separation date and sponsoring-employer identity for the SEPP account' },
  'irc-83-a-equity-compensation-execution-character': { kind: 'fix', implementation: 'packages/engine/src/actions/execution.ts#executeOrdinaryWithdrawals' },
  'irc-86-a-optimizer-taxable-social-security-linearization': { kind: 'convention', reason: "the optimizer's linear program requires a linear candidate objective and the full year-by-year projection re-prices candidates" },
  'la-rs-47-44-2-public-bucket-overreach': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'md-tax-10-209-pension-exclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'me-mrs-36-5122-2-m2-m3-2026-pension-deduction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'mi-mcl-206-30-retirement-and-ss': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'mn-stat-290-0132-subd-26-social-security-inclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'mo-dor-2026-rate-schedule-and-standard-deduction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ms-27-7-21-personal-and-age-65-exemptions': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ms-combined-return-runs-the-schedule-per-spouse': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ms-early-or-excess-distribution-not-exempt': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'mt-mca-15-30-2120-3-g-age-65-subtraction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ndcc-57-38-30-3-2-closed-subtraction-list': { kind: 'needs-fact', missingInput: 'military or qualified-peace-officer versus other public-pension class' },
  'ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion': { kind: 'needs-fact', missingInput: 'annual qualified-dividend amount' },
  'ne-stat-77-2716-public-pension-exemption': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'nj-stat-54a-6-10-retirement-income-exclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'nm-stat-7-2-5-14-social-security-and-federal-standard': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'notice-2004-50-a-39-prior-section-213-deduction': { kind: 'needs-fact', missingInput: 'per-expense prior-section-213-deduction status' },
  'notice-2008-59-a-41-hsa-establishment-date-per-account': { kind: 'needs-fact', missingInput: 'HSA establishment date and relate-back facts per account' },
  'notice-2022-6-3-02-e-1-projection-contribution-during-series': { kind: 'fix', implementation: 'packages/engine/src/projection/simulate.ts#simulatePlan' },
  'ny-government-pension-issuer-qualification-not-modeled': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome' },
  'ny-tax-612-c-3-a-pension-annuity-exclusion': { kind: 'convention', reason: 'annual pension income has no payment date for an honest intra-year 59.5 gate' },
  'oh-rev-code-5747-01-social-security-and-public-pension': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ok-stat-68-2358-retirement-and-social-security': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'or-lro-2026-rate-schedule-and-standard-deduction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'pa-pit-retirement-benefits-not-compensation': { kind: 'needs-fact', missingInput: 'plan age or service requirement and satisfaction at separation' },
  'pl-116-94-div-o-sec-401-b-1-post-2019-inherited-regime-boundary': { kind: 'fix', implementation: 'packages/engine/src/strategies/accountEligibility.ts#isTreatAsOwnEffective' },
  'poms-rs-00615-320-rib-lim-after-survivor-reduction': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/survivorBenefit.ts#survivorBenefitMonthly' },
  'poms-rs-00615-482-arf-crediting-months': { kind: 'convention', reason: 'exact work-deduction months are not inferable from annual future earnings' },
  'ri-gen-laws-44-30-12-social-security-and-pension-modification': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'sc-code-12-6-1170-retirement-income-deduction': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'ssa-table-4c6-period-life-table-vintage': { kind: 'fix', implementation: 'packages/engine/src/longevity/ssaPeriod2022.ts#baselineRemainingYears' },
  'treas-reg-1-1012-1-c-lot-basis-and-holding-period': { kind: 'convention', reason: 'specific-lot selection decades ahead is unknowable where the plan stores aggregate basis' },
  'treas-reg-1-1275-7-f-1-deflation-adjustment-income': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/tipsLadderAnnualCashFlow.ts#tipsLadderAnnualCashFlows' },
  'treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualInheritedIraDistributions.ts#annualInheritedIraDistributions' },
  'treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding' },
  'treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd': { kind: 'fix', implementation: 'packages/engine/src/actions/annualQcdExecution.ts#executeAnnualQcds' },
  'treas-reg-1-408-8-projection-sub-cent-distribution-discharge': { kind: 'convention', reason: 'a sub-cent amount cannot be transferred or represented in the exact-cent journal' },
  'treas-reg-1-72-5-b-2-joint-and-survivor-expected-return': { kind: 'fix', implementation: 'packages/engine/src/projection/annuityForms.ts#annuityExclusionMultiple' },
  'treas-reg-1-72-7-refund-feature-investment-adjustment': { kind: 'fix', implementation: 'packages/engine/src/projection/annuityForms.ts#annuityExclusionMultiple' },
  'usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure': { kind: 'convention', reason: 'future enrollment and death months are not credible beneficiary-year inputs' },
  'usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase' },
  'usc-42-1395r-i-5-optimizer-uniform-threshold-indexing': { kind: 'fix', implementation: 'packages/engine/src/strategies/optimizer.ts#buildOptimizerModel' },
  'usc-42-402-c-2-ssdi-spouse-auxiliary': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity' },
  'usc-42-403-a-6-ssdi-family-maximum': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity' },
  'usc-42-403-f-1-earnings-test-month-charging': { kind: 'convention', reason: 'annual earnings do not determine the months SSA charges' },
  'usc-42-415-b-2-a-i-computation-years-five-year-dropout': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings' },
  'usc-42-415-b-2-b-disability-freeze-aime-exclusion': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings' },
  'usc-42-415-b-2-b-ii-iii-initial-computation-base-window': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings' },
  'usc-42-415-f-2-post-entitlement-pia-recomputation': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/piaFromEarnings.ts#computePiaFromEarnings' },
  'usc-42-416-l-survivor-fra-age-60-attainment-cohorts': { kind: 'fix', implementation: 'packages/engine/src/socialSecurity/nra.ts#survivorFraForBirthYear' },
  'usc-42-423-a-2-402-q-retirement-claim-before-disability-onset': { kind: 'fix', implementation: 'packages/engine/src/projection/internal/annualSocialSecurity.ts#annualSocialSecurity' },
  'usc-42-423-c-2-ssdi-five-month-waiting-period': { kind: 'needs-fact', missingInput: 'disability onset month or exact onset date' },
  'va-code-58-1-322-03-age-deduction-and-social-security': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'vt-stat-32-5830e-social-security-inclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'wi-schedule-sb-line-5-long-term-capital-gain-exclusion': { kind: 'fix', implementation: 'packages/engine/src/tax/stateTax.ts#computeStateTaxableIncomeResult' },
  'wi-stat-71-05-retirement-income-subtraction': { kind: 'needs-fact', missingInput: 'per-recipient qualifying income and restricted-credit or election status' },
})
