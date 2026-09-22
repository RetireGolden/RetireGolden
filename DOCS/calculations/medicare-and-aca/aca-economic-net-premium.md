## Claim

Kind: formula. `tax/aca.ts#acaEconomicPremiumByMonth` computes annual economic net premium as gross enrollment premium minus modeled allowable PTC, floored at zero.

## Justification

The credit reduces the household's economic enrollment-premium cost, so for gross premium \(E\ge0\) and allowable credit \(P\ge0\), net cost is \(\max(0,E-P)\). It does not claim cash timing because APTC is outside this module.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Gross enrollment premium | 10,000 | dollars/year |
| Modeled allowable PTC | 9,208.20 | dollars/year |

The credit comes from the companion 2026 allowable-PTC worksheet.

## Arithmetic

Economic net premium: `max(0, $10,000 - $9,208.20) = $791.80`.

## Expected

Exact derived and published figure: `$791.80`; fixture tolerance: absolute `$0.005` for cents computed in binary floating point.

## Wrong readings

- Subtracting the credit from the SLCSP produces `$2,791.80`.
- Reversing the subtraction and flooring produces `$0`.

## Family

outputs: `aca-economic-net-premium-annual`.

feeds: `spending-healthcare-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
