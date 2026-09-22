## Claim

Kind: composition. `projection/internal/types/cashFlow.ts#YearCashFlowTaxCharacter.amountPlanDollars (on source, transfer and standalone taxCharacterMetadata lines)` is a nominal tax-character annotation outside every cash conservation identity and every transfer debit/credit total. Attaching character to a physical line does not create a second cash source or use.

## Justification

The cash-flow type comments call tax character non-cash metadata. A capital-gain annotation may be negative; other character amounts are nonnegative.

## Inputs

| Reporting item | Value | Unit |
|---|---:|---|
| Physical taxable-account withdrawal source | 100,000 | nominal Plan dollars |
| Attached capital-gain character | 30,000 | nominal Plan dollars |
| Other physical sources | 20,000 | nominal Plan dollars |

## Arithmetic

Cash source total `= $100,000 + $20,000 = $120,000`. The `$30,000` capital-gain character annotates the `$100,000` physical source and contributes `$0` to cash totals, so the source total remains `$120,000`.

## Expected

Exact values: `taxCharacter.amountPlanDollars = $30,000` and cash `sourceTotalPlanDollars = $120,000`. Fixture tolerance: absolute `$0.005` for dollar figures, because reporting amounts are binary floating point.

## Wrong readings

- Adding character as cash produces a false `$150,000` source total.
- Replacing the gross physical source with its gain character produces `$50,000` total sources.
- Requiring all tax-character amounts to be nonnegative would reject a valid negative capital-gain amount representing a realized loss.

## Family

outputs: `cash-flow-tax-character-amount`.

feeds: `tax-total-annual`.

## Provenance

Derived by: codex (gpt-5.6-sol), 2026-09-18, from the signatures-and-comments extract only, without executing the engine or reading any implementation body. Reviewed by: cursor (composer-2.5), 2026-09-18, by independent recomputation without executing the engine; see REVIEW-2026-09-18-round-eight.md in this directory.
