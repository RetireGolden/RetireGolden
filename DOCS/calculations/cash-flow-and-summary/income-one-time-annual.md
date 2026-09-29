## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.incomes.oneTime`, produced by `projection/internal/otherIncomeStreams.ts#otherIncomeStreams`, pays a one-time stream only in its named year while any household member is alive, multiplying by the supplied cumulative general-inflation factor only when `inflationAdjusted` is true. The formula is derived from the extract's stated year, household gate, and inflation-election convention.

## Justification

The required election distinguishes today's dollars from dollars of the payment year. Tax treatment controls ordinary/capital-gain routing, not the published cash amount.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Payment year / current year | 2031 / 2031 | year |
| Amount | 50,000 | today dollars |
| Inflation adjusted | true | Boolean |
| Cumulative inflation factor | 1.12 | nominal/today ratio |
| Any household member alive | true | Boolean |
| Tax treatment | capital gain | treatment |

## Arithmetic

The year and household gates pass. Amount `= 50,000 × 1.12 = $56,000`.

## Expected

Exact value: `$56,000`. Fixture tolerance: absolute `$0.005`, because inflation multiplication uses binary floating point.

## Wrong readings

- Treating the amount as already nominal produces `$50,000`.
- Paying it in 2030 or 2032 produces `$56,000`; the exact-year gate instead produces `$0`.
- Treating capital-gain tax character as exclusion from cash income produces `$0`.

## Family

outputs: `income-one-time-annual`.

feeds: `income-total-annual`.

## Dated before the start year (D-2027-ROLLOVER)

A stream whose year is before the projection start year pays nothing, as the exact-year gate above already says: from a 2027 start a 2026 stream never reaches a projected year. What changed is that it is no longer silent. The projection adds one warning naming it (`projection/preStartEvents.ts#preStartEvents`):

> The Inheritance income is dated 2026, before this plan starts in 2027, so it is not counted. If it has not arrived, move it to 2027 or later.

Worked case (the derivation's U1 inheritance): $50,000, not inflation-adjusted, dated 2026. From a 2026 start the 2026 row pays `$50,000` and no warning is added; from a 2027 start every row pays `$0` and the warning above is added. The evidence file asserts both.

Restated 2026-09-28 by the implementer of decision D-2027-ROLLOVER (Claude Opus 5.5), from the derivation and the independent check in C:/rgwt/staging/rollover-2027/ (derivation.md, check.md). Not yet reviewed: the record is `reviewedBy: 'unreviewed'`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-six.md in this directory.
