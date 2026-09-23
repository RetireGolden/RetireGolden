/**
 * The kind of every `approximated` tax rule: why the engine computes a figure
 * the authority does not require, sorted into one of three kinds.
 *
 * - `fix`: the engine can compute the authority's figure from facts the plan
 *   already collects, so the approximation is a defect with a known home. The
 *   home is the rule's own registered implementations (`implementedBy` and
 *   `implementedByFunctions` on its record), which the ledger already
 *   publishes with their declaration lines, so a fix entry carries nothing but
 *   its kind. This count should trend to zero.
 * - `needs-fact`: the authority's figure turns on a fact the plan does not
 *   collect. `missingInput` names that fact in plain words.
 * - `convention`: a deliberate, kept-on-purpose simplification or standing
 *   process. `reason` says why, in plain words.
 *
 * Source: the B1-P2 approximations triage of the bidirectional validation plan
 * (`approximations-triage.json`), pinned at engine commit fb398216, with its
 * ids re-verified against the registry's `approximated` rules at 3a23de9c.
 * The entries transcribe its kinds, `needsFact.missingInput` and
 * `convention.reason`, with these departures.
 *
 * Rewritten for the public-text rule: two convention reasons named the "exact
 * ledger", an internal term; they now say "the full year-by-year projection"
 * (and the first spells out "the LP" as the optimizer's linear program):
 * irc-86-a-optimizer-taxable-social-security-linearization and
 * irc-1-h-optimizer-flat-fifteen-percent-preferential-rate.
 *
 * Corrected because the triage's missingInput named a fact the plan does
 * collect, so the published text now names only what it does not:
 * - ndcc-57-38-30-3-2-closed-subtraction-list: a pension's `source` already
 *   distinguishes military, federal civil-service and state or local public
 *   pensions (model/stateTaxPlanFacts.ts, pensionSourceKindSchema); only the
 *   qualified retired law enforcement class has no typed field.
 * - irc-402-c-1-pension-lump-sum-direct-rollover-eligibility: a pension's
 *   `stateEligibility.qualifiedPlanType` already records a 401(a) plan, so
 *   the qualified-trust fact is collectable; eligible-rollover-distribution
 *   and plan-permission facts are not.
 * - wi-stat-71-05-retirement-income-subtraction: every account carries its
 *   `ownerPersonId`, and the projection attributes each retirement
 *   distribution to its recipient (annualStateRetirementEvents.ts), so
 *   per-recipient income is known; the credit and election facts are not.
 *
 * Reclassified from the triage, each against the rule's own record and code:
 * - ssa-table-4c6-period-life-table-vintage, fix to convention: the record
 *   says the table "is refreshed deliberately, not silently" in a reviewed
 *   change, a standing yearly process (DOCS/maintenance-schedule.md) that
 *   recurs after every refresh.
 * - aca-26-51-815-b-3-ten-million-dollar-gain-exemption, fix to convention:
 *   the record calls the population one the engine "will essentially never
 *   see, which is a reason to record the gap rather than to model it".
 * - irc-408-d-2-C-projection-pro-rata-measurement-instant, fix to
 *   convention: the record says "NOT CORRECTED HERE, and the reason has not
 *   changed"; the only shape still reaching the fallback is a balance too
 *   large for the exact-cent boundary.
 * - irc-1411-d-modified-agi-foreign-exclusion-addback, fix to convention:
 *   the plan collects the NIIT-specific amount (annualFederalTaxFacts), the
 *   engine uses it exactly when given, and omission falls back to the broad
 *   amount as a documented compatibility approximation.
 * - ic-6-3-6-2-2-county-income-tax-shares-the-state-base, needs-fact to
 *   convention: the plan collects the rate (`assumptions.localIncomeTaxPct`,
 *   default zero) and the record calls the gap "a missing DEFAULT rather than
 *   a missing mechanism", with no statewide rate to invent.
 * - ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion, needs-fact to fix:
 *   qualified dividends come from each taxable account's dividend yield and
 *   qualified ratio and already reach the state base in full.
 * - poms-rs-00615-482-arf-crediting-months and
 *   usc-42-403-f-1-earnings-test-month-charging, convention to fix: the
 *   annual withholding and benefit the statutory month count needs are both
 *   in hand where the engine rounds its ratio instead; months in a first
 *   (grace) year stay with cfr-20-404-435-grace-year-monthly-earnings-test.
 *
 * Registered as approximated after the triage, with the kind chosen in the
 * same change:
 * - usc-42-402-e-survivor-of-worker-who-died-before-claiming, fix: the plan
 *   already holds both birth dates, the worker's age at death, the PIA and
 *   both claim ages, which is what the statutory start and base need under
 *   the engine's existing whole-year death convention; the fix is in the
 *   survivor step-up's own code.
 *
 * This text is published. `scripts/rules-coverage.mjs` writes each entry onto
 * its rule in the ledger (`DOCS/operations/rule-coverage/`), and the public
 * methodology site renders it in its known-limits table, so every string must
 * read as plain words to a member of the public: no em dashes and none of the
 * internal test vocabulary `approximationKinds.conformance.test.ts` bans. The
 * titles of these rules, which the site prints beside each entry, are held to
 * the same rule there.
 *
 * A rule reclassified out of `approximated`, newly classified into it, or
 * fixed must update its entry here in the same change, and a change of kind
 * updates the pinned counts. The type below makes a missing or stale key a
 * compile error, and the conformance suite checks the keys, the shapes, the
 * counts by kind and the public text.
 */
import type { TAX_RULE_REGISTRY, TaxRuleId } from './taxRuleRegistry.js'

export type ApproximationKind = 'fix' | 'needs-fact' | 'convention'

export type ApproximationEntry =
  | { readonly kind: 'fix' }
  | { readonly kind: 'needs-fact'; readonly missingInput: string }
  | { readonly kind: 'convention'; readonly reason: string }

/** The registry ids classified `approximated`: exactly the keys this module must carry. */
export type ApproximatedTaxRuleId = {
  [Id in TaxRuleId]: (typeof TAX_RULE_REGISTRY)[Id]['classification'] extends 'approximated' ? Id : never
}[TaxRuleId]

export const APPROXIMATION_KINDS: Readonly<Record<ApproximatedTaxRuleId, ApproximationEntry>> = Object.freeze({
  'aca-26-51-815-b-3-ten-million-dollar-gain-exemption': { kind: 'convention', reason: 'a single gain above $10 million is outside the households the planner is built for, so the exemption above that amount is left out on purpose' },
  'al-form40-defined-benefit-414j-exemption': { kind: 'fix' },
  'al-form40-personal-and-dependent-exemptions-not-modeled': { kind: 'fix' },
  'al-form40-standard-deduction-agi-slide': { kind: 'fix' },
  'ars-43-1022-2-government-pension-exclusion': { kind: 'fix' },
  'ars-43-1022-22-long-term-capital-gain-subtraction': { kind: 'needs-fact', missingInput: 'acquisition date and long-term character for each Arizona gain lot' },
  'ars-43-1023-e-age-65-exemption': { kind: 'fix' },
  'cfr-20-404-1592-trial-work-period': { kind: 'convention', reason: 'future monthly service cannot be recovered from annual earnings without fabricated history' },
  'cfr-20-404-1592a-extended-period-of-eligibility': { kind: 'convention', reason: 'future month-by-month SGA is unknowable from annual wages' },
  'cfr-20-404-211-d-3-indexed-earnings-nearer-penny': { kind: 'fix' },
  'cfr-20-404-331-living-divorced-spouse-eligibility': { kind: 'needs-fact', missingInput: 'worker entitlement and fully-insured status plus exact divorce date' },
  'cfr-20-404-335-ordinary-widow-eligibility': { kind: 'fix' },
  'cfr-20-404-336-e-surviving-divorced-remarriage': { kind: 'fix' },
  'cfr-20-404-435-grace-year-monthly-earnings-test': { kind: 'convention', reason: 'annual plans cannot credibly place future earnings in service versus non-service months' },
  'ct-cgs-12-701-20-b-social-security-retirement': { kind: 'fix' },
  'de-code-30-1106-social-security-retirement-subtractions': { kind: 'fix' },
  'de-pit-est-2026-qss-standard-deduction-joint-mapper': { kind: 'fix' },
  'ga-code-48-7-27-retirement-and-social-security-exclusion': { kind: 'fix' },
  'hi-hrs-235-7-pension-and-social-security': { kind: 'fix' },
  'ic-6-3-1-3-5-exemptions-not-a-standard-deduction': { kind: 'fix' },
  'ic-6-3-2-3-7-civil-service-annuity-age-62': { kind: 'fix' },
  'ic-6-3-2-4-military-retirement-deduction': { kind: 'fix' },
  'ic-6-3-6-2-2-county-income-tax-shares-the-state-base': { kind: 'convention', reason: 'the county tax uses the local income tax rate set in the plan, which is zero unless entered, because county rates vary and there is no published statewide rate to use instead' },
  'irc-1-h-1-E-unrecaptured-section-1250-gain': { kind: 'fix' },
  'irc-1-h-optimizer-flat-fifteen-percent-preferential-rate': { kind: 'convention', reason: 'a constant rate keeps the optimizer linear and the full year-by-year projection re-prices its choice' },
  'irc-1014-a-1-basis-at-death-fair-market-value': { kind: 'fix' },
  'irc-1091-a-wash-sale-thirty-day-window': { kind: 'convention', reason: 'future security lots and replacement purchases cannot be forecast credibly in an aggregate-account plan' },
  'irc-121-a-b-principal-residence-eligibility-tests': { kind: 'needs-fact', missingInput: 'ownership/use history, prior exclusion date, and disqualifying expatriation facts' },
  'irc-1212-b-2-zero-income-section-1211-allowance-preserves-carryforward': { kind: 'fix' },
  'irc-1411-d-modified-agi-foreign-exclusion-addback': { kind: 'convention', reason: 'when the plan leaves out the foreign exclusion amount specific to the net investment income tax, the broader foreign exclusion amount stands in for it; an amount the plan gives is used as given' },
  'irc-163-h-3-E-i-pmi-qualified-residence-interest-restart': { kind: 'needs-fact', missingInput: 'annual qualified mortgage-insurance premiums' },
  'irc-163-h-3-F-acquisition-indebtedness-limit': { kind: 'needs-fact', missingInput: 'acquisition-debt balance, origination date, and qualified-residence use per mortgage' },
  'irc-164-b-7-B-magi-phasedown': { kind: 'fix' },
  'irc-165-c-personal-use-sale-loss-nondeductible': { kind: 'needs-fact', missingInput: 'profit-motive versus personal-use status of the sold property' },
  'irc-170-b-1-G-projection-cash-ceiling-not-applied': { kind: 'needs-fact', missingInput: 'opening charitable carryforward by contribution class and expiration year' },
  'irc-170-p-projection-nonitemizer-deduction-not-allowed': { kind: 'fix' },
  'irc-213-a-medical-expense-deduction': { kind: 'needs-fact', missingInput: 'annual unreimbursed qualifying medical expenses by tax category' },
  'irc-219-g-traditional-ira-deduction-phaseout': { kind: 'fix' },
  'irc-223-b-2-7-projection-coverage-proration-and-medicare': { kind: 'needs-fact', missingInput: 'monthly HSA eligibility, HDHP tier, and Medicare-entitlement month per owner' },
  'irc-223-f-4-C-hsa-age-65-annual-proxy': { kind: 'convention', reason: 'annual HSA withdrawals have no date, so the day-after-65 boundary cannot be located honestly' },
  'irc-223-f-8-B-estate-predeath-expense-reduction': { kind: 'needs-fact', missingInput: 'death-date HSA value, legal beneficiary class, and qualifying expenses timely paid' },
  'irc-401-a-17-plan-compensation-cap': { kind: 'fix' },
  'irc-401-a-9-C-i-II-still-working-exception': { kind: 'needs-fact', missingInput: 'still-employed-by-sponsor and five-percent-owner status per employer plan and year' },
  'irc-401-a-9-C-i-elected-deferral-ignores-attainment-year-distributions': { kind: 'fix' },
  'irc-401-a-9-E-ii-eligible-designated-beneficiary': { kind: 'fix' },
  'irc-401-c-2-earned-income-not-modeled': { kind: 'needs-fact', missingInput: 'annual net self-employment earnings eligible as section 219 compensation' },
  'irc-402-c-1-pension-lump-sum-direct-rollover-eligibility': { kind: 'needs-fact', missingInput: 'eligible-rollover-distribution and plan-permission facts for the pension offer' },
  'irc-402-c-4-B-rmd-not-eligible-rollover-distribution': { kind: 'fix' },
  'irc-408-d-2-C-annuity-contract-close-of-year-value': { kind: 'convention', reason: 'future insurer FMV or actuarial reserve cannot be inferred without inventing contract economics' },
  'irc-408-d-2-C-projection-pro-rata-measurement-instant': { kind: 'convention', reason: "an IRA balance above about 90 trillion dollars cannot be held to the cent, so that year measures the IRA value before the year's growth instead of after it; no real household reaches that size" },
  'irc-408-d-2-estate-household-basis-allocation': { kind: 'fix' },
  'irc-408-d-8-B-ii-projection-annual-age-proxy': { kind: 'convention', reason: 'the annual legacy gift has no execution date and an invented future date would be false precision' },
  'irc-408A-c-3-roth-contribution-agi-phase-out': { kind: 'fix' },
  'irc-408A-d-2-roth-qualified-distribution': { kind: 'needs-fact', missingInput: 'first taxable year of any Roth IRA contribution for each person' },
  'irc-408A-d-4-B-converted-layer-taxable-portion-first': { kind: 'fix' },
  'irc-408A-d-4-B-same-year-conversion-aggregation': { kind: 'fix' },
  'irc-414-v-1-plan-permitted-catch-up': { kind: 'needs-fact', missingInput: 'whether each sponsoring plan permits catch-up contributions' },
  'irc-414-v-7-A-prior-year-fica-wage-proxy': { kind: 'convention', reason: 'exact future Box 3 wages by sponsor are unknowable over decades; the entered proxy fails closed' },
  'irc-4973-a-b-f-ira-and-roth-excess-contribution-excise': { kind: 'fix' },
  'irc-4973-a-g-hsa-excess-contribution-excise': { kind: 'needs-fact', missingInput: 'year-end uncorrected HSA excess after monthly eligibility and corrections' },
  'irc-57-a-5-private-activity-bond-interest-amt-preference': { kind: 'convention', reason: 'future holdings lack issue-level identity and carve-out facts; guessing decades-out PAB mix would falsely exactify an AMT screen' },
  'irc-72-e-8-D-pre-1987-employee-contributions': { kind: 'convention', reason: 'administrator-only 1986 records are not reasonably recoverable for long-range household planning' },
  'irc-72-t-2-A-i-age-59-half-annual-proxy': { kind: 'convention', reason: 'annual withdrawals have no date, so a day-exact 59.5 boundary would fabricate timing' },
  'irc-72-t-2-A-v-rule-of-55-separation-proxy': { kind: 'needs-fact', missingInput: 'actual separation date and sponsoring-employer account identity' },
  'irc-72-t-3-B-sepp-separation-annual-proxy': { kind: 'needs-fact', missingInput: 'actual separation date and sponsoring-employer identity for the SEPP account' },
  'irc-83-a-equity-compensation-execution-character': { kind: 'fix' },
  'irc-86-a-optimizer-taxable-social-security-linearization': { kind: 'convention', reason: "the optimizer's linear program requires a linear candidate objective and the full year-by-year projection re-prices candidates" },
  'la-rs-47-44-2-public-bucket-overreach': { kind: 'fix' },
  'md-tax-10-209-pension-exclusion': { kind: 'fix' },
  'me-mrs-36-5122-2-m2-m3-2026-pension-deduction': { kind: 'fix' },
  'mi-mcl-206-30-retirement-and-ss': { kind: 'fix' },
  'mn-stat-290-0132-subd-26-social-security-inclusion': { kind: 'fix' },
  'mo-dor-2026-rate-schedule-and-standard-deduction': { kind: 'fix' },
  'ms-27-7-21-personal-and-age-65-exemptions': { kind: 'fix' },
  'ms-combined-return-runs-the-schedule-per-spouse': { kind: 'fix' },
  'ms-early-or-excess-distribution-not-exempt': { kind: 'fix' },
  'mt-mca-15-30-2120-3-g-age-65-subtraction': { kind: 'fix' },
  'ndcc-57-38-30-3-2-closed-subtraction-list': { kind: 'needs-fact', missingInput: 'whether a public pension is a qualified retired law enforcement (peace officer) benefit' },
  'ndcc-57-38-30-3-2-d-2-qualified-dividend-exclusion': { kind: 'fix' },
  'ne-stat-77-2716-public-pension-exemption': { kind: 'fix' },
  'nj-stat-54a-6-10-retirement-income-exclusion': { kind: 'fix' },
  'nm-stat-7-2-5-14-social-security-and-federal-standard': { kind: 'fix' },
  'notice-2004-50-a-39-prior-section-213-deduction': { kind: 'needs-fact', missingInput: 'per-expense prior-section-213-deduction status' },
  'notice-2008-59-a-41-hsa-establishment-date-per-account': { kind: 'needs-fact', missingInput: 'HSA establishment date and relate-back facts per account' },
  'notice-2022-6-3-02-e-1-projection-contribution-during-series': { kind: 'fix' },
  'ny-government-pension-issuer-qualification-not-modeled': { kind: 'fix' },
  'ny-tax-612-c-3-a-pension-annuity-exclusion': { kind: 'convention', reason: 'annual pension income has no payment date for an honest intra-year 59.5 gate' },
  'oh-rev-code-5747-01-social-security-and-public-pension': { kind: 'fix' },
  'ok-stat-68-2358-retirement-and-social-security': { kind: 'fix' },
  'or-lro-2026-rate-schedule-and-standard-deduction': { kind: 'fix' },
  'pa-pit-retirement-benefits-not-compensation': { kind: 'needs-fact', missingInput: 'plan age or service requirement and satisfaction at separation' },
  'pl-116-94-div-o-sec-401-b-1-post-2019-inherited-regime-boundary': { kind: 'fix' },
  'poms-rs-00615-320-rib-lim-after-survivor-reduction': { kind: 'fix' },
  'poms-rs-00615-482-arf-crediting-months': { kind: 'fix' },
  'ri-gen-laws-44-30-12-social-security-and-pension-modification': { kind: 'fix' },
  'sc-code-12-6-1170-retirement-income-deduction': { kind: 'fix' },
  'ssa-table-4c6-period-life-table-vintage': { kind: 'convention', reason: 'the life table is updated on purpose in a reviewed yearly change, because a new table changes results, so between updates it trails the newest table SSA has published' },
  'treas-reg-1-1012-1-c-lot-basis-and-holding-period': { kind: 'convention', reason: 'specific-lot selection decades ahead is unknowable where the plan stores aggregate basis' },
  'treas-reg-1-1275-7-f-1-deflation-adjustment-income': { kind: 'fix' },
  'treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy': { kind: 'fix' },
  'treas-reg-1-401-a-9-6-q-2-ii-qlac-premium-cap-across-every-contract': { kind: 'fix' },
  'treas-reg-1-408-8-g-projection-named-qcd-beyond-rmd': { kind: 'fix' },
  'treas-reg-1-408-8-projection-sub-cent-distribution-discharge': { kind: 'convention', reason: 'a sub-cent amount cannot be transferred or represented in the exact-cent journal' },
  'treas-reg-1-72-5-b-2-joint-and-survivor-expected-return': { kind: 'fix' },
  'treas-reg-1-72-7-refund-feature-investment-adjustment': { kind: 'fix' },
  'usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure': { kind: 'convention', reason: 'future enrollment and death months are not credible beneficiary-year inputs' },
  'usc-42-1395r-i-4-a-i-irmaa-magi-foreign-exclusion-addback': { kind: 'fix' },
  'usc-42-1395r-i-5-optimizer-uniform-threshold-indexing': { kind: 'fix' },
  'usc-42-402-c-2-ssdi-spouse-auxiliary': { kind: 'fix' },
  'usc-42-402-e-survivor-of-worker-who-died-before-claiming': { kind: 'fix' },
  'usc-42-403-a-6-ssdi-family-maximum': { kind: 'fix' },
  'usc-42-403-f-1-earnings-test-month-charging': { kind: 'fix' },
  'usc-42-415-b-2-a-i-computation-years-five-year-dropout': { kind: 'fix' },
  'usc-42-415-b-2-b-disability-freeze-aime-exclusion': { kind: 'fix' },
  'usc-42-415-b-2-b-ii-iii-initial-computation-base-window': { kind: 'fix' },
  'usc-42-415-f-2-post-entitlement-pia-recomputation': { kind: 'fix' },
  'usc-42-416-l-survivor-fra-age-60-attainment-cohorts': { kind: 'fix' },
  'usc-42-423-a-2-402-q-retirement-claim-before-disability-onset': { kind: 'fix' },
  'usc-42-423-c-2-ssdi-five-month-waiting-period': { kind: 'needs-fact', missingInput: 'disability onset month or exact onset date' },
  'va-code-58-1-322-03-age-deduction-and-social-security': { kind: 'fix' },
  'vt-stat-32-5830e-social-security-inclusion': { kind: 'fix' },
  'wi-schedule-sb-line-5-long-term-capital-gain-exclusion': { kind: 'fix' },
  'wi-stat-71-05-retirement-income-subtraction': { kind: 'needs-fact', missingInput: 'restricted-credit or election status' },
})
