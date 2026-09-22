## Claim

Kind: composition. `projection/internal/types/result.ts#YearResult.qcd`, together with `projection/internal/annualLegacyQcdGiftPlan.ts#annualLegacyQcdGiftPlan` and `projection/internal/annualLegacyQcdOwnerCharacterPlan.ts#annualLegacyQcdOwnerCharacterPlan`, publishes the gross physical gift. Character is allocated by first setting `qualified = min(gift, aggregate includible IRA amount)`, then charging the non-qualified remainder against the from-RMD portion first: `qualifiedFromRmd = fromRmd - min(fromRmd, gift - qualified)`. The income offset is `min(qualifiedFromRmd, qualified - the §408(d)(8)(A) second-sentence offset)`; any part of the §219 offset not absorbed by the from-RMD qualified slice, plus non-qualified dollars beyond the RMD, is non-qualified ordinary income. `rmd` remains gross.

## Justification

The corrected `YearResult.qcd` comment makes the gross gift, capped by aggregate includible IRA amount, the qualified slice. It then expressly charges the non-qualified remainder against the from-RMD portion before determining the qualified-from-RMD slice. Only that qualified-from-RMD slice can supply the income offset. Any §219 offset that this slice does not absorb, and any non-qualified gift beyond the RMD, is ordinary income; the gross physical gift and gross RMD publications do not shrink.

Primary sources for the ceiling: IRC §408(d)(8)(B), last sentence ("A distribution shall be treated as a qualified charitable distribution only to the extent that the distribution would be includible in gross income without regard to subparagraph (A)"), and §408(d)(8)(D), which measures that extent as if all of the owner's IRAs were one contract distributed in full during the year, so the ceiling is the aggregate includible amount rather than the taxable fraction of the RMD; the §219 reduction is the second sentence of §408(d)(8)(A). The allocation of the non-qualified remainder between the from-RMD and beyond-RMD portions has no statutory text and is an engine convention. Either order gives the same total ordinary inclusion, `$25,000` on these inputs (`50,000 − 35,000 + 10,000` qualified-first, `50,000 − 30,000 + 5,000` non-qualified-first), so the total that feeds tax and MAGI does not depend on it; only the split between the two published character rows does.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Gross gift | 60,000 | dollars/year |
| Gift from RMD | 50,000 | dollars/year |
| Gross RMD | 50,000 | dollars/year |
| Aggregate includible IRA amount | 40,000 | dollars/year |
| Remaining §408(d)(8)(A) offset | 5,000 | dollars/year |

These caps and character rules are stated in the `YearResult.qcd` and owner-character comments.

## Arithmetic

Qualified slice: `min(60,000, 40,000) = $40,000`.

Non-qualified remainder: `60,000 - 40,000 = $20,000`.

Charge the non-qualified remainder against the from-RMD portion first: `min(50,000, 20,000) = $20,000`.

Qualified from RMD: `50,000 - 20,000 = $30,000`.

Qualified amount after the §408(d)(8)(A) second-sentence offset: `40,000 - 5,000 = $35,000`; income offset: `min(30,000, 35,000) = $30,000`.

The from-RMD qualified slice absorbs none of the `$5,000` §219 offset because `30,000 - 30,000 = $0` of that slice remains available to absorb it. Non-qualified dollars beyond the RMD are `$0`, because all `$20,000` of the non-qualified remainder was charged within the `$50,000` from-RMD portion. The non-qualified ordinary-income delta is therefore `5,000 + 0 = $5,000`.

Gross RMD remains `$50,000`; ordinary inclusion is `50,000 - 30,000 + 5,000 = $25,000`.

## Expected

Exact derived publications/character: `qcd = $60,000`, `rmd = $50,000`, qualified gift `$40,000`, total non-qualified gift `$20,000`, `qualifiedFromRmd = $30,000`, `qcdIncomeOffset = $30,000`, unabsorbed §219/non-qualified ordinary-income delta `$5,000`, non-qualified dollars beyond the RMD `$0`, and resulting ordinary inclusion `$25,000`. Fixture tolerance: exact, because every expected value is a whole-dollar integer produced only by integer minima, addition, and subtraction.

What the fixture asserts: the character planner's published rows (the qualified slice recovered from `qualifiedFromRmd` and `nonQualifiedBeyondRmd`, the income offset, the non-qualified ordinary-income delta, the resulting inclusion, the provable-history flag and the ledger write). The `qcd = $60,000` and `rmd = $50,000` publications are written by the gift planner and the RMD phase, which this fixture does not run, so they are contract statements here, not executed evidence; the third wrong reading below is likewise not executed as a mutation.

## Wrong readings

- Allocating the qualified slice first gives a `$35,000` offset and a `$10,000` beyond-RMD ordinary-income delta, contrary to the required non-qualified-first charge against the from-RMD portion.
- Forgetting the §219 offset gives the correct `$30,000` income offset but a `$0` non-qualified ordinary-income delta instead of `$5,000`.
- Reducing `rmd` by the `$40,000` portion of the gift taken against it publishes `rmd = $10,000`, contradicting the gross-RMD rule.

## Family

outputs: `qcd-annual`.

feeds: `tax-total-annual`; `magi-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 qcd doc-comment correction) and the orchestrator's contract statement, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-four.md in this directory (the first review, and the re-check section after the allocation-order correction).

Revision note: The first derivation followed a comment that put the qualified slice first; the implementation's fixture found the order. Revision 2026-09-22 (pull-request review of #728): the Justification cites the statutory ceiling (§408(d)(8)(B) and (D)) and states that the allocation order is an engine convention under which the total inclusion is invariant; the Expected section says which publications the fixture asserts. No value changed.
