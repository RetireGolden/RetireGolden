## Claim

Kind: formula. `ladder/fedInvest.ts#nearestTipsForYear` selects the TIPS row whose maturity calendar year is nearest the requested year only when that nearest maturity is within one year of the target (`|maturityYear - targetYear| <= 1`). It returns `null` when every candidate is more than one year away, including for an empty list. The contract statement does not define a tie rule, so this worksheet treats ties as undefined and chooses inputs that avoid them.

## Justification

The natural distance is absolute calendar-year difference `|maturityYear - targetYear|`, matching the extract's stated "nearest ... year" convention. The orchestrator's contract statement limits eligible results to distance zero or one. This is a reference-row match, not CUSIP-level ladder optimization.

## Inputs

All three cases use target year 2033.

| Case | Candidate maturity years | Distances from 2033 | Purpose |
|---|---|---|---|
| A | 2032, 2036 | 1, 3 years | One candidate is within the window. |
| B | 2030, 2035 | 3, 2 years | No candidate is within the window. |
| C | 2033, 2034 | 0, 1 years | Two candidates are within the window, at unequal distances. |

## Arithmetic

- Case A: `|2032 - 2033| = 1` and `|2036 - 2033| = 3`. The nearest maturity is 2032, and distance 1 is within the window.
- Case B: `|2030 - 2033| = 3` and `|2035 - 2033| = 2`. The nearest maturity is 2035, but distance 2 is outside the window.
- Case C: `|2033 - 2033| = 0` and `|2034 - 2033| = 1`. Both maturities are within the window, and 2033 is nearer because 0 years is less than 1 year.

## Expected

- Case A: select the 2032 record, exact identity.
- Case B: return `null`.
- Case C: select the 2033 record, exact identity.

## Wrong readings

- Applying no window selects the 2035 record in Case B merely because it is nearer than 2030; the contract requires `null` because both candidates are more than one year away.
- Applying a two-year window selects the 2035 record in Case B; the contract's window is one year, not two.
- Selecting only maturities before the target chooses 2030 in Case B instead of returning `null`.
- Comparing full ISO strings lexically to `2033` rather than comparing maturity calendar-year distance does not implement the stated rule.

## Family

none yet - FedInvest matching is an opt-in quote reference.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-14, from the signatures-and-comments extract and the orchestrator's contract statement for the one-year window, without executing the engine or reading any implementation body. Reviewed by: unreviewed.

Revision note: The first derivation omitted the one-year window because the engine's doc comment does not state it. The engine's doc comment should be updated to state the window explicitly.
