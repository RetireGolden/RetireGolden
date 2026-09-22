## Claim

Kind: composition. `projection/compare.ts#ProjectionSummary.endingByCategory` sums the last ledger year's published balances by the corresponding selected logical account type: cash, taxable, traditional, Roth, and HSA. Equity-compensation balances are not one of this summary's five published categories.

## Justification

The summary is explicitly end-of-plan and category-based, so it uses only the final year row and the account types associated with its balance IDs.

## Inputs

| Account ID | Plan type | Last-year balance | Unit |
|---|---|---:|---|
| `cash-1` | cash | 10,000 | nominal dollars |
| `tax-1` | taxable | 20,000 | nominal dollars |
| `tax-2` | taxable | 5,000 | nominal dollars |
| `trad-1` | traditional | 30,000 | nominal dollars |
| `roth-1` | roth | 40,000 | nominal dollars |
| `hsa-1` | hsa | 6,000 | nominal dollars |

## Arithmetic

Cash `= $10,000`. Taxable `= $20,000 + $5,000 = $25,000`. Traditional `= $30,000`. Roth `= $40,000`. HSA `= $6,000`.

## Expected

Exact value: `endingByCategory = { cash: $10,000, taxable: $25,000, traditional: $30,000, roth: $40,000, hsa: $6,000 }`. Fixture tolerance: absolute `$0.005` per dollar member, because balances and category folds use binary floating point.

## Wrong readings

- Using the penultimate year rather than the last year produces that earlier row's category totals.
- Keeping the two taxable accounts separate fails to publish the required `$25,000` category sum.
- Adding property or insurance cash value creates categories this summary does not publish.

## Family

outputs: `accounts-ending-balance-by-category`.

feeds: `none yet`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
