# California and Minnesota 2026 parameter correction — case-delta adjudication

**Prepared:** 2026-09-08  
**Verdict:** `SUPPORTED_INTENTIONAL_DELTAS`  
**Scope:** the 22 metric deltas emitted by `pnpm cases:diff` for the CA/MN annual-parameter patch.

## Immutable evidence

| Artifact | SHA-256 |
|---|---|
| Before manifest ([ca-mn-cases-before.json](ca-mn-parameter-correction-2026-09-08/ca-mn-cases-before.json)) | `7c9a667d07a67c3311aea9e00ecb8fe7844a7cb83a1ed2ca6b05f36d1017e76b` |
| After manifest ([ca-mn-cases-after.json](ca-mn-parameter-correction-2026-09-08/ca-mn-cases-after.json)) | `1ec994933970f32a8bc7f7e5f8b055a437a5f33369757aaf56628f1fcf36aeed` |
| Diff log ([ca-mn-cases-diff.log](ca-mn-parameter-correction-2026-09-08/ca-mn-cases-diff.log)) | `d03cfa233af72140bac5029f9080413c820e751477f3f8ec5794b3a035c344c2` |
| Direct after observation ([ca-mn-after-main.json](ca-mn-parameter-correction-2026-09-08/ca-mn-after-main.json)) | `63caf404b2c62abcde5059c7642ad01072571038993d247e3a81f3abbbb36dc0` |

Both manifests carry the same **29** case IDs. Exactly **five** cases differ, exclusively in the **22** metrics printed by the diff log. No warning, recommendation, depletion-year, case-membership, or option delta appears.

The three JSON artifacts are preserved byte-for-byte from the observed runs. The diff log preserves its result header and all 22 delta rows; machine-specific command boilerplate and the expected pre-allowlist exit-1 trailer are omitted. Its published hash binds this extracted log. The original run classified all 22 differences as unexpected before the scoped allowance was applied. The observation's head field names the base checkout; the after values were captured with this PR's parameter changes applied before commit.

## Case-delta table

Every affected builder is a single-filer California plan with `stateMoves: []`. No default Minnesota example is represented in the manifest; Minnesota remains covered by targeted state fixtures and state-only plan rows rather than this allowance.

| Case | Exposure | Metric deltas | Lifetime tax Δ |
|---|---|---|---|
| `example:bridge-early-retirement` | single, CA, no moves | after-tax estate `+4,178`; investable/net worth `+4,701` | `-175` |
| `example:early-career-match` | single, CA, no moves | after-tax estate/investable/net worth `+2,631` | `-790` |
| `example:glidepath-allocation` | single, CA, no moves; `fillToTarget` Roth | after-tax estate/investable/net worth `+619`; Roth conversions `+204` | `-165` |
| `example:hsa-stealth-retirement` | single, CA, no moves | after-tax estate `+7,972`; investable/net worth `+9,472` | `-207` |
| `example:static-allocation-control` | single, CA, no moves; `fillToTarget` Roth | after-tax estate/investable/net worth `+363`; Roth conversions `+157` | `-104` |

Direction is uniform: lower `lifetimeTaxesAndPenalties` and higher terminal wealth. Only the two cases with an existing `fillToTarget` Roth strategy move `lifetimeRothConversions` (small positive feedback from retained cash and balance headroom). The glidepath/static pair shares the same causal chain.

## Exact scoped allowance

Protocol: `pnpm cases:diff --base <before> --head <after> --allowlist <allowlist>` (`app/src/cases/caseDiff.ts`). Match by exact `caseId` **and** `metric`; omitting `metric` would permit every metric for that case. A rerun with the allowlist below should report **22 allowed** and **0 unexpected** differences. The allowlist schema does not bind expected values — preserve the before/after manifest hashes above with any gate receipt.

```json
{
  "allowed": [
    { "caseId": "example:bridge-early-retirement", "metric": "endingAfterTaxEstate", "reason": "CA TY2026 deduction correction; observed +4178 terminal after-tax estate" },
    { "caseId": "example:bridge-early-retirement", "metric": "endingInvestable", "reason": "CA TY2026 deduction correction; observed +4701 retained and compounded investable assets" },
    { "caseId": "example:bridge-early-retirement", "metric": "endingNetWorth", "reason": "CA TY2026 deduction correction; observed +4701 retained and compounded net worth" },
    { "caseId": "example:bridge-early-retirement", "metric": "lifetimeTaxesAndPenalties", "reason": "CA TY2026 deduction correction; observed -175 modeled lifetime tax/penalty total" },
    { "caseId": "example:early-career-match", "metric": "endingAfterTaxEstate", "reason": "CA TY2026 deduction correction; observed +2631 terminal after-tax estate" },
    { "caseId": "example:early-career-match", "metric": "endingInvestable", "reason": "CA TY2026 deduction correction; observed +2631 retained and compounded investable assets" },
    { "caseId": "example:early-career-match", "metric": "endingNetWorth", "reason": "CA TY2026 deduction correction; observed +2631 retained and compounded net worth" },
    { "caseId": "example:early-career-match", "metric": "lifetimeTaxesAndPenalties", "reason": "CA TY2026 deduction correction; observed -790 modeled lifetime tax/penalty total" },
    { "caseId": "example:glidepath-allocation", "metric": "endingAfterTaxEstate", "reason": "CA TY2026 deduction correction; observed +619 terminal after-tax estate" },
    { "caseId": "example:glidepath-allocation", "metric": "endingInvestable", "reason": "CA TY2026 deduction correction; observed +619 retained and compounded investable assets" },
    { "caseId": "example:glidepath-allocation", "metric": "endingNetWorth", "reason": "CA TY2026 deduction correction; observed +619 retained and compounded net worth" },
    { "caseId": "example:glidepath-allocation", "metric": "lifetimeTaxesAndPenalties", "reason": "CA TY2026 deduction correction; observed -165 modeled lifetime tax/penalty total" },
    { "caseId": "example:glidepath-allocation", "metric": "lifetimeRothConversions", "reason": "CA deduction cash/balance feedback through the existing fill-to-target strategy; observed +204" },
    { "caseId": "example:hsa-stealth-retirement", "metric": "endingAfterTaxEstate", "reason": "CA TY2026 deduction correction; observed +7972 terminal after-tax estate" },
    { "caseId": "example:hsa-stealth-retirement", "metric": "endingInvestable", "reason": "CA TY2026 deduction correction; observed +9472 retained and compounded investable assets" },
    { "caseId": "example:hsa-stealth-retirement", "metric": "endingNetWorth", "reason": "CA TY2026 deduction correction; observed +9472 retained and compounded net worth" },
    { "caseId": "example:hsa-stealth-retirement", "metric": "lifetimeTaxesAndPenalties", "reason": "CA TY2026 deduction correction; observed -207 modeled lifetime tax/penalty total" },
    { "caseId": "example:static-allocation-control", "metric": "endingAfterTaxEstate", "reason": "CA TY2026 deduction correction; observed +363 terminal after-tax estate" },
    { "caseId": "example:static-allocation-control", "metric": "endingInvestable", "reason": "CA TY2026 deduction correction; observed +363 retained and compounded investable assets" },
    { "caseId": "example:static-allocation-control", "metric": "endingNetWorth", "reason": "CA TY2026 deduction correction; observed +363 retained and compounded net worth" },
    { "caseId": "example:static-allocation-control", "metric": "lifetimeTaxesAndPenalties", "reason": "CA TY2026 deduction correction; observed -104 modeled lifetime tax/penalty total" },
    { "caseId": "example:static-allocation-control", "metric": "lifetimeRothConversions", "reason": "CA deduction cash/balance feedback through the existing fill-to-target strategy; observed +157" }
  ]
}
```

## Limits

- Aggregate case manifests do not expose annual state-tax rows; this adjudication establishes causal consistency and isolation, not a year-by-year decomposition.
- No Minnesota case-diff coverage is inferred from the absence of Minnesota changes.
- California and Minnesota calendar-year records expire after 2026; `stateParamsFor` may reuse the 2026 pack in later plan years as a planning stand-in, not certification of future law.
- No complete state return, credit, itemization, or Minnesota Social Security runtime closure is certified.
