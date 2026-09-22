## Claim

Kind: formula. `strategies/inheritedIra.ts#inheritedRequirementForYear`, with `#beneficiaryFixedDivisor`, `#ownerFixedDivisor`, `#annualEvidence`, and `#finalSweepEvidence`, publishes the annual inherited-account requirement from the prior-December-31 balance. A beneficiary fixed Single Life Table divisor declines by exactly one per later calendar year. For a traditional account inherited on or after the owner's required beginning date under the eligible-designated-beneficiary life-expectancy regime, the greater of the beneficiary's fixed divisor and the owner's fixed divisor governs: the longer life expectancy produces the smaller quotient. A no-annual-requirement window publishes 0, and the final year requires the full prior-year-end balance, reconciled to the live balance at execution.

## Justification

For an annual arm with prior-year-end balance \(B\) and positive divisor \(d\), the convention implies \(B/d\). A fixed beneficiary divisor is read once at the beneficiary's age in the year after death and then reduced by one each later year. The post-RBD comparison is between divisors, not amounts: `max(beneficiary divisor, owner divisor)` supplies the divisor and therefore `min(B / beneficiary divisor, B / owner divisor)` supplies the required amount. The owner's fixed divisor starts with the Single Life Table entry at the owner's age in the death year and is reduced for elapsed years; an owner aged 86 in the death year has table entry 7.6, yielding 6.6 in the first year after the death year (death year + 1). The 2026 pack supplies 14.8 at age 75; the next fixed beneficiary divisor is therefore 13.8, not the age-76 table entry 14.1.

## Inputs

| Case | Year | Prior-year-end balance | Beneficiary divisor | Owner death-year age and table entry | Owner divisor | Requirement state | Unit |
|---|---:|---:|---:|---|---:|---|---|
| Fixed beneficiary, first year (age 75 lookup) | 2027 | 148,000 | 14.8 | not applicable | not applicable | annual RMD | dollars / years |
| Fixed beneficiary, next year | 2028 | 148,000 | 13.8 | not applicable | not applicable | annual RMD | dollars / years |
| Post-RBD, beneficiary divisor greater | first year after the death year (death year + 1) | 148,000 | 14.8 | age 86: 7.6 | 6.6 | annual RMD | dollars / years |
| Post-RBD, owner divisor greater | first year after the death year (death year + 1) | 148,000 | 5.7 | age 86: 7.6 | 6.6 | annual RMD | dollars / years |
| Pre-RBD ten-year window | 2027 | 148,000 | not applicable | not applicable | not applicable | none | dollars |
| Final-sweep year | 2036 | 83,000 | not applicable | not applicable | not applicable | final sweep | dollars |

The 14.8 divisor is the age-75 entry in `params/data/year2026.ts#year2026.rmd.singleLifeTable`; 13.8 is the required fixed-minus-one continuation. The owner's 7.6 death-year entry is the table value at age 86, and 6.6 is that fixed arm after its one-point reduction. The second post-RBD case uses 5.7, another Single Life Table value, to discriminate the owner-greater branch.

## Arithmetic

- 2027 beneficiary arm: `$148,000 / 14.8 = $10,000`.
- 2028 beneficiary arm: `$148,000 / (14.8 - 1) = $148,000 / 13.8 = $10,724.637681...`.
- Post-RBD, beneficiary divisor greater: beneficiary amount `$148,000 / 14.8 = $10,000`; owner amount `$148,000 / 6.6 = $22,424.242424...`; divisor `max(14.8, 6.6) = 14.8`, so the beneficiary arm wins with the smaller amount, `$10,000`.
- Post-RBD, owner divisor greater: beneficiary amount `$148,000 / 5.7 = $25,964.912280...`; owner amount `$148,000 / 6.6 = $22,424.242424...`; divisor `max(5.7, 6.6) = 6.6`, so the owner arm wins with the smaller amount, `$22,424.242424...`.
- No-annual-requirement window: `$0`.
- Final sweep evidence: the full prior-year-end balance, `$83,000`.

## Expected

Published required amounts: 2027 beneficiary arm `$10,000`; 2028 beneficiary arm `$10,724.637681...`; post-RBD beneficiary-greater-divisor case `$10,000`; post-RBD owner-greater-divisor case `$22,424.242424...`; no-annual-requirement window `$0`; final-sweep year `$83,000`. Fixture tolerance: absolute `$0.005` for all quotient-derived amounts because division is computed in binary floating point, including quotients that are mathematically whole-dollar `$10,000`; exact for the selected integer `$0` and `$83,000` results.

## Wrong readings

- Using a current live balance of `$120,000` instead of the stated `$148,000` prior-year-end balance gives `$120,000 / 14.8 = $8,108.108108...`, not `$10,000`.
- Re-reading the beneficiary table at current age 76 gives divisor `14.1` and `$148,000 / 14.1 = $10,496.453901...`, instead of decrementing the fixed 14.8 divisor to 13.8 and obtaining `$10,724.637681...`.
- Re-reading the owner's table at current age 88 gives `6.6` directly and then subtracting for elapsed years would double-advance the fixed arm; the owner arm starts from the death-year age-86 entry `7.6` and declines from that fixed entry.
- Selecting the greater amount in the beneficiary-greater-divisor case chooses the owner quotient `$22,424.242424...`; the rule selects the greater divisor 14.8 and the smaller beneficiary quotient `$10,000`.
- Choosing an arm by amount in the owner-greater-divisor case would choose the beneficiary quotient `$25,964.912280...`; the comparison is between divisors, so owner divisor 6.6 wins and publishes `$22,424.242424...`.
- Applying an annual quotient during the no-annual window gives `$10,000`; the requirement is `$0` until the final sweep.

## Family

outputs: `inherited-distribution-required-annual`.

feeds: `inherited-distribution-required-executed-annual`; `tax-penalties-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract (with the 2026-09-18 doc-comment completion), without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory (the re-check section named "Re-check, 2026-09-18 (three worksheets after the slice-eleven comment completion)") (approved with a note on the post-RBD row label, corrected by the orchestrator the same day).

Revision note: The first derivation selected the greater required amount and used an impossible owner divisor of 10.8; the implementation's fixture found those errors. This revision selects the greater fixed divisor, uses the age-86 Single Life Table entry of 7.6 to derive 6.6, and exercises both winning arms. Label corrected by the orchestrator on 2026-09-18 after the re-check: the two post-RBD rows sit in the first year after the death year, where the owner arm is already the entry minus one, as the extract states; the numbers were unchanged.
