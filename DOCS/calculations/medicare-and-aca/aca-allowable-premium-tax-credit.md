## Claim

Kind: formula. `tax/aca.ts#acaEconomicPremiumByMonth` computes current-year modeled allowable PTC from the SLCSP benchmark less expected contribution, floored at zero and capped by actual enrollment premium; it is annual planning math, not APTC timing or Form 8962 reconciliation.

## Justification

Preliminary credit is \(\max(0,S-C)\), where \(S\) is applicable annual SLCSP and \(C\) expected contribution. Allowable credit cannot exceed enrollment premium \(E\), so \(P=\min(E,\max(0,S-C))\). Domain: nonnegative annual premium totals and an eligible household.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Applicable SLCSP premium | 12,000 | dollars/year |
| Expected contribution | 2,791.80 | dollars/year |
| Gross enrollment premium | 10,000 | dollars/year |

The contribution is the independently derived result of the 2026 200%-FPL example using `year2026.aca.applicablePctBreakpoints`.

## Arithmetic

Preliminary credit: `max(0, $12,000 - $2,791.80) = $9,208.20`.

Enrollment cap: `min($10,000, $9,208.20) = $9,208.20`.

## Expected

Exact derived modeled allowable PTC: `$9,208.20`; published figure: `$9,208.20`; fixture tolerance: absolute `$0.005` for cents computed in binary floating point.

## Wrong readings

- Subtracting enrollment premium rather than SLCSP produces `$7,208.20`.
- Omitting the zero floor when contribution exceeds SLCSP can publish a negative credit.

## Family

outputs: `aca-modeled-allowable-ptc-annual`.

feeds: `aca-economic-net-premium-annual`; `spending-healthcare-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
