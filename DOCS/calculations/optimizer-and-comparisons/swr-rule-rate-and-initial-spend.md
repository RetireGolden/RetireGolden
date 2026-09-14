## Claim

Kind: model. `decisions/swrComparator.ts#compareSwrRules` assigns Bengen `4.7%`, Morningstar `3.9%`, or ERN `1.75%+0.5(100/CAPE)` and multiplies that percent by starting investable dollars to set constant-real initial annual spending before a same-plan ledger comparison.

## Justification

The calculation faithfully parameterizes published rules of thumb; it does not establish that any rule is safe for this household. CAPE must be positive and starting investable balance nonnegative.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Starting investable | 1,000,000 | today's dollars |
| CAPE | 25 | ratio |

## Arithmetic

Bengen spend `=1,000,000(0.047)=$47,000`. Morningstar `=$39,000`. ERN rate `=1.75+0.5(4)=3.75%`; spend `=$37,500`.

## Expected

Rates `4.7%,3.9%,3.75%` and spends `$47,000,$39,000,$37,500`, absolute tolerance `1e-12` percentage points and `1e-8` dollars.

## Wrong readings

- Omitting the ERN half-weight gives `5.75%` and `$57,500`.
- Multiplying by 3.75 rather than 0.0375 gives `$3,750,000`.

## Family

`swr-rule-result-initial-rate-pct`, `swr-rule-result-initial-annual-spend`, `swr-rule-result-depletion-year`, `swr-rule-result-end-year`, `swr-rule-result-ending-after-tax-estate`, `swr-rule-result-lifetime-taxes-and-penalties`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
