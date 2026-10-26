## Claim

Kind: formula. `projection/internal/types/result.ts#YearResult.employerMatch`, planned by `projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch`, is `min(elective deferral landed, capPctOfPay/100 × min(wages, K)) × matchPct/100`, where `K` is the IRC §401(a)(17) annual compensation limit, capped by the owner's remaining IRC §415(c) room for that plan after elective deferrals. The 2026 pack fixes `K` at `$360,000` (Notice 2025-67) and the §415(c) limit at `$72,000`.

## Justification

The match is computed only after all elective deferrals land, so the remaining annual-additions room can cap the raw employer match.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Year | 2026 | year |
| Wages | 75,000 | nominal dollars/year |
| Elective deferral landed | 24,500 | nominal dollars/year |
| Match cap | 50 | percent of pay |
| Match percentage | 200 | percent of matched elective base |
| 2026 §401(a)(17) compensation limit `K` | 360,000 | nominal dollars/year |
| 2026 §415(c) limit | 72,000 | nominal dollars/year |
| Other annual additions in this plan | 0 | nominal dollars/year |

## Arithmetic

Compensation taken into account `= min($75,000, $360,000) = $75,000`. Pay cap `= 50% × $75,000 = $37,500`. Matched elective base `= min($24,500, $37,500) = $24,500`. Raw match `= $24,500 × 200% = $49,000`. Remaining §415(c) room `= $72,000 - $24,500 = $47,500`. Credited match `= min($49,000, $47,500) = $47,500`.

## Expected

Exact value: `employerMatch = $47,500`. Fixture tolerance: absolute `$0.005`, because percent multiplication and the annual room comparison use binary floating point.

## Wrong readings

- Ignoring the §415(c) cap produces `$49,000`.
- Applying `matchPct` to all wages produces `$150,000`.
- Applying the pay cap after multiplying the elective deferral by 200% produces `min($49,000, $37,500) = $37,500` before the §415(c) cap.

## Family

outputs: `year-result-employer-match`.

feeds: `accounts-ending-balance-by-category`; `cash-flow-line-plan-dollars`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.

Amended 2026-10-26 by claude (opus 5.5), the implementer, when the engine began applying IRC §401(a)(17) (`irc-401-a-17-plan-compensation-cap`): the claim, the inputs and the first arithmetic step gain the compensation limit `K`. This case's $75,000 of wages is under `K`, so every figure above is unchanged and the review of 2026-09-18 still covers them; the limit is exercised by that rule's fixture (wages $500,000: pay cap `6% × min($500,000, $360,000) = $21,600`, against `$24,500` on uncapped wages). The amendment itself has not had an independent review.
