## Claim

Kind: composition. `tax/federalTax.ts#amtExemptionAmount; #amtOrdinaryRateTax; #tentativeMinimumTax; #computeFederalTax` computes the planning-grade 2026 single-filer AMT screen as tentative minimum tax on AMTI after its phased exemption, with preferential-rate awareness, less regular tax but not below zero; this no-preferential-income case uses the convention stated by the comments.

## Justification

With AMTI \(A\), exemption \(E\), phaseout start \(P\), phaseout rate \(q\), the exemption is \(\max(0,E-q\max(0,A-P))\). Taxable excess is \(\max(0,A-E')\). With no preferential income, apply 26% through the rate threshold and 28% above it. AMT is the nonnegative excess over regular tax. This is a planning screen, not a full Form 6251 claim.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Filing status | single | status |
| AMTI | 200,000 | dollars/year |
| Preferential income | 0 | dollars/year |
| Regular tax | 20,000 | dollars/year |
| Exemption | 90,100 | dollars/year |
| Phaseout starts | 500,000 | dollars/year |
| Phaseout rate | 50 | percent |
| 28% starts above | 244,500 | taxable-excess dollars |
| AMT rates | 26 / 28 | percent |

Parameters are `year2026.federalTax.amt`.

## Arithmetic

No phaseout applies, so exemption is `$90,100`.

Taxable excess: `$200,000 - $90,100 = $109,900`.

Tentative minimum tax: `$109,900 × 26/100 = $28,574`.

AMT: `max(0, $28,574 - $20,000) = $8,574`.

## Expected

Unrounded tentative minimum tax: `$28,574`; published AMT: `$8,574`; fixture tolerance: exact, because the selected inputs yield whole-dollar products and the extract states no rounding step.

## Wrong readings

- Treating the exemption as a deduction from regular tax produces `$0` AMT (`$20,000 - $90,100`).
- Charging 28% from the first dollar of taxable excess produces tentative tax `$30,772` and AMT `$10,772`.

## Family

outputs: `tax-amt-annual`.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-three.md in this directory.
