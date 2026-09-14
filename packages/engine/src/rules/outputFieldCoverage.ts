/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Output field coverage imported from the output-family census at commit 17c1d3d387430e65992822a159919b1eac5dcfa8.
 * Regenerate: node packages/engine/scripts/import-output-census.mjs <census-dir>
 */

export interface OutputFieldCoverageRow {
  readonly source: string
  readonly owner: string
  readonly field: string
  readonly disposition: string
  readonly familyId: string | null
  readonly reasonKind?: string
  readonly reason?: string
  readonly tsType?: string
}

export interface OutputFieldExclusion {
  readonly id: string
  readonly path: string
  readonly symbol: string
  readonly field: string
  readonly reasonKind: string
  readonly reason: string
}

type RawCoverage = {
  source?: unknown
  owner?: unknown
  field?: unknown
  disposition?: unknown
  familyId?: unknown
  reasonKind?: unknown
  reason?: unknown
  tsType?: unknown
}

type RawExclusion = {
  id?: unknown
  path?: unknown
  symbol?: unknown
  field?: unknown
  reasonKind?: unknown
  reason?: unknown
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function coverageRow(raw: RawCoverage): OutputFieldCoverageRow {
  const row: OutputFieldCoverageRow = {
    source: asString(raw.source),
    owner: asString(raw.owner),
    field: asString(raw.field),
    disposition: asString(raw.disposition),
    familyId: typeof raw.familyId === 'string' ? raw.familyId : null,
  }
  if (typeof raw.reasonKind === 'string') Object.assign(row, { reasonKind: raw.reasonKind })
  if (typeof raw.reason === 'string') Object.assign(row, { reason: raw.reason })
  if (typeof raw.tsType === 'string') Object.assign(row, { tsType: raw.tsType })
  return row
}

function exclusionRow(raw: RawExclusion): OutputFieldExclusion {
  return {
    id: asString(raw.id),
    path: asString(raw.path),
    symbol: asString(raw.symbol),
    field: asString(raw.field),
    reasonKind: asString(raw.reasonKind),
    reason: asString(raw.reason),
  }
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

const coverageCensus = [
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationPointMetrics",
    "field": "expectedShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-expected-shortfall-on-failing-paths",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationPointMetrics",
    "field": "medianEndingAfterTaxEstate",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationPointMetrics",
    "field": "p10EndingAfterTaxEstate",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationPointMetrics",
    "field": "requiredFloorSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-required-floor-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationPointMetrics",
    "field": "successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationPointMetrics",
    "field": "targetLifestyleSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-target-lifestyle-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweep",
    "field": "payoutRatePct",
    "disposition": "family",
    "familyId": "annuitization-payout-rate-pct",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweep",
    "field": "startAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Age annuity payments start, max(current age, 65); printed as a coordinate in the annuitization paragraph.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepConfig",
    "field": "allocationPcts",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Allocation grid (percent of investable) to sweep; overrides the default grid.",
    "tsType": "readonly number[]"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepConfig",
    "field": "quotedPayoutRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "User-entered annual SPIA payout rate (percent of premium) overriding the default payout table.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "allocationPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Requested grid percent that keys each sweep point; the chart plots effectiveAllocationPct instead.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "annualIncome",
    "disposition": "family",
    "familyId": "annuitization-sweep-annual-income",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "effectiveAllocationPct",
    "disposition": "family",
    "familyId": "annuitization-sweep-effective-allocation-pct",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "glidepathControl.expectedShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Glidepath-control variant's expected shortfall on failing paths (same premium shifted from bonds to US stocks, no annuity); MonteCarloPage.tsx charts only glidepathControl.successRate as the dashed 'Glidepath only (no annuity)' line; searched planner-ui/src for glidepathControl: no reader of the other control metrics.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "glidepathControl.medianEndingAfterTaxEstate",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Glidepath-control variant's median ending after-tax estate (same premium shifted from bonds to US stocks, no annuity); MonteCarloPage.tsx charts only glidepathControl.successRate as the dashed 'Glidepath only (no annuity)' line; searched planner-ui/src for glidepathControl: no reader of the other control metrics.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "glidepathControl.p10EndingAfterTaxEstate",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Glidepath-control variant's p10 ending after-tax estate (same premium shifted from bonds to US stocks, no annuity); MonteCarloPage.tsx charts only glidepathControl.successRate as the dashed 'Glidepath only (no annuity)' line; searched planner-ui/src for glidepathControl: no reader of the other control metrics.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "glidepathControl.requiredFloorSuccessRate",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Glidepath-control variant's required-floor success rate (same premium shifted from bonds to US stocks, no annuity); MonteCarloPage.tsx charts only glidepathControl.successRate as the dashed 'Glidepath only (no annuity)' line; searched planner-ui/src for glidepathControl: no reader of the other control metrics.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "glidepathControl.successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "glidepathControl.targetLifestyleSuccessRate",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Glidepath-control variant's target-lifestyle success rate (same premium shifted from bonds to US stocks, no annuity); MonteCarloPage.tsx charts only glidepathControl.successRate as the dashed 'Glidepath only (no annuity)' line; searched planner-ui/src for glidepathControl: no reader of the other control metrics.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "AnnuitizationSweepPoint",
    "field": "premium",
    "disposition": "family",
    "familyId": "annuitization-sweep-premium",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/annuitization.ts",
    "owner": "module",
    "field": "DEFAULT_GRID",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Default allocation grid (0, 5, 10, 15, 20, 25, 30 percent) swept when no allocationPcts is given.",
    "tsType": "readonly number[]"
  },
  {
    "source": "engine/src/decisions/pensionElection.ts",
    "owner": "analyzePensionElections",
    "field": "curveRatePct",
    "disposition": "family",
    "familyId": "pension-election-annuity-present-value",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/pensionElection.ts",
    "owner": "analyzePensionElections",
    "field": "presentValueAtCurveRate",
    "disposition": "family",
    "familyId": "pension-election-annuity-present-value",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "SustainableSpendingOptions",
    "field": "estateFloorTodayDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SustainableSpendingOptions.estateFloorTodayDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "SustainableSpendingOptions",
    "field": "maxSimulations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The SustainableSpendingOptions.maxSimulations field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "SustainableSpendingOptions",
    "field": "resolutionDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SustainableSpendingOptions.resolutionDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "SustainableSpendingResult",
    "field": "maxBaseAnnual",
    "disposition": "family",
    "familyId": "sustainable-spending-result-max-base-annual",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "SustainableSpendingResult",
    "field": "simulationCount",
    "disposition": "family",
    "familyId": "sustainable-spending-result-simulation-count",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "SustainableSpendingResult",
    "field": "spendingSlackDollars",
    "disposition": "family",
    "familyId": "sustainable-spending-result-spending-slack-dollars",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "module",
    "field": "baseAnnual",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.baseAnnual field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "solveMaxSustainableSpending",
    "field": "amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Candidate spending level tried by the bisection inside solveMaxSustainableSpending; a loop local.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "solveMaxSustainableSpending",
    "field": "baseAnnual",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Base spending patched into the trial plan by the bisection; a loop local.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "solveMaxSustainableSpending",
    "field": "lower",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Bisection lower bound; a loop local.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/decisions/spendingSolver.ts",
    "owner": "solveMaxSustainableSpending",
    "field": "upper",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Bisection upper bound; a loop local.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleResult",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "swr-rule-result-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleResult",
    "field": "endYear",
    "disposition": "family",
    "familyId": "swr-rule-result-end-year",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleResult",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "swr-rule-result-ending-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleResult",
    "field": "initialAnnualSpend",
    "disposition": "family",
    "familyId": "swr-rule-result-initial-annual-spend",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleResult",
    "field": "initialRatePct",
    "disposition": "family",
    "familyId": "swr-rule-result-initial-rate-pct",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleResult",
    "field": "lifetimeTaxesAndPenalties",
    "disposition": "family",
    "familyId": "swr-rule-result-lifetime-taxes-and-penalties",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "SwrRuleSpec",
    "field": "cape",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "CAPE ratio input to the CAPE-based withdrawal rule spec.",
    "tsType": "number"
  },
  {
    "source": "engine/src/decisions/swrComparator.ts",
    "owner": "compareSwrRules",
    "field": "cape",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "CAPE ratio passed to the rule comparison.",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/annuitizationHeadroom.ts",
    "owner": "annuitizationHeadroom.screen",
    "field": "monthly",
    "disposition": "family",
    "familyId": "insight-annuitization-headroom-illustrative-spia",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/annuitizationHeadroom.ts",
    "owner": "annuitizationHeadroom.screen",
    "field": "premium",
    "disposition": "family",
    "familyId": "insight-annuitization-headroom-illustrative-spia",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/assetLocation.ts",
    "owner": "assetLocation.screen",
    "field": "swapped",
    "disposition": "family",
    "familyId": "insight-asset-location-swappable-exposure",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/hecmBufferCandidate.ts",
    "owner": "hecmBufferCandidate.screen",
    "field": "investable",
    "disposition": "family",
    "familyId": "insight-hecm-buffer-illustrative-credit-line",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/hecmBufferCandidate.ts",
    "owner": "hecmBufferCandidate.screen",
    "field": "lineSize",
    "disposition": "family",
    "familyId": "insight-hecm-buffer-illustrative-credit-line",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/irmaaTierEdge.ts",
    "owner": "irmaaTierEdge.screen",
    "field": "annualPremiumCliff",
    "disposition": "family",
    "familyId": "insight-irmaa-tier-edge-premium-cliff",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/spendingGuardrails.ts",
    "owner": "guardrailPatchFromGenerator",
    "field": "requiredAnnual",
    "disposition": "family",
    "familyId": "insight-spending-guardrails-illustrative-floor",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/spendingHeadroom.ts",
    "owner": "spendingHeadroom.screen",
    "field": "endingEstateToday",
    "disposition": "family",
    "familyId": "insight-spending-headroom-rough-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/spendingHeadroom.ts",
    "owner": "spendingHeadroom.screen",
    "field": "roughHeadroomPerYear",
    "disposition": "family",
    "familyId": "insight-spending-headroom-rough-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/ssBridgeGap.ts",
    "owner": "ssBridgeGap.screen",
    "field": "annualTotal",
    "disposition": "family",
    "familyId": "insight-ss-bridge-gap-total",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/ssBridgeGap.ts",
    "owner": "ssBridgeGap.screen",
    "field": "totalCost",
    "disposition": "family",
    "familyId": "insight-ss-bridge-gap-total",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/stateRelocation.ts",
    "owner": "stateRelocation.evaluate",
    "field": "lifetimeStateTaxDeltaToday",
    "disposition": "family",
    "familyId": "insight-state-relocation-lifetime-state-tax-savings",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/stateRelocation.ts",
    "owner": "stateRelocation.evaluate",
    "field": "savings",
    "disposition": "family",
    "familyId": "insight-state-relocation-lifetime-state-tax-savings",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/detectors/widowsPenalty.ts",
    "owner": "widowsPenalty.screen",
    "field": "bracketJumpToday",
    "disposition": "family",
    "familyId": "insight-widows-penalty-bracket-jump",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "Detector",
    "field": "version",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The Detector.version field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "DetectorProjection",
    "field": "amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Parameter of the DetectorProjection.deflate(year, amount) callback the planner passes to detectors, not a published output.",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "DetectorProjection",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Projection start year handed to detectors; positions their evidence.",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "DetectorProjection",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The DetectorProjection.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "InsightEvidence",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The InsightEvidence.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "InsightImpact",
    "field": "endingAfterTaxEstateDelta",
    "disposition": "family",
    "familyId": "insight-impact-ending-after-tax-estate-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "InsightImpact",
    "field": "lifetimeTaxDelta",
    "disposition": "family",
    "familyId": "insight-impact-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/insights/types.ts",
    "owner": "InsightImpact",
    "field": "successRateDeltaPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Screen-time constant (spendingGuardrails sets 12) that only gates whether InsightCardView runs the Monte Carlo pair; the rendered success line is the UI-computed delta, never this value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizing",
    "field": "annualRealAmount",
    "disposition": "family",
    "familyId": "social-security-bridge-sizing",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizing",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last bridge payout year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizing",
    "field": "ladderCost",
    "disposition": "family",
    "familyId": "social-security-bridge-sizing",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizing",
    "field": "monthlyAge62Benefit",
    "disposition": "family",
    "familyId": "social-security-bridge-sizing",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizing",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "First bridge payout year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizing",
    "field": "years",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Number of bridge years (endYear - startYear + 1); a span, printed as the gap-year range.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "claimAge.months",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Month part of the chosen claim age (ClaimAge); a positive value extends the bridge through the claim year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "claimAge.years",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Whole-year part of the chosen claim age the bridge funds the wait for (ClaimAge).",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "currentYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Calendar year the projection starts; the bridge never starts before the next year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "dob.day",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Birth day of the claimant; sizing input.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "dob.month",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Birth month of the claimant; sizing input.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "dob.year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Birth year of the claimant; sizing input.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "piaMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Worker's monthly PIA in today's dollars; sizing input.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "BridgeSizingInput",
    "field": "retirementYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Calendar year retirement-phase spending begins; the bridge never starts before it.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/bridge.ts",
    "owner": "module",
    "field": "BRIDGE_FUNDING_MIN_FRACTION",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Minimum share (0.5) of the quoted ladder cost the funding account must hold before a bridge is proposed; a threshold shared by the ss-bridge-gap detector and bridgeLadderGenerator.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioInput",
    "field": "amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The FundedRatioInput.amount field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioInput",
    "field": "fromYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The FundedRatioInput.fromYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioInput",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The FundedRatioInput.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioInput",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The FundedRatioInput.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioResult",
    "field": "essentialSpendingPv",
    "disposition": "family",
    "familyId": "funded-ratio-result-essential-spending-pv",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioResult",
    "field": "fromYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "First year the funded-ratio present value covers.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioResult",
    "field": "fundedRatioPct",
    "disposition": "family",
    "familyId": "funded-ratio-result-funded-ratio-pct",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioResult",
    "field": "guaranteedIncomePv",
    "disposition": "family",
    "familyId": "funded-ratio-result-guaranteed-income-pv",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioResult",
    "field": "toYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last year the funded-ratio present value covers.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "FundedRatioResult",
    "field": "unfundedPv",
    "disposition": "family",
    "familyId": "funded-ratio-result-unfunded-pv",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "computeFundedRatio",
    "field": "realAmount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "One year's real cash flow inside the present-value sum; a loop local.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/fundedRatio.ts",
    "owner": "computeFundedRatio",
    "field": "yearsFromNow",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Discounting offset for one cash-flow year inside computeFundedRatio.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderBuild",
    "field": "annualRealIncomeByOffset",
    "disposition": "family",
    "familyId": "ladder-build-annual-real-income-by-offset",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderBuild",
    "field": "targetAnnualRealIncome",
    "disposition": "family",
    "familyId": "ladder-build-target-annual-real-income",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderBuild",
    "field": "totalCost",
    "disposition": "family",
    "familyId": "ladder-build-total-cost",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderBuildInput",
    "field": "annualRealIncome",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LadderBuildInput.annualRealIncome field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderBuildInput",
    "field": "firstPayoutOffset",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LadderBuildInput.firstPayoutOffset field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderBuildInput",
    "field": "payoutYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LadderBuildInput.payoutYears field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRealFlows",
    "field": "coupons",
    "disposition": "family",
    "familyId": "ladder-real-flows-coupons",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRealFlows",
    "field": "maturingPrincipal",
    "disposition": "family",
    "familyId": "ladder-real-flows-maturing-principal",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRealFlows",
    "field": "outstandingFace",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Face still outstanding after a rung matures; the income-floor section prints coupons and maturing principal per rung, not the running face.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRung",
    "field": "cost",
    "disposition": "family",
    "familyId": "ladder-rung-cost",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRung",
    "field": "couponRatePct",
    "disposition": "family",
    "familyId": "ladder-rung-coupon-rate-pct",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRung",
    "field": "face",
    "disposition": "family",
    "familyId": "ladder-rung-face",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "LadderRung",
    "field": "maturityOffset",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Years from purchase to the rung's maturity; the income-floor rung table prints purchase year + offset as the Year column.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "buildLadder",
    "field": "annualRealIncomeByOffset",
    "disposition": "family",
    "familyId": "ladder-build-annual-real-income-by-offset",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "buildLadder",
    "field": "m",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Loop index over rung maturities inside buildLadder.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "buildLadder",
    "field": "offsets",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Rung maturity offsets the ladder builder iterates.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "ladderRealFlowsAtOffset",
    "field": "offset",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Year offset at which ladder flows are read.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "ladderRemainingFace",
    "field": "offset",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Year offset at which remaining face is read.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "module",
    "field": "couponRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.couponRatePct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "module",
    "field": "face",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.face field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "module",
    "field": "maturityOffset",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.maturityOffset field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "module",
    "field": "realYieldPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.realYieldPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "realPresentValue",
    "field": "realAmount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Real amount argument of realPresentValue.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "realPresentValue",
    "field": "yearsFromNow",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Discounting offset argument of realPresentValue.",
    "tsType": "number"
  },
  {
    "source": "engine/src/ladder/ladderMath.ts",
    "owner": "realYieldAt",
    "field": "maturityYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Maturity in years at which the real-yield curve is read.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "expectedShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-expected-shortfall-on-failing-paths",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "medianEndingAfterTaxEstate",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "p10EndingAfterTaxEstate",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "requiredFloorSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-required-floor-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "targetLifestyleSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-target-lifestyle-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "StochasticFrontierPoint",
    "field": "x",
    "disposition": "family",
    "familyId": "stochastic-frontier-variant-axis",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "buildRetirementAgeSuccessFrontier",
    "field": "deltas",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Retirement-age offset grid (default -2 to +2 years) that builds the plan variants; the point x-axis value is the earliest resulting retirement age.",
    "tsType": "readonly number[]"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "buildSpendingSuccessFrontier",
    "field": "multipliers",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Spending multiplier grid (default 0.85 to 1.15) that builds the plan variants; the point x-axis value is the resulting baseAnnual (StochasticFrontierPoint.x).",
    "tsType": "readonly number[]"
  },
  {
    "source": "engine/src/montecarlo/frontiers.ts",
    "owner": "module",
    "field": "MAX_FRONTIER_POINTS",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Cap (15) on the number of points a frontier or annuitization sweep may evaluate; a run-size bound.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressSuite",
    "field": "windowLengthYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Length in years of each replayed historical window; a suite setting.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressSuiteOptions",
    "field": "equityWeightPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Equity weight (default 60) used to blend the historical stock and bond returns into the portfolio return shock.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressSuiteOptions",
    "field": "windowLengthYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Requested historical window length in years (default: the projection length).",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressSuiteOptions",
    "field": "worstWindowCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "How many worst windows each suite lists (default 5); a display-size setting.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressSuiteResult",
    "field": "windowLengthYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Effective window length after clamping the requested length to the projection length and the history; a suite setting repeated on each suite.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressWindow",
    "field": "endHistoricalYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last historical market year of the replayed window; part of the window label.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressWindow",
    "field": "marketYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Historical market years replayed in projection order (wrapping the window, reversed for the reversed suite); coordinates of the replay, not an outcome.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressWindow",
    "field": "startHistoricalYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "First historical market year of the replayed window; part of the window label.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressWindow",
    "field": "totalRequiredShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Summed required-floor shortfall for the window; the Historical stress windows table on MonteCarloPage.tsx prints totalShortfall only.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressWindow",
    "field": "totalShortfall",
    "disposition": "family",
    "familyId": "historical-stress-window-total-shortfall",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/historicalSuites.ts",
    "owner": "HistoricalStressWindow",
    "field": "totalTargetShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Summed target shortfall for the window; the Historical stress windows table on MonteCarloPage.tsx prints totalShortfall only.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "Histogram",
    "field": "binWidth",
    "disposition": "family",
    "familyId": "monte-carlo-ending-investable-histogram",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "Histogram",
    "field": "counts",
    "disposition": "family",
    "familyId": "monte-carlo-ending-investable-histogram",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "Histogram",
    "field": "min",
    "disposition": "family",
    "familyId": "monte-carlo-ending-investable-histogram",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "averageAnnualTargetShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (average annual target shortfall) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "cut",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (guardrail cuts) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "deferred",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (flexible goals deferred) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "depletionYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Per-path first depletion year; the aggregate histogram keys on it and the page never shows a single path.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "endingAfterTaxEstate",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (ending after-tax estate) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "endingInvestable",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (ending investable balance) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "endingNetWorth",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (ending net worth) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "excessFunded",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (excess spending funded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "excessIntended",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (excess spending intended) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "funded",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (flexible goals funded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "fundedAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (flexible-goal dollars funded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "guardrailCutYears",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (guardrail cut years) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "hold",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (guardrail holds) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "idealFunded",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (ideal spending funded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "idealIntended",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (ideal spending intended) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "longestGuardrailCutSpellYears",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (longest cut spell) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "maxGuardrailCutDepth",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (deepest cut fraction) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "partiallyFunded",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (flexible goals partially funded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "raise",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (guardrail raises) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "skipped",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (flexible goals skipped) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "targetAttainmentPct",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (share of target spending funded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "totalRequiredShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (summed required-floor shortfall) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "totalShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (summed unfunded spending) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "totalTargetShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (summed target shortfall) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "unfundedAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (flexible-goal dollars unfunded) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPath",
    "field": "yearsBelowTarget",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-path reduction (years with a target shortfall) consumed only by aggregateMonteCarlo in run.ts; MonteCarloPage.tsx renders MonteCarloSummary aggregates, never a single path.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathOptions",
    "field": "completed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPathOptions.completed field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathOptions",
    "field": "firstPathIndex",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPathOptions.firstPathIndex field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathOptions",
    "field": "pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The MonteCarloPathOptions.pathCount field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathOptions",
    "field": "seed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPathOptions.seed field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathOptions",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The MonteCarloPathOptions.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathsResult",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year of the path grid.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloPathsResult",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "First projection year of the path grid; positions the fan rows.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageAnnualTargetShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Mean across paths of the path-average annual target shortfall (the page shows the p90 statistic only); MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageCutYears",
    "disposition": "family",
    "familyId": "monte-carlo-cut-years",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageLongestCutSpellYears",
    "disposition": "family",
    "familyId": "monte-carlo-average-longest-cut-spell-years",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageRequiredShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Mean across all paths of total required-floor shortfall; MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageTargetShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Mean across all paths of total target-lifestyle shortfall; MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageTotalShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-average-total-shortfall",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "averageYearsBelowTarget",
    "disposition": "family",
    "familyId": "monte-carlo-average-years-below-target",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "count",
    "disposition": "family",
    "familyId": "monte-carlo-depletion-year-histogram",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "cumulativeProbability",
    "disposition": "family",
    "familyId": "monte-carlo-depletion-probability-by-year",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "cut",
    "disposition": "family",
    "familyId": "monte-carlo-guardrail-action-counts",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "deferred",
    "disposition": "family",
    "familyId": "monte-carlo-flexible-goal-outcome-counts",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "excessFundingRate",
    "disposition": "family",
    "familyId": "monte-carlo-excess-funding-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "expectedRequiredShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Average required-floor shortfall across failing paths; MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "expectedShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-expected-shortfall-on-failing-paths",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "expectedTargetShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Average target-lifestyle shortfall across failing paths; MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "failingPathCount",
    "disposition": "family",
    "familyId": "monte-carlo-failing-path-count",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "failureRate",
    "disposition": "family",
    "familyId": "monte-carlo-failure-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "funded",
    "disposition": "family",
    "familyId": "monte-carlo-flexible-goal-outcome-counts",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "fundedAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Flexible-goal dollars funded summed across path-years (the tile prints the four outcome counts only); MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "hold",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Count of guardrail hold actions across path-years (the tile prints cuts and raises only); MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "idealFundingRate",
    "disposition": "family",
    "familyId": "monte-carlo-ideal-funding-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "medianMaxCutDepth",
    "disposition": "family",
    "familyId": "monte-carlo-max-cut-depth-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "p90AverageAnnualTargetShortfall",
    "disposition": "family",
    "familyId": "monte-carlo-p90-average-annual-target-shortfall",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "p90CutYears",
    "disposition": "family",
    "familyId": "monte-carlo-cut-years",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "p90MaxCutDepth",
    "disposition": "family",
    "familyId": "monte-carlo-max-cut-depth-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "p90TotalShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-p90-total-shortfall",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "partiallyFunded",
    "disposition": "family",
    "familyId": "monte-carlo-flexible-goal-outcome-counts",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of simulated paths; a run-size setting the page prints beside the gauge and KPI, not a plan quantity.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "pathsWithCut",
    "disposition": "family",
    "familyId": "monte-carlo-paths-with-cut-share",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "pathsWithRaise",
    "disposition": "family",
    "familyId": "monte-carlo-paths-with-raise-share",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "probEndingAboveBequestTarget",
    "disposition": "family",
    "familyId": "monte-carlo-prob-ending-above-bequest-target",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "probEndingSurplus",
    "disposition": "family",
    "familyId": "monte-carlo-prob-ending-surplus",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "probability",
    "disposition": "family",
    "familyId": "monte-carlo-depletion-probability-by-year",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "raise",
    "disposition": "family",
    "familyId": "monte-carlo-guardrail-action-counts",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "requiredFloorSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-required-floor-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "skipped",
    "disposition": "family",
    "familyId": "monte-carlo-flexible-goal-outcome-counts",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "targetAttainmentPct",
    "disposition": "family",
    "familyId": "monte-carlo-target-attainment-median",
    "tsType": "Omit<YearPercentiles, 'year'>"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "targetLifestyleSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-target-lifestyle-success-rate",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "unfundedAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Flexible-goal dollars unfunded summed across path-years (the tile prints the four outcome counts only); MonteCarloPage.tsx and the scenario risk table checked at pin fb398216 render neither it nor any figure derived from it alone.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "MonteCarloSummary",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year keying the depletion-year histogram, depletion-probability series and fan rows.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "YearPercentiles",
    "field": "p10",
    "disposition": "family",
    "familyId": "monte-carlo-investable-fan-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "YearPercentiles",
    "field": "p25",
    "disposition": "family",
    "familyId": "monte-carlo-investable-fan-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "YearPercentiles",
    "field": "p50",
    "disposition": "family",
    "familyId": "monte-carlo-investable-fan-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "YearPercentiles",
    "field": "p75",
    "disposition": "family",
    "familyId": "monte-carlo-investable-fan-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "YearPercentiles",
    "field": "p90",
    "disposition": "family",
    "familyId": "monte-carlo-investable-fan-percentiles",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "YearPercentiles",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The YearPercentiles.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "averageTargetShortfalls",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The aggregateMonteCarlo.averageTargetShortfalls field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "column",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.column field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "cutDepths",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.cutDepths field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "cutYearCounts",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The aggregateMonteCarlo.cutYearCounts field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "n",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.n field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "targetAttainments",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.targetAttainments field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "aggregateMonteCarlo",
    "field": "totalShortfalls",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.totalShortfalls field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "module",
    "field": "histogramBins",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.histogramBins field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "module",
    "field": "p",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.p field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/montecarlo/run.ts",
    "owner": "module",
    "field": "sorted",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.sorted field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/montecarlo/survival.ts",
    "owner": "survivalPercentileAge",
    "field": "return",
    "disposition": "family",
    "familyId": "longevity-survival-percentile-age",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "EstateAccountBreakdown",
    "field": "charityAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-account estate breakdown charityAmount. Searched planner-ui/src at pin fb398216 for estateBreakdown, grossBalance, taxablePretaxBase, charityAmount, netToHeirs, heirTax and heirTaxRatePct: no page, chart, CSV column, report block or drilldown reads the per-account breakdown; it is consumed only inside summarizeProjection to produce endingEstateHeirTax and endingEstateToCharity (Scenarios page) and endingAfterTaxEstate.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "EstateAccountBreakdown",
    "field": "grossBalance",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-account estate breakdown grossBalance. Searched planner-ui/src at pin fb398216 for estateBreakdown, grossBalance, taxablePretaxBase, charityAmount, netToHeirs, heirTax and heirTaxRatePct: no page, chart, CSV column, report block or drilldown reads the per-account breakdown; it is consumed only inside summarizeProjection to produce endingEstateHeirTax and endingEstateToCharity (Scenarios page) and endingAfterTaxEstate.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "EstateAccountBreakdown",
    "field": "heirTax",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-account estate breakdown heirTax. Searched planner-ui/src at pin fb398216 for estateBreakdown, grossBalance, taxablePretaxBase, charityAmount, netToHeirs, heirTax and heirTaxRatePct: no page, chart, CSV column, report block or drilldown reads the per-account breakdown; it is consumed only inside summarizeProjection to produce endingEstateHeirTax and endingEstateToCharity (Scenarios page) and endingAfterTaxEstate.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "EstateAccountBreakdown",
    "field": "heirTaxRatePct",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-account estate breakdown heirTaxRatePct. Searched planner-ui/src at pin fb398216 for estateBreakdown, grossBalance, taxablePretaxBase, charityAmount, netToHeirs, heirTax and heirTaxRatePct: no page, chart, CSV column, report block or drilldown reads the per-account breakdown; it is consumed only inside summarizeProjection to produce endingEstateHeirTax and endingEstateToCharity (Scenarios page) and endingAfterTaxEstate.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "EstateAccountBreakdown",
    "field": "netToHeirs",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-account estate breakdown netToHeirs. Searched planner-ui/src at pin fb398216 for estateBreakdown, grossBalance, taxablePretaxBase, charityAmount, netToHeirs, heirTax and heirTaxRatePct: no page, chart, CSV column, report block or drilldown reads the per-account breakdown; it is consumed only inside summarizeProjection to produce endingEstateHeirTax and endingEstateToCharity (Scenarios page) and endingAfterTaxEstate.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "EstateAccountBreakdown",
    "field": "taxablePretaxBase",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-account estate breakdown taxablePretaxBase. Searched planner-ui/src at pin fb398216 for estateBreakdown, grossBalance, taxablePretaxBase, charityAmount, netToHeirs, heirTax and heirTaxRatePct: no page, chart, CSV column, report block or drilldown reads the per-account breakdown; it is consumed only inside summarizeProjection to produce endingEstateHeirTax and endingEstateToCharity (Scenarios page) and endingAfterTaxEstate.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "averagePreRetirementSavingsRatePct",
    "disposition": "family",
    "familyId": "projection-summary-average-pre-retirement-savings-rate-pct",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "cash",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "coastFireNumber",
    "disposition": "family",
    "familyId": "projection-summary-coast-fire-number",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "longevity-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "projection-summary-ending-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "endingEstateHeirTax",
    "disposition": "family",
    "familyId": "estate-heir-income-tax",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "endingEstateToCharity",
    "disposition": "family",
    "familyId": "estate-to-charity",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "endingInvestable",
    "disposition": "family",
    "familyId": "projection-summary-ending-investable",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "endingNetWorth",
    "disposition": "family",
    "familyId": "projection-summary-ending-net-worth",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "fiAge",
    "disposition": "family",
    "familyId": "projection-summary-fi-age",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "fiNumber",
    "disposition": "family",
    "familyId": "projection-summary-fi-number",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "fiYear",
    "disposition": "family",
    "familyId": "projection-summary-fi-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "hsa",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "lifetimeRothConversions",
    "disposition": "family",
    "familyId": "projection-summary-lifetime-roth-conversions",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "lifetimeTaxesAndPenalties",
    "disposition": "family",
    "familyId": "projection-summary-lifetime-taxes-and-penalties",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "ratePct",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-year savings rate (contributions + match + surplus invested over gross income); only its pre-retirement average is displayed. Searched planner-ui/src for savingsRates: no consumer.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "roth",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "taxable",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "traditional",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "ProjectionSummary",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ProjectionSummary.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "module",
    "field": "charityPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.charityPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "summarizeProjection",
    "field": "fiAge",
    "disposition": "family",
    "familyId": "projection-summary-fi-age",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/compare.ts",
    "owner": "summarizeProjection",
    "field": "fiYear",
    "disposition": "family",
    "familyId": "projection-summary-fi-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "applicableSlcspPremium",
    "disposition": "family",
    "familyId": "aca-applicable-slcsp-premium-annual",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "convergence.iterations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Number of iterations the healthcare/ACA fixed-point solve took for the year; a solver diagnostic.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "convergence.maxIterations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Iteration cap of the healthcare/ACA fixed-point solve; a solver setting.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "convergence.residualDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Dollar residual of the healthcare/ACA fixed-point solve at exit; a solver diagnostic.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "coveredMembers[].applicableSlcspPremium",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-member SLCSP benchmark summed over the enrolled months; the year total is aca-applicable-slcsp-premium-annual; no planner-ui reader of the per-member split.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "coveredMembers[].coveredMonths",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar months (1-12) in which the covered member had a positive enrollment premium; a coordinate list.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "coveredMembers[].grossEnrollmentPremium",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-member sum of the contract's monthly enrollment premiums; the year total is aca-gross-enrollment-premium-annual; no planner-ui reader of the per-member split (examples/buildContext.ts constructs contract inputs, not results).",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "economicNetPremium",
    "disposition": "family",
    "familyId": "aca-economic-net-premium-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "federalPovertyLine",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Federal poverty line for the tax-family size and region (acaFederalPovertyLine, scaled); searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader; acaThresholdProximity.ts card evidence only.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "fplPct",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household MAGI as a percent of the federal poverty line; searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader; acaThresholdProximity.ts uses it to classify cliff proximity and prints it only as card evidence.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "grossEnrollmentPremium",
    "disposition": "family",
    "familyId": "aca-gross-enrollment-premium-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "householdMagi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Final return-year ACA household MAGI (buildAcaHouseholdMagi); searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader; consumed by insights/detectors/acaThresholdProximity.ts as a gate and as card evidence, which InsightCardView.tsx does not render.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "magiComponents.federalAgi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ACA MAGI component: federal AGI before the household floor; searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader; engine evidence of the MAGI composition.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "magiComponents.foreignExclusionAddback",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ACA MAGI component: foreign earned-income exclusion added back when known; searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "magiComponents.nontaxableSocialSecurity",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ACA MAGI component: gross minus taxable Social Security added back; searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "magiComponents.requiredFilerDependentMagi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ACA MAGI component: MAGI of dependents required to file; searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "magiComponents.taxExemptInterest",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ACA MAGI component: tax-exempt interest added back when known; searched planner-ui/src (reportModel.ts aca-ledger block and ReportPage.tsx print gross premium, benchmark premium, modeled credit and net premium only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "modeledAllowablePtc",
    "disposition": "family",
    "familyId": "aca-modeled-allowable-ptc-annual",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "taxFamilyMembers[].includedMagi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Dependent MAGI counted in household MAGI (max(0, magi) when required to file, else 0); no planner-ui reader; feeds magiComponents.requiredFilerDependentMagi.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "taxFamilyMembers[].magi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Per-member MAGI attested in the ACA year contract (dependents); a contract input echoed into the result.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/aca.ts",
    "owner": "YearAcaResult",
    "field": "taxFamilySize",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Number of tax-family members echoed from the ACA year contract (taxFamilyMembers.length); the FPL lookup's household size, a contract input.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "contributionsPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: allowed contributions leaving household cash; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "destinationTotalPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity destination total (funded uses + tax + penalties + contributions + surplus investment); searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "differencePlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "sourceTotalPlanDollars minus destinationTotalPlanDollars before display rounding; the conservation residual that decides cashIdentityMismatch; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "fundedHouseholdUsesPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: funded lifestyle, goal, debt, property, healthcare, insurance and care uses; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "loanProceedsPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: loan proceeds (HECM and other draws); searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "penaltiesPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: early-withdrawal penalties paid; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "portfolioFundingPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: portfolio withdrawals funding the year; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "settledTaxPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: settled tax paid from household cash; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "sourceTotalPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "spendableSourcesPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household-cash identity component: spendable (non-portfolio, non-loan) sources; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashIdentityTotals",
    "field": "surplusInvestmentPlanDollars",
    "disposition": "family",
    "familyId": "surplus-invested-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowCashSourceLine",
    "field": "amountPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowPostSolveDepositLine",
    "field": "amountPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowReconciliation",
    "field": "cashIdentityTolerancePlanDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Cash-conservation tolerance aligned with the annual funding fixed point; a reconciliation constant.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowReconciliation",
    "field": "tolerancePlanDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Strict structural tolerance for the line, use, transfer and lineage checks; a reconciliation constant.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowReconciliationDiagnostic",
    "field": "actualPlanDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Actual amount recorded on a reconciliation failure diagnostic; never rendered.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowReconciliationDiagnostic",
    "field": "differencePlanDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Expected minus actual on a reconciliation failure diagnostic; never rendered.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowReconciliationDiagnostic",
    "field": "expectedPlanDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Expected amount recorded on a reconciliation failure diagnostic; graphical consumers refuse a notReconciled year and detailCsv.ts writes only the reason codes.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowTaxCharacter",
    "field": "amountPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-tax-character-amount",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowTransferIdentityTotals",
    "field": "creditsPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowTransferIdentityTotals",
    "field": "debitsPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowTransferIdentityTotals",
    "field": "differencePlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "debitsPlanDollars minus creditsPlanDollars; the residual that decides transferIdentityMismatch; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowTransferLine",
    "field": "creditPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowTransferLine",
    "field": "debitPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseIdentityTotals",
    "field": "differencePlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "requestedUsesPlanDollars minus dispositionTotalPlanDollars; the residual that decides useIdentityMismatch; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseIdentityTotals",
    "field": "dispositionTotalPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "fundedUsesPlanDollars + unfundedUsesPlanDollars; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseIdentityTotals",
    "field": "fundedUsesPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseIdentityTotals",
    "field": "requestedUsesPlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sum of requested amounts over every use line; searched planner-ui/src/planner/yearCashFlow (YearCashFlowDialog.tsx SummaryStrip prints source total, funded uses, surplus and shortfall; YearCashFlowSankey.tsx chartAriaLabel adds transfer debits and credits; detailCsv.ts writes reason codes only): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseIdentityTotals",
    "field": "unfundedUsesPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseLine",
    "field": "fundedPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseLine",
    "field": "requestedPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/cashFlow.ts",
    "owner": "YearCashFlowUseLine",
    "field": "unfundedPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-line-plan-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ElectionYearOwnerRmdObligation",
    "field": "creditedAcceptedDistributionAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ElectionYearOwnerRmdObligation.creditedAcceptedDistributionAmount: owner-RMD obligation for a midyear spouse election year; searched planner-ui/src for electionYearOwnerRmdObligations: no consumer at the pin.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ElectionYearOwnerRmdObligation",
    "field": "requiredAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ElectionYearOwnerRmdObligation.requiredAmount: owner-RMD obligation for a midyear spouse election year; searched planner-ui/src for electionYearOwnerRmdObligations: no consumer at the pin.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ElectionYearOwnerRmdObligation",
    "field": "settledAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ElectionYearOwnerRmdObligation.settledAmount: owner-RMD obligation for a midyear spouse election year; searched planner-ui/src for electionYearOwnerRmdObligations: no consumer at the pin.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ElectionYearOwnerRmdObligation",
    "field": "unpaidAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ElectionYearOwnerRmdObligation.unpaidAmount: owner-RMD obligation for a midyear spouse election year; searched planner-ui/src for electionYearOwnerRmdObligations: no consumer at the pin.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ElectionYearOwnerRmdObligation",
    "field": "unsatisfiedAmount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ElectionYearOwnerRmdObligation.unsatisfiedAmount: owner-RMD obligation for a midyear spouse election year; searched planner-ui/src for electionYearOwnerRmdObligations: no consumer at the pin.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ProjectionResult",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "longevity-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ProjectionResult",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year; printed as the horizon on KPI and compare surfaces.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ProjectionResult",
    "field": "endingInvestable",
    "disposition": "family",
    "familyId": "projection-result-ending-investable",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ProjectionResult",
    "field": "endingNetWorth",
    "disposition": "family",
    "familyId": "projection-result-ending-net-worth",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ProjectionResult",
    "field": "endingNondeductibleIraBasis",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Remaining nondeductible IRA basis at the horizon. Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed by summarizeProjection via estateTraditionalTaxableBase (irc-408-d-2-estate-household-basis-allocation) when computing endingEstateHeirTax.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "ProjectionResult",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "First projection year; the coordinate every ledger surface starts from.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "aggregateRothConversionAllocationDesired",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Household conversion amount the aggregate allocation policy was asked for before the identity trim; published for the optimizer promotion path, never printed (rothConversion is what moved).",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "amt",
    "disposition": "family",
    "familyId": "tax-amt-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "balanceIndex",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "identifier",
    "reason": "Positional index of a physical owned-IRA balance row in the replay source.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "balancePlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Physical owned-IRA row balance published for source replay validation; no planner-ui surface prints it.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "capitalLossCarryforwardRemaining",
    "disposition": "family",
    "familyId": "tax-loss-carryforward-remaining-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "capitalLossUsedAgainstGains",
    "disposition": "family",
    "familyId": "tax-loss-carryforward-used-against-gains-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "capitalLossUsedAgainstOrdinary",
    "disposition": "family",
    "familyId": "tax-loss-carryforward-used-against-ordinary-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "contributions",
    "disposition": "family",
    "familyId": "year-result-contributions",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "deathBenefit",
    "disposition": "family",
    "familyId": "insurance-death-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "deferred",
    "disposition": "family",
    "familyId": "flexible-goals-deferred-count-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "employerMatch",
    "disposition": "family",
    "familyId": "year-result-employer-match",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "excessShortfall",
    "disposition": "family",
    "familyId": "spending-excess-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "funded",
    "disposition": "family",
    "familyId": "flexible-goals-funded-count-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "fundedAmount",
    "disposition": "family",
    "familyId": "flexible-goal-funded-amount-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "hecmDraw",
    "disposition": "family",
    "familyId": "hecm-draw-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "hecmLoanBalance",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Year-end HECM loan balance before the non-recourse floor. Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed by the engine netWorth computation (netted, capped at home value) and the HECM accrual in engine/src/projection/hecm.ts.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "idealShortfall",
    "disposition": "family",
    "familyId": "spending-ideal-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "inflationScale",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Cumulative general-inflation factor for the year; drives nominal conversions inside the engine and the QCD detector targets, never printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "inheritedDistribution",
    "disposition": "family",
    "familyId": "inherited-distribution-forced-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "inheritedTraditionalDistribution",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Traditional-only share of the forced inherited distribution. Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed by the engine ordinary-income and withdrawals.traditional composition.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "insuranceCashValue",
    "disposition": "family",
    "familyId": "insurance-cash-value-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "investableTotal",
    "disposition": "family",
    "familyId": "accounts-investable-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "irmaaLookbackMagi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI figure the IRMAA tier decision read (two-year lookback / SSA-44). Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed by engine evidence consumers only; no planner-ui page at the pin reads it (the MCP explain surface is not in the pinned tree).",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "irmaaLookbackMagiYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year whose MAGI the IRMAA lookback selected; positions irmaaLookbackMagi.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "irmaaNextTierThreshold",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI boundary for the next IRMAA tier. Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed by engine evidence consumers only; no planner-ui page at the pin reads it.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "irmaaSurcharge",
    "disposition": "family",
    "familyId": "irmaa-surcharge-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "irmaaTier",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "IRMAA tier index (0 = standard, 1-5 = surcharge tiers) is a classification of the year's MAGI against the thresholds; irmaa-surcharge-annual is the numeric family. Shown as a category on the scenarios page (annual \"IRMAA tier\", \"Maximum IRMAA tier\") and the survivor page (\"tier a → b\").",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "ladderValue",
    "disposition": "family",
    "familyId": "ladder-value-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "ltcgZeroHeadroom",
    "disposition": "family",
    "familyId": "year-result-ltcg-zero-headroom",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "magi",
    "disposition": "family",
    "familyId": "magi-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "medicarePremiums",
    "disposition": "family",
    "familyId": "medicare-premiums-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "netPortfolioNeed",
    "disposition": "family",
    "familyId": "portfolio-need-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "netWorth",
    "disposition": "family",
    "familyId": "accounts-net-worth-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "ownedNonRothIraContributions",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Employee contributions credited to owner-wide non-Roth IRA pools, published for replay proof; the Results table prints total contributions only.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "partiallyFunded",
    "disposition": "family",
    "familyId": "flexible-goals-partially-funded-count-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "penalties",
    "disposition": "family",
    "familyId": "tax-penalties-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "qcd",
    "disposition": "family",
    "familyId": "qcd-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "realizedGains",
    "disposition": "family",
    "familyId": "tax-realized-gains-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "requiredShortfall",
    "disposition": "family",
    "familyId": "spending-required-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "rmd",
    "disposition": "family",
    "familyId": "rmd-required-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "rmdShortfallExciseTax",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "IRC §4974 excise component of penalties; searched planner-ui/src: no surface prints it separately from penalties.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "rothConversion",
    "disposition": "family",
    "familyId": "roth-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "sepp",
    "disposition": "family",
    "familyId": "sepp-distribution-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "shortfall",
    "disposition": "family",
    "familyId": "spending-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "skipped",
    "disposition": "family",
    "familyId": "flexible-goals-skipped-count-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "ssEarningsTestWithheld",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Social Security benefits withheld by the retirement earnings test. Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed inside the engine socialSecurity stream activity (the paid amount net of withholding is what incomes.socialSecurity carries); the ssClaimMilestone detector reads it into card evidence, which InsightCardView does not render.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "ssdiPaid",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "SSDI paid this year. Searched planner-ui/src at pin fb398216 (pages, charts, CSV columns, report blocks, cash-flow drilldown line identities): not displayed; consumed as a component of incomes.socialSecurity; engine/src/socialSecurity/disability.ts records govern it.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "surplusInvested",
    "disposition": "family",
    "familyId": "surplus-invested-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "targetShortfall",
    "disposition": "family",
    "familyId": "spending-target-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "tax",
    "disposition": "family",
    "familyId": "tax-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "taxExemptInterest",
    "disposition": "family",
    "familyId": "year-result-tax-exempt-interest",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "taxableYield",
    "disposition": "family",
    "familyId": "income-taxable-yield-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "unfundedAmount",
    "disposition": "family",
    "familyId": "flexible-goal-unfunded-amount-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/result.ts",
    "owner": "YearResult",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The YearResult.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "PersonYearState",
    "field": "ageAttained",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Age attained in the calendar year (year minus birth year); printed as the age column on the ResultsPage.tsx and ReportPage.tsx year tables to place the row, not a computed amount.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "PersonYearState",
    "field": "lifeAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Effective last full year of life for the run, echoed from SimulateOptions.deathAgeByPersonId or plan longevity.planningAge so detectors can place the first deceased year; a planning input, not an output.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "baseSpending",
    "disposition": "family",
    "familyId": "spending-base-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "careCost",
    "disposition": "family",
    "familyId": "spending-care-cost-gross-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "debtService",
    "disposition": "family",
    "familyId": "spending-debt-service-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "excessSpending",
    "disposition": "family",
    "familyId": "spending-excess-requested-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "guardrailFactor",
    "disposition": "family",
    "familyId": "spending-guardrail-factor-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "healthcare",
    "disposition": "family",
    "familyId": "spending-healthcare-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "idealSpending",
    "disposition": "family",
    "familyId": "spending-ideal-requested-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "insurancePremiums",
    "disposition": "family",
    "familyId": "spending-insurance-premiums-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "intendedSpending",
    "disposition": "family",
    "familyId": "spending-intended-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "ltcBenefit",
    "disposition": "family",
    "familyId": "long-term-care-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "oneTimeGoals",
    "disposition": "family",
    "familyId": "spending-one-time-goals-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "propertyCosts",
    "disposition": "family",
    "familyId": "spending-property-costs-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "requiredSpending",
    "disposition": "family",
    "familyId": "spending-required-requested-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "targetSpending",
    "disposition": "family",
    "familyId": "spending-target-requested-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearExpenses",
    "field": "total",
    "disposition": "family",
    "familyId": "spending-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "annuity",
    "disposition": "family",
    "familyId": "income-annuity-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "oneTime",
    "disposition": "family",
    "familyId": "income-one-time-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "ordinaryDividends",
    "disposition": "family",
    "familyId": "income-ordinary-dividends-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "pension",
    "disposition": "family",
    "familyId": "income-pension-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "qualifiedDividends",
    "disposition": "family",
    "familyId": "income-qualified-dividends-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "recurring",
    "disposition": "family",
    "familyId": "income-recurring-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "socialSecurity",
    "disposition": "family",
    "familyId": "social-security-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "taxExemptInterest",
    "disposition": "family",
    "familyId": "year-result-tax-exempt-interest",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "taxableInterest",
    "disposition": "family",
    "familyId": "income-taxable-interest-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "taxableYield",
    "disposition": "family",
    "familyId": "income-taxable-yield-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "tipsLadder",
    "disposition": "family",
    "familyId": "income-tips-ladder-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "total",
    "disposition": "family",
    "familyId": "income-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearIncomes",
    "field": "wages",
    "disposition": "family",
    "familyId": "income-wages-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearWithdrawals",
    "field": "cash",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearWithdrawals",
    "field": "hsa",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearWithdrawals",
    "field": "roth",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearWithdrawals",
    "field": "taxable",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearWithdrawals",
    "field": "total",
    "disposition": "family",
    "familyId": "withdrawals-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/internal/types/yearLedger.ts",
    "owner": "YearWithdrawals",
    "field": "traditional",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "AcaActionabilityVeto",
    "field": "baselineNonActionableYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "List of years whose ACA evidence was non-actionable in the baseline; printed as a veto explanation, not a quantity.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "AcaActionabilityVeto",
    "field": "candidateNonActionableYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "List of years whose ACA evidence was non-actionable in the candidate; printed as a veto explanation, not a quantity.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ClaimAgeCoOptimization",
    "field": "combinationsEvaluated",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-combinations-evaluated",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ClaimAgeCoOptimization",
    "field": "currentClaimExactEstate",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-current-claim-exact-estate",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ClaimAgeCoOptimization",
    "field": "incompleteComputationYears",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-incomplete-computation-years",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ClaimAgeCoOptimization",
    "field": "jointExactEstate",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-joint-exact-estate",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceDiagnostics",
    "field": "estateGainOverFirstSolveDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "After-tax estate gained by iterating the exact-ledger solve beyond the first pass; a convergence diagnostic the optimize page does not print.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceDiagnostics",
    "field": "finalMaxYearMoveDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Largest single-year schedule move in the final convergence iteration; a convergence diagnostic the optimize page does not print.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceDiagnostics",
    "field": "iterations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of exact-ledger convergence iterations run; effort, not a plan quantity.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceOptions",
    "field": "dampingFactor",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerConvergenceOptions.dampingFactor field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceOptions",
    "field": "maxIterations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerConvergenceOptions.maxIterations field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceOptions",
    "field": "maxYearStepDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerConvergenceOptions.maxYearStepDollars field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceOptions",
    "field": "objectiveToleranceDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerConvergenceOptions.objectiveToleranceDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerConvergenceOptions",
    "field": "scheduleToleranceDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerConvergenceOptions.scheduleToleranceDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerPostProcessing",
    "field": "iterationCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Post-processing iterations run; effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerPostProcessing",
    "field": "minimumRequestedConversionDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Minimum requested conversion the post-processor keeps; a threshold constant.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerPostProcessing",
    "field": "pruneIterationCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Post-processing prune iterations run; effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerPostProcessingOptions",
    "field": "maxIterations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerPostProcessingOptions.maxIterations field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerPostProcessingOptions",
    "field": "maxPruneIterations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerPostProcessingOptions.maxPruneIterations field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerScheduleAdjustment",
    "field": "cleaned",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerScheduleAdjustment",
    "field": "executed",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerScheduleAdjustment",
    "field": "requested",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerScheduleAdjustment",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerScheduleAdjustment.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerScheduleIdentity",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerScheduleIdentity",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerScheduleIdentity.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerSearchOptions",
    "field": "maxSimulations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerSearchOptions.maxSimulations field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerTournament",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerTournament",
    "field": "incompleteComputationYears",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-incomplete-computation-years",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerTournament",
    "field": "marginOverMilpDollars",
    "disposition": "family",
    "familyId": "exact-ledger-tournament-margin-over-milp-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerTournament",
    "field": "searchSimulations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of ledger simulations the tournament ran; effort.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerTournament",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerTournament.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "afterTaxEstateDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-after-tax-estate-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "endingNetWorthDelta",
    "disposition": "family",
    "familyId": "exact-ledger-validation-ending-net-worth-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "executedConversionRatio",
    "disposition": "family",
    "familyId": "exact-ledger-validation-executed-conversion-ratio",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "executedConversionTotal",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-executed-conversion-total",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "firstMateriallyUnexecutedYear",
    "disposition": "family",
    "familyId": "exact-ledger-validation-first-materially-unexecuted-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "incompleteComputationYears",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-incomplete-computation-years",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "lifetimeTaxDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "moneyLastsYearsDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-money-lasts-years-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "requestedConversionTotal",
    "disposition": "family",
    "familyId": "exact-ledger-validation-requested-conversion-total",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidation",
    "field": "traditionalDepletionYear",
    "disposition": "family",
    "familyId": "exact-ledger-validation-traditional-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidationOptions",
    "field": "materialConversionShortfallDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.materialConversionShortfallDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidationOptions",
    "field": "materialConversionShortfallPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.materialConversionShortfallPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidationOptions",
    "field": "minimumRequestedConversionDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.minimumRequestedConversionDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "ExactLedgerValidationOptions",
    "field": "neutralToleranceDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.neutralToleranceDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizePlanOptions",
    "field": "liquidationRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The OptimizePlanOptions.liquidationRatePct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizePlanOptions",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The OptimizePlanOptions.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizerOpeningBuckets",
    "field": "openingInheritedTrad",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Opening inheritedtrad bucket balance the MILP is seeded with; internal solver input never printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizerOpeningBuckets",
    "field": "openingOther",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Opening other bucket balance the MILP is seeded with; internal solver input never printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizerOpeningBuckets",
    "field": "openingTaxable",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Opening taxable bucket balance the MILP is seeded with; internal solver input never printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizerOpeningBuckets",
    "field": "openingTrad",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Opening trad bucket balance the MILP is seeded with; internal solver input never printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "OptimizerOpeningBuckets",
    "field": "taxableBasisRatio",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Cost basis over balance of the taxable bucket the MILP opens with; internal solver input never printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "PromotedWinner",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "PromotedWinner",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The PromotedWinner.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotion",
    "field": "amount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Promoted per-owner conversion amount; consumed by the retirement-action promotion path, not printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotion",
    "field": "incompleteComputationYears",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-incomplete-computation-years",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotion",
    "field": "marginOverMilpDollars",
    "disposition": "family",
    "familyId": "exact-ledger-tournament-margin-over-milp-dollars",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotion",
    "field": "searchSimulations",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Number of optimizer search simulations run for the promoted candidate; a runtime diagnostic shown in the explain panel, not a financial output.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotion",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The RetirementActionPromotion.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotionYear",
    "field": "allocatedCents",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Owner-allocation promotion evidence (allocatedCents) for a scheduled conversion year; consumed by the retirement-action promotion path, not printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotionYear",
    "field": "askedCents",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Owner-allocation promotion evidence (askedCents) for a scheduled conversion year; consumed by the retirement-action promotion path, not printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotionYear",
    "field": "slicePlanDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Owner-allocation promotion evidence (slicePlanDollars) for a scheduled conversion year; consumed by the retirement-action promotion path, not printed.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionPromotionYear",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The RetirementActionPromotionYear.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionReadinessVeto",
    "field": "amount",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Conversion amount of the year that tripped the retirement-action readiness veto; the optimize page prints the veto reason, not the amount.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RetirementActionReadinessVeto",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The RetirementActionReadinessVeto.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RichCandidate",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "RichCandidate",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The RichCandidate.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "SimpleCandidateEvaluation",
    "field": "afterTaxEstateDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-after-tax-estate-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "SimpleCandidateEvaluation",
    "field": "executedConversionTotal",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-executed-conversion-total",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "SimpleCandidateEvaluation",
    "field": "incompleteComputationYears",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-incomplete-computation-years",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "SimpleCandidateEvaluation",
    "field": "lifetimeTaxDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "SimpleCandidateEvaluation",
    "field": "moneyLastsYearsDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-money-lasts-years-delta",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "buildAcaActionabilityVeto",
    "field": "years",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The buildAcaActionabilityVeto.years field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "evaluateExactLedgerSchedule",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "evaluateExactLedgerSchedule",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The evaluateExactLedgerSchedule.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "evaluateIdentityCompleteLedgerSchedule",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "evaluateIdentityCompleteLedgerSchedule",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The evaluateIdentityCompleteLedgerSchedule.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.amount field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "annualReturnPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.annualReturnPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "balance",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.balance field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "estate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.estate field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "incompleteComputationYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.incompleteComputationYears field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "inheritedTrad",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.inheritedTrad field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "other",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.other field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "publicationFloorDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "Dollar floor below which a schedule year is not published; a constant.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "rate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.rate field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "taxable",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.taxable field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "toleranceDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.toleranceDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "trad",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.trad field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "width",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.width field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "module",
    "field": "years",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.years field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "optimizerOpeningBuckets",
    "field": "balance",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The optimizerOpeningBuckets.balance field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "optimizerOpeningBuckets",
    "field": "costBasis",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The optimizerOpeningBuckets.costBasis field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "postProcessExactLedgerSchedule",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "postProcessExactLedgerSchedule",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The postProcessExactLedgerSchedule.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "runExactLedgerTournament",
    "field": "switchMarginDollars",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The runExactLedgerTournament.switchMarginDollars field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "withOptimizedConversions",
    "field": "amount",
    "disposition": "family",
    "familyId": "optimizer-recommended-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/optimizePlan.ts",
    "owner": "withOptimizedConversions",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The withOptimizedConversions.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidate",
    "field": "localRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Flat local income-tax rate (percent) in the destination replacing the plan's localIncomeTaxPct; omitted means 0.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidate",
    "field": "moveMonth",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Move month (1-12) for the split year, default July.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidate",
    "field": "moveYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Calendar year of the move (split-year taxed); omitted means resident from the start.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidate",
    "field": "spendingDeltaPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Flat cost-of-living change (percent) applied to baseline lifestyle spending plan-wide.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "longevity-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year of the row; RelocationComparePage.tsx uses it as the deflation anchor for the ending estate (relocation-tax-comparison).",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "projection-summary-ending-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "endingNetWorth",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Ending net worth of the candidate projection (summary.endingNetWorth); searched planner-ui/src (RelocationComparePage.tsx prints state+local tax, lifetime taxes and penalties, ending after-tax estate, success and depletion; relocation/runRelocation.ts forwards the comparison): no reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "lifetimeStateLocalTax",
    "disposition": "family",
    "familyId": "relocation-lifetime-state-local-tax",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "lifetimeTaxesAndPenalties",
    "disposition": "family",
    "familyId": "projection-summary-lifetime-taxes-and-penalties",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "stateTaxByYear[].tax",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Per-year state+local income tax line of the candidate ledger (nominal); not printed per year (RelocationComparePage.tsx prints the lifetime sum, relocation-lifetime-state-local-tax); consumed by insights/detectors/stateRelocation.ts evaluate, which deflates the per-year delta between staying and the best candidate into insight-state-relocation-lifetime-state-tax-savings.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "stateTaxByYear[].year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of each per-year state+local tax line.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCandidateRow",
    "field": "successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCompareOptions",
    "field": "monteCarlo.pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Requested shared-path count for the optional Monte Carlo success column.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCompareOptions",
    "field": "monteCarlo.seed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Requested seed for the shared market paths.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationCompareOptions",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Projection start year argument of compareRelocationCandidates.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationComparison",
    "field": "monteCarlo.pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of shared market paths behind the success column; printed as 'the same N paths' on RelocationComparePage.tsx.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationComparison",
    "field": "monteCarlo.seed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Seed of the shared market paths; a reproducibility diagnostic.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationComparison",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Projection start year shared by every row.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDriverFacts",
    "field": "capitalGainsTaxablePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "State parameter-pack fact: percent of net capital gain in the state base; printed in the drivers panel prose on RelocationComparePage.tsx ('X% of net gains in the state base'), a rule constant rather than a computed output.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDriverFacts",
    "field": "topRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "internal-coefficient",
    "reason": "State parameter-pack fact: top marginal bracket rate (married filing jointly, percent); printed in the drivers panel prose on RelocationComparePage.tsx ('rate X%'), a rule constant rather than a computed output.",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDrivers",
    "field": "capitalGainsTreatmentSavings",
    "disposition": "family",
    "familyId": "relocation-state-tax-driver-savings",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDrivers",
    "field": "publicPensionExclusionSavings",
    "disposition": "family",
    "familyId": "relocation-state-tax-driver-savings",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDrivers",
    "field": "retirementExclusionSavings",
    "disposition": "family",
    "familyId": "relocation-state-tax-driver-savings",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDrivers",
    "field": "ssTreatmentSavings",
    "disposition": "family",
    "familyId": "relocation-state-tax-driver-savings",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "RelocationDrivers",
    "field": "totalStateLocalTax",
    "disposition": "family",
    "familyId": "relocation-lifetime-state-local-tax",
    "tsType": "number"
  },
  {
    "source": "engine/src/projection/relocation.ts",
    "owner": "module",
    "field": "MAX_RELOCATION_CANDIDATES",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Cap (5) on candidate states per comparison; a run-size bound.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "acaEconomicNetPremium",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "YearAcaResult.economicNetPremium of the year (0 when no ACA result); ScenariosPage.tsx ANNUAL_METRICS does not list this key (searched): no reader; AnnualComparisonValue maps the same key to a NullableScalarComparison per year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "acaGrossEnrollmentPremium",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "YearAcaResult.grossEnrollmentPremium of the year (0 when no ACA result); ScenariosPage.tsx ANNUAL_METRICS does not list this key (searched): no reader; AnnualComparisonValue maps the same key to a NullableScalarComparison per year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "acaModeledAllowablePtc",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "YearAcaResult.modeledAllowablePtc of the year (0 when null); ScenariosPage.tsx ANNUAL_METRICS does not list this key (searched): no reader; AnnualComparisonValue maps the same key to a NullableScalarComparison per year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "income",
    "disposition": "family",
    "familyId": "income-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "inheritedDistribution",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Forced inherited distribution of the year (YearResult.inheritedDistribution); its lifetime sum feeds ScenarioWithdrawalComparison.inherited; ScenariosPage.tsx ANNUAL_METRICS does not list this key (searched): no reader; AnnualComparisonValue maps the same key to a NullableScalarComparison per year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "inheritedRequired",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sum of inheritedAccounts[].executedRequiredAmount for the year; ScenariosPage.tsx ANNUAL_METRICS does not list this key (searched): no reader; AnnualComparisonValue maps the same key to a NullableScalarComparison per year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "inheritedVoluntary",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sum of inheritedAccounts[].voluntaryAmount for the year; ScenariosPage.tsx ANNUAL_METRICS does not list this key (searched): no reader; AnnualComparisonValue maps the same key to a NullableScalarComparison per year.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "investable",
    "disposition": "family",
    "familyId": "accounts-investable-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "irmaaSurcharge",
    "disposition": "family",
    "familyId": "irmaa-surcharge-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "irmaaTier",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "IRMAA tier index of the year (YearResult.irmaaTier); a classification, printed as 'IRMAA tier' in the annual ledger comparison.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "magi",
    "disposition": "family",
    "familyId": "magi-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "medicarePremiums",
    "disposition": "family",
    "familyId": "medicare-premiums-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "netWorth",
    "disposition": "family",
    "familyId": "accounts-net-worth-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "penalties",
    "disposition": "family",
    "familyId": "tax-penalties-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "qcd",
    "disposition": "family",
    "familyId": "qcd-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "requiredShortfall",
    "disposition": "family",
    "familyId": "spending-required-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "rmd",
    "disposition": "family",
    "familyId": "rmd-required-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "rothConversion",
    "disposition": "family",
    "familyId": "roth-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "rothWithdrawals",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "shortfall",
    "disposition": "family",
    "familyId": "spending-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "spendingFunded",
    "disposition": "family",
    "familyId": "spending-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "spendingIntended",
    "disposition": "family",
    "familyId": "spending-intended-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "targetShortfall",
    "disposition": "family",
    "familyId": "spending-target-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "tax",
    "disposition": "family",
    "familyId": "tax-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "taxExemptInterest",
    "disposition": "family",
    "familyId": "year-result-tax-exempt-interest",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "traditionalWithdrawals",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualComparisonValues",
    "field": "withdrawals",
    "disposition": "family",
    "familyId": "withdrawals-total-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "AnnualScenarioComparisonRow",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of the annual ledger comparison row (union of both plans' years).",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ComparisonProvenance",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Start year the comparison was run at; scenarioComparisonView.ts uses it only to test whether a cached comparison is current.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "NullableScalarComparison",
    "field": "baseline",
    "disposition": "family",
    "familyId": "scenario-comparison-cell",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "NullableScalarComparison",
    "field": "delta",
    "disposition": "family",
    "familyId": "scenario-comparison-cell",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "NullableScalarComparison",
    "field": "proposal",
    "disposition": "family",
    "familyId": "scenario-comparison-cell",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScalarComparison",
    "field": "baseline",
    "disposition": "family",
    "familyId": "scenario-comparison-cell",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScalarComparison",
    "field": "delta",
    "disposition": "family",
    "familyId": "scenario-comparison-cell",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScalarComparison",
    "field": "proposal",
    "disposition": "family",
    "familyId": "scenario-comparison-cell",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioAcaComparison",
    "field": "actionableYears",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Count of years whose YearAcaResult.readiness is 'actionable' for baseline and proposal; ScenariosPage.tsx renders no ACA comparison table (searched for comparison.aca: none) and the annual ledger omits the ACA keys: no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioAcaComparison",
    "field": "economicNetPremium",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearAcaResult.economicNetPremium for baseline and proposal; ScenariosPage.tsx renders no ACA comparison table (searched for comparison.aca: none) and the annual ledger omits the ACA keys: no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioAcaComparison",
    "field": "grossEnrollmentPremium",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearAcaResult.grossEnrollmentPremium for baseline and proposal; ScenariosPage.tsx renders no ACA comparison table (searched for comparison.aca: none) and the annual ledger omits the ACA keys: no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioAcaComparison",
    "field": "modeledAllowablePtc",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearAcaResult.modeledAllowablePtc for baseline and proposal; ScenariosPage.tsx renders no ACA comparison table (searched for comparison.aca: none) and the annual ledger omits the ACA keys: no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioAcaComparison",
    "field": "nonActionableYears",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Count of years whose YearAcaResult.readiness is 'nonActionable' for baseline and proposal; ScenariosPage.tsx renders no ACA comparison table (searched for comparison.aca: none) and the annual ledger omits the ACA keys: no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "afterTaxEstate",
    "disposition": "family",
    "familyId": "projection-summary-ending-after-tax-estate",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "byCategory.cash",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "byCategory.hsa",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "byCategory.roth",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "byCategory.taxable",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "byCategory.traditional",
    "disposition": "family",
    "familyId": "accounts-ending-balance-by-category",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "charity",
    "disposition": "family",
    "familyId": "estate-to-charity",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "grossNetWorth",
    "disposition": "family",
    "familyId": "projection-summary-ending-net-worth",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioEstateComparison",
    "field": "heirTax",
    "disposition": "family",
    "familyId": "estate-heir-income-tax",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "longevity-depletion-year",
    "tsType": "NullableScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "projection-summary-ending-after-tax-estate",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "endingInvestable",
    "disposition": "family",
    "familyId": "projection-summary-ending-investable",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "endingNetWorth",
    "disposition": "family",
    "familyId": "projection-summary-ending-net-worth",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "lifetimePenalties",
    "disposition": "family",
    "familyId": "scenario-lifetime-penalties",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "lifetimeTax",
    "disposition": "family",
    "familyId": "scenario-lifetime-tax",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "lifetimeTaxesAndPenalties",
    "disposition": "family",
    "familyId": "projection-summary-lifetime-taxes-and-penalties",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioHeadlineComparison",
    "field": "projectionEndYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year of each plan; printed as \"Projection end year\".",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "annuity",
    "disposition": "family",
    "familyId": "income-annuity-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "oneTime",
    "disposition": "family",
    "familyId": "income-one-time-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "ordinaryDividends",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearIncomes.ordinaryDividends for baseline and proposal; ScenariosPage.tsx's 'Lifetime gross income by source' table does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "pension",
    "disposition": "family",
    "familyId": "income-pension-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "qualifiedDividends",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearIncomes.qualifiedDividends for baseline and proposal; ScenariosPage.tsx's 'Lifetime gross income by source' table does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "recurring",
    "disposition": "family",
    "familyId": "income-recurring-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "socialSecurity",
    "disposition": "family",
    "familyId": "social-security-benefit-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "taxExemptInterest",
    "disposition": "family",
    "familyId": "year-result-tax-exempt-interest",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "taxableInterest",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearIncomes.taxableInterest for baseline and proposal; ScenariosPage.tsx's 'Lifetime gross income by source' table does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "taxableYield",
    "disposition": "family",
    "familyId": "income-taxable-yield-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "tipsLadder",
    "disposition": "family",
    "familyId": "income-tips-ladder-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "total",
    "disposition": "family",
    "familyId": "income-total-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIncomeComparison",
    "field": "wages",
    "disposition": "family",
    "familyId": "income-wages-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIrmaaComparison",
    "field": "maxTier",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "Highest IRMAA tier index reached; a classification (see YearResult.irmaaTier), shown as \"Maximum IRMAA tier\".",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIrmaaComparison",
    "field": "surcharge",
    "disposition": "family",
    "familyId": "irmaa-surcharge-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIrmaaComparison",
    "field": "surchargeTierYears",
    "disposition": "family",
    "familyId": "scenario-irmaa-surcharge-tier-years",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioIrmaaComparison",
    "field": "totalMedicarePremiums",
    "disposition": "family",
    "familyId": "medicare-premiums-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioPlanComparisonOptions",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Projection start year argument of compareScenarioPlans (must be an integer).",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioPlanComparisonOptions",
    "field": "stochastic.pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Requested shared-path count for the optional risk comparison; a run-size setting.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioPlanComparisonOptions",
    "field": "stochastic.seed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Requested seed for the shared market paths; a reproducibility diagnostic.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "averageRequiredShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MonteCarloSummary.spendingShortfall.averageRequiredShortfallDollars for baseline and proposal on shared paths; ScenariosPage.tsx's risk MetricTable does not list it (searched the rows array): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "averageTargetShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MonteCarloSummary.spendingShortfall.averageTargetShortfallDollars for baseline and proposal on shared paths; ScenariosPage.tsx's risk MetricTable does not list it (searched the rows array): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "averageTotalShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-average-total-shortfall",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "depletionProbabilityByYear[].cumulativeProbability",
    "disposition": "family",
    "familyId": "monte-carlo-depletion-probability-by-year",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "depletionProbabilityByYear[].year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of each cumulative depletion probability row (union of both plans' depletion years).",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "estateP10",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "estateP50",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "estateP90",
    "disposition": "family",
    "familyId": "monte-carlo-ending-after-tax-estate-percentiles",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "expectedRequiredShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MonteCarloSummary.downsideRisk.expectedRequiredShortfallDollars for baseline and proposal on shared paths; ScenariosPage.tsx's risk MetricTable does not list it (searched the rows array): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "expectedShortfallDollars",
    "disposition": "family",
    "familyId": "monte-carlo-expected-shortfall-on-failing-paths",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "expectedTargetShortfallDollars",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MonteCarloSummary.downsideRisk.expectedTargetShortfallDollars for baseline and proposal on shared paths; ScenariosPage.tsx's risk MetricTable does not list it (searched the rows array): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "medianMaxCutDepth",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MonteCarloSummary.adjustments.medianMaxCutDepth for baseline and proposal on shared paths; ScenariosPage.tsx's risk MetricTable does not list it (searched the rows array): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "p90MaxCutDepth",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MonteCarloSummary.adjustments.p90MaxCutDepth for baseline and proposal on shared paths; ScenariosPage.tsx's risk MetricTable does not list it (searched the rows array): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "probabilityOfAdjustment",
    "disposition": "family",
    "familyId": "monte-carlo-paths-with-cut-share",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "provenance.pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of shared market paths; printed in the risk caption 'N paths, seed S'.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "provenance.seed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Seed of the shared market paths; printed in the risk caption 'N paths, seed S' as provenance.",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "requiredFloorSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-required-floor-success-rate",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "targetAttainmentP50",
    "disposition": "family",
    "familyId": "monte-carlo-target-attainment-median",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioRiskComparison",
    "field": "targetLifestyleSuccessRate",
    "disposition": "family",
    "familyId": "monte-carlo-target-lifestyle-success-rate",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityComparison",
    "field": "baselineSimulationCount",
    "disposition": "family",
    "familyId": "sustainable-spending-result-simulation-count",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityComparison",
    "field": "maxBaseAnnual",
    "disposition": "family",
    "familyId": "sustainable-spending-result-max-base-annual",
    "tsType": "NullableScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityComparison",
    "field": "proposalSimulationCount",
    "disposition": "family",
    "familyId": "sustainable-spending-result-simulation-count",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityComparison",
    "field": "spendingSlack",
    "disposition": "family",
    "familyId": "sustainable-spending-result-spending-slack-dollars",
    "tsType": "NullableScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityResult",
    "field": "maxBaseAnnual",
    "disposition": "family",
    "familyId": "sustainable-spending-result-max-base-annual",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityResult",
    "field": "simulationCount",
    "disposition": "family",
    "familyId": "sustainable-spending-result-simulation-count",
    "tsType": "number"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingCapacityResult",
    "field": "spendingSlackDollars",
    "disposition": "family",
    "familyId": "sustainable-spending-result-spending-slack-dollars",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "excessShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearResult.excessShortfall for baseline and proposal; ScenariosPage.tsx's spending table does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "funded",
    "disposition": "family",
    "familyId": "spending-total-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "idealShortfall",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearResult.idealShortfall for baseline and proposal; ScenariosPage.tsx's spending table does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "intended",
    "disposition": "family",
    "familyId": "spending-intended-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "requiredShortfall",
    "disposition": "family",
    "familyId": "spending-required-shortfall-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "targetShortfall",
    "disposition": "family",
    "familyId": "spending-target-shortfall-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioSpendingComparison",
    "field": "totalShortfall",
    "disposition": "family",
    "familyId": "spending-shortfall-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "cash",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "hsa",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "inherited",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearResult.inheritedDistribution (forced inherited distributions) for baseline and proposal; ScenariosPage.tsx's 'Lifetime withdrawals by source' table does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "qcd",
    "disposition": "family",
    "familyId": "qcd-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "rmd",
    "disposition": "family",
    "familyId": "rmd-required-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "roth",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "rothConversions",
    "disposition": "family",
    "familyId": "roth-conversion-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "taxable",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "total",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Lifetime sum of YearWithdrawals.total for baseline and proposal; ScenariosPage.tsx's 'Lifetime withdrawals by source' table (the annual ledger prints the per-year total instead) does not list it (searched the MetricTable rows arrays): no reader.",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/scenarios/comparison.ts",
    "owner": "ScenarioWithdrawalComparison",
    "field": "traditional",
    "disposition": "family",
    "familyId": "withdrawals-by-category-annual",
    "tsType": "ScalarComparison"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiInput",
    "field": "dependents[].magi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Dependent MAGI attested in the ACA year contract; an input.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiInput",
    "field": "federalAgi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Federal AGI (signed, before the household floor) passed into buildAcaHouseholdMagi from the federal probe.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiInput",
    "field": "foreignExclusionAddback.amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Attested foreign earned-income exclusion amount with its state; a contract input.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiInput",
    "field": "grossSocialSecurity",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Gross Social Security benefits passed into buildAcaHouseholdMagi.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiInput",
    "field": "taxExemptInterest.amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Attested or plan-generated tax-exempt interest amount with its known/notApplicable/unknown state; an input.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiInput",
    "field": "taxableSocialSecurity",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Taxable Social Security from the federal probe passed into buildAcaHouseholdMagi.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "components.federalAgi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI component (federal AGI); published as YearAcaResult.magiComponents.federalAgi; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "components.foreignExclusionAddback",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI component (foreign exclusion addback when known, else 0); published as YearAcaResult.magiComponents.foreignExclusionAddback; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "components.nontaxableSocialSecurity",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI component max(0, gross minus taxable Social Security); published as YearAcaResult.magiComponents.nontaxableSocialSecurity; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "components.requiredFilerDependentMagi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI component (sum of includedMagi over dependents); published as YearAcaResult.magiComponents.requiredFilerDependentMagi; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "components.taxExemptInterest",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI component (tax-exempt interest when known, else 0); published as YearAcaResult.magiComponents.taxExemptInterest; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "dependents[].includedMagi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Dependent MAGI included in household MAGI (max(0, magi) when required to file, else 0); published per member as YearAcaResult.taxFamilyMembers[].includedMagi; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "dependents[].magi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Dependent MAGI echoed from the input into the result.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaHouseholdMagiResult",
    "field": "magi",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "ACA household MAGI, max(0, sum of the components) when no blocker applies; published as YearAcaResult.householdMagi; no planner-ui reader.",
    "tsType": "number | null"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "applicableSlcspPremium",
    "disposition": "family",
    "familyId": "aca-applicable-slcsp-premium-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "credit",
    "disposition": "family",
    "familyId": "aca-modeled-allowable-ptc-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "economicNetPremium",
    "disposition": "family",
    "familyId": "aca-economic-net-premium-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "expectedContribution",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Expected annual contribution toward the benchmark premium (applicable percentage / 100 × MAGI); an intermediate of the credit that YearAcaResult does not publish; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "fplPct",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "MAGI as a percent of the FPL computed by acaEconomicPremiumByMonth (magi / fpl × 100); published as YearAcaResult.fplPct; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "grossEnrollmentPremium",
    "disposition": "family",
    "familyId": "aca-gross-enrollment-premium-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "modeledAllowablePtc",
    "disposition": "family",
    "familyId": "aca-modeled-allowable-ptc-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "AcaResult",
    "field": "netAnnualPremium",
    "disposition": "family",
    "familyId": "aca-economic-net-premium-annual",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaApplicablePct",
    "field": "fplPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "FPL percentage argument of acaApplicablePct.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaApplicablePct",
    "field": "return",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Applicable contribution percentage, piecewise-linear between the pack breakpoints with the statutory step at 133% FPL; an intermediate of expectedContribution that nothing publishes; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaEconomicPremiumByMonth",
    "field": "enrollmentPremiums",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Monthly enrollment premiums (12 entries) argument of acaEconomicPremiumByMonth.",
    "tsType": "readonly number[]"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaEconomicPremiumByMonth",
    "field": "fplScale",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "fplScale argument of acaEconomicPremiumByMonth.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaEconomicPremiumByMonth",
    "field": "householdSize",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "householdSize argument of acaEconomicPremiumByMonth.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaEconomicPremiumByMonth",
    "field": "magi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "magi argument of acaEconomicPremiumByMonth.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaEconomicPremiumByMonth",
    "field": "slcspBenchmarkPremiums",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Monthly SLCSP benchmark premiums argument of acaEconomicPremiumByMonth.",
    "tsType": "readonly number[]"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaFederalPovertyLine",
    "field": "fplScale",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "FPL inflation scale argument of acaFederalPovertyLine (default 1).",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaFederalPovertyLine",
    "field": "householdSize",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Tax-family size argument of acaFederalPovertyLine.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaFederalPovertyLine",
    "field": "return",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Federal poverty line: (firstPerson + perAdditionalPerson × max(0, size − 1)) × scale from the parameter pack for the region; published as YearAcaResult.federalPovertyLine; no planner-ui reader.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremium",
    "field": "fplScale",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "fplScale argument of the backward-compatible annual helper acaNetAnnualPremium.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremium",
    "field": "fullAnnualPremium",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "fullAnnualPremium argument of the backward-compatible annual helper acaNetAnnualPremium.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremium",
    "field": "householdSize",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "householdSize argument of the backward-compatible annual helper acaNetAnnualPremium.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremium",
    "field": "magi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "magi argument of the backward-compatible annual helper acaNetAnnualPremium.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremiumByMonth",
    "field": "fplScale",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "fplScale argument of the backward-compatible monthly helper acaNetAnnualPremiumByMonth.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremiumByMonth",
    "field": "householdSize",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "householdSize argument of the backward-compatible monthly helper acaNetAnnualPremiumByMonth.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremiumByMonth",
    "field": "magi",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "magi argument of the backward-compatible monthly helper acaNetAnnualPremiumByMonth.",
    "tsType": "number"
  },
  {
    "source": "engine/src/tax/aca.ts",
    "owner": "acaNetAnnualPremiumByMonth",
    "field": "monthlyPremiums",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Monthly premiums argument of acaNetAnnualPremiumByMonth (used as both enrollment and benchmark).",
    "tsType": "readonly number[]"
  },
  {
    "source": "planner-ui/src/planner/ComparePlansPage.tsx",
    "owner": "module",
    "field": "delta",
    "disposition": "family",
    "familyId": "compare-plan-money-deltas",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/ComparePlansPage.tsx",
    "owner": "module",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.endYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ComparePlansPage.tsx",
    "owner": "module",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ComparePlansPage.tsx",
    "owner": "module",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "ModelKind",
    "field": "pathCount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ModelKind.pathCount field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "ModelKind",
    "field": "rate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ModelKind.rate field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "equityWeightPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Market-model equity weight chosen in the page controls; a run setting, not an output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "histRows.label",
    "disposition": "family",
    "familyId": "display-histogram-bin-label",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "p10",
    "disposition": "family",
    "familyId": "display-fan-band-widths",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "p25",
    "disposition": "family",
    "familyId": "display-fan-band-widths",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "p75",
    "disposition": "family",
    "familyId": "display-fan-band-widths",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "p90",
    "disposition": "family",
    "familyId": "display-fan-band-widths",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "paths",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Path count the page passes to the pool; a run-size setting printed beside results.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/MonteCarloPage.tsx",
    "owner": "MonteCarloPage",
    "field": "seed",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPage.seed field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/OptimizePage.tsx",
    "owner": "OptimizePage",
    "field": "rawConversions",
    "disposition": "family",
    "familyId": "optimizer-schedule-conversion-total",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/OptimizePage.tsx",
    "owner": "OptimizePage",
    "field": "totalConversions",
    "disposition": "family",
    "familyId": "optimizer-schedule-conversion-total",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/OptimizePage.tsx",
    "owner": "module",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/RelocationComparePage.tsx",
    "owner": "CandidateDraft",
    "field": "localRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The CandidateDraft.localRatePct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/RelocationComparePage.tsx",
    "owner": "CandidateDraft",
    "field": "moveYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The CandidateDraft.moveYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/RelocationComparePage.tsx",
    "owner": "CandidateDraft",
    "field": "spendingDeltaPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The CandidateDraft.spendingDeltaPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/RelocationComparePage.tsx",
    "owner": "RelocationComparePage",
    "field": "amount",
    "disposition": "family",
    "familyId": "relocation-tax-comparison",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "FlowViewParam",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The FlowViewParam.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "InheritedSchedulesSection",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Projection start year prop of the inherited schedules section.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "InheritedSchedulesSection",
    "field": "v",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Formatter or tick callback parameter in InheritedSchedulesSection; not a quantity.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "InheritedSchedulesSection",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The InheritedSchedulesSection.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "ResultsPage",
    "field": "guardrailThresholdDollars",
    "disposition": "family",
    "familyId": "display-guardrail-balance-thresholds",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "ResultsPage",
    "field": "v",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Formatter or tick callback parameter in ResultsPage; not a quantity.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "ResultsPage",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ResultsPage.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "ResultsPage",
    "field": "yearsBeforeEnd",
    "disposition": "family",
    "familyId": "display-years-before-plan-end",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "YearByYearLedger",
    "field": "taxFreeGainsRoom",
    "disposition": "family",
    "familyId": "display-tax-free-gains-room-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "YearByYearLedger",
    "field": "taxPlusPenalties",
    "disposition": "family",
    "familyId": "display-tax-plus-penalties-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "YearByYearLedger",
    "field": "upsideShortfall",
    "disposition": "family",
    "familyId": "display-upside-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "YearByYearLedger",
    "field": "upsideSpending",
    "disposition": "family",
    "familyId": "display-upside-spending-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "YearByYearLedger",
    "field": "v",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Formatter or tick callback parameter in YearByYearLedger; not a quantity.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "YearByYearLedger",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The YearByYearLedger.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "module",
    "field": "fiTarget",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.fiTarget field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "module",
    "field": "investable",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.investable field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "module",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "module",
    "field": "v",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.v field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ResultsPage.tsx",
    "owner": "module",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "careAnnual",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.careAnnual field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "careStartAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.careStartAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "careYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.careYears field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.endYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "homeSaleYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.homeSaleYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "incomeChangePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.incomeChangePct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "incomeStartAgeDelta",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.incomeStartAgeDelta field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "moveMonth",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.moveMonth field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "moveYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.moveYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "retireAgeDelta",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.retireAgeDelta field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "returnPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.returnPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "rothAnnual",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.rothAnnual field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "rothTargetValue",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.rothTargetValue field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "spendPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.spendPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "ssClaimAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.ssClaimAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "ssCutPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.ssCutPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "stockPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.stockPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "LeverParams",
    "field": "survivorSpendingPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.survivorSpendingPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "module",
    "field": "nextStartYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.nextStartYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "module",
    "field": "previousStartYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.previousStartYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ScenariosPage.tsx",
    "owner": "module",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SpendingSolverPage.tsx",
    "owner": "ShapeRow",
    "field": "maxBaseAnnual",
    "disposition": "family",
    "familyId": "sustainable-spending-result-max-base-annual",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/SpendingSolverPage.tsx",
    "owner": "SpendingSolverPage",
    "field": "delta",
    "disposition": "family",
    "familyId": "spending-shape-delta-vs-flat",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SpendingSolverPage.tsx",
    "owner": "SpendingSolverPage",
    "field": "solvedRounded",
    "disposition": "family",
    "familyId": "solved-spending-rounded-to-hundred",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SpendingSolverPage.tsx",
    "owner": "SpendingSolverPage",
    "field": "solvedWithdrawalRatePct",
    "disposition": "family",
    "familyId": "solved-initial-withdrawal-rate-pct",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "BridgeComparisonRow",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "longevity-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "BridgeComparisonRow",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "projection-summary-ending-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "BridgeComparisonRow",
    "field": "successRate",
    "disposition": "family",
    "familyId": "monte-carlo-success-rate",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "SsAnalysisPage",
    "field": "getBack",
    "disposition": "family",
    "familyId": "social-security-expected-present-value",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "SsAnalysisPage",
    "field": "piaAnnual",
    "disposition": "family",
    "familyId": "social-security-pia-annualized",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "SsAnalysisPage",
    "field": "ratio",
    "disposition": "family",
    "familyId": "social-security-fica-return-ratio",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "module",
    "field": "ca",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.ca field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "module",
    "field": "discountPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The module.discountPct field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "module",
    "field": "ra",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.ra field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "module",
    "field": "t",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.t field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "module",
    "field": "v",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.v field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "owner": "module",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/SurvivorTransitionPage.tsx",
    "owner": "SurvivorTransitionPage",
    "field": "depletionYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Prop carrying the plan's depletion year into the degenerate-timings note; the value itself is the longevity-depletion-year family.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/SurvivorTransitionPage.tsx",
    "owner": "module",
    "field": "depletionYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.depletionYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "BucketPreset",
    "field": "spans",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The BucketPreset.spans field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "BucketYearRow",
    "field": "buckets",
    "disposition": "family",
    "familyId": "bucket-lens-allocation",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "BucketYearRow",
    "field": "investableTotal",
    "disposition": "family",
    "familyId": "accounts-investable-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "BucketYearRow",
    "field": "need",
    "disposition": "family",
    "familyId": "portfolio-need-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "BucketYearRow",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The BucketYearRow.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "bucketLens",
    "field": "buckets",
    "disposition": "family",
    "familyId": "bucket-lens-allocation",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/planner/bucketLens.ts",
    "owner": "bucketLens",
    "field": "spans",
    "disposition": "family",
    "familyId": "bucket-lens-allocation",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "MoneyLastsDelta",
    "field": "value",
    "disposition": "family",
    "familyId": "compare-plan-deltas",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "ageDelta",
    "field": "a",
    "disposition": "family",
    "familyId": "compare-plan-deltas",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "ageDelta",
    "field": "b",
    "disposition": "family",
    "familyId": "compare-plan-deltas",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "deterministicSuccessPct",
    "field": "depletionYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The deterministicSuccessPct.depletionYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "formatDelta",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The formatDelta.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "lastFundedYear",
    "field": "depletionYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The lastFundedYear.depletionYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "lastFundedYear",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The lastFundedYear.endYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "module",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "moneyLastsDelta",
    "field": "depletionYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The moneyLastsDelta.depletionYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/compareDeltas.ts",
    "owner": "moneyLastsDelta",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The moneyLastsDelta.endYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/insights/InsightCardView.tsx",
    "owner": "InsightCardView",
    "field": "mcDelta",
    "disposition": "family",
    "familyId": "insight-monte-carlo-success-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/optimizePageClaim.ts",
    "owner": "claimEstateGain",
    "field": "return",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-estate-gain",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "DollarAdjuster",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The DollarAdjuster.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "DollarAdjuster",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The DollarAdjuster.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "amt",
    "disposition": "family",
    "familyId": "tax-amt-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "annuity",
    "disposition": "family",
    "familyId": "income-annuity-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "baseSpending",
    "disposition": "family",
    "familyId": "spending-base-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "careCost",
    "disposition": "family",
    "familyId": "spending-care-cost-gross-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "contributions",
    "disposition": "family",
    "familyId": "year-result-contributions",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "deathBenefit",
    "disposition": "family",
    "familyId": "insurance-death-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "debtService",
    "disposition": "family",
    "familyId": "spending-debt-service-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "employerMatch",
    "disposition": "family",
    "familyId": "year-result-employer-match",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "excessShortfall",
    "disposition": "family",
    "familyId": "spending-excess-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "excessSpending",
    "disposition": "family",
    "familyId": "spending-excess-requested-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "filingStatus",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "The LEDGER_CSV_COLUMNS.filingStatus field is a categorical label used to name or classify the displayed record.",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "flexibleGoalFundedAmount",
    "disposition": "family",
    "familyId": "flexible-goal-funded-amount-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "flexibleGoalUnfundedAmount",
    "disposition": "family",
    "familyId": "flexible-goal-unfunded-amount-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "flexibleGoalsDeferred",
    "disposition": "family",
    "familyId": "flexible-goals-deferred-count-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "flexibleGoalsFunded",
    "disposition": "family",
    "familyId": "flexible-goals-funded-count-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "flexibleGoalsPartiallyFunded",
    "disposition": "family",
    "familyId": "flexible-goals-partially-funded-count-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "flexibleGoalsSkipped",
    "disposition": "family",
    "familyId": "flexible-goals-skipped-count-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "goals",
    "disposition": "family",
    "familyId": "spending-one-time-goals-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "guardrailAction",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "The LEDGER_CSV_COLUMNS.guardrailAction field is a categorical label used to name or classify the displayed record.",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "guardrailFactor",
    "disposition": "family",
    "familyId": "spending-guardrail-factor-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "healthcare",
    "disposition": "family",
    "familyId": "spending-healthcare-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "idealShortfall",
    "disposition": "family",
    "familyId": "spending-ideal-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "idealSpending",
    "disposition": "family",
    "familyId": "spending-ideal-requested-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "insuranceCashValue",
    "disposition": "family",
    "familyId": "insurance-cash-value-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "insurancePremiums",
    "disposition": "family",
    "familyId": "spending-insurance-premiums-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "intendedSpending",
    "disposition": "family",
    "familyId": "spending-intended-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "investable",
    "disposition": "family",
    "familyId": "accounts-balance-per-account-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "ladderValue",
    "disposition": "family",
    "familyId": "ladder-value-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "lossCarryforwardRemaining",
    "disposition": "family",
    "familyId": "tax-loss-carryforward-remaining-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "lossCarryforwardUsed",
    "disposition": "family",
    "familyId": "tax-loss-carryforward-used-against-gains-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "ltcBenefit",
    "disposition": "family",
    "familyId": "long-term-care-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "magi",
    "disposition": "family",
    "familyId": "magi-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "netWorth",
    "disposition": "family",
    "familyId": "accounts-net-worth-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "oneTimeIncome",
    "disposition": "family",
    "familyId": "income-one-time-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "ordinaryDividends",
    "disposition": "family",
    "familyId": "income-ordinary-dividends-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "penalties",
    "disposition": "family",
    "familyId": "tax-penalties-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "pension",
    "disposition": "family",
    "familyId": "income-pension-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "propertyCosts",
    "disposition": "family",
    "familyId": "spending-property-costs-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "qcd",
    "disposition": "family",
    "familyId": "qcd-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "qualifiedDividends",
    "disposition": "family",
    "familyId": "income-qualified-dividends-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "realizedGains",
    "disposition": "family",
    "familyId": "tax-realized-gains-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "recurring",
    "disposition": "family",
    "familyId": "income-recurring-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "requiredShortfall",
    "disposition": "family",
    "familyId": "spending-required-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "requiredSpending",
    "disposition": "family",
    "familyId": "spending-required-requested-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "rmd",
    "disposition": "family",
    "familyId": "rmd-required-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "rothConversion",
    "disposition": "family",
    "familyId": "roth-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "shortfall",
    "disposition": "family",
    "familyId": "spending-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "socialSecurity",
    "disposition": "family",
    "familyId": "social-security-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "targetShortfall",
    "disposition": "family",
    "familyId": "spending-target-shortfall-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "targetSpending",
    "disposition": "family",
    "familyId": "spending-target-requested-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "tax",
    "disposition": "family",
    "familyId": "tax-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "taxExemptInterest",
    "disposition": "family",
    "familyId": "year-result-tax-exempt-interest",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "taxableInterest",
    "disposition": "family",
    "familyId": "income-taxable-interest-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "taxableYield",
    "disposition": "family",
    "familyId": "income-taxable-yield-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "tipsLadder",
    "disposition": "family",
    "familyId": "income-tips-ladder-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "totalExpenses",
    "disposition": "family",
    "familyId": "spending-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "totalIncome",
    "disposition": "family",
    "familyId": "income-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "wages",
    "disposition": "family",
    "familyId": "income-wages-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "withdrawals",
    "disposition": "family",
    "familyId": "withdrawals-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "LEDGER_CSV_COLUMNS",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The LEDGER_CSV_COLUMNS.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "buildExpenseRows",
    "field": "care",
    "disposition": "family",
    "familyId": "display-net-care-cost-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "buildLedgerCsv",
    "field": "lossCarryforwardUsed",
    "disposition": "family",
    "familyId": "display-loss-carryforward-used-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "buildResultsRows",
    "field": "fiTarget",
    "disposition": "family",
    "familyId": "display-fi-target-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "inheritedLedgerCsvValues",
    "field": "executedRequiredAmount",
    "disposition": "family",
    "familyId": "inherited-distribution-required-executed-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "inheritedLedgerCsvValues",
    "field": "inheritedEvidenceNote",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "evidence-note",
    "reason": "The inheritedLedgerCsvValues.inheritedEvidenceNote field is a narrative evidence or audit note rather than a numeric amount.",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "inheritedLedgerCsvValues",
    "field": "needsProfessionalConfirmation",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "not-numeric",
    "reason": "The inheritedLedgerCsvValues.inheritedProfessionalConfirmation field is a nonnumeric object, collection, or text value.",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "inheritedLedgerCsvValues",
    "field": "requiredAmount",
    "disposition": "family",
    "familyId": "inherited-distribution-required-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "inheritedLedgerCsvValues",
    "field": "requirementKind",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "The inheritedLedgerCsvValues.inheritedRequirementKind field is a categorical label used to name or classify the displayed record.",
    "tsType": "string"
  },
  {
    "source": "planner-ui/src/planner/resultsRows.ts",
    "owner": "inheritedLedgerCsvValues",
    "field": "voluntaryAmount",
    "disposition": "family",
    "familyId": "inherited-distribution-voluntary-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/sections/IncomeFloorSection.tsx",
    "owner": "FedInvestSnapshot",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Start year the TIPS price snapshot is aligned to.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/sections/IncomeFloorSection.tsx",
    "owner": "IncomeFloorSection",
    "field": "yieldPct",
    "disposition": "family",
    "familyId": "income-floor-ladder-yield-pct",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/sections/IncomeFloorSection.tsx",
    "owner": "module",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "BenefitsPvRow",
    "field": "expectedPv",
    "disposition": "family",
    "familyId": "social-security-expected-present-value",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "MonthlyClaim",
    "field": "months",
    "disposition": "family",
    "familyId": "social-security-claiming-sweep-objective",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "MonthlyClaim",
    "field": "years",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Whole-year part of a month-granular claim age; a coordinate.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "ResolvedPia",
    "field": "piaMonthly",
    "disposition": "family",
    "familyId": "social-security-claiming-sweep-objective",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "SweepRow",
    "field": "primaryValue",
    "disposition": "family",
    "familyId": "social-security-claiming-sweep-objective",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "benefitsOnlyRanking",
    "field": "discountRate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The benefitsOnlyRanking.discountRate field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "candidateClaimAges",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The candidateClaimAges.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "claimingPeople",
    "field": "pia",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The claimingPeople.pia field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "dobParts",
    "field": "d",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The dobParts.d field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "dobParts",
    "field": "m",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The dobParts.m field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "dobParts",
    "field": "y",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The dobParts.y field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "module",
    "field": "claimYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.claimYears field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "module",
    "field": "pia",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.pia field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/ssAnalysis.ts",
    "owner": "module",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "FilingSegment",
    "field": "fromYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "First year of a filing-status run in the survivor timeline chip.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "FilingSegment",
    "field": "toYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Last year of a filing-status run in the survivor timeline chip.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorAnalysis",
    "field": "failedTimings",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Count of death timings whose ledger run threw and was skipped; a run diagnostic printed as \"N death timings could not be simulated\", not a plan quantity.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorAnalysisOptions",
    "field": "deathAges",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorAnalysisOptions.deathAges field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorAnalysisOptions",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorAnalysisOptions.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorIrmaaYear",
    "field": "premiumsWithSsa44",
    "disposition": "family",
    "familyId": "survivor-scenario-row-ssa44premium-savings",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorIrmaaYear",
    "field": "premiumsWithoutSsa44",
    "disposition": "family",
    "familyId": "survivor-scenario-row-ssa44premium-savings",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorIrmaaYear",
    "field": "tierWithSsa44",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "Engine irmaaTier read from the run with SSA-44 relief forced on (the recomputation is engine-side via the plan flag); a classification shown as \"tier a → b\" on the survivor page.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorIrmaaYear",
    "field": "tierWithoutSsa44",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "Engine irmaaTier read from the run without SSA-44 relief; a classification shown as \"tier a → b\" on the survivor page. The premium dollars are the numeric family (medicare-premiums-annual, survivor-scenario-row-ssa44premium-savings).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorIrmaaYear",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorIrmaaYear.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "baseEndingAfterTaxEstate",
    "disposition": "family",
    "familyId": "survivor-scenario-row-estate-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "baseLifetimeTax",
    "disposition": "family",
    "familyId": "survivor-scenario-row-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "deathAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Swept death age from the SURVIVOR_DEATH_AGES grid (70..90 clamped to the person's ages); the row's coordinate, printed as \"Dies at\".",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "deathYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Birth year plus the swept death age; a coordinate printed under \"Dies at\" and in the lever sentence.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "survivor-scenario-row-estate-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "estateDelta",
    "disposition": "family",
    "familyId": "survivor-scenario-row-estate-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "lifetimeTax",
    "disposition": "family",
    "familyId": "survivor-scenario-row-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "lifetimeTaxDelta",
    "disposition": "family",
    "familyId": "survivor-scenario-row-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "minSurvivorInvestable",
    "disposition": "family",
    "familyId": "accounts-investable-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "ssAfterDeath",
    "disposition": "family",
    "familyId": "social-security-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "ssBeforeDeath",
    "disposition": "family",
    "familyId": "social-security-benefit-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "ssa44PremiumSavings",
    "disposition": "family",
    "familyId": "survivor-scenario-row-ssa44premium-savings",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorScenarioRow",
    "field": "survivorShortfallYears",
    "disposition": "family",
    "familyId": "survivor-scenario-row-survivor-shortfall-years",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorYearFacts",
    "field": "magi",
    "disposition": "family",
    "familyId": "magi-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorYearFacts",
    "field": "shortfall",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Engine YearResult.shortfall for the last joint and first survivor years, read only by isDegenerateTiming to decide whether a timing row is shown as degenerate; a display gate, never printed (the shortfall family is surfaced elsewhere).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorYearFacts",
    "field": "tax",
    "disposition": "family",
    "familyId": "tax-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "SurvivorYearFacts",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorYearFacts.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "candidateDeathAges",
    "field": "grid",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The candidateDeathAges.grid field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "candidateDeathAges",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The candidateDeathAges.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "conversionLeverPatch",
    "field": "lastJointYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The conversionLeverPatch.lastJointYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "conversionLeverPatch",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The conversionLeverPatch.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "module",
    "field": "deathAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.deathAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/survivorAnalysis.ts",
    "owner": "module",
    "field": "v",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.v field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowDialog.tsx",
    "owner": "YearCashFlowDialogProps",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The YearCashFlowDialogProps.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowDialog.tsx",
    "owner": "module",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowDialog.tsx",
    "owner": "module",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "ChartLink",
    "field": "displayAmount",
    "disposition": "family",
    "familyId": "cash-flow-line-amount",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "ChartLink",
    "field": "source",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "identifier",
    "reason": "Index of the link's source node in the placed Sankey.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "ChartLink",
    "field": "target",
    "disposition": "family",
    "familyId": "cash-flow-line-amount",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "ChartLink",
    "field": "value",
    "disposition": "family",
    "familyId": "cash-flow-line-amount",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "ChartNode",
    "field": "displayAmount",
    "disposition": "family",
    "familyId": "cash-flow-line-amount",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "linkWidth",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (linkWidth in pixels).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "sourceControlX",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (sourceControlX in pixels).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "sourceX",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (sourceX in pixels).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "sourceY",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (sourceY in pixels).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "targetControlX",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedLink.targetControlX field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "targetX",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedLink.targetX field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedLink",
    "field": "targetY",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedLink.targetY field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedNode",
    "field": "height",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (node height in pixels).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedNode",
    "field": "index",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.index field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedNode",
    "field": "width",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.width field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedNode",
    "field": "x",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.x field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "PlacedNode",
    "field": "y",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.y field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowDisplayAmount",
    "field": "nominalAmount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Nominal amount argument of the displayAmount dollar-basis callback.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowDisplayAmount",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The YearCashFlowDisplayAmount.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowSankeyProps",
    "field": "fundedUsesPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowSankeyProps",
    "field": "shortfallPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowSankeyProps",
    "field": "sourceTotalPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowSankeyProps",
    "field": "transferCreditsPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowSankeyProps",
    "field": "transferDebitsPlanDollars",
    "disposition": "family",
    "familyId": "cash-flow-reconciliation-totals",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "YearCashFlowSankeyProps",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The YearCashFlowSankeyProps.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "module",
    "field": "amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.amount field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "owner": "module",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/projection.ts",
    "owner": "inflationView",
    "field": "deflate",
    "disposition": "family",
    "familyId": "display-dollar-basis-conversion",
    "tsType": "function"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ParsedReportModel",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ParsedReportModel.endYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ParsedReportModel",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ParsedReportModel.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ParsedReportModel",
    "field": "version",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ParsedReportModel.version field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAcaLedgerBlock",
    "field": "applicableSlcspPremium",
    "disposition": "family",
    "familyId": "aca-applicable-slcsp-premium-annual",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAcaLedgerBlock",
    "field": "economicNetPremium",
    "disposition": "family",
    "familyId": "aca-economic-net-premium-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAcaLedgerBlock",
    "field": "grossEnrollmentPremium",
    "disposition": "family",
    "familyId": "aca-gross-enrollment-premium-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAcaLedgerBlock",
    "field": "modeledAllowablePtc",
    "disposition": "family",
    "familyId": "aca-modeled-allowable-ptc-annual",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAcaLedgerBlock",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of the ACA ledger row.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAccountRow",
    "field": "annualReturnPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAccountRow.annualReturnPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAccountRow",
    "field": "balance",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAccountRow.balance restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "defaultReturnPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.defaultReturnPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "healthcareExtraInflationPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.healthcareExtraInflationPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "heirTaxRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.heirTaxRatePct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "inflationPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.inflationPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "localIncomeTaxPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.localIncomeTaxPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "safeWithdrawalRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.safeWithdrawalRatePct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportAssumptionsBlock",
    "field": "stateEffectiveTaxPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.stateEffectiveTaxPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "cash",
    "disposition": "family",
    "familyId": "display-balance-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "equityComp",
    "disposition": "family",
    "familyId": "display-balance-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "hsa",
    "disposition": "family",
    "familyId": "display-balance-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "income",
    "disposition": "family",
    "familyId": "income-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "roth",
    "disposition": "family",
    "familyId": "display-balance-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "spendingPlusTax",
    "disposition": "family",
    "familyId": "display-total-spending-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "taxable",
    "disposition": "family",
    "familyId": "display-balance-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "traditional",
    "disposition": "family",
    "familyId": "display-balance-by-category-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportChartDataRow",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportChartDataRow.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportClaimAgeEvidence",
    "field": "combinationsEvaluated",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-combinations-evaluated",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportClaimAgeEvidence",
    "field": "currentClaimExactEstate",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-current-claim-exact-estate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportClaimAgeEvidence",
    "field": "jointExactEstate",
    "disposition": "family",
    "familyId": "claim-age-co-optimization-joint-exact-estate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportDecisionCandidateRow",
    "field": "afterTaxEstateDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-after-tax-estate-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportDecisionCandidateRow",
    "field": "lifetimeTaxDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportDecisionCandidateRow",
    "field": "moneyLastsYearsDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-money-lasts-years-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "averagePreRetirementSavingsRatePct",
    "disposition": "family",
    "familyId": "projection-summary-average-pre-retirement-savings-rate-pct",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "coastFireNumber",
    "disposition": "family",
    "familyId": "projection-summary-coast-fire-number",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "depletionYear",
    "disposition": "family",
    "familyId": "longevity-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "endingAfterTaxEstate",
    "disposition": "family",
    "familyId": "projection-summary-ending-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "endingInvestable",
    "disposition": "family",
    "familyId": "projection-result-ending-investable",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "endingNetWorth",
    "disposition": "family",
    "familyId": "projection-result-ending-net-worth",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "fiAge",
    "disposition": "family",
    "familyId": "projection-summary-fi-age",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "fiNumber",
    "disposition": "family",
    "familyId": "projection-summary-fi-number",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "fiYear",
    "disposition": "family",
    "familyId": "projection-summary-fi-year",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "lifetimeRothConversions",
    "disposition": "family",
    "familyId": "projection-summary-lifetime-roth-conversions",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportHeadlineResultsBlock",
    "field": "lifetimeTaxesAndPenalties",
    "disposition": "family",
    "familyId": "projection-summary-lifetime-taxes-and-penalties",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportInheritedScheduleAccount",
    "field": "finalDeadlineYear",
    "disposition": "family",
    "familyId": "inherited-account-final-deadline-year",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportInheritedScheduleYearRow",
    "field": "executedRequiredAmount",
    "disposition": "family",
    "familyId": "inherited-distribution-required-executed-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportInheritedScheduleYearRow",
    "field": "requiredAmount",
    "disposition": "family",
    "familyId": "inherited-distribution-required-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportInheritedScheduleYearRow",
    "field": "voluntaryAmount",
    "disposition": "family",
    "familyId": "inherited-distribution-voluntary-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportInheritedScheduleYearRow",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportInheritedScheduleYearRow.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportModel",
    "field": "endYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportModel.endYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportModel",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportModel.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportModelInput",
    "field": "startYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportModelInput.startYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportPersonRow",
    "field": "planningAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportPersonRow.planningAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportPersonRow",
    "field": "retirementAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportPersonRow.retirementAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportProvenance",
    "field": "federalParameterPackYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportProvenance.federalParameterPackYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportProvenance",
    "field": "stateParameterPackYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportProvenance.stateParameterPackYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "afterTaxEstateDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-after-tax-estate-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "baselineAfterTaxEstate",
    "disposition": "family",
    "familyId": "optimization-baseline-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "candidateAfterTaxEstate",
    "disposition": "family",
    "familyId": "optimization-candidate-after-tax-estate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "endingNetWorthDelta",
    "disposition": "family",
    "familyId": "exact-ledger-validation-ending-net-worth-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "executedConversionRatio",
    "disposition": "family",
    "familyId": "exact-ledger-validation-executed-conversion-ratio",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "executedConversionTotal",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-executed-conversion-total",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "firstMateriallyUnexecutedYear",
    "disposition": "family",
    "familyId": "exact-ledger-validation-first-materially-unexecuted-year",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "lifetimeTaxDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-lifetime-tax-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "moneyLastsYearsDelta",
    "disposition": "family",
    "familyId": "simple-candidate-evaluation-money-lasts-years-delta",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "requestedConversionTotal",
    "disposition": "family",
    "familyId": "exact-ledger-validation-requested-conversion-total",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportValidationEvidence",
    "field": "traditionalDepletionYear",
    "disposition": "family",
    "familyId": "exact-ledger-validation-traditional-depletion-year",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "contributions",
    "disposition": "family",
    "familyId": "year-result-contributions",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "expenses",
    "disposition": "family",
    "familyId": "spending-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "income",
    "disposition": "family",
    "familyId": "income-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "investable",
    "disposition": "family",
    "familyId": "accounts-investable-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "magi",
    "disposition": "family",
    "familyId": "magi-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "netWorth",
    "disposition": "family",
    "familyId": "accounts-net-worth-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "rmd",
    "disposition": "family",
    "familyId": "rmd-required-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "rothConversion",
    "disposition": "family",
    "familyId": "roth-conversion-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "taxAndPenalties",
    "disposition": "family",
    "familyId": "display-tax-plus-penalties-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "withdrawals",
    "disposition": "family",
    "familyId": "withdrawals-total-annual",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "ReportYearLedgerRow",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportYearLedgerRow.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "buildInheritedSchedules",
    "field": "finalDeadlineYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The buildInheritedSchedules.finalDeadlineYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "buildInheritedSchedules",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The buildInheritedSchedules.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "inheritedRequirementKindLabelForYear",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The inheritedRequirementKindLabelForYear.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "module",
    "field": "scheduleYears",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.scheduleYears field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "module",
    "field": "value",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "module",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/report/reportModel.ts",
    "owner": "primaryInheritedRegimeLabel",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The primaryInheritedRegimeLabel.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenCrossing",
    "field": "age",
    "disposition": "family",
    "familyId": "social-security-break-even",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenCrossing",
    "field": "early",
    "disposition": "family",
    "familyId": "social-security-break-even",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenCrossing",
    "field": "late",
    "disposition": "family",
    "familyId": "social-security-break-even",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "claimAges",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The BreakEvenInput.claimAges field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "colaPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.colaPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "day",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.day field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "growthPct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.growthPct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "month",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.month field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "piaMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.piaMonthly field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "throughAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The BreakEvenInput.throughAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenInput",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The BreakEvenInput.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "BreakEvenPoint",
    "field": "age",
    "disposition": "family",
    "familyId": "social-security-break-even",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "computeBreakEven",
    "field": "a",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The computeBreakEven.a field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "computeBreakEven",
    "field": "age",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The computeBreakEven.age field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "computeBreakEven",
    "field": "crossAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The computeBreakEven.crossAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/socialSecurity/breakEven.ts",
    "owner": "computeBreakEven",
    "field": "prevDiff",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The computeBreakEven.prevDiff field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "benefitFloorMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.benefitFloorMonthly field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "currentAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ClaimantInput.currentAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "day",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.day field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "longevityMultiplier",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.longevityMultiplier field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "month",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.month field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "piaMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.piaMonthly field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ClaimantInput",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ClaimantInput.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ExpectedPvOptions",
    "field": "discountRate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExpectedPvOptions.discountRate field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "ExpectedPvOptions",
    "field": "maxAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ExpectedPvOptions.maxAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "SurvivalCurve",
    "field": "fromAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivalCurve.fromAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "SurvivalCurve",
    "field": "toAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivalCurve.toAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "module",
    "field": "age",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The module.age field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "module",
    "field": "multiplier",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.multiplier field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "survivalCurve",
    "field": "cum",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The survivalCurve.cum field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number[]"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "survivalCurve",
    "field": "fromAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The survivalCurve.fromAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/expectedPv.ts",
    "owner": "survivalCurve",
    "field": "toAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The survivalCurve.toAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "BendTier",
    "field": "first",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "BendTier.first: the bend-point tier the next AIME dollar falls in, printed as the label \"90% / 32% / 15%\"; the bend points themselves are parameter-pack data.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "BendTier",
    "field": "marginalRate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "BendTier.marginalRate: the bend-point tier the next AIME dollar falls in, printed as the label \"90% / 32% / 15%\"; the bend points themselves are parameter-pack data.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "BendTier",
    "field": "second",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "label-or-category",
    "reason": "BendTier.second: the bend-point tier the next AIME dollar falls in, printed as the label \"90% / 32% / 15%\"; the bend points themselves are parameter-pack data.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "ComputationSummary",
    "field": "computationYearCount",
    "disposition": "family",
    "familyId": "social-security-computation-summary-counts",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "ComputationSummary",
    "field": "divisorMonths",
    "disposition": "unsurfaced-evidence",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "AIME divisor (12 × computation years); SocialSecuritySection.tsx prints the year counts, not the divisor.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "ComputationSummary",
    "field": "zeroYearsInAime",
    "disposition": "family",
    "familyId": "social-security-computation-summary-counts",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "CreditEstimate",
    "field": "credits",
    "disposition": "family",
    "familyId": "social-security-credit-estimate",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "bendTierForAime",
    "field": "aime",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "AIME argument to the bend-tier lookup (engine piaFromEarnings output passed in).",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "bendTierForAime",
    "field": "eligibilityYear",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The bendTierForAime.eligibilityYear field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "estimateCredits",
    "field": "override",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "User-entered credit count that overrides the estimate.",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "replaceZeroYearGain",
    "field": "indexedAnnual",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Sample indexed earnings the explainer plugs in.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/explain.ts",
    "owner": "replaceZeroYearGain",
    "field": "return",
    "disposition": "family",
    "familyId": "social-security-zero-year-replacement-gain",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "owner": "FicaPaidInOptions",
    "field": "oasdiEmployeeRatePct",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The FicaPaidInOptions.oasdiEmployeeRatePct field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "owner": "FicaPaidInOptions",
    "field": "wageBaseFallback",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The FicaPaidInOptions.wageBaseFallback field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "owner": "FicaPaidInResult",
    "field": "employerPaid",
    "disposition": "family",
    "familyId": "social-security-oasdi-paid-in",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "owner": "FicaPaidInResult",
    "field": "paidIn",
    "disposition": "family",
    "familyId": "social-security-oasdi-paid-in",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "owner": "ficaOasdiPaidIn",
    "field": "amount",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "input-parameter",
    "reason": "Earnings-history amount iterated by the paid-in sum.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "owner": "ficaOasdiPaidIn",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The ficaOasdiPaidIn.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchResult",
    "field": "expectedPv",
    "disposition": "family",
    "familyId": "social-security-survivor-switch-pv",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchStrategy",
    "field": "ownClaimAge",
    "disposition": "family",
    "familyId": "social-security-survivor-switch-pv",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchStrategy",
    "field": "survivorClaimAge",
    "disposition": "family",
    "familyId": "social-security-survivor-switch-pv",
    "tsType": "number | null"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "currentAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SwitchingInput.currentAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "day",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.day field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "deceasedPiaMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.deceasedPiaMonthly field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "longevityMultiplier",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.longevityMultiplier field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "month",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.month field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "ownPiaMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.ownPiaMonthly field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "survivorMonthly",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.survivorMonthly field is an internal diagnostic used to trace or validate calculation behavior.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingInput",
    "field": "year",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SwitchingInput.year field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingOptions",
    "field": "discountRate",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The SwitchingOptions.discountRate field is a run-size setting or execution count that describes calculation effort.",
    "tsType": "number"
  },
  {
    "source": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "owner": "SwitchingOptions",
    "field": "maxAge",
    "disposition": "excluded",
    "familyId": null,
    "reasonKind": "dimension-coordinate",
    "reason": "The SwitchingOptions.maxAge field is a coordinate such as year, age, or offset used to place another value.",
    "tsType": "number"
  }
] satisfies readonly RawCoverage[]

const exclusionCensus = [
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "build_plan",
    "reasonKind": "protocol-metadata",
    "reason": "Returns the constructed plan and build/session caveats; numeric plan values are echoed state, not a modeled result."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "validate_plan",
    "reasonKind": "protocol-metadata",
    "reason": "Returns parse success or validation issues/schema status, not calculation results."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "get_session",
    "reasonKind": "protocol-metadata",
    "reason": "Returns session presence, start year, plan name, versions, conventions and caveats; startYear is session metadata."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "export_plan",
    "reasonKind": "protocol-metadata",
    "reason": "Returns a cloned plan plus round-trip provenance, conventions and caveats; numeric plan fields are state echo."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "describe_plan_schema",
    "reasonKind": "protocol-metadata",
    "reason": "Returns JSON Schema and schema version/path metadata, not modeled numbers."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "explain_modeled_result",
    "reasonKind": "label-or-category",
    "reason": "Returns framing, assumptions, conventions, caveats, limitations, versions and cached-result context; no new numeric calculation is performed."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "update_plan",
    "reasonKind": "protocol-metadata",
    "reason": "Returns applied-operation count, compact plan summary, validation status and caveats; numeric expenseBaseAnnual is echoed plan state."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "clear_session",
    "reasonKind": "protocol-metadata",
    "reason": "Returns only {ok:true} after clearing session state."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_projection.years[].year",
    "reasonKind": "protocol-metadata",
    "reason": "Projection year coordinate, not a numeric result."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_projection.startYear",
    "reasonKind": "protocol-metadata",
    "reason": "Projection start-year coordinate."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_projection.endYear",
    "reasonKind": "protocol-metadata",
    "reason": "Projection end-year coordinate."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_projection.years[].irmaaTier",
    "reasonKind": "label-or-category",
    "reason": "IRMAA tier index is a classification, not a modeled dollar output."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_monte_carlo.pathCount",
    "reasonKind": "protocol-metadata",
    "reason": "Echoed run configuration."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_monte_carlo.seed",
    "reasonKind": "protocol-metadata",
    "reason": "Echoed run configuration."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_monte_carlo.returnVolPct",
    "reasonKind": "protocol-metadata",
    "reason": "Echoed model input, not an output."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "batch_evaluate.results[].index",
    "reasonKind": "protocol-metadata",
    "reason": "Input-array position."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "batch_evaluate.results[].policy",
    "reasonKind": "protocol-metadata",
    "reason": "Echoed candidate policy input."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "batch_evaluate.results[].ok",
    "reasonKind": "protocol-metadata",
    "reason": "Per-row evaluation status."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "batch_evaluate.count",
    "reasonKind": "protocol-metadata",
    "reason": "Count of submitted result rows, not a financial calculation."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_optimizer.tournament.policyId",
    "reasonKind": "label-or-category",
    "reason": "Winning policy identifier."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_optimizer.tournament.winnerSource",
    "reasonKind": "label-or-category",
    "reason": "Winning strategy source label."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_optimizer.tournament.winnerLabel",
    "reasonKind": "label-or-category",
    "reason": "Winning strategy label."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_optimizer.schedule[].year",
    "reasonKind": "protocol-metadata",
    "reason": "Schedule year coordinate."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "run_optimizer.tournament.winnerConversions[].year",
    "reasonKind": "protocol-metadata",
    "reason": "Winning schedule year coordinate."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "solve_max_spending.converged",
    "reasonKind": "protocol-metadata",
    "reason": "Solver status flag."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "solve_max_spending.limitingConstraint",
    "reasonKind": "label-or-category",
    "reason": "Constraint category label."
  },
  {
    "id": "",
    "path": "RetireGolden-MCP/src/adapter.ts",
    "symbol": "",
    "field": "compare_scenarios.startYear (input only)",
    "reasonKind": "protocol-metadata",
    "reason": "Optional projection start-year input, not returned as a result field."
  },
  {
    "id": "csv-filing-status",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "LEDGER_CSV_COLUMNS",
    "field": "filingStatus",
    "reasonKind": "label-or-category",
    "reason": "Tax filing-status label applying to the CSV ledger year."
  },
  {
    "id": "csv-guardrail-action",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "LEDGER_CSV_COLUMNS",
    "field": "guardrailAction",
    "reasonKind": "label-or-category",
    "reason": "Categorical cut, hold, or raise decision for the CSV ledger year."
  },
  {
    "id": "csv-inherited-evidence-note",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "inheritedLedgerCsvValues",
    "field": "inheritedEvidenceNote",
    "reasonKind": "evidence-note",
    "reason": "The inheritedLedgerCsvValues.inheritedEvidenceNote field is a narrative evidence or audit note rather than a numeric amount."
  },
  {
    "id": "csv-inherited-professional-confirmation",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "inheritedLedgerCsvValues",
    "field": "inheritedProfessionalConfirmation",
    "reasonKind": "not-numeric",
    "reason": "The inheritedLedgerCsvValues.inheritedProfessionalConfirmation field is a nonnumeric object, collection, or text value."
  },
  {
    "id": "csv-inherited-requirement-kind",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "inheritedLedgerCsvValues",
    "field": "inheritedRequirementKind",
    "reasonKind": "label-or-category",
    "reason": "The inheritedLedgerCsvValues.inheritedRequirementKind field is a categorical label used to name or classify the displayed record."
  },
  {
    "id": "csv-year",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "LEDGER_CSV_COLUMNS",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year identifying each CSV ledger row."
  },
  {
    "id": "field-engine-src-decisions-annuitization-ts-annuitizationsweep-startage",
    "path": "engine/src/decisions/annuitization.ts",
    "symbol": "AnnuitizationSweep",
    "field": "startAge",
    "reasonKind": "dimension-coordinate",
    "reason": "Age annuity payments start, max(current age, 65); printed as a coordinate in the annuitization paragraph."
  },
  {
    "id": "field-engine-src-decisions-annuitization-ts-annuitizationsweepconfig-allocationpcts",
    "path": "engine/src/decisions/annuitization.ts",
    "symbol": "AnnuitizationSweepConfig",
    "field": "allocationPcts",
    "reasonKind": "input-parameter",
    "reason": "Allocation grid (percent of investable) to sweep; overrides the default grid."
  },
  {
    "id": "field-engine-src-decisions-annuitization-ts-annuitizationsweepconfig-quotedpayoutratepct",
    "path": "engine/src/decisions/annuitization.ts",
    "symbol": "AnnuitizationSweepConfig",
    "field": "quotedPayoutRatePct",
    "reasonKind": "input-parameter",
    "reason": "User-entered annual SPIA payout rate (percent of premium) overriding the default payout table."
  },
  {
    "id": "field-engine-src-decisions-annuitization-ts-annuitizationsweeppoint-allocationpct",
    "path": "engine/src/decisions/annuitization.ts",
    "symbol": "AnnuitizationSweepPoint",
    "field": "allocationPct",
    "reasonKind": "dimension-coordinate",
    "reason": "Requested grid percent that keys each sweep point; the chart plots effectiveAllocationPct instead."
  },
  {
    "id": "field-engine-src-decisions-annuitization-ts-module-default-grid",
    "path": "engine/src/decisions/annuitization.ts",
    "symbol": "module",
    "field": "DEFAULT_GRID",
    "reasonKind": "internal-coefficient",
    "reason": "Default allocation grid (0, 5, 10, 15, 20, 25, 30 percent) swept when no allocationPcts is given."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-module-baseannual",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "module",
    "field": "baseAnnual",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.baseAnnual field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-solvemaxsustainablespending-amount",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "solveMaxSustainableSpending",
    "field": "amount",
    "reasonKind": "runtime-diagnostic",
    "reason": "Candidate spending level tried by the bisection inside solveMaxSustainableSpending; a loop local."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-solvemaxsustainablespending-baseannual",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "solveMaxSustainableSpending",
    "field": "baseAnnual",
    "reasonKind": "runtime-diagnostic",
    "reason": "Base spending patched into the trial plan by the bisection; a loop local."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-solvemaxsustainablespending-lower",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "solveMaxSustainableSpending",
    "field": "lower",
    "reasonKind": "runtime-diagnostic",
    "reason": "Bisection lower bound; a loop local."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-solvemaxsustainablespending-upper",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "solveMaxSustainableSpending",
    "field": "upper",
    "reasonKind": "runtime-diagnostic",
    "reason": "Bisection upper bound; a loop local."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-sustainablespendingoptions-estatefloortodaydollars",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "SustainableSpendingOptions",
    "field": "estateFloorTodayDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SustainableSpendingOptions.estateFloorTodayDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-sustainablespendingoptions-maxsimulations",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "SustainableSpendingOptions",
    "field": "maxSimulations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The SustainableSpendingOptions.maxSimulations field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-engine-src-decisions-spendingsolver-ts-sustainablespendingoptions-resolutiondollars",
    "path": "engine/src/decisions/spendingSolver.ts",
    "symbol": "SustainableSpendingOptions",
    "field": "resolutionDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SustainableSpendingOptions.resolutionDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-decisions-swrcomparator-ts-compareswrrules-cape",
    "path": "engine/src/decisions/swrComparator.ts",
    "symbol": "compareSwrRules",
    "field": "cape",
    "reasonKind": "input-parameter",
    "reason": "CAPE ratio passed to the rule comparison."
  },
  {
    "id": "field-engine-src-decisions-swrcomparator-ts-swrrulespec-cape",
    "path": "engine/src/decisions/swrComparator.ts",
    "symbol": "SwrRuleSpec",
    "field": "cape",
    "reasonKind": "input-parameter",
    "reason": "CAPE ratio input to the CAPE-based withdrawal rule spec."
  },
  {
    "id": "field-engine-src-insights-types-ts-detector-version",
    "path": "engine/src/insights/types.ts",
    "symbol": "Detector",
    "field": "version",
    "reasonKind": "runtime-diagnostic",
    "reason": "The Detector.version field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-insights-types-ts-detectorprojection-amount",
    "path": "engine/src/insights/types.ts",
    "symbol": "DetectorProjection",
    "field": "amount",
    "reasonKind": "input-parameter",
    "reason": "Parameter of the DetectorProjection.deflate(year, amount) callback the planner passes to detectors, not a published output."
  },
  {
    "id": "field-engine-src-insights-types-ts-detectorprojection-startyear",
    "path": "engine/src/insights/types.ts",
    "symbol": "DetectorProjection",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Projection start year handed to detectors; positions their evidence."
  },
  {
    "id": "field-engine-src-insights-types-ts-detectorprojection-year",
    "path": "engine/src/insights/types.ts",
    "symbol": "DetectorProjection",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The DetectorProjection.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-insights-types-ts-insightevidence-year",
    "path": "engine/src/insights/types.ts",
    "symbol": "InsightEvidence",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The InsightEvidence.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-insights-types-ts-insightimpact-successratedeltapct",
    "path": "engine/src/insights/types.ts",
    "symbol": "InsightImpact",
    "field": "successRateDeltaPct",
    "reasonKind": "internal-coefficient",
    "reason": "Screen-time constant (spendingGuardrails sets 12) that only gates whether InsightCardView runs the Monte Carlo pair; the rendered success line is the UI-computed delta, never this value."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizing-endyear",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizing",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last bridge payout year."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizing-startyear",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizing",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "First bridge payout year."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizing-years",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizing",
    "field": "years",
    "reasonKind": "dimension-coordinate",
    "reason": "Number of bridge years (endYear - startYear + 1); a span, printed as the gap-year range."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-claimage-months",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "claimAge.months",
    "reasonKind": "input-parameter",
    "reason": "Month part of the chosen claim age (ClaimAge); a positive value extends the bridge through the claim year."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-claimage-years",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "claimAge.years",
    "reasonKind": "input-parameter",
    "reason": "Whole-year part of the chosen claim age the bridge funds the wait for (ClaimAge)."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-currentyear",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "currentYear",
    "reasonKind": "input-parameter",
    "reason": "Calendar year the projection starts; the bridge never starts before the next year."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-dob-day",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "dob.day",
    "reasonKind": "input-parameter",
    "reason": "Birth day of the claimant; sizing input."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-dob-month",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "dob.month",
    "reasonKind": "input-parameter",
    "reason": "Birth month of the claimant; sizing input."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-dob-year",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "dob.year",
    "reasonKind": "input-parameter",
    "reason": "Birth year of the claimant; sizing input."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-piamonthly",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "piaMonthly",
    "reasonKind": "input-parameter",
    "reason": "Worker's monthly PIA in today's dollars; sizing input."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-bridgesizinginput-retirementyear",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "BridgeSizingInput",
    "field": "retirementYear",
    "reasonKind": "input-parameter",
    "reason": "Calendar year retirement-phase spending begins; the bridge never starts before it."
  },
  {
    "id": "field-engine-src-ladder-bridge-ts-module-bridge-funding-min-fraction",
    "path": "engine/src/ladder/bridge.ts",
    "symbol": "module",
    "field": "BRIDGE_FUNDING_MIN_FRACTION",
    "reasonKind": "internal-coefficient",
    "reason": "Minimum share (0.5) of the quoted ladder cost the funding account must hold before a bridge is proposed; a threshold shared by the ss-bridge-gap detector and bridgeLadderGenerator."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-computefundedratio-realamount",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "computeFundedRatio",
    "field": "realAmount",
    "reasonKind": "runtime-diagnostic",
    "reason": "One year's real cash flow inside the present-value sum; a loop local."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-computefundedratio-yearsfromnow",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "computeFundedRatio",
    "field": "yearsFromNow",
    "reasonKind": "dimension-coordinate",
    "reason": "Discounting offset for one cash-flow year inside computeFundedRatio."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-fundedratioinput-amount",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "FundedRatioInput",
    "field": "amount",
    "reasonKind": "runtime-diagnostic",
    "reason": "The FundedRatioInput.amount field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-fundedratioinput-fromyear",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "FundedRatioInput",
    "field": "fromYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The FundedRatioInput.fromYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-fundedratioinput-startyear",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "FundedRatioInput",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The FundedRatioInput.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-fundedratioinput-year",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "FundedRatioInput",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The FundedRatioInput.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-fundedratioresult-fromyear",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "FundedRatioResult",
    "field": "fromYear",
    "reasonKind": "dimension-coordinate",
    "reason": "First year the funded-ratio present value covers."
  },
  {
    "id": "field-engine-src-ladder-fundedratio-ts-fundedratioresult-toyear",
    "path": "engine/src/ladder/fundedRatio.ts",
    "symbol": "FundedRatioResult",
    "field": "toYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last year the funded-ratio present value covers."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-buildladder-m",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "buildLadder",
    "field": "m",
    "reasonKind": "runtime-diagnostic",
    "reason": "Loop index over rung maturities inside buildLadder."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-buildladder-offsets",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "buildLadder",
    "field": "offsets",
    "reasonKind": "dimension-coordinate",
    "reason": "Rung maturity offsets the ladder builder iterates."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-ladderbuildinput-annualrealincome",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "LadderBuildInput",
    "field": "annualRealIncome",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LadderBuildInput.annualRealIncome field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-ladderbuildinput-firstpayoutoffset",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "LadderBuildInput",
    "field": "firstPayoutOffset",
    "reasonKind": "dimension-coordinate",
    "reason": "The LadderBuildInput.firstPayoutOffset field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-ladderbuildinput-payoutyears",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "LadderBuildInput",
    "field": "payoutYears",
    "reasonKind": "dimension-coordinate",
    "reason": "The LadderBuildInput.payoutYears field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-ladderrealflowsatoffset-offset",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "ladderRealFlowsAtOffset",
    "field": "offset",
    "reasonKind": "dimension-coordinate",
    "reason": "Year offset at which ladder flows are read."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-ladderremainingface-offset",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "ladderRemainingFace",
    "field": "offset",
    "reasonKind": "dimension-coordinate",
    "reason": "Year offset at which remaining face is read."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-ladderrung-maturityoffset",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "LadderRung",
    "field": "maturityOffset",
    "reasonKind": "dimension-coordinate",
    "reason": "Years from purchase to the rung's maturity; the income-floor rung table prints purchase year + offset as the Year column."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-module-couponratepct",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "module",
    "field": "couponRatePct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.couponRatePct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-module-face",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "module",
    "field": "face",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.face field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-module-maturityoffset",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "module",
    "field": "maturityOffset",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.maturityOffset field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-module-realyieldpct",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "module",
    "field": "realYieldPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.realYieldPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-realpresentvalue-realamount",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "realPresentValue",
    "field": "realAmount",
    "reasonKind": "input-parameter",
    "reason": "Real amount argument of realPresentValue."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-realpresentvalue-yearsfromnow",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "realPresentValue",
    "field": "yearsFromNow",
    "reasonKind": "dimension-coordinate",
    "reason": "Discounting offset argument of realPresentValue."
  },
  {
    "id": "field-engine-src-ladder-laddermath-ts-realyieldat-maturityyears",
    "path": "engine/src/ladder/ladderMath.ts",
    "symbol": "realYieldAt",
    "field": "maturityYears",
    "reasonKind": "dimension-coordinate",
    "reason": "Maturity in years at which the real-yield curve is read."
  },
  {
    "id": "field-engine-src-montecarlo-frontiers-ts-buildretirementagesuccessfrontier-deltas",
    "path": "engine/src/montecarlo/frontiers.ts",
    "symbol": "buildRetirementAgeSuccessFrontier",
    "field": "deltas",
    "reasonKind": "input-parameter",
    "reason": "Retirement-age offset grid (default -2 to +2 years) that builds the plan variants; the point x-axis value is the earliest resulting retirement age."
  },
  {
    "id": "field-engine-src-montecarlo-frontiers-ts-buildspendingsuccessfrontier-multipliers",
    "path": "engine/src/montecarlo/frontiers.ts",
    "symbol": "buildSpendingSuccessFrontier",
    "field": "multipliers",
    "reasonKind": "input-parameter",
    "reason": "Spending multiplier grid (default 0.85 to 1.15) that builds the plan variants; the point x-axis value is the resulting baseAnnual (StochasticFrontierPoint.x)."
  },
  {
    "id": "field-engine-src-montecarlo-frontiers-ts-module-max-frontier-points",
    "path": "engine/src/montecarlo/frontiers.ts",
    "symbol": "module",
    "field": "MAX_FRONTIER_POINTS",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Cap (15) on the number of points a frontier or annuitization sweep may evaluate; a run-size bound."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresssuite-windowlengthyears",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressSuite",
    "field": "windowLengthYears",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Length in years of each replayed historical window; a suite setting."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresssuiteoptions-equityweightpct",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressSuiteOptions",
    "field": "equityWeightPct",
    "reasonKind": "input-parameter",
    "reason": "Equity weight (default 60) used to blend the historical stock and bond returns into the portfolio return shock."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresssuiteoptions-windowlengthyears",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressSuiteOptions",
    "field": "windowLengthYears",
    "reasonKind": "input-parameter",
    "reason": "Requested historical window length in years (default: the projection length)."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresssuiteoptions-worstwindowcount",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressSuiteOptions",
    "field": "worstWindowCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "How many worst windows each suite lists (default 5); a display-size setting."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresssuiteresult-windowlengthyears",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressSuiteResult",
    "field": "windowLengthYears",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Effective window length after clamping the requested length to the projection length and the history; a suite setting repeated on each suite."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresswindow-endhistoricalyear",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressWindow",
    "field": "endHistoricalYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last historical market year of the replayed window; part of the window label."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresswindow-marketyears",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressWindow",
    "field": "marketYears",
    "reasonKind": "dimension-coordinate",
    "reason": "Historical market years replayed in projection order (wrapping the window, reversed for the reversed suite); coordinates of the replay, not an outcome."
  },
  {
    "id": "field-engine-src-montecarlo-historicalsuites-ts-historicalstresswindow-starthistoricalyear",
    "path": "engine/src/montecarlo/historicalSuites.ts",
    "symbol": "HistoricalStressWindow",
    "field": "startHistoricalYear",
    "reasonKind": "dimension-coordinate",
    "reason": "First historical market year of the replayed window; part of the window label."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-averagetargetshortfalls",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "averageTargetShortfalls",
    "reasonKind": "dimension-coordinate",
    "reason": "The aggregateMonteCarlo.averageTargetShortfalls field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-column",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "column",
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.column field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-cutdepths",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "cutDepths",
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.cutDepths field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-cutyearcounts",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "cutYearCounts",
    "reasonKind": "dimension-coordinate",
    "reason": "The aggregateMonteCarlo.cutYearCounts field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-n",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "n",
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.n field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-targetattainments",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "targetAttainments",
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.targetAttainments field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-aggregatemontecarlo-totalshortfalls",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "aggregateMonteCarlo",
    "field": "totalShortfalls",
    "reasonKind": "runtime-diagnostic",
    "reason": "The aggregateMonteCarlo.totalShortfalls field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-module-histogrambins",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "module",
    "field": "histogramBins",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.histogramBins field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-module-p",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "module",
    "field": "p",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.p field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-module-sorted",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "module",
    "field": "sorted",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.sorted field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopath-depletionyear",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPath",
    "field": "depletionYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Per-path first depletion year; the aggregate histogram keys on it and the page never shows a single path."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathoptions-completed",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathOptions",
    "field": "completed",
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPathOptions.completed field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathoptions-firstpathindex",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathOptions",
    "field": "firstPathIndex",
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPathOptions.firstPathIndex field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathoptions-pathcount",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathOptions",
    "field": "pathCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The MonteCarloPathOptions.pathCount field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathoptions-seed",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathOptions",
    "field": "seed",
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPathOptions.seed field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathoptions-startyear",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathOptions",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The MonteCarloPathOptions.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathsresult-endyear",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathsResult",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year of the path grid."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlopathsresult-startyear",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloPathsResult",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "First projection year of the path grid; positions the fan rows."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlosummary-pathcount",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloSummary",
    "field": "pathCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of simulated paths; a run-size setting the page prints beside the gauge and KPI, not a plan quantity."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-montecarlosummary-year",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "MonteCarloSummary",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year keying the depletion-year histogram, depletion-probability series and fan rows."
  },
  {
    "id": "field-engine-src-montecarlo-run-ts-yearpercentiles-year",
    "path": "engine/src/montecarlo/run.ts",
    "symbol": "YearPercentiles",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The YearPercentiles.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-compare-ts-module-charitypct",
    "path": "engine/src/projection/compare.ts",
    "symbol": "module",
    "field": "charityPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.charityPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-compare-ts-projectionsummary-year",
    "path": "engine/src/projection/compare.ts",
    "symbol": "ProjectionSummary",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ProjectionSummary.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-internal-types-aca-ts-yearacaresult-convergence-iterations",
    "path": "engine/src/projection/internal/types/aca.ts",
    "symbol": "YearAcaResult",
    "field": "convergence.iterations",
    "reasonKind": "runtime-diagnostic",
    "reason": "Number of iterations the healthcare/ACA fixed-point solve took for the year; a solver diagnostic."
  },
  {
    "id": "field-engine-src-projection-internal-types-aca-ts-yearacaresult-convergence-maxiterations",
    "path": "engine/src/projection/internal/types/aca.ts",
    "symbol": "YearAcaResult",
    "field": "convergence.maxIterations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Iteration cap of the healthcare/ACA fixed-point solve; a solver setting."
  },
  {
    "id": "field-engine-src-projection-internal-types-aca-ts-yearacaresult-convergence-residualdollars",
    "path": "engine/src/projection/internal/types/aca.ts",
    "symbol": "YearAcaResult",
    "field": "convergence.residualDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "Dollar residual of the healthcare/ACA fixed-point solve at exit; a solver diagnostic."
  },
  {
    "id": "field-engine-src-projection-internal-types-aca-ts-yearacaresult-coveredmembers-coveredmonths",
    "path": "engine/src/projection/internal/types/aca.ts",
    "symbol": "YearAcaResult",
    "field": "coveredMembers[].coveredMonths",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar months (1-12) in which the covered member had a positive enrollment premium; a coordinate list."
  },
  {
    "id": "field-engine-src-projection-internal-types-aca-ts-yearacaresult-taxfamilymembers-magi",
    "path": "engine/src/projection/internal/types/aca.ts",
    "symbol": "YearAcaResult",
    "field": "taxFamilyMembers[].magi",
    "reasonKind": "input-parameter",
    "reason": "Per-member MAGI attested in the ACA year contract (dependents); a contract input echoed into the result."
  },
  {
    "id": "field-engine-src-projection-internal-types-aca-ts-yearacaresult-taxfamilysize",
    "path": "engine/src/projection/internal/types/aca.ts",
    "symbol": "YearAcaResult",
    "field": "taxFamilySize",
    "reasonKind": "input-parameter",
    "reason": "Number of tax-family members echoed from the ACA year contract (taxFamilyMembers.length); the FPL lookup's household size, a contract input."
  },
  {
    "id": "field-engine-src-projection-internal-types-cashflow-ts-yearcashflowreconciliation-cashidentitytoleranceplandollars",
    "path": "engine/src/projection/internal/types/cashFlow.ts",
    "symbol": "YearCashFlowReconciliation",
    "field": "cashIdentityTolerancePlanDollars",
    "reasonKind": "internal-coefficient",
    "reason": "Cash-conservation tolerance aligned with the annual funding fixed point; a reconciliation constant."
  },
  {
    "id": "field-engine-src-projection-internal-types-cashflow-ts-yearcashflowreconciliation-toleranceplandollars",
    "path": "engine/src/projection/internal/types/cashFlow.ts",
    "symbol": "YearCashFlowReconciliation",
    "field": "tolerancePlanDollars",
    "reasonKind": "internal-coefficient",
    "reason": "Strict structural tolerance for the line, use, transfer and lineage checks; a reconciliation constant."
  },
  {
    "id": "field-engine-src-projection-internal-types-cashflow-ts-yearcashflowreconciliationdiagnostic-actualplandollars",
    "path": "engine/src/projection/internal/types/cashFlow.ts",
    "symbol": "YearCashFlowReconciliationDiagnostic",
    "field": "actualPlanDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "Actual amount recorded on a reconciliation failure diagnostic; never rendered."
  },
  {
    "id": "field-engine-src-projection-internal-types-cashflow-ts-yearcashflowreconciliationdiagnostic-differenceplandollars",
    "path": "engine/src/projection/internal/types/cashFlow.ts",
    "symbol": "YearCashFlowReconciliationDiagnostic",
    "field": "differencePlanDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "Expected minus actual on a reconciliation failure diagnostic; never rendered."
  },
  {
    "id": "field-engine-src-projection-internal-types-cashflow-ts-yearcashflowreconciliationdiagnostic-expectedplandollars",
    "path": "engine/src/projection/internal/types/cashFlow.ts",
    "symbol": "YearCashFlowReconciliationDiagnostic",
    "field": "expectedPlanDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "Expected amount recorded on a reconciliation failure diagnostic; graphical consumers refuse a notReconciled year and detailCsv.ts writes only the reason codes."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-projectionresult-endyear",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "ProjectionResult",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year; printed as the horizon on KPI and compare surfaces."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-projectionresult-startyear",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "ProjectionResult",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "First projection year; the coordinate every ledger surface starts from."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-yearresult-balanceindex",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "YearResult",
    "field": "balanceIndex",
    "reasonKind": "identifier",
    "reason": "Positional index of a physical owned-IRA balance row in the replay source."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-yearresult-inflationscale",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "YearResult",
    "field": "inflationScale",
    "reasonKind": "internal-coefficient",
    "reason": "Cumulative general-inflation factor for the year; drives nominal conversions inside the engine and the QCD detector targets, never printed."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-yearresult-irmaalookbackmagiyear",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "YearResult",
    "field": "irmaaLookbackMagiYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year whose MAGI the IRMAA lookback selected; positions irmaaLookbackMagi."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-yearresult-irmaatier",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "YearResult",
    "field": "irmaaTier",
    "reasonKind": "label-or-category",
    "reason": "IRMAA tier index (0 = standard, 1-5 = surcharge tiers) is a classification of the year's MAGI against the thresholds; irmaa-surcharge-annual is the numeric family. Shown as a category on the scenarios page (annual \"IRMAA tier\", \"Maximum IRMAA tier\") and the survivor page (\"tier a → b\")."
  },
  {
    "id": "field-engine-src-projection-internal-types-result-ts-yearresult-year",
    "path": "engine/src/projection/internal/types/result.ts",
    "symbol": "YearResult",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The YearResult.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-internal-types-yearledger-ts-personyearstate-ageattained",
    "path": "engine/src/projection/internal/types/yearLedger.ts",
    "symbol": "PersonYearState",
    "field": "ageAttained",
    "reasonKind": "dimension-coordinate",
    "reason": "Age attained in the calendar year (year minus birth year); printed as the age column on the ResultsPage.tsx and ReportPage.tsx year tables to place the row, not a computed amount."
  },
  {
    "id": "field-engine-src-projection-internal-types-yearledger-ts-personyearstate-lifeage",
    "path": "engine/src/projection/internal/types/yearLedger.ts",
    "symbol": "PersonYearState",
    "field": "lifeAge",
    "reasonKind": "input-parameter",
    "reason": "Effective last full year of life for the run, echoed from SimulateOptions.deathAgeByPersonId or plan longevity.planningAge so detectors can place the first deceased year; a planning input, not an output."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-acaactionabilityveto-baselinenonactionableyears",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "AcaActionabilityVeto",
    "field": "baselineNonActionableYears",
    "reasonKind": "dimension-coordinate",
    "reason": "List of years whose ACA evidence was non-actionable in the baseline; printed as a veto explanation, not a quantity."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-acaactionabilityveto-candidatenonactionableyears",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "AcaActionabilityVeto",
    "field": "candidateNonActionableYears",
    "reasonKind": "dimension-coordinate",
    "reason": "List of years whose ACA evidence was non-actionable in the candidate; printed as a veto explanation, not a quantity."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-buildacaactionabilityveto-years",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "buildAcaActionabilityVeto",
    "field": "years",
    "reasonKind": "dimension-coordinate",
    "reason": "The buildAcaActionabilityVeto.years field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-evaluateexactledgerschedule-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "evaluateExactLedgerSchedule",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The evaluateExactLedgerSchedule.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-evaluateidentitycompleteledgerschedule-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "evaluateIdentityCompleteLedgerSchedule",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The evaluateIdentityCompleteLedgerSchedule.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerconvergencediagnostics-iterations",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerConvergenceDiagnostics",
    "field": "iterations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of exact-ledger convergence iterations run; effort, not a plan quantity."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerconvergenceoptions-dampingfactor",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerConvergenceOptions",
    "field": "dampingFactor",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerConvergenceOptions.dampingFactor field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerconvergenceoptions-maxiterations",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerConvergenceOptions",
    "field": "maxIterations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerConvergenceOptions.maxIterations field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerconvergenceoptions-maxyearstepdollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerConvergenceOptions",
    "field": "maxYearStepDollars",
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerConvergenceOptions.maxYearStepDollars field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerconvergenceoptions-objectivetolerancedollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerConvergenceOptions",
    "field": "objectiveToleranceDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerConvergenceOptions.objectiveToleranceDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerconvergenceoptions-scheduletolerancedollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerConvergenceOptions",
    "field": "scheduleToleranceDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerConvergenceOptions.scheduleToleranceDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerpostprocessing-iterationcount",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerPostProcessing",
    "field": "iterationCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Post-processing iterations run; effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerpostprocessing-minimumrequestedconversiondollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerPostProcessing",
    "field": "minimumRequestedConversionDollars",
    "reasonKind": "internal-coefficient",
    "reason": "Minimum requested conversion the post-processor keeps; a threshold constant."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerpostprocessing-pruneiterationcount",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerPostProcessing",
    "field": "pruneIterationCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Post-processing prune iterations run; effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerpostprocessingoptions-maxiterations",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerPostProcessingOptions",
    "field": "maxIterations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerPostProcessingOptions.maxIterations field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerpostprocessingoptions-maxpruneiterations",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerPostProcessingOptions",
    "field": "maxPruneIterations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerPostProcessingOptions.maxPruneIterations field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerscheduleadjustment-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerScheduleAdjustment",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerScheduleAdjustment.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgerscheduleidentity-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerScheduleIdentity",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerScheduleIdentity.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgersearchoptions-maxsimulations",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerSearchOptions",
    "field": "maxSimulations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExactLedgerSearchOptions.maxSimulations field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgertournament-searchsimulations",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerTournament",
    "field": "searchSimulations",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of ledger simulations the tournament ran; effort."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgertournament-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerTournament",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ExactLedgerTournament.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgervalidationoptions-materialconversionshortfalldollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerValidationOptions",
    "field": "materialConversionShortfallDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.materialConversionShortfallDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgervalidationoptions-materialconversionshortfallpct",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerValidationOptions",
    "field": "materialConversionShortfallPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.materialConversionShortfallPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgervalidationoptions-minimumrequestedconversiondollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerValidationOptions",
    "field": "minimumRequestedConversionDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.minimumRequestedConversionDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-exactledgervalidationoptions-neutraltolerancedollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "ExactLedgerValidationOptions",
    "field": "neutralToleranceDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ExactLedgerValidationOptions.neutralToleranceDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-amount",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "amount",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.amount field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-annualreturnpct",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "annualReturnPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.annualReturnPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-balance",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "balance",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.balance field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-estate",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "estate",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.estate field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-incompletecomputationyears",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "incompleteComputationYears",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.incompleteComputationYears field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-inheritedtrad",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "inheritedTrad",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.inheritedTrad field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-other",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "other",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.other field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-publicationfloordollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "publicationFloorDollars",
    "reasonKind": "internal-coefficient",
    "reason": "Dollar floor below which a schedule year is not published; a constant."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-rate",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "rate",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.rate field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-startyear",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-taxable",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "taxable",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.taxable field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-tolerancedollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "toleranceDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.toleranceDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-trad",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "trad",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.trad field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-width",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "width",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.width field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-module-years",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "module",
    "field": "years",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.years field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-optimizeplanoptions-liquidationratepct",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "OptimizePlanOptions",
    "field": "liquidationRatePct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The OptimizePlanOptions.liquidationRatePct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-optimizeplanoptions-startyear",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "OptimizePlanOptions",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The OptimizePlanOptions.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-optimizeropeningbuckets-balance",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "optimizerOpeningBuckets",
    "field": "balance",
    "reasonKind": "runtime-diagnostic",
    "reason": "The optimizerOpeningBuckets.balance field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-optimizeropeningbuckets-costbasis",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "optimizerOpeningBuckets",
    "field": "costBasis",
    "reasonKind": "runtime-diagnostic",
    "reason": "The optimizerOpeningBuckets.costBasis field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-postprocessexactledgerschedule-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "postProcessExactLedgerSchedule",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The postProcessExactLedgerSchedule.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-promotedwinner-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "PromotedWinner",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The PromotedWinner.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-retirementactionpromotion-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "RetirementActionPromotion",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The RetirementActionPromotion.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-retirementactionpromotionyear-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "RetirementActionPromotionYear",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The RetirementActionPromotionYear.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-retirementactionreadinessveto-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "RetirementActionReadinessVeto",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The RetirementActionReadinessVeto.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-richcandidate-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "RichCandidate",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The RichCandidate.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-runexactledgertournament-switchmargindollars",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "runExactLedgerTournament",
    "field": "switchMarginDollars",
    "reasonKind": "runtime-diagnostic",
    "reason": "The runExactLedgerTournament.switchMarginDollars field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-engine-src-projection-optimizeplan-ts-withoptimizedconversions-year",
    "path": "engine/src/projection/optimizePlan.ts",
    "symbol": "withOptimizedConversions",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The withOptimizedConversions.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-module-max-relocation-candidates",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "module",
    "field": "MAX_RELOCATION_CANDIDATES",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Cap (5) on candidate states per comparison; a run-size bound."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcandidate-localratepct",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCandidate",
    "field": "localRatePct",
    "reasonKind": "input-parameter",
    "reason": "Flat local income-tax rate (percent) in the destination replacing the plan's localIncomeTaxPct; omitted means 0."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcandidate-movemonth",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCandidate",
    "field": "moveMonth",
    "reasonKind": "input-parameter",
    "reason": "Move month (1-12) for the split year, default July."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcandidate-moveyear",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCandidate",
    "field": "moveYear",
    "reasonKind": "input-parameter",
    "reason": "Calendar year of the move (split-year taxed); omitted means resident from the start."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcandidate-spendingdeltapct",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCandidate",
    "field": "spendingDeltaPct",
    "reasonKind": "input-parameter",
    "reason": "Flat cost-of-living change (percent) applied to baseline lifestyle spending plan-wide."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcandidaterow-endyear",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCandidateRow",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year of the row; RelocationComparePage.tsx uses it as the deflation anchor for the ending estate (relocation-tax-comparison)."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcandidaterow-statetaxbyyear-year",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCandidateRow",
    "field": "stateTaxByYear[].year",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of each per-year state+local tax line."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcompareoptions-montecarlo-pathcount",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCompareOptions",
    "field": "monteCarlo.pathCount",
    "reasonKind": "input-parameter",
    "reason": "Requested shared-path count for the optional Monte Carlo success column."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcompareoptions-montecarlo-seed",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCompareOptions",
    "field": "monteCarlo.seed",
    "reasonKind": "input-parameter",
    "reason": "Requested seed for the shared market paths."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcompareoptions-startyear",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationCompareOptions",
    "field": "startYear",
    "reasonKind": "input-parameter",
    "reason": "Projection start year argument of compareRelocationCandidates."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcomparison-montecarlo-pathcount",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationComparison",
    "field": "monteCarlo.pathCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of shared market paths behind the success column; printed as 'the same N paths' on RelocationComparePage.tsx."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcomparison-montecarlo-seed",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationComparison",
    "field": "monteCarlo.seed",
    "reasonKind": "runtime-diagnostic",
    "reason": "Seed of the shared market paths; a reproducibility diagnostic."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationcomparison-startyear",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationComparison",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Projection start year shared by every row."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationdriverfacts-capitalgainstaxablepct",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationDriverFacts",
    "field": "capitalGainsTaxablePct",
    "reasonKind": "internal-coefficient",
    "reason": "State parameter-pack fact: percent of net capital gain in the state base; printed in the drivers panel prose on RelocationComparePage.tsx ('X% of net gains in the state base'), a rule constant rather than a computed output."
  },
  {
    "id": "field-engine-src-projection-relocation-ts-relocationdriverfacts-topratepct",
    "path": "engine/src/projection/relocation.ts",
    "symbol": "RelocationDriverFacts",
    "field": "topRatePct",
    "reasonKind": "internal-coefficient",
    "reason": "State parameter-pack fact: top marginal bracket rate (married filing jointly, percent); printed in the drivers panel prose on RelocationComparePage.tsx ('rate X%'), a rule constant rather than a computed output."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-annualcomparisonvalues-irmaatier",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "AnnualComparisonValues",
    "field": "irmaaTier",
    "reasonKind": "label-or-category",
    "reason": "IRMAA tier index of the year (YearResult.irmaaTier); a classification, printed as 'IRMAA tier' in the annual ledger comparison."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-annualscenariocomparisonrow-year",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "AnnualScenarioComparisonRow",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of the annual ledger comparison row (union of both plans' years)."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-comparisonprovenance-startyear",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ComparisonProvenance",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Start year the comparison was run at; scenarioComparisonView.ts uses it only to test whether a cached comparison is current."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioheadlinecomparison-projectionendyear",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioHeadlineComparison",
    "field": "projectionEndYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last projection year of each plan; printed as \"Projection end year\"."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioirmaacomparison-maxtier",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioIrmaaComparison",
    "field": "maxTier",
    "reasonKind": "label-or-category",
    "reason": "Highest IRMAA tier index reached; a classification (see YearResult.irmaaTier), shown as \"Maximum IRMAA tier\"."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioplancomparisonoptions-startyear",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioPlanComparisonOptions",
    "field": "startYear",
    "reasonKind": "input-parameter",
    "reason": "Projection start year argument of compareScenarioPlans (must be an integer)."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioplancomparisonoptions-stochastic-pathcount",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioPlanComparisonOptions",
    "field": "stochastic.pathCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Requested shared-path count for the optional risk comparison; a run-size setting."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioplancomparisonoptions-stochastic-seed",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioPlanComparisonOptions",
    "field": "stochastic.seed",
    "reasonKind": "runtime-diagnostic",
    "reason": "Requested seed for the shared market paths; a reproducibility diagnostic."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioriskcomparison-depletionprobabilitybyyear-year",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioRiskComparison",
    "field": "depletionProbabilityByYear[].year",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of each cumulative depletion probability row (union of both plans' depletion years)."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioriskcomparison-provenance-pathcount",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioRiskComparison",
    "field": "provenance.pathCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Number of shared market paths; printed in the risk caption 'N paths, seed S'."
  },
  {
    "id": "field-engine-src-scenarios-comparison-ts-scenarioriskcomparison-provenance-seed",
    "path": "engine/src/scenarios/comparison.ts",
    "symbol": "ScenarioRiskComparison",
    "field": "provenance.seed",
    "reasonKind": "runtime-diagnostic",
    "reason": "Seed of the shared market paths; printed in the risk caption 'N paths, seed S' as provenance."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acaapplicablepct-fplpct",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaApplicablePct",
    "field": "fplPct",
    "reasonKind": "input-parameter",
    "reason": "FPL percentage argument of acaApplicablePct."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acaeconomicpremiumbymonth-enrollmentpremiums",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaEconomicPremiumByMonth",
    "field": "enrollmentPremiums",
    "reasonKind": "input-parameter",
    "reason": "Monthly enrollment premiums (12 entries) argument of acaEconomicPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acaeconomicpremiumbymonth-fplscale",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaEconomicPremiumByMonth",
    "field": "fplScale",
    "reasonKind": "input-parameter",
    "reason": "fplScale argument of acaEconomicPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acaeconomicpremiumbymonth-householdsize",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaEconomicPremiumByMonth",
    "field": "householdSize",
    "reasonKind": "input-parameter",
    "reason": "householdSize argument of acaEconomicPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acaeconomicpremiumbymonth-magi",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaEconomicPremiumByMonth",
    "field": "magi",
    "reasonKind": "input-parameter",
    "reason": "magi argument of acaEconomicPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acaeconomicpremiumbymonth-slcspbenchmarkpremiums",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaEconomicPremiumByMonth",
    "field": "slcspBenchmarkPremiums",
    "reasonKind": "input-parameter",
    "reason": "Monthly SLCSP benchmark premiums argument of acaEconomicPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acafederalpovertyline-fplscale",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaFederalPovertyLine",
    "field": "fplScale",
    "reasonKind": "input-parameter",
    "reason": "FPL inflation scale argument of acaFederalPovertyLine (default 1)."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acafederalpovertyline-householdsize",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaFederalPovertyLine",
    "field": "householdSize",
    "reasonKind": "input-parameter",
    "reason": "Tax-family size argument of acaFederalPovertyLine."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiinput-dependents-magi",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiInput",
    "field": "dependents[].magi",
    "reasonKind": "input-parameter",
    "reason": "Dependent MAGI attested in the ACA year contract; an input."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiinput-federalagi",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiInput",
    "field": "federalAgi",
    "reasonKind": "input-parameter",
    "reason": "Federal AGI (signed, before the household floor) passed into buildAcaHouseholdMagi from the federal probe."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiinput-foreignexclusionaddback-amount",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiInput",
    "field": "foreignExclusionAddback.amount",
    "reasonKind": "input-parameter",
    "reason": "Attested foreign earned-income exclusion amount with its state; a contract input."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiinput-grosssocialsecurity",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiInput",
    "field": "grossSocialSecurity",
    "reasonKind": "input-parameter",
    "reason": "Gross Social Security benefits passed into buildAcaHouseholdMagi."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiinput-taxablesocialsecurity",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiInput",
    "field": "taxableSocialSecurity",
    "reasonKind": "input-parameter",
    "reason": "Taxable Social Security from the federal probe passed into buildAcaHouseholdMagi."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiinput-taxexemptinterest-amount",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiInput",
    "field": "taxExemptInterest.amount",
    "reasonKind": "input-parameter",
    "reason": "Attested or plan-generated tax-exempt interest amount with its known/notApplicable/unknown state; an input."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acahouseholdmagiresult-dependents-magi",
    "path": "engine/src/tax/aca.ts",
    "symbol": "AcaHouseholdMagiResult",
    "field": "dependents[].magi",
    "reasonKind": "input-parameter",
    "reason": "Dependent MAGI echoed from the input into the result."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremium-fplscale",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremium",
    "field": "fplScale",
    "reasonKind": "input-parameter",
    "reason": "fplScale argument of the backward-compatible annual helper acaNetAnnualPremium."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremium-fullannualpremium",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremium",
    "field": "fullAnnualPremium",
    "reasonKind": "input-parameter",
    "reason": "fullAnnualPremium argument of the backward-compatible annual helper acaNetAnnualPremium."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremium-householdsize",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremium",
    "field": "householdSize",
    "reasonKind": "input-parameter",
    "reason": "householdSize argument of the backward-compatible annual helper acaNetAnnualPremium."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremium-magi",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremium",
    "field": "magi",
    "reasonKind": "input-parameter",
    "reason": "magi argument of the backward-compatible annual helper acaNetAnnualPremium."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremiumbymonth-fplscale",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremiumByMonth",
    "field": "fplScale",
    "reasonKind": "input-parameter",
    "reason": "fplScale argument of the backward-compatible monthly helper acaNetAnnualPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremiumbymonth-householdsize",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremiumByMonth",
    "field": "householdSize",
    "reasonKind": "input-parameter",
    "reason": "householdSize argument of the backward-compatible monthly helper acaNetAnnualPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremiumbymonth-magi",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremiumByMonth",
    "field": "magi",
    "reasonKind": "input-parameter",
    "reason": "magi argument of the backward-compatible monthly helper acaNetAnnualPremiumByMonth."
  },
  {
    "id": "field-engine-src-tax-aca-ts-acanetannualpremiumbymonth-monthlypremiums",
    "path": "engine/src/tax/aca.ts",
    "symbol": "acaNetAnnualPremiumByMonth",
    "field": "monthlyPremiums",
    "reasonKind": "input-parameter",
    "reason": "Monthly premiums argument of acaNetAnnualPremiumByMonth (used as both enrollment and benchmark)."
  },
  {
    "id": "field-planner-ui-src-planner-bucketlens-ts-bucketpreset-spans",
    "path": "planner-ui/src/planner/bucketLens.ts",
    "symbol": "BucketPreset",
    "field": "spans",
    "reasonKind": "runtime-diagnostic",
    "reason": "The BucketPreset.spans field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-bucketlens-ts-bucketyearrow-year",
    "path": "planner-ui/src/planner/bucketLens.ts",
    "symbol": "BucketYearRow",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The BucketYearRow.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-deterministicsuccesspct-depletionyear",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "deterministicSuccessPct",
    "field": "depletionYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The deterministicSuccessPct.depletionYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-formatdelta-value",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "formatDelta",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The formatDelta.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-lastfundedyear-depletionyear",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "lastFundedYear",
    "field": "depletionYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The lastFundedYear.depletionYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-lastfundedyear-endyear",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "lastFundedYear",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The lastFundedYear.endYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-module-value",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "module",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-moneylastsdelta-depletionyear",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "moneyLastsDelta",
    "field": "depletionYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The moneyLastsDelta.depletionYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-comparedeltas-ts-moneylastsdelta-endyear",
    "path": "planner-ui/src/planner/compareDeltas.ts",
    "symbol": "moneyLastsDelta",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The moneyLastsDelta.endYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-compareplanspage-tsx-module-endyear",
    "path": "planner-ui/src/planner/ComparePlansPage.tsx",
    "symbol": "module",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.endYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-compareplanspage-tsx-module-value",
    "path": "planner-ui/src/planner/ComparePlansPage.tsx",
    "symbol": "module",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-compareplanspage-tsx-module-year",
    "path": "planner-ui/src/planner/ComparePlansPage.tsx",
    "symbol": "module",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-montecarlopage-tsx-modelkind-pathcount",
    "path": "planner-ui/src/planner/MonteCarloPage.tsx",
    "symbol": "ModelKind",
    "field": "pathCount",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ModelKind.pathCount field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-planner-ui-src-planner-montecarlopage-tsx-modelkind-rate",
    "path": "planner-ui/src/planner/MonteCarloPage.tsx",
    "symbol": "ModelKind",
    "field": "rate",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ModelKind.rate field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-montecarlopage-tsx-montecarlopage-equityweightpct",
    "path": "planner-ui/src/planner/MonteCarloPage.tsx",
    "symbol": "MonteCarloPage",
    "field": "equityWeightPct",
    "reasonKind": "input-parameter",
    "reason": "Market-model equity weight chosen in the page controls; a run setting, not an output."
  },
  {
    "id": "field-planner-ui-src-planner-montecarlopage-tsx-montecarlopage-paths",
    "path": "planner-ui/src/planner/MonteCarloPage.tsx",
    "symbol": "MonteCarloPage",
    "field": "paths",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "Path count the page passes to the pool; a run-size setting printed beside results."
  },
  {
    "id": "field-planner-ui-src-planner-montecarlopage-tsx-montecarlopage-seed",
    "path": "planner-ui/src/planner/MonteCarloPage.tsx",
    "symbol": "MonteCarloPage",
    "field": "seed",
    "reasonKind": "runtime-diagnostic",
    "reason": "The MonteCarloPage.seed field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-optimizepage-tsx-module-value",
    "path": "planner-ui/src/planner/OptimizePage.tsx",
    "symbol": "module",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-relocationcomparepage-tsx-candidatedraft-localratepct",
    "path": "planner-ui/src/planner/RelocationComparePage.tsx",
    "symbol": "CandidateDraft",
    "field": "localRatePct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The CandidateDraft.localRatePct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-relocationcomparepage-tsx-candidatedraft-moveyear",
    "path": "planner-ui/src/planner/RelocationComparePage.tsx",
    "symbol": "CandidateDraft",
    "field": "moveYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The CandidateDraft.moveYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-relocationcomparepage-tsx-candidatedraft-spendingdeltapct",
    "path": "planner-ui/src/planner/RelocationComparePage.tsx",
    "symbol": "CandidateDraft",
    "field": "spendingDeltaPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The CandidateDraft.spendingDeltaPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-flowviewparam-year",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "FlowViewParam",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The FlowViewParam.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-inheritedschedulessection-startyear",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "InheritedSchedulesSection",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Projection start year prop of the inherited schedules section."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-inheritedschedulessection-v",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "InheritedSchedulesSection",
    "field": "v",
    "reasonKind": "runtime-diagnostic",
    "reason": "Formatter or tick callback parameter in InheritedSchedulesSection; not a quantity."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-inheritedschedulessection-year",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "InheritedSchedulesSection",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The InheritedSchedulesSection.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-module-fitarget",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "module",
    "field": "fiTarget",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.fiTarget field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-module-investable",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "module",
    "field": "investable",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.investable field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-module-startyear",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "module",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-module-v",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "module",
    "field": "v",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.v field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-module-year",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "module",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-resultspage-v",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "ResultsPage",
    "field": "v",
    "reasonKind": "runtime-diagnostic",
    "reason": "Formatter or tick callback parameter in ResultsPage; not a quantity."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-resultspage-year",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "ResultsPage",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ResultsPage.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-yearbyyearledger-v",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "YearByYearLedger",
    "field": "v",
    "reasonKind": "runtime-diagnostic",
    "reason": "Formatter or tick callback parameter in YearByYearLedger; not a quantity."
  },
  {
    "id": "field-planner-ui-src-planner-resultspage-tsx-yearbyyearledger-year",
    "path": "planner-ui/src/planner/ResultsPage.tsx",
    "symbol": "YearByYearLedger",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The YearByYearLedger.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-dollaradjuster-value",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "DollarAdjuster",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The DollarAdjuster.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-dollaradjuster-year",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "DollarAdjuster",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The DollarAdjuster.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-inheritedledgercsvvalues-inheritedevidencenote",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "inheritedLedgerCsvValues",
    "field": "inheritedEvidenceNote",
    "reasonKind": "evidence-note",
    "reason": "The inheritedLedgerCsvValues.inheritedEvidenceNote field is a narrative evidence or audit note rather than a numeric amount."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-inheritedledgercsvvalues-inheritedprofessionalconfirmation",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "inheritedLedgerCsvValues",
    "field": "inheritedProfessionalConfirmation",
    "reasonKind": "not-numeric",
    "reason": "The inheritedLedgerCsvValues.inheritedProfessionalConfirmation field is a nonnumeric object, collection, or text value."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-inheritedledgercsvvalues-inheritedrequirementkind",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "inheritedLedgerCsvValues",
    "field": "inheritedRequirementKind",
    "reasonKind": "label-or-category",
    "reason": "The inheritedLedgerCsvValues.inheritedRequirementKind field is a categorical label used to name or classify the displayed record."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-ledger-csv-columns-filingstatus",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "LEDGER_CSV_COLUMNS",
    "field": "filingStatus",
    "reasonKind": "label-or-category",
    "reason": "The LEDGER_CSV_COLUMNS.filingStatus field is a categorical label used to name or classify the displayed record."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-ledger-csv-columns-guardrailaction",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "LEDGER_CSV_COLUMNS",
    "field": "guardrailAction",
    "reasonKind": "label-or-category",
    "reason": "The LEDGER_CSV_COLUMNS.guardrailAction field is a categorical label used to name or classify the displayed record."
  },
  {
    "id": "field-planner-ui-src-planner-resultsrows-ts-ledger-csv-columns-year",
    "path": "planner-ui/src/planner/resultsRows.ts",
    "symbol": "LEDGER_CSV_COLUMNS",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The LEDGER_CSV_COLUMNS.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-careannual",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "careAnnual",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.careAnnual field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-carestartage",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "careStartAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.careStartAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-careyears",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "careYears",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.careYears field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-endyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.endYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-homesaleyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "homeSaleYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.homeSaleYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-incomechangepct",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "incomeChangePct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.incomeChangePct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-incomestartagedelta",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "incomeStartAgeDelta",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.incomeStartAgeDelta field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-movemonth",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "moveMonth",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.moveMonth field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-moveyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "moveYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.moveYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-retireagedelta",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "retireAgeDelta",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.retireAgeDelta field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-returnpct",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "returnPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.returnPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-rothannual",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "rothAnnual",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.rothAnnual field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-rothtargetvalue",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "rothTargetValue",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.rothTargetValue field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-spendpct",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "spendPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.spendPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-ssclaimage",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "ssClaimAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.ssClaimAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-sscutpct",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "ssCutPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.ssCutPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-startyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The LeverParams.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-stockpct",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "stockPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.stockPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-leverparams-survivorspendingpct",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "LeverParams",
    "field": "survivorSpendingPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The LeverParams.survivorSpendingPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-module-nextstartyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "module",
    "field": "nextStartYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.nextStartYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-module-previousstartyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "module",
    "field": "previousStartYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.previousStartYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-scenariospage-tsx-module-startyear",
    "path": "planner-ui/src/planner/ScenariosPage.tsx",
    "symbol": "module",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-sections-incomefloorsection-tsx-fedinvestsnapshot-startyear",
    "path": "planner-ui/src/planner/sections/IncomeFloorSection.tsx",
    "symbol": "FedInvestSnapshot",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Start year the TIPS price snapshot is aligned to."
  },
  {
    "id": "field-planner-ui-src-planner-sections-incomefloorsection-tsx-module-startyear",
    "path": "planner-ui/src/planner/sections/IncomeFloorSection.tsx",
    "symbol": "module",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-benefitsonlyranking-discountrate",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "benefitsOnlyRanking",
    "field": "discountRate",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The benefitsOnlyRanking.discountRate field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-candidateclaimages-startyear",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "candidateClaimAges",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The candidateClaimAges.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-claimingpeople-pia",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "claimingPeople",
    "field": "pia",
    "reasonKind": "runtime-diagnostic",
    "reason": "The claimingPeople.pia field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-dobparts-d",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "dobParts",
    "field": "d",
    "reasonKind": "runtime-diagnostic",
    "reason": "The dobParts.d field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-dobparts-m",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "dobParts",
    "field": "m",
    "reasonKind": "runtime-diagnostic",
    "reason": "The dobParts.m field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-dobparts-y",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "dobParts",
    "field": "y",
    "reasonKind": "runtime-diagnostic",
    "reason": "The dobParts.y field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-module-claimyears",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "module",
    "field": "claimYears",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.claimYears field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-module-pia",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "module",
    "field": "pia",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.pia field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-module-startyear",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "module",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysis-ts-monthlyclaim-years",
    "path": "planner-ui/src/planner/ssAnalysis.ts",
    "symbol": "MonthlyClaim",
    "field": "years",
    "reasonKind": "dimension-coordinate",
    "reason": "Whole-year part of a month-granular claim age; a coordinate."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysispage-tsx-module-ca",
    "path": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "symbol": "module",
    "field": "ca",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.ca field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysispage-tsx-module-discountpct",
    "path": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "symbol": "module",
    "field": "discountPct",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The module.discountPct field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysispage-tsx-module-ra",
    "path": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "symbol": "module",
    "field": "ra",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.ra field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysispage-tsx-module-t",
    "path": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "symbol": "module",
    "field": "t",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.t field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysispage-tsx-module-v",
    "path": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "symbol": "module",
    "field": "v",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.v field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-ssanalysispage-tsx-module-value",
    "path": "planner-ui/src/planner/SsAnalysisPage.tsx",
    "symbol": "module",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-candidatedeathages-grid",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "candidateDeathAges",
    "field": "grid",
    "reasonKind": "runtime-diagnostic",
    "reason": "The candidateDeathAges.grid field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-candidatedeathages-startyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "candidateDeathAges",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The candidateDeathAges.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-conversionleverpatch-lastjointyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "conversionLeverPatch",
    "field": "lastJointYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The conversionLeverPatch.lastJointYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-conversionleverpatch-startyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "conversionLeverPatch",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The conversionLeverPatch.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-filingsegment-fromyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "FilingSegment",
    "field": "fromYear",
    "reasonKind": "dimension-coordinate",
    "reason": "First year of a filing-status run in the survivor timeline chip."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-filingsegment-toyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "FilingSegment",
    "field": "toYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Last year of a filing-status run in the survivor timeline chip."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-module-deathage",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "module",
    "field": "deathAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.deathAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-module-v",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "module",
    "field": "v",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.v field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivoranalysis-failedtimings",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorAnalysis",
    "field": "failedTimings",
    "reasonKind": "runtime-diagnostic",
    "reason": "Count of death timings whose ledger run threw and was skipped; a run diagnostic printed as \"N death timings could not be simulated\", not a plan quantity."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivoranalysisoptions-deathages",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorAnalysisOptions",
    "field": "deathAges",
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorAnalysisOptions.deathAges field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivoranalysisoptions-startyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorAnalysisOptions",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorAnalysisOptions.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivorirmaayear-tierwithoutssa44",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorIrmaaYear",
    "field": "tierWithoutSsa44",
    "reasonKind": "label-or-category",
    "reason": "Engine irmaaTier read from the run without SSA-44 relief; a classification shown as \"tier a → b\" on the survivor page. The premium dollars are the numeric family (medicare-premiums-annual, survivor-scenario-row-ssa44premium-savings)."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivorirmaayear-tierwithssa44",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorIrmaaYear",
    "field": "tierWithSsa44",
    "reasonKind": "label-or-category",
    "reason": "Engine irmaaTier read from the run with SSA-44 relief forced on (the recomputation is engine-side via the plan flag); a classification shown as \"tier a → b\" on the survivor page."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivorirmaayear-year",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorIrmaaYear",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorIrmaaYear.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivorscenariorow-deathage",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorScenarioRow",
    "field": "deathAge",
    "reasonKind": "dimension-coordinate",
    "reason": "Swept death age from the SURVIVOR_DEATH_AGES grid (70..90 clamped to the person's ages); the row's coordinate, printed as \"Dies at\"."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivorscenariorow-deathyear",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorScenarioRow",
    "field": "deathYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Birth year plus the swept death age; a coordinate printed under \"Dies at\" and in the lever sentence."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivoryearfacts-shortfall",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorYearFacts",
    "field": "shortfall",
    "reasonKind": "runtime-diagnostic",
    "reason": "Engine YearResult.shortfall for the last joint and first survivor years, read only by isDegenerateTiming to decide whether a timing row is shown as degenerate; a display gate, never printed (the shortfall family is surfaced elsewhere)."
  },
  {
    "id": "field-planner-ui-src-planner-survivoranalysis-ts-survivoryearfacts-year",
    "path": "planner-ui/src/planner/survivorAnalysis.ts",
    "symbol": "SurvivorYearFacts",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivorYearFacts.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivortransitionpage-tsx-module-depletionyear",
    "path": "planner-ui/src/planner/SurvivorTransitionPage.tsx",
    "symbol": "module",
    "field": "depletionYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.depletionYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-survivortransitionpage-tsx-survivortransitionpage-depletionyear",
    "path": "planner-ui/src/planner/SurvivorTransitionPage.tsx",
    "symbol": "SurvivorTransitionPage",
    "field": "depletionYear",
    "reasonKind": "dimension-coordinate",
    "reason": "Prop carrying the plan's depletion year into the degenerate-timings note; the value itself is the longevity-depletion-year family."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowdialog-tsx-module-value",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowDialog.tsx",
    "symbol": "module",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowdialog-tsx-module-year",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowDialog.tsx",
    "symbol": "module",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowdialog-tsx-yearcashflowdialogprops-year",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowDialog.tsx",
    "symbol": "YearCashFlowDialogProps",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The YearCashFlowDialogProps.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-chartlink-source",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "ChartLink",
    "field": "source",
    "reasonKind": "identifier",
    "reason": "Index of the link's source node in the placed Sankey."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-module-amount",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "module",
    "field": "amount",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.amount field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-module-year",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "module",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-linkwidth",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "linkWidth",
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (linkWidth in pixels)."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-sourcecontrolx",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "sourceControlX",
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (sourceControlX in pixels)."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-sourcex",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "sourceX",
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (sourceX in pixels)."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-sourcey",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "sourceY",
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (sourceY in pixels)."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-targetcontrolx",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "targetControlX",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedLink.targetControlX field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-targetx",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "targetX",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedLink.targetX field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placedlink-targety",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedLink",
    "field": "targetY",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedLink.targetY field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placednode-height",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedNode",
    "field": "height",
    "reasonKind": "runtime-diagnostic",
    "reason": "Sankey layout geometry (node height in pixels)."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placednode-index",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedNode",
    "field": "index",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.index field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placednode-width",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedNode",
    "field": "width",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.width field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placednode-x",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedNode",
    "field": "x",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.x field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-placednode-y",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "PlacedNode",
    "field": "y",
    "reasonKind": "runtime-diagnostic",
    "reason": "The PlacedNode.y field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-yearcashflowdisplayamount-nominalamount",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "YearCashFlowDisplayAmount",
    "field": "nominalAmount",
    "reasonKind": "input-parameter",
    "reason": "Nominal amount argument of the displayAmount dollar-basis callback."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-yearcashflowdisplayamount-year",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "YearCashFlowDisplayAmount",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The YearCashFlowDisplayAmount.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-planner-yearcashflow-yearcashflowsankey-tsx-yearcashflowsankeyprops-year",
    "path": "planner-ui/src/planner/yearCashFlow/YearCashFlowSankey.tsx",
    "symbol": "YearCashFlowSankeyProps",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The YearCashFlowSankeyProps.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-buildinheritedschedules-finaldeadlineyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "buildInheritedSchedules",
    "field": "finalDeadlineYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The buildInheritedSchedules.finalDeadlineYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-buildinheritedschedules-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "buildInheritedSchedules",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The buildInheritedSchedules.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-inheritedrequirementkindlabelforyear-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "inheritedRequirementKindLabelForYear",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The inheritedRequirementKindLabelForYear.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-module-scheduleyears",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "module",
    "field": "scheduleYears",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.scheduleYears field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-module-value",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "module",
    "field": "value",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.value field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-module-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "module",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-parsedreportmodel-endyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ParsedReportModel",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ParsedReportModel.endYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-parsedreportmodel-startyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ParsedReportModel",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ParsedReportModel.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-parsedreportmodel-version",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ParsedReportModel",
    "field": "version",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ParsedReportModel.version field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-primaryinheritedregimelabel-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "primaryInheritedRegimeLabel",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The primaryInheritedRegimeLabel.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportacaledgerblock-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAcaLedgerBlock",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "Calendar year of the ACA ledger row."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportaccountrow-annualreturnpct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAccountRow",
    "field": "annualReturnPct",
    "reasonKind": "input-parameter",
    "reason": "ReportAccountRow.annualReturnPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportaccountrow-balance",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAccountRow",
    "field": "balance",
    "reasonKind": "input-parameter",
    "reason": "ReportAccountRow.balance restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-defaultreturnpct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "defaultReturnPct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.defaultReturnPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-healthcareextrainflationpct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "healthcareExtraInflationPct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.healthcareExtraInflationPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-heirtaxratepct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "heirTaxRatePct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.heirTaxRatePct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-inflationpct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "inflationPct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.inflationPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-localincometaxpct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "localIncomeTaxPct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.localIncomeTaxPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-safewithdrawalratepct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "safeWithdrawalRatePct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.safeWithdrawalRatePct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportassumptionsblock-stateeffectivetaxpct",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportAssumptionsBlock",
    "field": "stateEffectiveTaxPct",
    "reasonKind": "input-parameter",
    "reason": "ReportAssumptionsBlock.stateEffectiveTaxPct restates a plan input (account opening balance or a modeling assumption) in the report; not a computed output."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportchartdatarow-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportChartDataRow",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportChartDataRow.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportinheritedscheduleyearrow-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportInheritedScheduleYearRow",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportInheritedScheduleYearRow.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportmodel-endyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportModel",
    "field": "endYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportModel.endYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportmodel-startyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportModel",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportModel.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportmodelinput-startyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportModelInput",
    "field": "startYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportModelInput.startYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportpersonrow-planningage",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportPersonRow",
    "field": "planningAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportPersonRow.planningAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportpersonrow-retirementage",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportPersonRow",
    "field": "retirementAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportPersonRow.retirementAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportprovenance-federalparameterpackyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportProvenance",
    "field": "federalParameterPackYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportProvenance.federalParameterPackYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportprovenance-stateparameterpackyear",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportProvenance",
    "field": "stateParameterPackYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportProvenance.stateParameterPackYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-report-reportmodel-ts-reportyearledgerrow-year",
    "path": "planner-ui/src/report/reportModel.ts",
    "symbol": "ReportYearLedgerRow",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ReportYearLedgerRow.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-claimages",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "claimAges",
    "reasonKind": "dimension-coordinate",
    "reason": "The BreakEvenInput.claimAges field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-colapct",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "colaPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.colaPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-day",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "day",
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.day field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-growthpct",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "growthPct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.growthPct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-month",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "month",
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.month field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-piamonthly",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "piaMonthly",
    "reasonKind": "runtime-diagnostic",
    "reason": "The BreakEvenInput.piaMonthly field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-throughage",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "throughAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The BreakEvenInput.throughAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-breakeveninput-year",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "BreakEvenInput",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The BreakEvenInput.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-computebreakeven-a",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "computeBreakEven",
    "field": "a",
    "reasonKind": "runtime-diagnostic",
    "reason": "The computeBreakEven.a field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-computebreakeven-age",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "computeBreakEven",
    "field": "age",
    "reasonKind": "dimension-coordinate",
    "reason": "The computeBreakEven.age field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-computebreakeven-crossage",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "computeBreakEven",
    "field": "crossAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The computeBreakEven.crossAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-breakeven-ts-computebreakeven-prevdiff",
    "path": "planner-ui/src/socialSecurity/breakEven.ts",
    "symbol": "computeBreakEven",
    "field": "prevDiff",
    "reasonKind": "runtime-diagnostic",
    "reason": "The computeBreakEven.prevDiff field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-benefitfloormonthly",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "benefitFloorMonthly",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.benefitFloorMonthly field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-currentage",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "currentAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The ClaimantInput.currentAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-day",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "day",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.day field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-longevitymultiplier",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "longevityMultiplier",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.longevityMultiplier field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-month",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "month",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.month field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-piamonthly",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "piaMonthly",
    "reasonKind": "runtime-diagnostic",
    "reason": "The ClaimantInput.piaMonthly field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-claimantinput-year",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ClaimantInput",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ClaimantInput.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-expectedpvoptions-discountrate",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ExpectedPvOptions",
    "field": "discountRate",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The ExpectedPvOptions.discountRate field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-expectedpvoptions-maxage",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "ExpectedPvOptions",
    "field": "maxAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The ExpectedPvOptions.maxAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-module-age",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "module",
    "field": "age",
    "reasonKind": "dimension-coordinate",
    "reason": "The module.age field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-module-multiplier",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "module",
    "field": "multiplier",
    "reasonKind": "runtime-diagnostic",
    "reason": "The module.multiplier field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-survivalcurve-cum",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "survivalCurve",
    "field": "cum",
    "reasonKind": "runtime-diagnostic",
    "reason": "The survivalCurve.cum field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-survivalcurve-fromage",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "SurvivalCurve",
    "field": "fromAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivalCurve.fromAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-survivalcurve-fromage",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "survivalCurve",
    "field": "fromAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The survivalCurve.fromAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-survivalcurve-toage",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "SurvivalCurve",
    "field": "toAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The SurvivalCurve.toAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-expectedpv-ts-survivalcurve-toage",
    "path": "planner-ui/src/socialSecurity/expectedPv.ts",
    "symbol": "survivalCurve",
    "field": "toAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The survivalCurve.toAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-bendtier-first",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "BendTier",
    "field": "first",
    "reasonKind": "label-or-category",
    "reason": "BendTier.first: the bend-point tier the next AIME dollar falls in, printed as the label \"90% / 32% / 15%\"; the bend points themselves are parameter-pack data."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-bendtier-marginalrate",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "BendTier",
    "field": "marginalRate",
    "reasonKind": "label-or-category",
    "reason": "BendTier.marginalRate: the bend-point tier the next AIME dollar falls in, printed as the label \"90% / 32% / 15%\"; the bend points themselves are parameter-pack data."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-bendtier-second",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "BendTier",
    "field": "second",
    "reasonKind": "label-or-category",
    "reason": "BendTier.second: the bend-point tier the next AIME dollar falls in, printed as the label \"90% / 32% / 15%\"; the bend points themselves are parameter-pack data."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-bendtierforaime-aime",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "bendTierForAime",
    "field": "aime",
    "reasonKind": "input-parameter",
    "reason": "AIME argument to the bend-tier lookup (engine piaFromEarnings output passed in)."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-bendtierforaime-eligibilityyear",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "bendTierForAime",
    "field": "eligibilityYear",
    "reasonKind": "dimension-coordinate",
    "reason": "The bendTierForAime.eligibilityYear field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-estimatecredits-override",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "estimateCredits",
    "field": "override",
    "reasonKind": "input-parameter",
    "reason": "User-entered credit count that overrides the estimate."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-explain-ts-replacezeroyeargain-indexedannual",
    "path": "planner-ui/src/socialSecurity/explain.ts",
    "symbol": "replaceZeroYearGain",
    "field": "indexedAnnual",
    "reasonKind": "input-parameter",
    "reason": "Sample indexed earnings the explainer plugs in."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-ficareturn-ts-ficaoasdipaidin-amount",
    "path": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "symbol": "ficaOasdiPaidIn",
    "field": "amount",
    "reasonKind": "input-parameter",
    "reason": "Earnings-history amount iterated by the paid-in sum."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-ficareturn-ts-ficaoasdipaidin-year",
    "path": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "symbol": "ficaOasdiPaidIn",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The ficaOasdiPaidIn.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-ficareturn-ts-ficapaidinoptions-oasdiemployeeratepct",
    "path": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "symbol": "FicaPaidInOptions",
    "field": "oasdiEmployeeRatePct",
    "reasonKind": "runtime-diagnostic",
    "reason": "The FicaPaidInOptions.oasdiEmployeeRatePct field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-ficareturn-ts-ficapaidinoptions-wagebasefallback",
    "path": "planner-ui/src/socialSecurity/ficaReturn.ts",
    "symbol": "FicaPaidInOptions",
    "field": "wageBaseFallback",
    "reasonKind": "dimension-coordinate",
    "reason": "The FicaPaidInOptions.wageBaseFallback field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-currentage",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "currentAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The SwitchingInput.currentAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-day",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "day",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.day field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-deceasedpiamonthly",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "deceasedPiaMonthly",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.deceasedPiaMonthly field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-longevitymultiplier",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "longevityMultiplier",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.longevityMultiplier field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-month",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "month",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.month field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-ownpiamonthly",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "ownPiaMonthly",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.ownPiaMonthly field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-survivormonthly",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "survivorMonthly",
    "reasonKind": "runtime-diagnostic",
    "reason": "The SwitchingInput.survivorMonthly field is an internal diagnostic used to trace or validate calculation behavior."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchinginput-year",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingInput",
    "field": "year",
    "reasonKind": "dimension-coordinate",
    "reason": "The SwitchingInput.year field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchingoptions-discountrate",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingOptions",
    "field": "discountRate",
    "reasonKind": "sample-size-or-count-setting",
    "reason": "The SwitchingOptions.discountRate field is a run-size setting or execution count that describes calculation effort."
  },
  {
    "id": "field-planner-ui-src-socialsecurity-survivorswitching-ts-switchingoptions-maxage",
    "path": "planner-ui/src/socialSecurity/survivorSwitching.ts",
    "symbol": "SwitchingOptions",
    "field": "maxAge",
    "reasonKind": "dimension-coordinate",
    "reason": "The SwitchingOptions.maxAge field is a coordinate such as year, age, or offset used to place another value."
  },
  {
    "id": "insight-aca-threshold-proximity",
    "path": "engine/src/insights/detectors/acaThresholdProximity.ts",
    "symbol": "aca-threshold-proximity",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector aca-threshold-proximity publishes only status text and coordinates on its card: Publishes the year, the parameter-pack FPL boundary percent and status text; the household MAGI, FPL percentage and credit at stake are card evidence, which InsightCardView.tsx does not render at pin fb398216."
  },
  {
    "id": "insight-law-pack-drift",
    "path": "engine/src/insights/detectors/lawPackDrift.ts",
    "symbol": "law-pack-drift",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector law-pack-drift publishes only status text and coordinates on its card: Publishes the plan's last-saved year, the active parameter year and data vintage; status text only."
  },
  {
    "id": "insight-missing-data-basis",
    "path": "engine/src/insights/detectors/missingDataBasis.ts",
    "symbol": "missing-data-basis",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector missing-data-basis publishes only status text and coordinates on its card: Publishes which basis and retirement-date facts use planning defaults; the affected balances are card evidence, which InsightCardView.tsx does not render."
  },
  {
    "id": "insight-qcd-efficiency",
    "path": "engine/src/insights/detectors/qcdEfficiency.ts",
    "symbol": "qcd-efficiency",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector qcd-efficiency publishes only status text and coordinates on its card: Publishes the plan's charitable giving and current QCD (both plan inputs) and status text; the exact preview delta is the shared decision evaluator (insight-impact families)."
  },
  {
    "id": "insight-roth-bridge-headroom",
    "path": "engine/src/insights/detectors/rothBridgeHeadroom.ts",
    "symbol": "roth-bridge-headroom",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector roth-bridge-headroom publishes only status text and coordinates on its card: Publishes the first and last low-income bridge years and status text; the traditional balance is card evidence, not rendered."
  },
  {
    "id": "insight-ss-claim-milestone",
    "path": "engine/src/insights/detectors/ssClaimMilestone.ts",
    "symbol": "ss-claim-milestone",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector ss-claim-milestone publishes only status text and coordinates on its card: Publishes the configured claim age, attained age and first payable year; the modeled first-year benefit is card evidence, not rendered."
  },
  {
    "id": "insight-stale-plan-data",
    "path": "engine/src/insights/detectors/stalePlanData.ts",
    "symbol": "stale-plan-data",
    "field": "card",
    "reasonKind": "label-or-category",
    "reason": "Insight detector stale-plan-data publishes only status text and coordinates on its card: Publishes the last-saved year-month, the current planning year and the gap in years; status text only."
  }
] satisfies readonly RawExclusion[]

export const OUTPUT_FIELD_COVERAGE = Object.freeze(
  (coverageCensus as readonly RawCoverage[]).map(coverageRow).sort(
    (left, right) =>
      compareStrings(left.source, right.source) ||
      compareStrings(left.owner, right.owner) ||
      compareStrings(left.field, right.field),
  ),
) as readonly OutputFieldCoverageRow[]

export const OUTPUT_FIELD_EXCLUSIONS = Object.freeze(
  (exclusionCensus as readonly RawExclusion[]).map(exclusionRow).sort((left, right) =>
    compareStrings(left.id, right.id),
  ),
) as readonly OutputFieldExclusion[]
