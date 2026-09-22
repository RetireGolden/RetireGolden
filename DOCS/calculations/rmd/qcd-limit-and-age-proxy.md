## Claim

Kind: data. `projection/internal/types/result.ts#YearResult.qcd` caps each donor at `params/data/year2026.ts#year2026.rmd.qcdAnnualLimit` multiplied by the applicable limit-growth factor, and uses an annual proxy for age 70½: eligible at attained age 71, or at attained age 70 when birth month is June or earlier.

## Justification

The field comment states both conventions. For the published 2026 pack year, limit growth is 1, so the indexed personal cap equals the stored `$111,000` constant.

## Inputs

| Case | Age attained | Birth month | Requested gift | Limit growth |
|---|---:|---:|---:|---:|
| At cap, eligible | 71 | December | 111,000 | 1 |
| Age-gate eligible side | 70 | June | 1,000 | 1 |
| Age-gate ineligible side | 70 | July | 1,000 | 1 |

The base is `year2026.rmd.qcdAnnualLimit = 111_000`.

## Arithmetic

2026 per-donor cap: `111,000 × 1 = $111,000`.

Age 71 qualifies regardless of birth month, so the at-cap gift is `$111,000`.

Age 70 with birth month June satisfies “June or earlier,” so `$1,000` is within the age proxy. Age 70 with birth month July does not, so `$0` is qualified under this proxy.

## Expected

Exact derived qualified gross gifts: age-71 at-limit case `$111,000`; age-70/June case `$1,000`; age-70/July case `$0`. Fixture tolerance: exact to the cent for dollars and exact boolean age-gate comparison, because the pack value and annual proxy are discrete.

## Wrong readings

- Treating every attained-age-70 donor as eligible admits the July case.
- Requiring attained age 71 rejects the June case.
- Applying the `$111,000` cap per household rather than per donor changes a two-donor plan.
- Applying limit growth twice overstates the indexed cap.

## Family

outputs: `qcd-annual`.

feeds: `tax-total-annual`; `magi-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory.
