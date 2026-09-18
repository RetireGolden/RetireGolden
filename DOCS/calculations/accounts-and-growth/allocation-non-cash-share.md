## Claim

Kind: formula. `allocation/assetClasses.ts#nonCashWeight` returns the sum of all normalized asset-class weights except cash, the fraction subject to the single-factor market shock.

## Justification

With normalized weights, noncash share is equivalently `1-w_cash`. Domain: finite nonnegative normalized weights in the documented class order.

## Inputs

| US | International | Bonds | Cash | Unit |
|---:|---:|---:|---:|---|
| 0.5 | 0.1 | 0.3 | 0.1 | fraction |

## Arithmetic

`0.5+0.1+0.3=0.9`, also `1-0.1=0.9`.

## Expected

Noncash weight `0.9`, absolute tolerance `1e-12`.

## Wrong readings

- Treating bonds as cash gives `0.6`.
- Returning the cash share gives `0.1`.

## Family

`accounts-balance-per-account-annual`, `accounts-investable-total-annual`, `monte-carlo-success-rate`, `monte-carlo-investable-fan-percentiles`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18.md in this directory.

Status (orchestrator, 2026-09-18): no catalog record. The pinned helper has no production caller (the Monte Carlo class-shock models hold cash unshocked per class and the single-return shock skips cash by account type), so a record would have to name a family it does not feed. The worksheet stays on file pending decision D-DEAD-EXPORT in the plan's decision backlog.
