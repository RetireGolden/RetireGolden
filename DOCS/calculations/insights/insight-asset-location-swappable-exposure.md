## Claim

Kind: model. `insights/detectors/assetLocation.ts#assetLocation.screen` publishes the nominal swappable exposure attached to the candidate whose id is `asset-location-bonds-to-traditional` when that candidate exists, otherwise to the first candidate in generator order; missing `metadata.swappedDollars` is published as zero.

## Justification

The screen never prices candidates. Its preferred-id/first-candidate rule selects metadata supplied by the generator, independent of exposure size and of any exact-ledger ending-estate deltas that a later evaluation might compute. It is a screening choice, not a claim that asset location always helps.

## Inputs

Preferred-id-present case, in generator order:

| Candidate id | Swappable exposure | Ending after-tax estate delta (ignored input) | Unit |
|---|---:|---:|---|
| asset-location-stocks-to-roth | 80,000 | 10,000 | nominal dollars |
| asset-location-bonds-to-traditional | 120,000 | -2,000 | nominal dollars |
| asset-location-stocks-to-traditional | 150,000 | 20,000 | nominal dollars |

Preferred-id-absent case, in generator order:

| Candidate id | Swappable exposure | Ending after-tax estate delta (ignored input) | Unit |
|---|---:|---:|---|
| asset-location-bonds-to-roth | 70,000 | -1,000 | nominal dollars |
| asset-location-stocks-to-traditional | 200,000 | 30,000 | nominal dollars |
| asset-location-stocks-to-roth | 100,000 | 5,000 | nominal dollars |

## Arithmetic

In the first list, `asset-location-bonds-to-traditional` is present, so the screen publishes its `$120,000` exposure even though another candidate has both the largest exposure and the largest positive delta. In the second list, the preferred id is absent, so the screen publishes the first candidate's `$70,000` exposure even though the second candidate has the larger exposure and delta. No delta participates in either selection.

## Expected

With the preferred id present, swappable exposure is exactly `$120,000.00`. With the preferred id absent, swappable exposure is exactly `$70,000.00`. Both use exact-cent tolerance because selection copies the chosen candidate's supplied dollar metadata.

## Wrong readings

- Selecting the largest `swappedDollars` gives `$150,000.00` in the first case and `$200,000.00` in the second.
- Selecting the largest-positive-delta candidate, which is `evaluate()`'s rule rather than `screen()`'s rule, gives `$150,000.00` in the first case and `$200,000.00` in the second.
- Selecting the last candidate gives `$150,000.00` in the first case and `$100,000.00` in the second.

## Family

outputs: `insight-asset-location-swappable-exposure`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. The pull-request review found and prompted correction of the screen's candidate-selection rule from evaluated benefit to preferred id or first generator candidate. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory (first review and the addendum for the revision).
