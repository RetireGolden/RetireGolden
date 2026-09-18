## Claim

Kind: model. `insights/detectors/hecmBufferCandidate.ts#hecmBufferCandidate.screen` illustrates for a primary residence worth at least `$100,000`, youngest borrower age at least 62, no modeled HECM and home-to-investable ratio at least `0.75` a nominal initial credit line equal to the applicable principal-limit factor times home value, while publishing the compared investable sum across cash, taxable, equity compensation, traditional, Roth and HSA balances.

## Justification

The model screens for a house-rich, portfolio-thin case and sizes an illustrative line from the published age factor; its intended use is to preview a coordinated HECM scenario whose sequence effect is evaluated stochastically. It does not claim the line is a lender quote, available after underwriting, or valuable on the deterministic path. The domain requires a resolved youngest-borrower factor and nonnegative balances.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Youngest borrower age | 65 | years |
| Primary residence value | 400,000 | nominal dollars |
| Principal-limit factor | 45 | percent |
| Cash / taxable / equity comp | 20,000 / 90,000 / 10,000 | nominal dollars |
| Traditional / Roth / HSA | 180,000 / 80,000 / 20,000 | nominal dollars |
| Existing HECM | no | boolean |

## Arithmetic

Investable `=$20,000+$90,000+$10,000+$180,000+$80,000+$20,000=$400,000`. Home-to-investable ratio `=$400,000/$400,000=1`, which clears `0.75`. Credit line `=$400,000*(45/100)=$180,000`.

## Expected

Illustrative credit line is exactly `$180,000.00` and compared investable is exactly `$400,000.00`, with exact-cent tolerance because the inputs and multiplication are exact here.

## Wrong readings

- Multiplying by `45` rather than `0.45` gives `$18,000,000.00`.
- Excluding Roth and HSA from investable gives `$300,000.00`, changing the ratio to `4/3`.

## Family

outputs: `insight-hecm-buffer-illustrative-credit-line`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.
