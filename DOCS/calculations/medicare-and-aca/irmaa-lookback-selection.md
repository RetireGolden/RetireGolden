## Claim

Kind: model. `projection/internal/annualHealthcareExpenses.ts#annualHealthcareExpenses` resolves premium-year IRMAA MAGI from year minus two, except that an active SSA-44 life-changing event selects year minus one only when it is lower; a tie retains year minus two. For lookback years before the projection ledger, `resolveMagiFor` falls back to the plan's matching `historicalAnnualMagiByYear[year]`, then its coarse `recentAnnualMagi` stand-in. This selection formula is derived from the conventions stated by `YearResult.magi` and the published lookback fields.

## Justification

The selected year and source are observable outputs, not merely inputs to premium arithmetic. Strictly-lower comparison explains why equal MAGIs preserve the ordinary two-year year.

## Inputs

| Case | Premium/start year | SSA-44 active | Year - 2 MAGI/source | Year - 1 MAGI/source |
|---|---:|---|---|---|
| Ordinary projected | 2028 / 2026 | no | 120,000 / projected | 90,000 / projected |
| SSA-44 lower | 2028 / 2026 | yes | 120,000 / projected | 90,000 / projected |
| SSA-44 tie | 2028 / 2026 | yes | 100,000 / projected | 100,000 / projected |

Initial fallback checks: for premium year 2026/start 2026, historical 2024 MAGI is `$125,000`; for premium year 2027, absent a 2025 historical entry, `recentAnnualMagi` is `$80,000`.

## Arithmetic

Ordinary: select `2028 - 2 = 2026`, `$120,000`.

SSA-44 lower: compare `$120,000` with `$90,000`; select 2027, `$90,000`.

SSA-44 tie: `$100,000` is not lower than `$100,000`; retain 2026, `$100,000`.

Initial years: 2026 selects historical-input year 2024 at `$125,000`; 2027 requests 2025 and, with no matching historical value, selects plan-fallback `$80,000` for year 2025.

## Expected

Exact derived selections: ordinary `(2026, $120,000, projected)`; SSA-44 lower `(2027, $90,000, projected)`; SSA-44 tie `(2026, $100,000, projected)`; first-year fallback `(2024, $125,000, historicalInput)`; second-year fallback `(2025, $80,000, planFallback)`. Fixture tolerance: exact for year/source enums and exact to the cent for MAGI, because selection performs no numerical approximation.

## Wrong readings

- SSA-44 always selecting year minus one chooses 2027 even in the tie case.
- Taking the lower value without an SSA-44 event selects `$90,000` in the ordinary case.
- Using current-year MAGI ignores the lookback.
- Treating `recentAnnualMagi` as historical evidence misstates its documented coarse-stand-in source.

## Family

outputs: none.

feeds: `irmaa-surcharge-annual`; `medicare-premiums-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.
