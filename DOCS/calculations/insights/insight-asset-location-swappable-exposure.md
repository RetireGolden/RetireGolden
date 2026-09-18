## Claim

Kind: model. `insights/detectors/assetLocation.ts#assetLocation.screen` publishes the nominal swappable exposure attached to the unique best beneficial bounded asset-location candidate among plans using static allocation on multiple accounts, where beneficial means a positive exact-ledger ending-estate delta.

## Justification

The model holds the household asset mix constant and changes account wrappers, then uses the candidate evaluator's ending-estate delta to select the preferred positive candidate; its published exposure is the selected candidate's metadata, not the estate benefit itself. It is a screening choice, not a claim that asset location always helps; this worksheet's domain requires a unique largest positive delta so the extract's unstated tie behavior is irrelevant.

## Inputs

| Candidate | Swappable exposure | Ending after-tax estate delta | Unit |
|---|---:|---:|---|
| A | 80,000 | 4,000 | nominal dollars |
| B | 120,000 | 3,000 | nominal dollars |
| C | 150,000 | -1,000 | nominal dollars |

## Arithmetic

Beneficial candidates are A and B because their deltas exceed zero. `max($4,000,$3,000)=$4,000`, so A is selected. Its published swappable exposure is `$80,000`.

## Expected

Swappable exposure is exactly `$80,000.00`, with exact-cent tolerance because selection copies the chosen candidate's supplied dollar metadata.

## Wrong readings

- Selecting the largest exposure regardless of benefit gives `$150,000.00` from harmful candidate C.
- Publishing the selected candidate's estate delta instead of its exposure gives `$4,000.00`.

## Family

outputs: `insight-asset-location-swappable-exposure`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
