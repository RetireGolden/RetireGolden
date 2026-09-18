## Claim

Kind: composition. `decisions/swrComparator.ts#compareSwrRules` publishes `ProjectionResult.endYear`, the final calendar year actually used by that safe-withdrawal-rule ledger run, without treating an earlier depletion year as the endpoint.

## Justification

The exact identity is `SwrRuleResult.endYear=result.endYear`; the comparator's comment says the rule is priced through the same deterministic ledger, and the scenario type separately warns that the simulation horizon is not depletion. The domain is any completed rule run.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Projection start year | 2026 | calendar year |
| Projection end year | 2055 | calendar year |
| Depletion year (discriminator only) | 2041 | calendar year |

## Arithmetic

`SwrRuleResult.endYear = 2055`.

## Expected

End year is exactly integer `2055`.

## Wrong readings

- Substituting the depletion year produces `2041`.
- Counting a 30-year inclusive horizon from 2026 as `2026+30=2056` produces `2056` instead of selecting the ledger endpoint.

## Family

outputs: `swr-rule-result-end-year`.

feeds: none.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: unreviewed.
